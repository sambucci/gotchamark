use anyhow::Result;
use lopdf::Document;

const GOTCHAMARK_KEY: &[u8] = b"GotchaMark-ID";

/// Check if a PDF already has a GotchaMark watermark.
/// Returns Some(id) if already marked, None if clean.
/// Checks two locations in order:
///   1. The PDF Info dictionary (fast, most common)
///   2. The XMP metadata stream on the document catalog (fallback — survives
///      pipelines that rebuild or strip the Info dict)
pub fn detect(pdf_bytes: &[u8]) -> Result<Option<String>> {
    let doc = Document::load_mem(pdf_bytes)?;
    let trailer = &doc.trailer;

    // ── 1. Info dictionary ────────────────────────────────────────────────────
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

    // ── 2. XMP metadata stream (catalog Metadata entry) ──────────────────────
    if let Ok(catalog_ref) = trailer.get(b"Root").and_then(|o| o.as_reference()) {
        if let Ok(lopdf::Object::Stream(stream)) = doc
            .get_object(catalog_ref)
            .and_then(|o| o.as_dict())
            .and_then(|d| d.get(b"Metadata"))
            .and_then(|o| o.as_reference())
            .and_then(|r| doc.get_object(r))
            .map(|o| o.clone())
        {
            if let Ok(xml) = std::str::from_utf8(&stream.content) {
                if let Some(id) = extract_xmp_mark_id(xml) {
                    return Ok(Some(id));
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

/// Embed the GotchaMark-ID as an XMP metadata stream on the document catalog.
///
/// XMP streams are stored in the PDF catalog (not the trailer), making them
/// more resilient to processing pipelines that rebuild or strip the Info dict.
/// They are also natively extracted by forensic tools such as ExifTool, enabling
/// security researchers to scan large dumps without any GotchaMark-specific tooling:
///
///   exiftool -r -GotchaMark:all /dump/
///   grep -rl "gotchamark:MarkID" /dump/
pub fn embed_xmp(doc: &mut lopdf::Document, mark_id: &str) {
    use lopdf::{Dictionary, Object, Stream};

    let xml = build_xmp_packet(mark_id);

    let mut stream_dict = Dictionary::new();
    stream_dict.set(b"Type",    Object::Name(b"Metadata".to_vec()));
    stream_dict.set(b"Subtype", Object::Name(b"XML".to_vec()));
    let stream = Stream::new(stream_dict, xml.into_bytes());
    let stream_ref = doc.add_object(Object::Stream(stream));

    // Attach to the document catalog under the standard "Metadata" key
    if let Ok(catalog_id) = doc.trailer
        .get(b"Root")
        .and_then(|o| o.as_reference())
    {
        if let Ok(obj) = doc.get_object_mut(catalog_id) {
            if let Ok(catalog) = obj.as_dict_mut() {
                catalog.set(b"Metadata", Object::Reference(stream_ref));
            }
        }
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Build a well-formed XMP packet containing the GotchaMark mark ID.
/// Uses a custom namespace `https://gotchamark.net/xmp/1.0/`.
/// The `<?xpacket?>` wrappers are required by the XMP spec and allow
/// in-place editing by compliant tools without full re-serialisation.
fn build_xmp_packet(mark_id: &str) -> String {
    // Escape the mark_id for XML (IDs are alphanumeric + hyphens, but be safe)
    let escaped = xml_escape(mark_id);
    format!(
        "<?xpacket begin=\"\u{FEFF}\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n\
         <x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n\
           <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\
             <rdf:Description rdf:about=\"\"\n\
                 xmlns:gotchamark=\"https://gotchamark.net/xmp/1.0/\">\n\
               <gotchamark:MarkID>{}</gotchamark:MarkID>\n\
               <gotchamark:Version>1</gotchamark:Version>\n\
             </rdf:Description>\n\
           </rdf:RDF>\n\
         </x:xmpmeta>\n\
         <?xpacket end=\"w\"?>",
        escaped
    )
}

/// Extract the GotchaMark ID from an XMP XML string.
/// Looks for the value between `<gotchamark:MarkID>` and `</gotchamark:MarkID>`.
/// No XML parser needed — the format is fully under our control.
fn extract_xmp_mark_id(xml: &str) -> Option<String> {
    const OPEN:  &str = "<gotchamark:MarkID>";
    const CLOSE: &str = "</gotchamark:MarkID>";
    let start = xml.find(OPEN)? + OPEN.len();
    let end   = xml[start..].find(CLOSE)? + start;
    let id = xml[start..end].trim().to_string();
    if id.is_empty() { None } else { Some(id) }
}

/// Minimal XML character escaping for embedding values inside element content.
fn xml_escape(s: &str) -> String {
    s.chars().fold(String::with_capacity(s.len()), |mut out, c| {
        match c {
            '&'  => out.push_str("&amp;"),
            '<'  => out.push_str("&lt;"),
            '>'  => out.push_str("&gt;"),
            '"'  => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _    => out.push(c),
        }
        out
    })
}
