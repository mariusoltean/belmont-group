// Belmont Group admin UI (no framework). Talks to /admin/api/*.

const $ = (sel, root = document) => root.querySelector(sel);
const LOCALES = ['ro', 'en', 'de'];
const SLOT_LABELS = {
  hero: 'Prima secțiune (sus)',
  angus: 'Rasa Angus',
  romania: 'România',
  transylvania: 'Transilvania',
};
const SECTION_LABELS = {
  meta: 'Titlul paginii și descrierea pentru Google',
  header: 'Antet și meniu',
  hero: 'Prima secțiune',
  about: 'Cine suntem',
  philosophy: 'Filosofie',
  products: 'Produse',
  angus: 'Rasa Angus',
  team: 'Echipa',
  region: 'România și Transilvania',
  gallery: 'Galerie (texte)',
  contact: 'Contact și formular',
  footer: 'Subsol',
};
const KEY_LABELS = {
  kicker: 'Supratitlu', title: 'Titlu', lead: 'Citat', copy: 'Text', intro: 'Introducere', quote: 'Citat',
  p1: 'Paragraful 1', p2: 'Paragraful 2', p3: 'Paragraful 3', note: 'Notă', cta: 'Buton',
  ctaPrimary: 'Buton principal', ctaSecondary: 'Link secundar', imageAlt: 'Descrierea fotografiei',
  text: 'Text', name: 'Nume', role: 'Funcție', area: 'Zonă', email: 'E-mail', phone: 'Telefon',
  description: 'Descriere', facts: 'Repere', items: 'Produse', traits: 'Caracteristici', benefits: 'Avantaje',
  members: 'Membri', nav: 'Meniu', errors: 'Mesaje de eroare', romania: 'România', transylvania: 'Transilvania',
};

const state = {
  i18n: null,
  draft: null,
  gallery: [],
  images: null,
  locale: 'ro',
  dirty: { texts: false, gallery: false, images: false },
};

// ---------- API ----------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/admin/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? { 'X-Requested-With': 'belmont-admin' } : { 'Content-Type': 'application/json', 'X-Requested-With': 'belmont-admin' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') {
    showLogin();
    throw new Error('Sesiunea a expirat. Intrați din nou în cont.');
  }
  if (!res.ok) throw new Error(data.error || `Eroare ${res.status}`);
  return data;
}

function notify(message, kind = 'ok') {
  const el = $('#notice');
  el.textContent = message;
  el.className = `notice notice-${kind}`;
  el.hidden = false;
  clearTimeout(notify.timer);
  if (kind === 'ok') notify.timer = setTimeout(() => (el.hidden = true), 5000);
}

const media = (file) => `/admin/media/${file}`;
const thumbOf = (file) => file.replace(/\/([^/]+)$/, '/w800/$1');

// ---------- Auth ----------
function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-email').focus();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('login', { method: 'POST', body: { email: $('#login-email').value, password: $('#login-password').value } });
    $('#login-password').value = '';
    await start();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  if (anyDirty() && !confirm('Aveți modificări nesalvate. Ieșiți oricum?')) return;
  await api('logout', { method: 'POST', body: {} }).catch(() => {});
  resetDirty();
  showLogin();
});

// ---------- Publish status ----------
let statusTimer;
function renderStatus(status) {
  const chip = $('#publish-state');
  const when = status.publishedAt ? new Date(status.publishedAt).toLocaleString('ro-RO') : '—';
  if (status.state === 'building') {
    chip.textContent = 'Se publică…';
    chip.className = 'chip chip-busy';
  } else if (status.state === 'failed') {
    chip.textContent = 'Publicarea a eșuat';
    chip.className = 'chip chip-error';
    chip.title = status.lastError || '';
  } else if (status.unpublished) {
    chip.textContent = 'Modificări nepublicate';
    chip.className = 'chip chip-warn';
  } else {
    chip.textContent = `Publicat · ${when}`;
    chip.className = 'chip chip-ok';
  }
  $('#publish').disabled = status.state === 'building';
  clearTimeout(statusTimer);
  if (status.state === 'building') statusTimer = setTimeout(pollStatus, 1500);
}

async function pollStatus() {
  const status = await api('status').catch(() => null);
  if (!status) return;
  const wasBuilding = $('#publish-state').classList.contains('chip-busy');
  renderStatus(status);
  if (wasBuilding && status.state === 'idle') notify('Site-ul a fost publicat.');
  if (wasBuilding && status.state === 'failed') notify(`Publicarea a eșuat: ${status.lastError}`, 'error');
}

$('#publish').addEventListener('click', async () => {
  if (anyDirty() && !confirm('Unele modificări nu sunt salvate și nu vor fi publicate. Continuați?')) return;
  try {
    renderStatus(await api('publish', { method: 'POST', body: {} }));
    pollStatus();
  } catch (err) {
    notify(err.message, 'error');
  }
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    for (const name of ['texts', 'gallery', 'images']) $(`#tab-${name}`).hidden = name !== tab.dataset.tab;
  }),
);

function anyDirty() {
  return Object.values(state.dirty).some(Boolean);
}
function resetDirty() {
  state.dirty = { texts: false, gallery: false, images: false };
}
function setDirty(key, value = true) {
  state.dirty[key] = value;
  $(`#save-${key}`).disabled = !value;
}
window.addEventListener('beforeunload', (e) => {
  if (anyDirty()) e.preventDefault();
});

// ---------- Texts ----------
document.querySelectorAll('.seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    if (btn.dataset.locale === state.locale) return;
    if (state.dirty.texts && !confirm('Textele modificate nu sunt salvate. Schimbați limba oricum?')) return;
    state.locale = btn.dataset.locale;
    document.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    state.draft = structuredClone(state.i18n[state.locale]);
    setDirty('texts', false);
    renderTexts();
  }),
);

function label(path) {
  return path
    .slice(1)
    .map((p) => (typeof p === 'number' ? `${p + 1}` : KEY_LABELS[p] || p))
    .join(' · ');
}

function getAt(obj, path) {
  return path.reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setAt(obj, path, value) {
  getAt(obj, path.slice(0, -1))[path.at(-1)] = value;
}

function leaves(node, path = [], out = []) {
  if (typeof node === 'string') out.push(path);
  else if (Array.isArray(node)) node.forEach((v, i) => leaves(v, [...path, i], out));
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) leaves(node[k], [...path, k], out);
  return out;
}

let fieldId = 0;
function renderTexts() {
  const root = $('#texts');
  root.replaceChildren();
  const reference = state.i18n.ro;
  const order = [...Object.keys(SECTION_LABELS), ...Object.keys(state.draft)];
  for (const section of [...new Set(order)].filter((k) => k in state.draft)) {
    const details = document.createElement('details');
    details.className = 'section';
    const summary = document.createElement('summary');
    summary.textContent = SECTION_LABELS[section] || section;
    details.append(summary);
    const body = document.createElement('div');
    body.className = 'fields';
    for (const path of leaves(state.draft[section], [section])) {
      const value = getAt(state.draft, path);
      const id = `f${++fieldId}`;
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lab = document.createElement('label');
      lab.htmlFor = id;
      lab.textContent = label(path) || section;
      const long = value.length > 70 || (getAt(reference, path) || '').length > 70;
      const input = document.createElement(long ? 'textarea' : 'input');
      input.id = id;
      input.value = value;
      if (long) input.rows = Math.min(8, Math.ceil(value.length / 90) + 1);
      input.addEventListener('input', () => {
        setAt(state.draft, path, input.value);
        setDirty('texts');
      });
      wrap.append(lab, input);
      if (state.locale !== 'ro') {
        const ref = document.createElement('p');
        ref.className = 'ref';
        ref.textContent = `RO: ${getAt(reference, path)}`;
        wrap.append(ref);
      }
      body.append(wrap);
    }
    details.append(body);
    root.append(details);
  }
}

$('#save-texts').addEventListener('click', async () => {
  try {
    const res = await api(`i18n/${state.locale}`, { method: 'PUT', body: state.draft });
    state.i18n[state.locale] = structuredClone(state.draft);
    setDirty('texts', false);
    renderStatus(res.status);
    notify('Textele au fost salvate. Apăsați „Publică site-ul” ca să apară pe site.');
  } catch (err) {
    notify(err.message, 'error');
  }
});

// ---------- Image upload (shrunk on the server) ----------
/** Formats the server reads directly; anything else (e.g. iPhone HEIC) is converted here first. */
const SERVER_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff', 'image/gif'];
const MAX_UPLOAD = 25 * 1024 * 1024;

/** Re-encodes a file the server can't read (or that is over 25 MB) as a high-quality JPEG. */
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`${file.name}: formatul nu poate fi citit (folosiți JPG, PNG sau WebP).`);
  });
  const scale = Math.min(1, 4000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
}

/** Uploads a picked photo; the server makes the 2000px + 800px JPEGs (and drops EXIF/GPS). */
async function uploadFile(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: nu este o imagine.`);
  const body = SERVER_FORMATS.includes(file.type) && file.size <= MAX_UPLOAD ? file : await toJpeg(file);
  if (body.size > MAX_UPLOAD) throw new Error(`${file.name}: imaginea este prea mare (maximum 25 MB).`);
  const res = await fetch('/admin/api/uploads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': body.type || 'image/jpeg', 'X-Requested-With': 'belmont-admin' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showLogin();
    throw new Error('Sesiunea a expirat. Intrați din nou în cont.');
  }
  if (res.status === 413) throw new Error(`${file.name}: imaginea este prea mare (maximum 25 MB).`);
  if (!res.ok) throw new Error(`${file.name}: ${data.error || `Eroare ${res.status}`}`);
  return data;
}

function pickFile(multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}

// ---------- Gallery ----------
function renderGallery() {
  const list = $('#gallery');
  list.replaceChildren();
  $('#gallery-count').textContent = `${state.gallery.length} fotografii`;
  state.gallery.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'g-item';
    const img = document.createElement('img');
    img.src = media(thumbOf(entry.file));
    img.alt = '';
    img.loading = 'lazy';
    const fields = document.createElement('div');
    fields.className = 'g-fields';
    const num = document.createElement('span');
    num.className = 'g-num';
    num.textContent = `#${index + 1}`;
    fields.append(num);
    for (const l of LOCALES) {
      const id = `g${index}-${l}`;
      const lab = document.createElement('label');
      lab.htmlFor = id;
      lab.textContent = `Descriere ${l.toUpperCase()}${l === 'ro' ? ' *' : ''}`;
      const input = document.createElement('input');
      input.id = id;
      input.value = entry.caption[l] || '';
      input.maxLength = 300;
      input.addEventListener('input', () => {
        entry.caption[l] = input.value;
        setDirty('gallery');
      });
      fields.append(lab, input);
    }
    const actions = document.createElement('div');
    actions.className = 'g-actions';
    const button = (text, title, fn, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-small';
      b.textContent = text;
      b.title = title;
      b.setAttribute('aria-label', `${title} (#${index + 1})`);
      b.disabled = disabled;
      b.addEventListener('click', fn);
      actions.append(b);
    };
    button('↑', 'Mută mai sus', () => move(index, -1), index === 0);
    button('↓', 'Mută mai jos', () => move(index, 1), index === state.gallery.length - 1);
    button('Înlocuiește', 'Înlocuiește fotografia', () => replaceGallery(index));
    button('Șterge', 'Șterge fotografia', () => {
      if (!confirm('Ștergeți această fotografie din galerie?')) return;
      state.gallery.splice(index, 1);
      setDirty('gallery');
      renderGallery();
    });
    li.append(img, fields, actions);
    list.append(li);
  });
}

function move(index, delta) {
  const [item] = state.gallery.splice(index, 1);
  state.gallery.splice(index + delta, 0, item);
  setDirty('gallery');
  renderGallery();
}

async function replaceGallery(index) {
  const [file] = await pickFile();
  if (!file) return;
  try {
    notify('Se încarcă fotografia…', 'info');
    const image = await uploadFile(file);
    Object.assign(state.gallery[index], image);
    setDirty('gallery');
    renderGallery();
    notify('Fotografia a fost înlocuită. Salvați galeria.');
  } catch (err) {
    notify(err.message, 'error');
  }
}

$('#gallery-add').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  let added = 0;
  for (const [i, file] of files.entries()) {
    try {
      notify(`Se încarcă ${i + 1} din ${files.length}…`, 'info');
      const image = await uploadFile(file);
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      state.gallery.unshift({ ...image, caption: { ro: name, en: '', de: '' } });
      added++;
    } catch (err) {
      notify(err.message, 'error');
    }
  }
  if (added) {
    setDirty('gallery');
    renderGallery();
    notify(`${added} fotografii adăugate la începutul galeriei. Completați descrierile și salvați.`);
  }
});

$('#save-gallery').addEventListener('click', async () => {
  const missing = state.gallery.findIndex((g) => !g.caption.ro.trim());
  if (missing >= 0) {
    notify(`Fotografia #${missing + 1} nu are descriere în română.`, 'error');
    $(`#g${missing}-ro`)?.focus();
    return;
  }
  try {
    const res = await api('gallery', { method: 'PUT', body: state.gallery });
    state.gallery = res.gallery;
    setDirty('gallery', false);
    renderGallery();
    renderStatus(res.status);
    notify('Galeria a fost salvată. Apăsați „Publică site-ul” ca să apară pe site.');
  } catch (err) {
    notify(err.message, 'error');
  }
});

// ---------- Main photos ----------
function renderSlots() {
  const root = $('#slots');
  root.replaceChildren();
  for (const [slot, title] of Object.entries(SLOT_LABELS)) {
    const card = document.createElement('figure');
    card.className = 'slot';
    const img = document.createElement('img');
    img.src = media(thumbOf(state.images[slot].file));
    img.alt = '';
    const cap = document.createElement('figcaption');
    const h = document.createElement('strong');
    h.textContent = title;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-small';
    b.textContent = 'Înlocuiește';
    b.setAttribute('aria-label', `Înlocuiește fotografia: ${title}`);
    b.addEventListener('click', async () => {
      const [file] = await pickFile();
      if (!file) return;
      try {
        notify('Se încarcă fotografia…', 'info');
        state.images[slot] = await uploadFile(file);
        setDirty('images');
        renderSlots();
        notify('Fotografia a fost înlocuită. Salvați fotografiile.');
      } catch (err) {
        notify(err.message, 'error');
      }
    });
    cap.append(h, b);
    card.append(img, cap);
    root.append(card);
  }
}

$('#save-images').addEventListener('click', async () => {
  try {
    const res = await api('images', { method: 'PUT', body: state.images });
    state.images = res.images;
    setDirty('images', false);
    renderStatus(res.status);
    notify('Fotografiile au fost salvate. Apăsați „Publică site-ul” ca să apară pe site.');
  } catch (err) {
    notify(err.message, 'error');
  }
});

// ---------- Start ----------
async function start() {
  const data = await api('content');
  state.i18n = data.i18n;
  state.draft = structuredClone(data.i18n[state.locale]);
  state.gallery = data.gallery;
  state.images = data.images;
  resetDirty();
  ['texts', 'gallery', 'images'].forEach((k) => setDirty(k, false));
  $('#login').hidden = true;
  $('#app').hidden = false;
  renderTexts();
  renderGallery();
  renderSlots();
  renderStatus(data.status);
}

api('session')
  .then(start)
  .catch(() => showLogin());
