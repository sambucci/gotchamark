mod config;
mod contrast;
mod detection;
mod registry;
mod watermark;

use serde::Serialize;

// ─── Tauri Commands ────────────────────────────────────────────────────────────

/// Apply a watermark to a PDF.
/// pdf_b64: base64-encoded PDF bytes.
#[tauri::command]
fn cmd_watermark(
    recipient: Option<String>,
    date: Option<String>,
    custom_text: Option<String>,
    mark_id: Option<String>,
    font_color: String,
    bg_color: String,
    font_size: f64,
    pos_x: f64,
    pos_y: f64,
    all_pages: bool,
    pdf_b64: String,
    output_path: String,
) -> Result<watermark::WatermarkResult, String> {
    let pdf_bytes = base64_decode(&pdf_b64).map_err(|e| e.to_string())?;
    let req = watermark::WatermarkRequest {
        pdf_bytes,
        recipient,
        date,
        custom_text,
        mark_id,
        font_color,
        bg_color,
        font_size,
        pos_x,
        pos_y,
        all_pages,
        output_path,
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

/// Check if a PDF (base64) is already GotchaMark'd.
/// Returns Some(mark_id) or null.
#[tauri::command]
fn cmd_detect(pdf_b64: String) -> Result<Option<String>, String> {
    let pdf_bytes = base64_decode(&pdf_b64).map_err(|e| e.to_string())?;
    detection::detect(&pdf_bytes).map_err(|e| e.to_string())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running gotchamark");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn base64_decode(s: &str) -> anyhow::Result<Vec<u8>> {
    base64_simple::decode(s)
}

/// Minimal base64 decoder (avoids adding another crate for now).
mod base64_simple {
    use anyhow::{anyhow, Result};

    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    pub fn decode(input: &str) -> Result<Vec<u8>> {
        let input = input.trim().replace('\n', "").replace('\r', "");
        let input = input.as_bytes();
        let mut out = Vec::with_capacity(input.len() * 3 / 4);
        let mut buf = 0u32;
        let mut bits = 0u8;

        for &c in input {
            if c == b'=' { break; }
            let val = TABLE.iter().position(|&t| t == c)
                .ok_or_else(|| anyhow!("invalid base64 char: {}", c as char))? as u32;
            buf = (buf << 6) | val;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push(((buf >> bits) & 0xFF) as u8);
            }
        }
        Ok(out)
    }
}
