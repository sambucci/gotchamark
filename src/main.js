// ─── Gotcha!Mark frontend ─────────────────────────────────────────────────
// ES module — uses window.__TAURI__ globals (withGlobalTauri: true).
// PDF rendering uses PDF.js loaded dynamically from CDN.

import { LANGUAGES, setLang, getLang, t } from "./i18n.js";

// ── Tauri API accessors ────────────────────────────────────────────────────
const invoke      = (...a) => window.__TAURI__.core.invoke(...a);
const tauriDialog = ()    => window.__TAURI__.dialog;
const tauriFs     = ()    => window.__TAURI__.fs;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  pdfBytes:       null,
  pdfDoc:         null,
  currentPage:    1,
  totalPages:     0,
  posX:           0.05,
  posY:           0.95,
  markIdDraft:    "GM-········",
  markIdUserEdited: false,
  sourceFilePath: null,
  sourceStem:     null,
  sourceDir:      null,
  zoom:           1.0,   // zoom multiplier on top of fit-to-panel base scale
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dropZone           = $("drop-zone");
const dropLabel          = $("drop-label");
const dropFilename       = $("drop-filename");
const wmFields           = $("wm-fields");
const previewPlaceholder = $("preview-placeholder");
const previewContainer   = $("preview-container");
const pdfCanvas          = $("pdf-canvas");
const overlayCanvas      = $("overlay-canvas");
const pageIndicator      = $("page-indicator");
const btnPrev            = $("btn-prev-page");
const btnNext            = $("btn-next-page");
const fMarkId            = $("f-mark-id");
const contrastWarning    = $("contrast-warning");
const resultBanner       = $("result-banner");
const btnApply           = $("btn-apply");

const fRecipient = $("f-recipient");
const fDate      = $("f-date");
const fCustom    = $("f-custom");
const fNote      = $("f-note");
const fPrefix    = $("f-prefix");
const fColor     = $("f-color");
const fColorHex  = $("f-color-hex");
const fSize      = $("f-size");

const searchBox     = $("search-box");
const historyTbody  = $("history-tbody");
const historyEmpty  = $("history-empty");
const historyTable  = $("history-table");
const btnExportJson = $("btn-export-json");
const btnExportCsv  = $("btn-export-csv");
const btnRefresh    = $("btn-refresh");

// ── i18n — apply translations to the DOM ───────────────────────────────────
// Every element with data-i18n="key" gets its textContent replaced.
// Placeholder attributes are also updated where needed.
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  // Placeholder strings (inputs)
  if (fRecipient) fRecipient.placeholder = t("wm_recipient_ph");
  if (fCustom)    fCustom.placeholder    = t("wm_custom_ph");
  if (fNote)      fNote.placeholder      = t("wm_note_ph");
  if (fPrefix)    fPrefix.placeholder    = t("wm_prefix_ph");
  if (searchBox)  searchBox.placeholder  = t("hist_search_ph");
  // License body — set as textContent (not innerHTML) so no HTML injection risk,
  // and the <pre> white-space:pre-wrap handles all line breaks cleanly.
  const licenseText = $("license-text");
  if (licenseText) licenseText.textContent = t("license_body");
  // Apply button (may be mid-applying — don't clobber "Applying…")
  if (btnApply && !btnApply.disabled) btnApply.textContent = t("wm_apply");
  // Update active lang option highlighting
  document.querySelectorAll(".lang-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === getLang());
  });
}

// ── Language picker ─────────────────────────────────────────────────────────
const btnLang  = $("btn-lang");
const langMenu = $("lang-menu");

// Populate the menu from the LANGUAGES array — no hard-coding in HTML
LANGUAGES.forEach(({ code, label }) => {
  const btn = document.createElement("button");
  btn.className    = "lang-option";
  btn.dataset.lang = code;
  btn.textContent  = label;
  btn.addEventListener("click", () => {
    switchLang(code);
    langMenu.classList.add("hidden");
  });
  langMenu.appendChild(btn);
});

btnLang?.addEventListener("click", (e) => {
  e.stopPropagation();
  langMenu.classList.toggle("hidden");
});

// Close the menu when clicking elsewhere
document.addEventListener("click", () => langMenu.classList.add("hidden"));

function switchLang(code) {
  setLang(code);
  applyTranslations();
  schedulePrefs();   // persist the new language choice
}

// ── Navigation ─────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => {
    // Language button has no data-view — leave it alone
    if (b.dataset.view) b.classList.toggle("active", b.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((v) => {
    const isTarget = v.id === "view-" + name;
    v.classList.toggle("active", isTarget);
    v.style.display = isTarget ? "flex" : "none";
  });
  if (name === "history") loadHistory();
}

document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

showView("watermark");

// ── PDF loading ─────────────────────────────────────────────────────────────
async function openViaTauriDialog() {
  try {
    const selected = await tauriDialog().open({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      multiple: false,
    });
    if (!selected) return;
    const filePath = Array.isArray(selected) ? selected[0] : selected;
    await loadFromPath(filePath);
  } catch (e) {
    console.error("Open dialog failed:", e);
  }
}

$("btn-browse").addEventListener("click", (e) => {
  e.stopPropagation();
  openViaTauriDialog();
});
dropZone.addEventListener("click", (e) => {
  if (e.target !== $("btn-browse")) openViaTauriDialog();
});
dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const fullPath = file.path;
  if (fullPath) {
    await loadFromPath(fullPath);
  } else {
    const buf  = await file.arrayBuffer();
    const stem = file.name.replace(/\.pdf$/i, "");
    await loadBytes(new Uint8Array(buf), file.name, stem, null);
  }
});

async function loadFromPath(filePath) {
  // Pre-validate before touching Rust: must be a non-empty string ending in .pdf
  // with no path traversal sequences.
  if (!filePath || typeof filePath !== "string" || filePath.length > 4096) return;
  if (!filePath.toLowerCase().endsWith(".pdf")) {
    showResult("error", t("err_not_pdf") || "File must be a PDF (.pdf).");
    return;
  }
  if (filePath.includes("..")) {
    showResult("error", "Invalid file path.");
    return;
  }

  // Guard against loading oversized files before reading into memory.
  // Matches the MAX_PDF_BYTES constant in the Rust backend (lib.rs).
  const MAX_PDF_BYTES = 209_715_200; // 200 MiB
  try {
    const meta = await tauriFs().stat(filePath);
    if (meta.size > MAX_PDF_BYTES) {
      showResult("error", t("err_pdf_too_large"));
      return;
    }
  } catch (statErr) {
    // If stat fails (e.g. permission edge case), let readFile proceed;
    // the backend will enforce the limit independently.
    console.warn("stat failed before readFile:", statErr);
  }

  const bytes    = await tauriFs().readFile(filePath);
  const sep      = filePath.includes("\\") ? "\\" : "/";
  const parts    = filePath.split(sep);
  const filename = parts[parts.length - 1];
  const stem     = filename.replace(/\.pdf$/i, "");
  const dir      = parts.slice(0, -1).join(sep);
  await loadBytes(new Uint8Array(bytes), filename, stem, dir);
}

async function loadBytes(bytes, filename, stem, dir) {
  // Run the already-marked check BEFORE updating any state, so a rejected file
  // never partially replaces a previously loaded one.
  if (dir) {
    const candidatePath = `${dir}${dir.includes("\\") ? "\\" : "/"}${filename}`;
    try {
      const existingId = await invoke("cmd_detect", { sourcePath: candidatePath });
      if (existingId) {
        showResult("error", t("err_already_marked", { id: existingId }));
        showView("watermark");
        return;
      }
    } catch (e) {
      console.warn("Detection check failed (non-fatal):", e);
    }
  }

  state.pdfBytes       = bytes;
  state.sourceFilePath = dir ? `${dir}${dir.includes("\\") ? "\\" : "/"}${filename}` : null;
  state.sourceStem     = stem;
  state.sourceDir      = dir;

  dropLabel.classList.add("hidden");
  dropFilename.textContent = "📄 " + filename;
  dropFilename.classList.remove("hidden");

  if (!fDate.value) fDate.value = new Date().toISOString().slice(0, 10);

  wmFields.classList.remove("hidden");
  hideResult();
  seedMarkId();
  await renderPdf(state.pdfBytes);
}

// ── PDF.js rendering ────────────────────────────────────────────────────────
let pdfjsLib = null;
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // Local copy — no CDN dependency, no external network request at runtime.
  const mod = await import("./pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";
  pdfjsLib = mod;
  return pdfjsLib;
}

async function renderPdf(bytes) {
  const lib = await getPdfJs();
  state.pdfDoc = await lib.getDocument({ data: bytes }).promise;
  state.totalPages  = state.pdfDoc.numPages;
  state.currentPage = 1;
  previewPlaceholder.classList.add("hidden");
  previewContainer.classList.remove("hidden");
  await renderPage(state.currentPage);
  updatePageNav();
}

async function renderPage(pageNum) {
  const page     = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  // Base scale = fit to the available panel area (nav bar is ~52px, padding 32px each side)
  const panelH   = previewContainer.clientHeight - 52;
  const panelW   = previewContainer.clientWidth  - 32;
  const baseScale = Math.min(panelW / viewport.width, panelH / viewport.height);
  const scale     = baseScale * state.zoom;

  const scaled   = page.getViewport({ scale });
  pdfCanvas.width      = scaled.width;
  pdfCanvas.height     = scaled.height;
  overlayCanvas.width  = scaled.width;
  overlayCanvas.height = scaled.height;

  await page.render({ canvasContext: pdfCanvas.getContext("2d"), viewport: scaled }).promise;
  drawOverlay();
  updateZoomLabel();
}

// ── Page navigation ─────────────────────────────────────────────────────────
btnPrev.addEventListener("click", async () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    state.zoom = 1.0;          // reset zoom on page change
    await renderPage(state.currentPage);
    updatePageNav();
  }
});
btnNext.addEventListener("click", async () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    state.zoom = 1.0;          // reset zoom on page change
    await renderPage(state.currentPage);
    updatePageNav();
  }
});
function updatePageNav() {
  pageIndicator.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  btnPrev.disabled = state.currentPage <= 1;
  btnNext.disabled = state.currentPage >= state.totalPages;
}

// ── Zoom controls ────────────────────────────────────────────────────────────
const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 4.0;
const zoomLabel = $("zoom-label");

function updateZoomLabel() {
  if (zoomLabel) zoomLabel.textContent = Math.round(state.zoom * 100) + "%";
  const btnIn  = $("btn-zoom-in");
  const btnOut = $("btn-zoom-out");
  if (btnIn)  btnIn.disabled  = state.zoom >= ZOOM_MAX;
  if (btnOut) btnOut.disabled = state.zoom <= ZOOM_MIN;
}

$("btn-zoom-in")?.addEventListener("click", async () => {
  if (!state.pdfDoc) return;
  state.zoom = Math.min(ZOOM_MAX, parseFloat((state.zoom + ZOOM_STEP).toFixed(2)));
  await renderPage(state.currentPage);
});

$("btn-zoom-out")?.addEventListener("click", async () => {
  if (!state.pdfDoc) return;
  state.zoom = Math.max(ZOOM_MIN, parseFloat((state.zoom - ZOOM_STEP).toFixed(2)));
  await renderPage(state.currentPage);
});

// Double-click zoom label → reset to 100%
zoomLabel?.addEventListener("dblclick", async () => {
  if (!state.pdfDoc) return;
  state.zoom = 1.0;
  await renderPage(state.currentPage);
});

// Ctrl+wheel on the preview panel → zoom (natural browser-like behaviour)
const previewPageWrap = $("preview-page-wrap");
previewPageWrap?.addEventListener("wheel", async (e) => {
  if (!state.pdfDoc || !e.ctrlKey) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const next  = parseFloat((state.zoom + delta).toFixed(2));
  state.zoom  = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  await renderPage(state.currentPage);
}, { passive: false });

// ── ResizeObserver — re-render when the panel changes size ───────────────────
// This makes the PDF responsive: full-screen enlarges it, shrinking the window
// reduces it — while preserving the current zoom multiplier.
let resizeTimer = null;
const resizeObserver = new ResizeObserver(() => {
  if (!state.pdfDoc) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderPage(state.currentPage), 120);
});
// Observe the outer panel (not just the container) so maximise/restore fires it
const previewPanel = $("wm-preview-panel");
if (previewPanel) resizeObserver.observe(previewPanel);

// ── Watermark overlay canvas ────────────────────────────────────────────────
let isDragging = false;
overlayCanvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  overlayCanvas.classList.add("dragging");
  updatePosFromEvent(e);
});
window.addEventListener("mousemove", (e) => { if (isDragging) updatePosFromEvent(e); });
window.addEventListener("mouseup",   ()  => {
  if (!isDragging) return;
  isDragging = false;
  overlayCanvas.classList.remove("dragging");
});

function updatePosFromEvent(e) {
  const rect   = overlayCanvas.getBoundingClientRect();
  state.posX   = parseFloat(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width )).toFixed(4));
  state.posY   = parseFloat(Math.min(1, Math.max(0, (e.clientY - rect.top)  / rect.height)).toFixed(4));
  drawOverlay();
}

function drawOverlay() {
  const ctx      = overlayCanvas.getContext("2d");
  const w        = overlayCanvas.width;
  const h        = overlayCanvas.height;
  ctx.clearRect(0, 0, w, h);
  const px       = state.posX * w;
  const py       = state.posY * h;
  const color    = fColor?.value || "#1a1a1a";
  const fontSize = parseFloat(fSize?.value || 7.5);
  const pxSize   = fontSize * Math.max(w / 612, 0.8) * 1.4;
  const lineH    = pxSize * 1.35;
  ctx.save();
  ctx.fillStyle   = color;
  ctx.globalAlpha = 0.92;
  const row1 = buildRow1Preview();
  const row2 = state.markIdDraft;
  const row3 = "gotchamark.net - watermark your docs, trace the leaks";
  let curY = py;
  ctx.font = `${pxSize}px monospace`;
  if (row1) { ctx.fillText(row1, px, curY); curY += lineH; }
  ctx.fillText(row2, px, curY);
  ctx.font = `${pxSize * 0.85}px monospace`;
  ctx.fillText(row3, px, curY + lineH * 1.1);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function buildRow1Preview() {
  return [fRecipient?.value, fDate?.value, fCustom?.value]
    .filter((v) => v && v.trim())
    .join(" - ");
}

// ── Mark ID ─────────────────────────────────────────────────────────────────
function seedMarkId() {
  const prefix  = fPrefix?.value?.trim().toUpperCase() || "";
  const generated = generateShortId(prefix);
  state.markIdDraft    = generated;
  state.markIdUserEdited = false;
  if (fMarkId) fMarkId.value = generated;
}

function datePart() {
  const d = new Date();
  const yyyymmdd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return yyyymmdd.toString(36).toUpperCase().padStart(5, "0");
}

function generateShortId(prefix) {
  const date  = datePart();
  const hex   = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const token = `${date}-${hex}`;
  return prefix ? `GM-${prefix}-${token}` : `GM-${token}`;
}

fPrefix?.addEventListener("input", () => {
  if (!state.markIdUserEdited) {
    const generated = generateShortId(fPrefix.value.trim().toUpperCase());
    state.markIdDraft = generated;
    if (fMarkId) fMarkId.value = generated;
  }
  redraw();
});
fMarkId?.addEventListener("input", () => {
  state.markIdUserEdited = true;
  state.markIdDraft = fMarkId.value;
  redraw();
});

const redraw = () => { if (state.pdfDoc) drawOverlay(); };

// ── Preferences (appearance + language) ─────────────────────────────────────
let prefsSaveTimer = null;

function schedulePrefs() {
  clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(flushPrefs, 800);
}

function flushPrefs() {
  clearTimeout(prefsSaveTimer);
  invoke("cmd_save_prefs", {
    fontColor: fColor?.value || "#1a1a1a",
    fontSize:  parseFloat(fSize?.value || 7.5),
    lang:      getLang(),
  }).catch((e) => console.warn("Prefs save failed:", e));
}

async function loadPrefs() {
  try {
    const prefs = await invoke("cmd_load_prefs");
    if (prefs.font_color) {
      if (fColor)    fColor.value    = prefs.font_color;
      if (fColorHex) fColorHex.value = prefs.font_color;
    }
    if (prefs.font_size != null && fSize) fSize.value = prefs.font_size;
    if (prefs.lang) {
      setLang(prefs.lang);
      applyTranslations();
    }
  } catch (e) {
    console.warn("Prefs load failed (non-fatal):", e);
  }
}

window.addEventListener("beforeunload", flushPrefs);

// ── Font size — clamp + save pref ───────────────────────────────────────────
fSize?.addEventListener("input", () => {
  const v = parseFloat(fSize.value);
  if (!isNaN(v) && v < 4) fSize.value = 4;
  schedulePrefs();
  redraw();
});
[fRecipient, fDate, fCustom].forEach((el) => el?.addEventListener("input", redraw));

// ── Color sync, contrast check, + save pref ─────────────────────────────────
const HARD_CONTRAST_FLOOR = 1.3;

function applyColor(hex) {
  if (fColor)    fColor.value    = hex;
  if (fColorHex) fColorHex.value = hex;
}

fColor?.addEventListener("input", () => {
  if (fColorHex) fColorHex.value = fColor.value;
  schedulePrefs();
  checkContrast(); redraw();
});
fColorHex?.addEventListener("input", () => {
  const hex = fColorHex.value;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    if (fColor) fColor.value = hex;
    schedulePrefs();
    checkContrast(); redraw();
  }
});

async function checkContrast() {
  const fg    = fColor?.value   || "#1a1a1a";
  const bgHex = sampleBgColor() || "#ffffff";
  try {
    const result = await invoke("cmd_check_contrast", { fgHex: fg, bgHex });
    if (result.ratio < HARD_CONTRAST_FLOOR) {
      applyColor(result.suggestedFallback || "#000000");
      contrastWarning.classList.add("hidden");
      redraw();
      return;
    }
    if (result.ok) {
      contrastWarning.classList.add("hidden");
    } else {
      contrastWarning.classList.remove("hidden");
      contrastWarning.textContent = t("contrast_low", {
        ratio:    result.ratio.toFixed(1),
        fallback: result.suggestedFallback || t("contrast_adjust"),
      });
    }
  } catch (_) { /* non-blocking */ }
}

function sampleBgColor() {
  try {
    const ctx = pdfCanvas.getContext("2d");
    const px  = Math.floor(state.posX * pdfCanvas.width);
    const py  = Math.floor(state.posY * pdfCanvas.height);
    const d   = ctx.getImageData(px, py, 1, 1).data;
    return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch (_) { return "#ffffff"; }
}

// ── Apply watermark ──────────────────────────────────────────────────────────
btnApply?.addEventListener("click", async () => {
  if (!state.pdfBytes) return;

  const stem        = state.sourceStem || "document";
  const sep         = state.sourceDir?.includes("\\") ? "\\" : "/";
  const defaultPath = state.sourceDir
    ? `${state.sourceDir}${sep}${stem}-gotchamark.pdf`
    : `${stem}-gotchamark.pdf`;

  let outputPath;
  try {
    outputPath = await tauriDialog().save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath,
    });
  } catch (_) { return; }
  if (!outputPath) return;

  btnApply.disabled    = true;
  btnApply.textContent = t("wm_applying");
  hideResult();

  const allPages = document.querySelector('input[name="pages"]:checked')?.value === "all";

  try {
    const markId = fMarkId?.value?.trim() || generateShortId(fPrefix?.value?.trim().toUpperCase() || "");

    if (!state.sourceFilePath) {
      showResult("error", t("err_no_path"));
      return;
    }

    const result = await invoke("cmd_watermark", {
      recipient:    fRecipient?.value        || null,
      date:         fDate?.value             || null,
      customText:   fCustom?.value           || null,
      internalNote: fNote?.value?.trim()     || null,
      markId,
      fontColor:    fColor?.value            || "#1a1a1a",
      bgColor:      sampleBgColor()          || "#ffffff",
      fontSize:     parseFloat(fSize?.value  || 7.5),
      posX:         state.posX,
      posY:         state.posY,
      allPages,
      sourcePath:   state.sourceFilePath,
      outputPath,
    });

    showResult("success", t("success_applied", { summary: result.summary, path: outputPath }));
    showSuccessPopup(result.summary, outputPath);
  } catch (err) {
    const msg = String(err);
    if (msg.startsWith("ALREADY_MARKED:")) {
      showResult("error", t("err_already_marked_apply", { id: msg.split(":")[1] }));
    } else if (msg.startsWith("LOW_CONTRAST:")) {
      const parts = msg.split(":");
      showResult("error", t("err_low_contrast_apply", {
        ratio:    parseFloat(parts[1]).toFixed(1),
        fallback: parts[2],
      }));
    } else {
      showResult("error", `Error: ${sanitizeError(msg)}`);
    }
  } finally {
    btnApply.disabled    = false;
    btnApply.textContent = t("wm_apply");
  }
});

function showResult(type, text) {
  resultBanner.className        = type;
  resultBanner.textContent      = text;
  resultBanner.style.whiteSpace = "pre-wrap";
  resultBanner.classList.remove("hidden");
}
function hideResult() { resultBanner.classList.add("hidden"); }

// ── History ──────────────────────────────────────────────────────────────────
async function loadHistory(query = "") {
  try {
    const records = query
      ? await invoke("cmd_search_watermarks", { query })
      : await invoke("cmd_list_watermarks");
    renderHistory(records);
  } catch (e) { console.error("History load failed:", e); }
}

function renderHistory(records) {
  historyTbody.innerHTML = "";
  const dash = t("hist_empty_cell");
  if (!records || records.length === 0) {
    historyEmpty.classList.remove("hidden");
    historyTable.classList.add("hidden");
    return;
  }
  historyEmpty.classList.add("hidden");
  historyTable.classList.remove("hidden");
  records.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${esc(r.id)}</td>
      <td>${esc(r.recipient     || dash)}</td>
      <td>${esc(r.date          || dash)}</td>
      <td>${esc(r.custom_text   || dash)}</td>
      <td>${esc(r.internal_note || dash)}</td>
      <td>${esc(r.source_name   || dash)}</td>
      <td class="source-dir" title="${esc(r.source_dir || "")}">${esc(r.source_dir || dash)}</td>
      <td>${esc((r.created_at   || dash).slice(0, 16).replace("T", " "))}</td>
    `;
    historyTbody.appendChild(tr);
  });
}

let searchTimer = null;
searchBox?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadHistory(searchBox.value.trim()), 250);
});
btnRefresh?.addEventListener("click", async () => {
  btnRefresh.disabled = true;
  const original = btnRefresh.textContent;
  btnRefresh.textContent = t("hist_refreshing");
  await loadHistory(searchBox.value.trim());
  btnRefresh.textContent = t("hist_refreshed");
  setTimeout(() => {
    btnRefresh.textContent = original;
    btnRefresh.disabled = false;
  }, 1000);
});

// ── Export ───────────────────────────────────────────────────────────────────
btnExportJson?.addEventListener("click", async () => {
  try {
    const json = await invoke("cmd_export_json");
    const path = await tauriDialog().save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: "gotchamark-export.json",
    });
    if (path) await tauriFs().writeTextFile(path, json);
  } catch (e) { alert(t("hist_export_fail", { err: e })); }
});
btnExportCsv?.addEventListener("click", async () => {
  try {
    const csv  = await invoke("cmd_export_csv");
    const path = await tauriDialog().save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: "gotchamark-export.csv",
    });
    if (path) await tauriFs().writeTextFile(path, csv);
  } catch (e) { alert(t("hist_export_fail", { err: e })); }
});

// ── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Strip filesystem paths and internal Rust module names from error strings
// before showing them to the user, to avoid leaking implementation details.
function sanitizeError(msg) {
  return String(msg)
    // Remove Windows and Unix absolute paths (e.g. C:\Users\...\file or /home/user/...)
    .replace(/([A-Za-z]:)?[/\\](?:[^/\\\s:,;]+[/\\])+[^/\\\s:,;]*/g, "<path>")
    // Remove Rust module paths (e.g. registry::open, lopdf::...)
    .replace(/\b\w+(?:::\w+)+/g, (m) => m.split("::").pop())
    // Trim and collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// ── Success popup ─────────────────────────────────────────────────────────────
const successModal        = $("success-modal");
const successPopupSummary = $("success-popup-summary");
const successPopupPath    = $("success-popup-path");

function showSuccessPopup(summary, path) {
  successPopupSummary.textContent = summary || "";
  successPopupPath.textContent    = path    || "";
  successModal.classList.remove("hidden");
}
function hideSuccessPopup() { successModal.classList.add("hidden"); }

$("btn-success-close")?.addEventListener("click", hideSuccessPopup);
$("btn-success-ok")?.addEventListener("click",    hideSuccessPopup);
successModal?.addEventListener("click", (e) => {
  if (e.target === successModal) hideSuccessPopup();
});

// ── License modal ─────────────────────────────────────────────────────────────
const licenseModal = $("license-modal");
$("btn-license")?.addEventListener("click",       () => licenseModal.classList.remove("hidden"));
$("btn-license-close")?.addEventListener("click", () => licenseModal.classList.add("hidden"));
licenseModal?.addEventListener("click", (e) => {
  if (e.target === licenseModal) licenseModal.classList.add("hidden");
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    licenseModal.classList.add("hidden");
    hideSuccessPopup();
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────
// 1. Apply default (English) translations immediately so no key names flash.
applyTranslations();
// 2. Load saved prefs — restores color, size, and language from last session.
loadPrefs();
// (Mark ID is seeded when a PDF is loaded, not at startup)
