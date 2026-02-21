// ─── Gotcha!Mark frontend ─────────────────────────────────────────────────
// Uses window.__TAURI__ globals injected by Tauri (withGlobalTauri: true).
// PDF rendering uses PDF.js loaded dynamically from CDN.

// ── Tauri API accessors (safe — __TAURI__ is injected by the runtime) ──────
const invoke   = (...a) => window.__TAURI__.core.invoke(...a);
const tauriDialog = () => window.__TAURI__.dialog;
const tauriFs     = () => window.__TAURI__.fs;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  pdfBytes:    null,   // Uint8Array of the loaded PDF
  pdfDoc:      null,   // PDF.js document object
  currentPage: 1,
  totalPages:  0,
  posX:        0.05,   // relative position (0–1), updated on canvas click
  posY:        0.95,
  markIdDraft: "GM-········",
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dropZone           = $("drop-zone");
const fileInput          = $("file-input");
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

// Form fields
const fRecipient = $("f-recipient");
const fDate      = $("f-date");
const fCustom    = $("f-custom");
const fPrefix    = $("f-prefix");
const fColor     = $("f-color");
const fColorHex  = $("f-color-hex");
const fSize      = $("f-size");

// History
const searchBox     = $("search-box");
const historyTbody  = $("history-tbody");
const historyEmpty  = $("history-empty");
const historyTable  = $("history-table");
const btnExportJson = $("btn-export-json");
const btnExportCsv  = $("btn-export-csv");
const btnRefresh    = $("btn-refresh");

// ── Navigation ─────────────────────────────────────────────────────────────
// Views use display:none / display:flex via .active — NOT .hidden — to avoid
// the !important conflict.
function showView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((v) => {
    const isTarget = v.id === "view-" + name;
    v.classList.toggle("active", isTarget);
    // explicitly set display so there's no ambiguity
    v.style.display = isTarget ? "flex" : "none";
  });
  if (name === "history") loadHistory();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// Init: show watermark view
showView("watermark");

// ── PDF loading — Browse button & drag-and-drop ────────────────────────────
$("btn-browse").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

// Clicking the drop zone (anywhere except the button) also opens file picker
dropZone.addEventListener("click", (e) => {
  if (e.target !== $("btn-browse")) fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

async function loadFile(file) {
  const buf = await file.arrayBuffer();
  state.pdfBytes = new Uint8Array(buf);

  // Solo check — refuse if already GotchaMark'd
  const b64 = toBase64(state.pdfBytes);
  try {
    const existingId = await invoke("cmd_detect", { pdfB64: b64 });
    if (existingId) {
      showResult("error",
        `⚠ This PDF is already watermarked.\nMark ID: ${existingId}\n\nPlease use the original un-watermarked file.`
      );
      return;
    }
  } catch (e) {
    console.warn("Detection check failed (non-fatal):", e);
  }

  // Show filename in drop zone
  dropLabel.classList.add("hidden");
  dropFilename.textContent = "📄 " + file.name;
  dropFilename.classList.remove("hidden");

  // Default to today's date
  if (!fDate.value) {
    fDate.value = new Date().toISOString().slice(0, 10);
  }

  wmFields.classList.remove("hidden");
  hideResult();
  seedMarkId();   // generate a fresh unique ID for this document
  await renderPdf(state.pdfBytes);
}

// ── PDF.js rendering ───────────────────────────────────────────────────────
let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  pdfjsLib = mod;
  return pdfjsLib;
}

async function renderPdf(bytes) {
  const lib = await getPdfJs();
  state.pdfDoc = await lib.getDocument({ data: bytes }).promise;
  state.totalPages = state.pdfDoc.numPages;
  state.currentPage = 1;

  previewPlaceholder.classList.add("hidden");
  previewContainer.classList.remove("hidden");

  await renderPage(state.currentPage);
  updatePageNav();
}

async function renderPage(pageNum) {
  const page = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  const panelH = previewContainer.clientHeight - 60;
  const panelW = previewContainer.clientWidth - 32;
  const scale  = Math.min(panelW / viewport.width, panelH / viewport.height, 2);
  const scaled = page.getViewport({ scale });

  pdfCanvas.width    = scaled.width;
  pdfCanvas.height   = scaled.height;
  overlayCanvas.width  = scaled.width;
  overlayCanvas.height = scaled.height;

  const ctx = pdfCanvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  drawOverlay();
}

// ── Page navigation ────────────────────────────────────────────────────────
btnPrev.addEventListener("click", async () => {
  if (state.currentPage > 1) { state.currentPage--; await renderPage(state.currentPage); updatePageNav(); }
});
btnNext.addEventListener("click", async () => {
  if (state.currentPage < state.totalPages) { state.currentPage++; await renderPage(state.currentPage); updatePageNav(); }
});
function updatePageNav() {
  pageIndicator.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  btnPrev.disabled = state.currentPage <= 1;
  btnNext.disabled = state.currentPage >= state.totalPages;
}

// ── Overlay canvas — drag-to-position watermark ────────────────────────────
// Standard UX: grab cursor on hover, grabbing while held, releases on mouseup.
// mousemove fires continuously while dragging so the overlay updates live.
let isDragging = false;

overlayCanvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  overlayCanvas.classList.add("dragging");
  updatePosFromEvent(e);
});

// Listen on window so drag continues even if mouse leaves the canvas
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  updatePosFromEvent(e);
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  overlayCanvas.classList.remove("dragging");
});

function updatePosFromEvent(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  // Clamp to [0, 1] so you can't drag outside the page
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left)  / rect.width));
  const y = Math.min(1, Math.max(0, (e.clientY - rect.top)   / rect.height));
  state.posX = parseFloat(x.toFixed(4));
  state.posY = parseFloat(y.toFixed(4));
  drawOverlay();
}

function drawOverlay() {
  const ctx = overlayCanvas.getContext("2d");
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const px    = state.posX * w;
  const py    = state.posY * h;
  const color = fColor?.value || "#1a1a1a";
  const fontSize = parseFloat(fSize?.value || 7.5);
  // Scale pt → canvas pixels (approx A4/Letter ratio)
  const pxSize = fontSize * Math.max(w / 612, 0.8) * 1.4;
  const lineH  = pxSize * 1.35;

  ctx.save();
  ctx.fillStyle  = color;
  ctx.globalAlpha = 0.92;

  const row1 = buildRow1Preview();
  const row2 = state.markIdDraft;
  const row3 = "gotchamark.net — watermark your docs, trace the leaks";

  let curY = py;
  ctx.font = `${pxSize}px monospace`;
  if (row1) { ctx.fillText(row1, px, curY); curY += lineH; }
  ctx.fillText(row2, px, curY);
  ctx.font = `${pxSize * 0.85}px monospace`;
  ctx.fillText(row3, px, curY + lineH * 1.1);

  // Anchor dot
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function buildRow1Preview() {
  return [fRecipient?.value, fDate?.value, fCustom?.value]
    .filter((v) => v && v.trim())
    .join("  —  ");
}

// ── Live preview updates ───────────────────────────────────────────────────

// Called once when a PDF is loaded to seed the Mark ID input with a fresh generated value.
// After that, the user owns the field — prefix changes only update it if the user hasn't
// manually edited it (tracked via state.markIdUserEdited).
function seedMarkId() {
  const prefix = fPrefix?.value?.trim().toUpperCase() || "";
  const generated = generateShortId(prefix);
  state.markIdDraft = generated;
  state.markIdUserEdited = false;
  if (fMarkId) fMarkId.value = generated;
}

function generateShortId(prefix) {
  // 8-char random hex, uppercase
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return prefix ? `GM-${prefix}-${hex}` : `GM-${hex}`;
}

// When prefix changes: regenerate the ID only if the user hasn't hand-edited it
fPrefix?.addEventListener("input", () => {
  if (!state.markIdUserEdited) {
    const prefix = fPrefix.value.trim().toUpperCase();
    const generated = generateShortId(prefix);
    state.markIdDraft = generated;
    if (fMarkId) fMarkId.value = generated;
  }
  redraw();
});

// When the user types directly in the Mark ID field, respect it
fMarkId?.addEventListener("input", () => {
  state.markIdUserEdited = true;
  state.markIdDraft = fMarkId.value;
  redraw();
});

const redraw = () => { if (state.pdfDoc) drawOverlay(); };

[fRecipient, fDate, fCustom, fSize].forEach((el) => el?.addEventListener("input", redraw));

// ── Color sync & contrast check ────────────────────────────────────────────
fColor?.addEventListener("input", () => {
  if (fColorHex) fColorHex.value = fColor.value;
  checkContrast(); redraw();
});
fColorHex?.addEventListener("input", () => {
  const hex = fColorHex.value;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) { if (fColor) fColor.value = hex; checkContrast(); redraw(); }
});

async function checkContrast() {
  const fg   = fColor?.value || "#1a1a1a";
  const bgHex = sampleBgColor() || "#ffffff";
  try {
    const result = await invoke("cmd_check_contrast", { fgHex: fg, bgHex });
    if (result.ok) {
      contrastWarning.classList.add("hidden");
    } else {
      contrastWarning.classList.remove("hidden");
      contrastWarning.textContent =
        `⚠ Low contrast (${result.ratio.toFixed(1)}:1). Suggested: ${result.suggestedFallback || "adjust manually"}.`;
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

// ── Apply watermark ────────────────────────────────────────────────────────
btnApply?.addEventListener("click", async () => {
  if (!state.pdfBytes) return;

  // Open native Save dialog via Tauri dialog plugin
  let outputPath;
  try {
    outputPath = await tauriDialog().save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: "watermarked.pdf",
    });
  } catch (_) { return; }
  if (!outputPath) return;

  btnApply.disabled = true;
  btnApply.textContent = "Applying…";
  hideResult();

  const allPages = document.querySelector('input[name="pages"]:checked')?.value === "all";

  try {
    // Use the mark ID as the user left it; fall back to a fresh generated one
    const markId = fMarkId?.value?.trim() || generateShortId(fPrefix?.value?.trim().toUpperCase() || "");

    const result = await invoke("cmd_watermark", {
      recipient:  fRecipient?.value || null,
      date:       fDate?.value      || null,
      customText: fCustom?.value    || null,
      markId,
      fontColor:  fColor?.value     || "#1a1a1a",
      bgColor:    sampleBgColor()   || "#ffffff",
      fontSize:   parseFloat(fSize?.value || 7.5),
      posX:       state.posX,
      posY:       state.posY,
      allPages,
      pdfB64:     toBase64(state.pdfBytes),
      outputPath,
    });

    showResult("success",
      `✓ Watermark applied!\n\n${result.summary}\n\nSaved to:\n${outputPath}`
    );
  } catch (err) {
    const msg = String(err);
    if (msg.startsWith("ALREADY_MARKED:")) {
      showResult("error", `⚠ Already marked (ID: ${msg.split(":")[1]}).\nUse the original un-watermarked file.`);
    } else if (msg.startsWith("LOW_CONTRAST:")) {
      const parts = msg.split(":");
      showResult("error",
        `⚠ Text color has insufficient contrast (${parseFloat(parts[1]).toFixed(1)}:1).\n` +
        `Suggested color: ${parts[2]}\n\nAdjust the text color and try again.`
      );
    } else {
      showResult("error", `Error: ${msg}`);
    }
  } finally {
    btnApply.disabled = false;
    btnApply.textContent = "Apply watermark & save";
  }
});

function showResult(type, text) {
  resultBanner.className = type;
  resultBanner.textContent = text;
  resultBanner.classList.remove("hidden");
  resultBanner.style.whiteSpace = "pre-wrap";
}
function hideResult() {
  resultBanner.classList.add("hidden");
}

// ── History ────────────────────────────────────────────────────────────────
async function loadHistory(query = "") {
  try {
    const records = query
      ? await invoke("cmd_search_watermarks", { query })
      : await invoke("cmd_list_watermarks");
    renderHistory(records);
  } catch (e) {
    console.error("History load failed:", e);
  }
}

function renderHistory(records) {
  historyTbody.innerHTML = "";
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
      <td>${esc(r.recipient   || "—")}</td>
      <td>${esc(r.sent_date   || "—")}</td>
      <td>${esc(r.custom_text || "—")}</td>
      <td>${esc((r.created_at || "—").slice(0, 16).replace("T", " "))}</td>
    `;
    historyTbody.appendChild(tr);
  });
}

let searchTimer = null;
searchBox?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadHistory(searchBox.value.trim()), 250);
});
btnRefresh?.addEventListener("click", () => loadHistory(searchBox.value.trim()));

// ── Export ─────────────────────────────────────────────────────────────────
btnExportJson?.addEventListener("click", async () => {
  try {
    const json = await invoke("cmd_export_json");
    const path = await tauriDialog().save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: "gotchamark-export.json",
    });
    if (path) await tauriFs().writeTextFile(path, json);
  } catch (e) { alert("Export failed: " + e); }
});

btnExportCsv?.addEventListener("click", async () => {
  try {
    const csv = await invoke("cmd_export_csv");
    const path = await tauriDialog().save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: "gotchamark-export.csv",
    });
    if (path) await tauriFs().writeTextFile(path, csv);
  } catch (e) { alert("Export failed: " + e); }
});

// ── Utilities ──────────────────────────────────────────────────────────────
function toBase64(bytes) {
  // chunk to avoid stack overflow on large files
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── License modal ──────────────────────────────────────────────────────────
const licenseModal = $("license-modal");
$("btn-license")?.addEventListener("click", () => {
  licenseModal.classList.remove("hidden");
});
$("btn-license-close")?.addEventListener("click", () => {
  licenseModal.classList.add("hidden");
});
// Close on backdrop click
licenseModal?.addEventListener("click", (e) => {
  if (e.target === licenseModal) licenseModal.classList.add("hidden");
});
// Close on Escape
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") licenseModal.classList.add("hidden");
});

// ── Init ───────────────────────────────────────────────────────────────────
// (Mark ID is seeded when a PDF loads, not at startup)
