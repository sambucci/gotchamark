mod config;
mod contrast;
mod detection;
mod registry;
mod watermark;

use serde::{Deserialize, Serialize};

/// Maximum PDF file size accepted by the backend (200 MiB).
/// Matches the frontend guard in src/main.js.
const MAX_PDF_BYTES: u64 = 209_715_200;

// ─── Tauri Commands ────────────────────────────────────────────────────────────

/// Apply a watermark to a PDF.
/// source_path: absolute path to the input PDF — Rust reads it directly,
/// eliminating any base64 encoding round-trip corruption.
#[tauri::command]
fn cmd_watermark(
    recipient: Option<String>,
    date: Option<String>,
    custom_text: Option<String>,
    internal_note: Option<String>,
    mark_id: Option<String>,
    font_color: String,
    bg_color: String,
    font_size: f64,
    pos_x: f64,
    pos_y: f64,
    all_pages: bool,
    source_path: String,
    output_path: String,
) -> Result<watermark::WatermarkResult, String> {
    // ── Input length validation ────────────────────────────────────────────
    const MAX_RECIPIENT:  usize = 120;
    const MAX_DATE:       usize = 32;
    const MAX_CUSTOM:     usize = 200;
    const MAX_NOTE:       usize = 500;
    const MAX_MARK_ID:    usize = 128;
    const MAX_COLOR:      usize = 32;

    if recipient.as_deref().map(|s| s.len()).unwrap_or(0) > MAX_RECIPIENT {
        return Err(format!("Recipient exceeds maximum length ({MAX_RECIPIENT} chars)"));
    }
    if date.as_deref().map(|s| s.len()).unwrap_or(0) > MAX_DATE {
        return Err(format!("Date exceeds maximum length ({MAX_DATE} chars)"));
    }
    if custom_text.as_deref().map(|s| s.len()).unwrap_or(0) > MAX_CUSTOM {
        return Err(format!("Custom text exceeds maximum length ({MAX_CUSTOM} chars)"));
    }
    if internal_note.as_deref().map(|s| s.len()).unwrap_or(0) > MAX_NOTE {
        return Err(format!("Internal note exceeds maximum length ({MAX_NOTE} chars)"));
    }
    if mark_id.as_deref().map(|s| s.len()).unwrap_or(0) > MAX_MARK_ID {
        return Err(format!("Mark ID exceeds maximum length ({MAX_MARK_ID} chars)"));
    }
    if font_color.len() > MAX_COLOR || bg_color.len() > MAX_COLOR {
        return Err("Color value exceeds maximum length".to_string());
    }
    if !(1.0..=100.0).contains(&font_size) {
        return Err("Font size must be between 1 and 100 pt".to_string());
    }

    // ── Output path validation ─────────────────────────────────────────────
    {
        let out = std::path::Path::new(&output_path);
        // Must end with .pdf (case-insensitive)
        let ext = out.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase());
        if ext.as_deref() != Some("pdf") {
            return Err("Output path must end with .pdf".to_string());
        }
        // Must not contain path traversal components
        if out.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err("Output path must not contain '..' components".to_string());
        }
        // Must be absolute
        if !out.is_absolute() {
            return Err("Output path must be an absolute path".to_string());
        }
    }

    validate_pdf_source_path(&source_path)?;
    let pdf_meta = std::fs::metadata(&source_path).map_err(|e| e.to_string())?;
    if pdf_meta.len() > MAX_PDF_BYTES {
        return Err(format!("PDF_TOO_LARGE:{}", pdf_meta.len()));
    }
    let pdf_bytes = std::fs::read(&source_path).map_err(|e| e.to_string())?;
    let req = watermark::WatermarkRequest {
        pdf_bytes,
        recipient,
        date,
        custom_text,
        internal_note,
        mark_id,
        font_color,
        bg_color,
        font_size,
        pos_x,
        pos_y,
        all_pages,
        output_path,
        source_path,
    };
    watermark::apply(req).map_err(|e| e.to_string())
}

/// Check contrast between two hex colors.
/// Returns Ok(ratio) or Err with ratio + suggested fallback color.
#[tauri::command]
fn cmd_check_contrast(fg_hex: String, bg_hex: String) -> ContrastResult {
    match contrast::check_contrast(&fg_hex, &bg_hex) {
        Ok(ratio) => ContrastResult {
            ok: true,
            ratio,
            suggested_fallback: None,
        },
        Err(ratio) => ContrastResult {
            ok: false,
            ratio,
            suggested_fallback: Some(contrast::suggest_fallback(&bg_hex).to_string()),
        },
    }
}

#[derive(Serialize)]
struct ContrastResult {
    ok: bool,
    ratio: f64,
    suggested_fallback: Option<String>,
}

/// Check if a PDF is already GotchaMark'd.
/// source_path: absolute path — Rust reads the file directly.
/// Returns Some(mark_id) or null.
#[tauri::command]
fn cmd_detect(source_path: String) -> Result<Option<String>, String> {
    validate_pdf_source_path(&source_path)?;
    let pdf_meta = std::fs::metadata(&source_path).map_err(|e| e.to_string())?;
    if pdf_meta.len() > MAX_PDF_BYTES {
        return Err(format!("PDF_TOO_LARGE:{}", pdf_meta.len()));
    }
    let pdf_bytes = std::fs::read(&source_path).map_err(|e| e.to_string())?;
    detection::detect(&pdf_bytes).map_err(|e| e.to_string())
}

/// Shared guard: source path must be absolute, end in .pdf, and contain no traversal.
fn validate_pdf_source_path(path: &str) -> Result<(), String> {
    let p = std::path::Path::new(path);
    let ext = p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    if ext.as_deref() != Some("pdf") {
        return Err("Source path must end with .pdf".to_string());
    }
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Source path must not contain '..' components".to_string());
    }
    if !p.is_absolute() {
        return Err("Source path must be an absolute path".to_string());
    }
    Ok(())
}

/// Return all watermark records from the registry.
#[tauri::command]
fn cmd_list_watermarks() -> Result<Vec<registry::WatermarkRecord>, String> {
    registry::all().map_err(|e| e.to_string())
}

/// Search watermark records.
#[tauri::command]
fn cmd_search_watermarks(query: String) -> Result<Vec<registry::WatermarkRecord>, String> {
    registry::search(&query).map_err(|e| e.to_string())
}

/// Export registry as JSON string.
#[tauri::command]
fn cmd_export_json() -> Result<String, String> {
    registry::export_json().map_err(|e| e.to_string())
}

/// Export registry as CSV string.
#[tauri::command]
fn cmd_export_csv() -> Result<String, String> {
    registry::export_csv().map_err(|e| e.to_string())
}

/// User preferences persisted between sessions.
#[derive(Debug, Serialize, Deserialize)]
struct AppPrefs {
    font_color: String,
    font_size: f64,
    /// BCP-47 / ISO 639-1 language code, e.g. "en" or "it".
    #[serde(default = "default_lang")]
    lang: String,
}

fn default_lang() -> String { "en".to_string() }

impl Default for AppPrefs {
    fn default() -> Self {
        AppPrefs {
            font_color: "#1a1a1a".to_string(),
            font_size: 7.5,
            lang: default_lang(),
        }
    }
}

fn prefs_path() -> anyhow::Result<std::path::PathBuf> {
    let mut p = config::app_data_dir()?;
    p.push("prefs.json");
    Ok(p)
}

/// Load preferences. Returns defaults if the file doesn't exist yet.
#[tauri::command]
fn cmd_load_prefs() -> Result<AppPrefs, String> {
    const MAX_PREFS_BYTES: u64 = 8_192; // 8 KB — a prefs.json should never exceed this

    let path = prefs_path().map_err(|e| e.to_string())?;
    if !path.exists() {
        return Ok(AppPrefs::default());
    }
    // Guard against a maliciously large prefs file before reading it into memory
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_PREFS_BYTES {
        // Silently fall back to defaults rather than crashing on startup
        return Ok(AppPrefs::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    // serde_json will use #[serde(default)] for missing fields (e.g. old prefs without lang)
    // On parse failure, fall back to defaults so a corrupted file doesn't brick the app
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

/// Save preferences to disk.
#[tauri::command]
fn cmd_save_prefs(font_color: String, font_size: f64, lang: String) -> Result<(), String> {
    // ── Validation ────────────────────────────────────────────────────────
    // font_color: must be a 4- or 7-char hex string starting with '#'
    const MAX_COLOR: usize = 7;
    if font_color.len() > MAX_COLOR
        || !font_color.starts_with('#')
        || font_color.len() < 4
        || !font_color[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err("Invalid font color — must be a hex color (e.g. #1a1a1a)".to_string());
    }
    // font_size: must be a finite number in the valid range
    if !font_size.is_finite() || !(1.0..=100.0).contains(&font_size) {
        return Err("Font size must be a finite number between 1 and 100 pt".to_string());
    }
    // lang: must be one of the supported ISO 639-1 codes
    // NOTE: keep in sync with LANGUAGES array in src/i18n.js
    const SUPPORTED_LANGS: &[&str] = &["en", "it"];
    if !SUPPORTED_LANGS.contains(&lang.as_str()) {
        return Err(format!("Unsupported language code: {}", lang));
    }

    let prefs = AppPrefs { font_color, font_size, lang };
    let path = prefs_path().map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

// ─── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialise DB on startup
    registry::init_db().expect("Failed to initialise GotchaMark database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            cmd_watermark,
            cmd_check_contrast,
            cmd_detect,
            cmd_list_watermarks,
            cmd_search_watermarks,
            cmd_export_json,
            cmd_export_csv,
            cmd_load_prefs,
            cmd_save_prefs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running gotchamark");
}

