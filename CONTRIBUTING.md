# Contributing to Gotcha!Mark

**Authors:** Luca Sambucci · Claude Opus 4.6

Thanks for your interest in contributing. This document covers everything you need to get the project running locally, understand the codebase, and submit changes.

---

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) ≥ 18
- [Tauri CLI v2](https://tauri.app/start/prerequisites/) and its platform dependencies

## Running in development mode

```bash
npm install
npm run tauri dev
```

## Building a release binary

```bash
npm run tauri build
```

---

## Project structure

```
src/                      Vanilla JS/HTML/CSS frontend
  main.js                 App logic, Tauri command calls
  i18n.js                 All UI strings and translations
  styles.css
  index.html
  pdf.min.mjs             PDF.js bundled locally (no CDN)
  pdf.worker.min.mjs      PDF.js worker bundled locally

src-tauri/
  src/
    lib.rs                Tauri commands, input validation
    registry.rs           SQLite watermark registry
    watermark.rs          Watermark embed/detect logic
  tauri.conf.json         App config, CSP, capabilities
  Cargo.toml
```

---

## Adding a new language

Two files must be updated together — they are intentionally kept in sync:

1. **`src/i18n.js`** — add a new locale object to the `TRANSLATIONS` map, and add the language code to the `LANGUAGES` array (this drives the language switcher in the UI).

2. **`src-tauri/src/lib.rs`** — add the same language code to the `SUPPORTED_LANGS` constant in `cmd_save_prefs`. This is the backend whitelist; the Rust layer will reject any unknown `lang` value even if the frontend sends it.

```rust
// src-tauri/src/lib.rs
const SUPPORTED_LANGS: &[&str] = &["en", "it", "fr"]; // ← add here
```

```js
// src/i18n.js
const LANGUAGES = ["en", "it", "fr"]; // ← and here
```

If you update one without the other, the language switcher will either silently fail (lang rejected by Rust) or crash on missing translation keys (lang missing from i18n.js).

---

## Security model

The app follows a defence-in-depth approach. Keep this in mind when modifying or adding commands:

- **Frontend validates first** — for fast failure and good UX, but is not trusted.
- **Rust validates independently** — all `#[tauri::command]` functions validate their inputs regardless of what the frontend sends. This is the authoritative layer.
- **Path validation** — source and output PDF paths are checked for absolute path, `.pdf` extension, and no `..` components. Use `validate_pdf_source_path()` for source paths.
- **Preferences** — `cmd_load_prefs` caps file size at 8 KB and falls back to defaults on parse failure. `cmd_save_prefs` whitelists `lang`, validates `font_color` as hex, and range-checks `font_size`.
- **SQL** — all queries use `params![]` parameterised binding. Never use string concatenation for queries.
- **CSP** — `tauri.conf.json` enforces `script-src 'self'`, blocking all external scripts and inline execution. Don't loosen this.
- **Error messages** — use `sanitizeError()` in the frontend before displaying any error string returned from Rust. This strips internal filesystem paths and Rust module names.

---

## Commit style

- Use conventional commit prefixes: `feat:`, `fix:`, `security:`, `docs:`, `refactor:`
- Keep the subject line under 72 characters
- Reference issues where relevant

## Licence

By contributing, you agree that your contributions will be licensed under the [GPL v3](./LICENSE).
