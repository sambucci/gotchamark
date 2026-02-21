use anyhow::Result;
use lopdf::Document;

const GOTCHAMARK_KEY: &[u8] = b"GotchaMark-ID";

/// Check if a PDF already has a GotchaMark watermark.
/// Returns Some(id) if already marked, None if clean.
pub fn detect(pdf_bytes: &[u8]) -> Result<Option<String>> {
    let doc = Document::load_mem(pdf_bytes)?;
    let trailer = &doc.trailer;

    // Check document-level Info dictionary for GotchaMark-ID
    if let Ok(info_ref) = trailer.get(b"Info") {
        if let Ok(info_id) = info_ref.as_reference() {
            if let Ok(info_obj) = doc.get_object(info_id) {
                if let Ok(dict) = info_obj.as_dict() {
                    if let Ok(val) = dict.get(GOTCHAMARK_KEY) {
                        if let Ok(s) = val.as_str() {
                            return Ok(Some(String::from_utf8_lossy(s).to_string()));
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Embed the GotchaMark-ID into the PDF Info dictionary.
pub fn embed_id(doc: &mut lopdf::Document, mark_id: &str) {
    use lopdf::Object;

    // Get or create Info dictionary
    let info_ref = doc.trailer.get(b"Info").and_then(|o| o.as_reference()).ok();

    if let Some(id) = info_ref {
        if let Ok(obj) = doc.get_object_mut(id) {
            if let Ok(dict) = obj.as_dict_mut() {
                dict.set(
                    GOTCHAMARK_KEY,
                    Object::string_literal(mark_id),
                );
            }
        }
    } else {
        // Create a new Info dict
        let mut dict = lopdf::Dictionary::new();
        dict.set(GOTCHAMARK_KEY, Object::string_literal(mark_id));
        let new_ref = doc.add_object(lopdf::Object::Dictionary(dict));
        doc.trailer.set(b"Info", lopdf::Object::Reference(new_ref));
    }
}
