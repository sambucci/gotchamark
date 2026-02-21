use anyhow::{anyhow, Result};
use lopdf::{Document, Object, Stream, Dictionary, content::{Content, Operation}};
use uuid::Uuid;
use chrono::Local;
use sha2::{Sha256, Digest};

use crate::contrast::{check_contrast, suggest_fallback};
use crate::detection::{detect, embed_id};
use crate::registry::{WatermarkRecord, insert};

/// All parameters the caller provides for a watermark operation.
#[derive(Debug, serde::Deserialize)]
pub struct WatermarkRequest {
    /// Raw bytes of the input PDF (base64-decoded by the command layer)
    pub pdf_bytes: Vec<u8>,
    // Row 1 — all optional
    pub recipient: Option<String>,
    pub date: Option<String>,       // ISO date string, e.g. "2026-02-21"
    pub custom_text: Option<String>,
    // Row 2 — the full mark ID as the user left it (may be empty → auto-generate)
    pub mark_id: Option<String>,
    // Styling
    pub font_color: String,         // hex, e.g. "#1a1a1a"
    pub bg_color: String,           // hex of the page bg at placement area, for contrast check
    pub font_size: f64,             // points, e.g. 7.0
    /// Relative position: 0.0 = left/top, 1.0 = right/bottom
    pub pos_x: f64,
    pub pos_y: f64,
    /// If true, same position applied to every page.
    pub all_pages: bool,
    /// Where to save the output file
    pub output_path: String,
}

#[derive(Debug, serde::Serialize)]
pub struct WatermarkResult {
    pub mark_id: String,
    pub summary: String,
}

pub fn apply(req: WatermarkRequest) -> Result<WatermarkResult> {
    // 1. Solo check — refuse if already watermarked
    if let Some(existing_id) = detect(&req.pdf_bytes)? {
        return Err(anyhow!(
            "ALREADY_MARKED:{}",
            existing_id
        ));
    }

    // 2. Contrast check
    match check_contrast(&req.font_color, &req.bg_color) {
        Ok(_) => {}
        Err(ratio) => {
            let fallback = suggest_fallback(&req.bg_color);
            return Err(anyhow!(
                "LOW_CONTRAST:{:.2}:{}",
                ratio,
                fallback
            ));
        }
    }

    // 3. Determine the mark ID — use what the user provided, or auto-generate
    let mark_id = match &req.mark_id {
        Some(id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => {
            let hex = Uuid::new_v4().to_string().replace('-', "").to_uppercase();
            format!("GM-{}", &hex[..8])
        }
    };

    // 4. Build the three watermark lines
    let row1 = build_row1(&req);
    let row2 = mark_id.clone();
    let row3 = "gotchamark.net — watermark your docs, trace the leaks".to_string();

    // 5. Load and modify the PDF
    let mut doc = Document::load_mem(&req.pdf_bytes)?;

    // Embed the ID in metadata
    embed_id(&mut doc, &mark_id);

    // Get page IDs to watermark
    let page_ids: Vec<lopdf::ObjectId> = doc.get_pages()
        .into_iter()
        .map(|(_, id)| id)
        .collect();

    let pages_to_mark: Vec<lopdf::ObjectId> = if req.all_pages {
        page_ids
    } else {
        page_ids.into_iter().take(1).collect()
    };

    for page_id in pages_to_mark {
        add_watermark_to_page(
            &mut doc,
            page_id,
            &row1,
            &row2,
            &row3,
            req.pos_x,
            req.pos_y,
            &req.font_color,
            req.font_size,
        )?;
    }

    // 6. Save output
    doc.save(&req.output_path)?;

    // 7. Hash the original PDF for the registry
    let mut hasher = Sha256::new();
    hasher.update(&req.pdf_bytes);
    let pdf_hash = format!("{:x}", hasher.finalize());

    // 8. Write to registry
    let now = Local::now().to_rfc3339();
    let record = WatermarkRecord {
        id: mark_id.clone(),
        pdf_hash,
        output_path: Some(req.output_path.clone()),
        recipient: req.recipient.clone(),
        sent_date: req.date.clone(),
        custom_text: req.custom_text.clone(),
        prefix: None,
        position_x: req.pos_x,
        position_y: req.pos_y,
        font_color: req.font_color.clone(),
        font_size: req.font_size,
        created_at: now,
    };
    insert(&record)?;

    // 9. Build human-readable summary
    let summary = build_summary(&mark_id, &req);

    Ok(WatermarkResult { mark_id, summary })
}

fn build_row1(req: &WatermarkRequest) -> String {
    let parts: Vec<String> = [
        req.recipient.as_deref(),
        req.date.as_deref(),
        req.custom_text.as_deref(),
    ]
    .iter()
    .filter_map(|&s| s.filter(|v| !v.trim().is_empty()).map(str::to_string))
    .collect();
    parts.join("  —  ")
}

fn build_summary(mark_id: &str, req: &WatermarkRequest) -> String {
    let mut parts = vec![mark_id.to_string()];
    if let Some(r) = &req.recipient { if !r.is_empty() { parts.push(r.clone()); } }
    if let Some(d) = &req.date { if !d.is_empty() { parts.push(d.clone()); } }
    format!("Watermarked → {}", parts.join(" | "))
}

/// Add a text watermark to a single page using lopdf content stream injection.
fn add_watermark_to_page(
    doc: &mut Document,
    page_id: lopdf::ObjectId,
    row1: &str,
    row2: &str,
    row3: &str,
    pos_x: f64,
    pos_y: f64,
    color_hex: &str,
    font_size: f64,
) -> Result<()> {
    // Get page dimensions
    let page = doc.get_object(page_id)?.as_dict()?.clone();
    let media_box = get_media_box(&page, doc)?;
    let page_width = media_box.2 - media_box.0;
    let page_height = media_box.3 - media_box.1;

    // Convert relative position to absolute PDF coordinates
    // PDF origin is bottom-left; Y increases upward.
    // pos_y=0.95 means near the bottom (5% from bottom edge)
    let abs_x = media_box.0 + pos_x * page_width;
    let abs_y = media_box.1 + (1.0 - pos_y) * page_height;

    // Parse color
    let (r, g, b) = crate::contrast::parse_hex_color(color_hex)
        .unwrap_or((0, 0, 0));
    let rf = r as f32 / 255.0;
    let gf = g as f32 / 255.0;
    let bf = b as f32 / 255.0;

    let line_height = font_size * 1.3;

    // Build PDF content stream operations
    let mut ops: Vec<Operation> = vec![
        // Save graphics state
        Operation::new("q", vec![]),
        // Set text color (non-stroking)
        Operation::new("rg", vec![
            Object::Real(rf),
            Object::Real(gf),
            Object::Real(bf),
        ]),
        // Begin text
        Operation::new("BT", vec![]),
        // Use Helvetica (standard PDF font — no embedding needed)
        Operation::new("Tf", vec![
            Object::Name(b"Helvetica".to_vec()),
            Object::Real(font_size as f32),
        ]),
    ];

    // Row 3 (bottom-most, smallest)
    let small_size = (font_size * 0.85).max(5.0);
    let rows = [
        (row1, font_size, abs_y),
        (row2, font_size, abs_y - line_height),
        (row3, small_size, abs_y - line_height * 2.1),
    ];

    for (text, size, y) in &rows {
        if text.is_empty() { continue; }
        ops.push(Operation::new("Tf", vec![
            Object::Name(b"Helvetica".to_vec()),
            Object::Real(*size as f32),
        ]));
        // Move-to-absolute using Tm matrix
        ops.push(Operation::new("Tm", vec![
            Object::Real(1.0f32), Object::Real(0.0f32),
            Object::Real(0.0f32), Object::Real(1.0f32),
            Object::Real(abs_x as f32), Object::Real(*y as f32),
        ]));
        ops.push(Operation::new("Tj", vec![
            Object::string_literal(text.as_bytes()),
        ]));
    }

    ops.push(Operation::new("ET", vec![]));
    // We need to ensure Helvetica is in the page's font resources
    ops.push(Operation::new("Q", vec![]));

    // Remove the Td operations (they conflict with Tm); clean up ops
    let ops: Vec<Operation> = ops.into_iter().filter(|op| op.operator != "Td").collect();

    let content = Content { operations: ops };
    let encoded = content.encode()?;

    let watermark_stream = Stream::new(Dictionary::new(), encoded);
    let watermark_ref = doc.add_object(Object::Stream(watermark_stream));

    // Ensure Helvetica is registered in the page's Resources > Font dictionary
    ensure_helvetica_resource(doc, page_id)?;

    // Append this stream to the page's Contents
    append_to_page_contents(doc, page_id, watermark_ref)?;

    Ok(())
}

fn get_media_box(page: &lopdf::Dictionary, _doc: &Document) -> Result<(f64, f64, f64, f64)> {
    if let Ok(mb) = page.get(b"MediaBox") {
        if let Ok(arr) = mb.as_array() {
            if arr.len() == 4 {
                let x0 = arr[0].as_float().unwrap_or(0.0) as f64;
                let y0 = arr[1].as_float().unwrap_or(0.0) as f64;
                let x1 = arr[2].as_float().unwrap_or(612.0) as f64;
                let y1 = arr[3].as_float().unwrap_or(792.0) as f64;
                return Ok((x0, y0, x1, y1));
            }
        }
    }
    // Default: US Letter
    Ok((0.0, 0.0, 612.0, 792.0))
}

fn ensure_helvetica_resource(doc: &mut Document, page_id: lopdf::ObjectId) -> Result<()> {
    let page = doc.get_object_mut(page_id)?.as_dict_mut()?;

    // Get or create Resources dict
    let resources_exists = page.get(b"Resources").is_ok();
    if !resources_exists {
        page.set(b"Resources", Object::Dictionary(Dictionary::new()));
    }

    // We need to navigate into Resources > Font > Helvetica
    // lopdf doesn't give us deep mutable refs easily, so we rebuild the Resources dict.
    let resources_clone = page.get(b"Resources")?.clone();
    let mut resources_dict = match resources_clone {
        Object::Dictionary(d) => d,
        Object::Reference(r) => {
            doc.get_object(r)?.as_dict()?.clone()
        }
        _ => Dictionary::new(),
    };

    let font_dict_clone = resources_dict.get(b"Font")
        .ok()
        .and_then(|o| o.as_dict().ok())
        .cloned()
        .unwrap_or_default();

    let mut font_dict = font_dict_clone;

    if font_dict.get(b"Helvetica").is_err() {
        let mut helvetica = Dictionary::new();
        helvetica.set(b"Type", Object::Name(b"Font".to_vec()));
        helvetica.set(b"Subtype", Object::Name(b"Type1".to_vec()));
        helvetica.set(b"BaseFont", Object::Name(b"Helvetica".to_vec()));
        helvetica.set(b"Encoding", Object::Name(b"WinAnsiEncoding".to_vec()));
        font_dict.set(b"Helvetica", Object::Dictionary(helvetica));
    }

    resources_dict.set(b"Font", Object::Dictionary(font_dict));

    // Write resources back — handle indirect ref case
    let page = doc.get_object_mut(page_id)?.as_dict_mut()?;
    page.set(b"Resources", Object::Dictionary(resources_dict));

    Ok(())
}

fn append_to_page_contents(
    doc: &mut Document,
    page_id: lopdf::ObjectId,
    new_stream_ref: lopdf::ObjectId,
) -> Result<()> {
    let page = doc.get_object_mut(page_id)?.as_dict_mut()?;

    let existing = page.get(b"Contents").ok().cloned();
    match existing {
        None => {
            page.set(b"Contents", Object::Reference(new_stream_ref));
        }
        Some(Object::Reference(r)) => {
            page.set(
                b"Contents",
                Object::Array(vec![
                    Object::Reference(r),
                    Object::Reference(new_stream_ref),
                ]),
            );
        }
        Some(Object::Array(mut arr)) => {
            arr.push(Object::Reference(new_stream_ref));
            page.set(b"Contents", Object::Array(arr));
        }
        _ => {
            page.set(b"Contents", Object::Reference(new_stream_ref));
        }
    }

    Ok(())
}
