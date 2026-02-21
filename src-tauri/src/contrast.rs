/// WCAG 2.1 color contrast enforcement.
/// Ensures watermark text is always legible against the background.

/// Parse a hex color string (#RRGGBB or #RGB) into (r, g, b) 0–255.
pub fn parse_hex_color(hex: &str) -> Option<(u8, u8, u8)> {
    let h = hex.trim_start_matches('#');
    match h.len() {
        6 => {
            let r = u8::from_str_radix(&h[0..2], 16).ok()?;
            let g = u8::from_str_radix(&h[2..4], 16).ok()?;
            let b = u8::from_str_radix(&h[4..6], 16).ok()?;
            Some((r, g, b))
        }
        3 => {
            let r = u8::from_str_radix(&h[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&h[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&h[2..3].repeat(2), 16).ok()?;
            Some((r, g, b))
        }
        _ => None,
    }
}

/// WCAG relative luminance for a single 8-bit channel value.
fn channel_luminance(c: u8) -> f64 {
    let v = c as f64 / 255.0;
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055f64).powf(2.4)
    }
}

/// WCAG relative luminance of an RGB color.
pub fn relative_luminance(r: u8, g: u8, b: u8) -> f64 {
    0.2126 * channel_luminance(r)
        + 0.7152 * channel_luminance(g)
        + 0.0722 * channel_luminance(b)
}

/// WCAG contrast ratio between two colors.
/// Returns a value between 1.0 (no contrast) and 21.0 (black on white).
pub fn contrast_ratio(fg: (u8, u8, u8), bg: (u8, u8, u8)) -> f64 {
    let l1 = relative_luminance(fg.0, fg.1, fg.2);
    let l2 = relative_luminance(bg.0, bg.1, bg.2);
    let (lighter, darker) = if l1 > l2 { (l1, l2) } else { (l2, l1) };
    (lighter + 0.05) / (darker + 0.05)
}

/// Minimum contrast ratio we enforce (WCAG AA for normal text).
pub const MIN_CONTRAST_RATIO: f64 = 4.5;

/// Check if two hex colors have sufficient contrast.
/// Returns Ok(ratio) if sufficient, Err(ratio) if not.
pub fn check_contrast(fg_hex: &str, bg_hex: &str) -> Result<f64, f64> {
    let fg = parse_hex_color(fg_hex).unwrap_or((0, 0, 0));
    let bg = parse_hex_color(bg_hex).unwrap_or((255, 255, 255));
    let ratio = contrast_ratio(fg, bg);
    if ratio >= MIN_CONTRAST_RATIO {
        Ok(ratio)
    } else {
        Err(ratio)
    }
}

/// Suggest a fallback color (black or white) with guaranteed contrast against the given background.
pub fn suggest_fallback(bg_hex: &str) -> &'static str {
    let bg = parse_hex_color(bg_hex).unwrap_or((255, 255, 255));
    let lum = relative_luminance(bg.0, bg.1, bg.2);
    // White background → suggest black; dark background → suggest white
    if lum > 0.179 { "#000000" } else { "#FFFFFF" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn black_on_white_is_max_contrast() {
        let ratio = contrast_ratio((0,0,0), (255,255,255));
        assert!((ratio - 21.0).abs() < 0.1);
    }

    #[test]
    fn white_on_white_fails() {
        assert!(check_contrast("#FFFFFF", "#FFFFFF").is_err());
    }

    #[test]
    fn black_on_white_passes() {
        assert!(check_contrast("#000000", "#FFFFFF").is_ok());
    }
}
