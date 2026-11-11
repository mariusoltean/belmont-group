# Kickoff prompt for Claude Code

Copy this folder into an empty project directory as `handoff/`, open Claude Code there, and paste:

---

Read `handoff/CLAUDE.md` in full, then every file in `handoff/design/`. They are the approved design and the build brief for the Belmont Group website.

Create a new Angular project in this directory (current stable Angular, standalone components, signals, SCSS, strict mode) and implement the site exactly as specified:

1. Copy `handoff/assets/images/` to `public/images/`, `handoff/i18n/` to `public/i18n/`, and `handoff/styles/_tokens.scss` into `src/styles/`. Copy `handoff/CLAUDE.md` to the project root as `CLAUDE.md` so it stays the project's standing instructions.
2. Follow the "Suggested build order" in the brief. Port one design file to one component; keep markup, copy and numeric style values identical. Take all text from the i18n JSON — do not retranslate, reword or invent content, and keep the marked placeholders as they are.
3. Build the shared pieces described in the brief: `I18nService` + `t` pipe (Romanian default, persisted choice), `ScrollProgressService`, `RevealDirective`.
4. After each step run `ng build` and the tests; fix failures before moving on.
5. When done, check the "Definition of done" list item by item and report which items you verified and how, and anything you could not verify.

Ask me before adding any dependency not named in the brief, before changing the design, and for any content marked as a placeholder.

---
