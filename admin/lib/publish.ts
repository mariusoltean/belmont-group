import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSitemap, type SitemapImage } from './sitemap.ts';

export interface PublishStatus {
  state: 'idle' | 'building' | 'failed';
  publishedAt: string | null;
  lastError: string | null;
  /** Content saved after the last successful publish. */
  unpublished: boolean;
}

/**
 * Rebuilds the prerendered site (`ng build`) with the current content into a new
 * release folder, then atomically repoints `<siteDir>/current` at it. nginx serves
 * `current`, so visitors never see a half-written site. One build at a time; a
 * publish requested during a build runs right after it.
 */
export class Publisher {
  private readonly appDir: string;
  private readonly siteDir: string;
  private readonly keepReleases: number;
  private state: PublishStatus['state'] = 'idle';
  private lastError: string | null = null;
  private pending = false;
  private savedAt = 0;
  private running: Promise<void> | null = null;

  constructor(appDir: string, siteDir: string, keepReleases = 3) {
    this.appDir = appDir;
    this.siteDir = siteDir;
    this.keepReleases = keepReleases;
    mkdirSync(join(siteDir, 'releases'), { recursive: true });
  }

  private stateFile(): string {
    return join(this.appDir, 'content', '.publish-state.json');
  }

  private readState(): { publishedAt: number; savedAt: number } {
    try {
      return JSON.parse(readFileSync(this.stateFile(), 'utf8'));
    } catch {
      return { publishedAt: 0, savedAt: 0 };
    }
  }

  private writeState(patch: Partial<{ publishedAt: number; savedAt: number }>): void {
    writeFileSync(this.stateFile(), JSON.stringify({ ...this.readState(), ...patch }) + '\n');
  }

  markSaved(): void {
    this.savedAt = Date.now();
    this.writeState({ savedAt: this.savedAt });
  }

  status(): PublishStatus {
    const s = this.readState();
    return {
      state: this.state,
      publishedAt: s.publishedAt ? new Date(s.publishedAt).toISOString() : null,
      lastError: this.lastError,
      unpublished: Math.max(s.savedAt, this.savedAt) > s.publishedAt,
    };
  }

  /** Starts a publish (or queues one). Resolves when the site is live or the build failed. */
  publish(): Promise<void> {
    if (this.running) {
      this.pending = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.pending) {
        this.pending = false;
        void this.publish();
      }
    });
    return this.running;
  }

  private async run(): Promise<void> {
    this.state = 'building';
    this.lastError = null;
    const startedAt = Date.now();
    const id = new Date(startedAt).toISOString().replace(/[-:.TZ]/g, '');
    const releaseDir = join(this.siteDir, 'releases', id);
    try {
      await this.build(releaseDir);
      const browserDir = join(releaseDir, 'browser');
      if (!existsSync(join(browserDir, 'index.html'))) throw new Error('build produced no index.html');
      this.writeSitemap(browserDir);
      this.dropUnusedUploads(browserDir);
      this.activate(join('releases', id, 'browser'));
      this.pruneReleases(id);
      this.writeState({ publishedAt: startedAt });
      this.state = 'idle';
    } catch (err) {
      this.state = 'failed';
      this.lastError = err instanceof Error ? err.message : String(err);
      rmSync(releaseDir, { recursive: true, force: true });
      throw err;
    }
  }

  private build(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['ng', 'build', '--output-path', outputPath], {
        cwd: this.appDir,
        env: { ...process.env, NG_CLI_ANALYTICS: 'false', CI: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let log = '';
      const keep = (chunk: Buffer) => (log = (log + chunk.toString()).slice(-4000));
      child.stdout.on('data', keep);
      child.stderr.on('data', keep);
      const timer = setTimeout(() => child.kill('SIGKILL'), 5 * 60 * 1000);
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`build failed (exit ${code}):\n${log.trim().split('\n').slice(-15).join('\n')}`));
      });
    });
  }

  private usedImages(): SitemapImage[] {
    const read = <T>(f: string) => JSON.parse(readFileSync(join(this.appDir, 'content', f), 'utf8')) as T;
    return [...Object.values(read<Record<string, SitemapImage>>('images.json')), ...read<SitemapImage[]>('gallery.json')];
  }

  private writeSitemap(browserDir: string): void {
    writeFileSync(join(browserDir, 'sitemap.xml'), buildSitemap(this.usedImages()));
  }

  /**
   * The build copies every file in content/uploads; drop the ones no page uses, so a photo
   * deleted in the admin is gone from the site (also by direct URL) on this publish. The files
   * themselves stay in content/ for a day (see ContentStore.removeUnusedUploads).
   */
  private dropUnusedUploads(browserDir: string): void {
    const used = new Set(this.usedImages().map((i) => i.file));
    for (const dir of ['uploads', 'uploads/w800']) {
      const abs = join(browserDir, dir);
      if (!existsSync(abs)) continue;
      for (const name of readdirSync(abs)) {
        if (name.endsWith('.jpg') && !used.has(`uploads/${name}`)) unlinkSync(join(abs, name));
      }
    }
  }

  /** Atomic switch: create a new symlink next to `current`, then rename it over. */
  private activate(target: string): void {
    const tmp = join(this.siteDir, `current.${process.pid}.tmp`);
    rmSync(tmp, { force: true });
    symlinkSync(target, tmp);
    renameSync(tmp, join(this.siteDir, 'current'));
  }

  private pruneReleases(currentId: string): void {
    const releases = readdirSync(join(this.siteDir, 'releases')).sort();
    const keep = new Set(releases.slice(-this.keepReleases).concat(currentId));
    for (const r of releases) {
      if (!keep.has(r)) rmSync(join(this.siteDir, 'releases', r), { recursive: true, force: true });
    }
  }
}
