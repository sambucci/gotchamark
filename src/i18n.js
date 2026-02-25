// ─── Gotcha!Mark i18n ─────────────────────────────────────────────────────
// To add a new language:
//   1. Copy the "en" block below and give it an ISO 639-1 code key.
//   2. Translate every value string. Do not change the keys.
//   3. Add the new code to the LANGUAGES array with a display label.
//   4. That's it — the language picker and all t() calls pick it up automatically.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
];

const STRINGS = {
  en: {
    // Sidebar nav
    nav_watermark: "Watermark",
    nav_history:   "History",
    nav_language:  "Language",

    // Watermark view
    wm_heading:           "New watermark",
    wm_pdf_label:         "PDF file",
    wm_drop_hint:         "Drop a PDF here, or",
    wm_browse:            "browse",
    wm_section_info:      "Watermark info",
    wm_all_optional:      "all optional",
    wm_recipient:         "Recipient",
    wm_recipient_ph:      "Acme Corp",
    wm_date:              "Date",
    wm_custom:            "Custom text",
    wm_custom_ph:         "Add optional custom text here",
    wm_note:              "Internal note",
    wm_note_hidden:       "won't be shown",
    wm_note_ph:           "e.g. Sent via email on 2026-02-21",
    wm_section_markid:    "Mark ID",
    wm_markid_hint:       "A unique ID is always auto-generated. You can clear it entirely if you prefer no ID, or edit it freely.",
    wm_prefix:            "Prefix",
    wm_prefix_ph:         "e.g. ACME",
    wm_markid:            "Mark ID",
    wm_section_appearance:"Appearance",
    wm_color:             "Text color",
    wm_fontsize:          "Font size (pt)",
    wm_section_pages:     "Pages",
    wm_pages_all:         "All pages",
    wm_pages_first:       "First page only",
    wm_drag_hint:         "Drag the watermark on the PDF preview to reposition it.",
    wm_apply:             "Apply watermark & save",
    wm_applying:          "Applying\u2026",
    wm_preview_hint:      "PDF preview\nwill appear here",

    // Contrast / validation messages
    contrast_low:         "\u26a0 Low contrast ({ratio}:1). Suggested: {fallback}.",
    contrast_adjust:      "adjust manually",
    err_already_marked:   "\u26a0 This PDF is already watermarked — it was not loaded.\nMark ID: {id}\n\nPlease use the original un-watermarked file.",
    err_no_path:          "\u26a0 Source file path is unavailable. Please re-open the file using the Browse button.",
    err_pdf_too_large:    "\u26a0 File too large. Maximum allowed size is 200 MB.",
    err_already_marked_apply: "\u26a0 Already marked (ID: {id}).\nUse the original un-watermarked file.",
    err_low_contrast_apply:   "\u26a0 Text color has insufficient contrast ({ratio}:1).\nSuggested color: {fallback}\n\nAdjust the text color and try again.",
    success_applied:      "\u2713 Watermark applied!\n\n{summary}\n\nSaved to:\n{path}",
    success_popup_title:  "\u2713 Watermark applied",
    success_popup_saved:  "Saved to",
    success_popup_ok:     "OK",

    // History view
    hist_heading:         "Watermark history",
    hist_search_ph:       "Search by ID, recipient, text\u2026",
    hist_refresh:         "Refresh",
    hist_refreshing:      "Refreshing…",
    hist_refreshed:       "✓ Done",
    hist_export_json:     "Export JSON",
    hist_import_json:     "Import JSON",
    hist_import_done:     "Imported {imported} record(s), skipped {skipped} duplicate(s).",
    hist_import_fail:     "Import failed: {err}",
    hist_note_placeholder:"Add a note\u2026",
    hist_note_save_err:   "Failed to save note: {err}",
    err_popup_title:      "\u26a0 Error",
    hist_col_id:          "Mark ID",
    hist_col_recipient:   "Recipient",
    hist_col_date:        "Date",
    hist_col_custom:      "Custom text",
    hist_col_note:        "Internal note",
    hist_col_source_name: "Source file",
    hist_col_source_dir:  "Source folder",
    hist_col_created:     "Created at",
    hist_empty_title:     "No watermarks yet",
    hist_empty_sub:       "Every PDF you watermark will be recorded here, along with who you sent it to. If a copy ever leaks, paste the mark ID into the search box above to find out who got that version.",
    hist_empty_cell:      "\u2014",
    hist_export_fail:     "Export failed: {err}",

    // License modal
    license_title:        "License",
    license_body:
`DISCLAIMER OF WARRANTY AND LIMITATION OF LIABILITY

Gotcha!Mark is provided in good faith and with care, but without any warranty of any kind. The authors and contributors make no representations or guarantees \u2014 express, implied, or statutory \u2014 regarding the software\u2019s fitness for a particular purpose, accuracy, reliability, or freedom from defects.

By using Gotcha!Mark you acknowledge that:

  \u2022 You are solely responsible for how you use the software and for any consequences that arise from its use.
  \u2022 The authors and contributors shall not be held liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, loss of data, loss of business, or breach of confidentiality) arising out of or in connection with the use or inability to use this software, even if advised of the possibility of such damages.
  \u2022 No watermarking system \u2014 including this one \u2014 can guarantee the prevention of data leaks or the identification of their source in every circumstance. Gotcha!Mark is a tool to assist in forensic tracing, not a security guarantee.

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (c) 2026 Layer Focused

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

What this means for you:

  \u2022 You are free to use, study, and modify this software for any purpose.
  \u2022 You may share copies, modified or unmodified, but you must do so under the same GPL v3 license and make the source code available.
  \u2022 You may NOT incorporate this software into a proprietary product and distribute it without releasing your full source code under GPL v3.
  \u2022 The full license text is available at: https://www.gnu.org/licenses/gpl-3.0.html`,

    // Language picker
    lang_title:           "Language",
  },

  it: {
    // Sidebar nav
    nav_watermark: "Filigrana",
    nav_history:   "Cronologia",
    nav_language:  "Lingua",

    // Watermark view
    wm_heading:           "Nuova filigrana",
    wm_pdf_label:         "File PDF",
    wm_drop_hint:         "Trascina un PDF qui, oppure",
    wm_browse:            "sfoglia",
    wm_section_info:      "Info filigrana",
    wm_all_optional:      "tutti facoltativi",
    wm_recipient:         "Destinatario",
    wm_recipient_ph:      "Acme Srl",
    wm_date:              "Data",
    wm_custom:            "Testo personalizzato",
    wm_custom_ph:         "Aggiungi un testo facoltativo",
    wm_note:              "Nota interna",
    wm_note_hidden:       "non sar\u00e0 mostrata",
    wm_note_ph:           "es. Inviato per email il 21/02/2026",
    wm_section_markid:    "Mark ID",
    wm_markid_hint:       "Un ID univoco viene sempre generato automaticamente. Puoi cancellarlo se preferisci nessun ID, o modificarlo liberamente.",
    wm_prefix:            "Prefisso",
    wm_prefix_ph:         "es. ACME",
    wm_markid:            "Mark ID",
    wm_section_appearance:"Aspetto",
    wm_color:             "Colore testo",
    wm_fontsize:          "Dimensione font (pt)",
    wm_section_pages:     "Pagine",
    wm_pages_all:         "Tutte le pagine",
    wm_pages_first:       "Solo la prima pagina",
    wm_drag_hint:         "Trascina la filigrana sull\u2019anteprima PDF per riposizionarla.",
    wm_apply:             "Applica filigrana e salva",
    wm_applying:          "Applicazione in corso\u2026",
    wm_preview_hint:      "L\u2019anteprima PDF\napparir\u00e0 qui",

    // Contrast / validation messages
    contrast_low:         "\u26a0 Contrasto insufficiente ({ratio}:1). Suggerito: {fallback}.",
    contrast_adjust:      "regola manualmente",
    err_already_marked:   "\u26a0 Questo PDF ha gi\u00e0 una filigrana \u2014 il file non \u00e8 stato caricato.\nMark ID: {id}\n\nUsa il file originale senza filigrana.",
    err_no_path:          "\u26a0 Percorso del file non disponibile. Riapri il file con il pulsante Sfoglia.",
    err_pdf_too_large:    "\u26a0 File troppo grande. La dimensione massima consentita \u00e8 200 MB.",
    err_already_marked_apply: "\u26a0 Gi\u00e0 con filigrana (ID: {id}).\nUsa il file originale senza filigrana.",
    err_low_contrast_apply:   "\u26a0 Il colore del testo ha un contrasto insufficiente ({ratio}:1).\nColore suggerito: {fallback}\n\nModifica il colore e riprova.",
    success_applied:      "\u2713 Filigrana applicata!\n\n{summary}\n\nSalvato in:\n{path}",
    success_popup_title:  "\u2713 Filigrana applicata",
    success_popup_saved:  "Salvato in",
    success_popup_ok:     "OK",

    // History view
    hist_heading:         "Cronologia filigrane",
    hist_search_ph:       "Cerca per ID, destinatario, testo\u2026",
    hist_refresh:         "Aggiorna",
    hist_refreshing:      "Aggiornamento…",
    hist_refreshed:       "✓ Fatto",
    hist_export_json:     "Esporta JSON",
    hist_import_json:     "Importa JSON",
    hist_import_done:     "Importati {imported} record, saltati {skipped} duplicati.",
    hist_import_fail:     "Importazione fallita: {err}",
    hist_note_placeholder:"Aggiungi una nota\u2026",
    hist_note_save_err:   "Salvataggio nota fallito: {err}",
    err_popup_title:      "\u26a0 Errore",
    hist_col_id:          "Mark ID",
    hist_col_recipient:   "Destinatario",
    hist_col_date:        "Data",
    hist_col_custom:      "Testo personalizzato",
    hist_col_note:        "Nota interna",
    hist_col_source_name: "File originale",
    hist_col_source_dir:  "Cartella originale",
    hist_col_created:     "Creato il",
    hist_empty_title:     "Nessuna filigrana ancora",
    hist_empty_sub:       "Ogni PDF a cui applichi una filigrana sar\u00e0 registrato qui, insieme al destinatario. Se una copia trapela, incolla il Mark ID nella casella di ricerca per scoprire chi aveva quella versione.",
    hist_empty_cell:      "\u2014",
    hist_export_fail:     "Esportazione fallita: {err}",

    // License modal
    license_title:        "Licenza",
    license_body:
`ESCLUSIONE DI GARANZIA E LIMITAZIONE DI RESPONSABILIT\u00c0

Gotcha!Mark \u00e8 fornito in buona fede e con cura, ma senza alcuna garanzia di alcun tipo. Gli autori e i collaboratori non rilasciano dichiarazioni o garanzie \u2014 esplicite, implicite o di legge \u2014 in merito all\u2019idoneit\u00e0 del software a uno scopo specifico, alla sua accuratezza, affidabilit\u00e0 o assenza di difetti.

Utilizzando Gotcha!Mark l\u2019utente riconosce che:

  \u2022 L\u2019utente \u00e8 il solo responsabile dell\u2019utilizzo del software e di qualsiasi conseguenza che ne derivi.
  \u2022 Gli autori e i collaboratori non potranno essere ritenuti responsabili per danni diretti, indiretti, incidentali, speciali, esemplari o consequenziali (inclusi, a titolo esemplificativo, perdita di dati, perdita di attivit\u00e0 commerciale o violazione della riservatezza) derivanti dall\u2019uso o dall\u2019impossibilit\u00e0 di utilizzare il software, anche qualora fossero stati avvisati della possibilit\u00e0 di tali danni.
  \u2022 Nessun sistema di filigrana \u2014 incluso questo \u2014 pu\u00f2 garantire la prevenzione delle fughe di dati o l\u2019identificazione della loro fonte in ogni circostanza. Gotcha!Mark \u00e8 uno strumento di supporto alla tracciabilit\u00e0 forense, non una garanzia di sicurezza.

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

LICENZA PUBBLICA GENERALE GNU
Versione 3, 29 giugno 2007

Copyright (c) 2026 Layer Focused

Questo programma \u00e8 software libero: puoi ridistribuirlo e/o modificarlo secondo i termini della Licenza Pubblica Generale GNU pubblicata dalla Free Software Foundation, nella versione 3 della Licenza, o (a tua scelta) qualsiasi versione successiva.

Questo programma \u00e8 distribuito nella speranza che sia utile, ma SENZA ALCUNA GARANZIA; senza nemmeno la garanzia implicita di COMMERCIABILIT\u00c0 o IDONEIT\u00c0 PER UNO SCOPO SPECIFICO. Consulta la Licenza Pubblica Generale GNU per ulteriori dettagli.

Dovresti aver ricevuto una copia della Licenza Pubblica Generale GNU insieme a questo programma. In caso contrario, consulta: <https://www.gnu.org/licenses/>.

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

Cosa significa per te:

  \u2022 Sei libero di usare, studiare e modificare questo software per qualsiasi scopo.
  \u2022 Puoi condividere copie, modificate o non, ma devi farlo sotto la stessa licenza GPL v3 e rendere disponibile il codice sorgente.
  \u2022 NON puoi incorporare questo software in un prodotto proprietario e distribuirlo senza rilasciare il codice sorgente completo sotto GPL v3.
  \u2022 Il testo completo della licenza \u00e8 disponibile su: https://www.gnu.org/licenses/gpl-3.0.html`,

    // Language picker
    lang_title:           "Lingua",
  },
};

// ── Runtime state ──────────────────────────────────────────────────────────
let _lang = "en";

export function setLang(code) {
  if (STRINGS[code]) _lang = code;
  document.documentElement.lang = _lang;
}

export function getLang() { return _lang; }

/**
 * Translate a key, optionally interpolating named placeholders.
 * t("contrast_low", { ratio: "2.1", fallback: "#000000" })
 * → "⚠ Low contrast (2.1:1). Suggested: #000000."
 */
export function t(key, vars = {}) {
  const str = (STRINGS[_lang]?.[key] ?? STRINGS.en[key]) ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
