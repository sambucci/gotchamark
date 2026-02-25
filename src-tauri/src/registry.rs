use anyhow::Result;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::config::db_path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatermarkRecord {
    pub id: String,
    pub pdf_hash: String,
    pub source_name: Option<String>,   // filename of the original PDF (no directory)
    pub source_dir: Option<String>,    // directory of the original PDF
    pub output_path: Option<String>,
    pub recipient: Option<String>,
    pub date: Option<String>,
    pub custom_text: Option<String>,
    pub internal_note: Option<String>,
    pub prefix: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub font_color: String,
    pub font_size: f64,
    pub created_at: String,
}

fn open() -> Result<Connection> {
    let path = db_path()?;
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    Ok(conn)
}

pub fn init_db() -> Result<()> {
    let conn = open()?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS watermarks (
            id            TEXT PRIMARY KEY,
            pdf_hash      TEXT NOT NULL,
            source_name   TEXT,
            source_dir    TEXT,
            output_path   TEXT,
            recipient     TEXT,
            date          TEXT,
            custom_text   TEXT,
            internal_note TEXT,
            prefix        TEXT,
            position_x    REAL NOT NULL DEFAULT 0.05,
            position_y    REAL NOT NULL DEFAULT 0.95,
            font_color    TEXT NOT NULL DEFAULT '#000000',
            font_size     REAL NOT NULL DEFAULT 8.0,
            created_at    TEXT NOT NULL
        );",
    )?;
    // Migrations for databases created before schema additions
    let _ = conn.execute_batch("ALTER TABLE watermarks ADD COLUMN internal_note TEXT;");
    let _ = conn.execute_batch("ALTER TABLE watermarks ADD COLUMN source_name TEXT;");
    let _ = conn.execute_batch("ALTER TABLE watermarks ADD COLUMN source_dir TEXT;");
    // Rename sent_date → date if the old column still exists
    let _ = conn.execute_batch(
        "ALTER TABLE watermarks RENAME COLUMN sent_date TO date;"
    );
    Ok(())
}

/// Returns true if a record with the given ID already exists in the registry.
pub fn exists(id: &str) -> Result<bool> {
    let conn = open()?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM watermarks WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn insert(record: &WatermarkRecord) -> Result<()> {
    let conn = open()?;
    conn.execute(
        "INSERT INTO watermarks
            (id, pdf_hash, source_name, source_dir, output_path, recipient, date,
             custom_text, internal_note, prefix, position_x, position_y,
             font_color, font_size, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
        params![
            record.id,
            record.pdf_hash,
            record.source_name,
            record.source_dir,
            record.output_path,
            record.recipient,
            record.date,
            record.custom_text,
            record.internal_note,
            record.prefix,
            record.position_x,
            record.position_y,
            record.font_color,
            record.font_size,
            record.created_at,
        ],
    )?;
    Ok(())
}

pub fn delete(id: &str) -> Result<()> {
    let conn = open()?;
    conn.execute("DELETE FROM watermarks WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn all() -> Result<Vec<WatermarkRecord>> {
    let conn = open()?;
    let mut stmt = conn.prepare(
        "SELECT id, pdf_hash, source_name, source_dir, output_path, recipient, date,
                custom_text, internal_note, prefix, position_x, position_y,
                font_color, font_size, created_at
         FROM watermarks ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WatermarkRecord {
            id:            row.get(0)?,
            pdf_hash:      row.get(1)?,
            source_name:   row.get(2)?,
            source_dir:    row.get(3)?,
            output_path:   row.get(4)?,
            recipient:     row.get(5)?,
            date:          row.get(6)?,
            custom_text:   row.get(7)?,
            internal_note: row.get(8)?,
            prefix:        row.get(9)?,
            position_x:    row.get(10)?,
            position_y:    row.get(11)?,
            font_color:    row.get(12)?,
            font_size:     row.get(13)?,
            created_at:    row.get(14)?,
        })
    })?;
    let mut records = Vec::new();
    for r in rows { records.push(r?); }
    Ok(records)
}

pub fn search(query: &str) -> Result<Vec<WatermarkRecord>> {
    const MAX_QUERY: usize = 200;
    if query.len() > MAX_QUERY {
        return Err(anyhow::anyhow!(
            "Search query exceeds maximum length ({} chars)", MAX_QUERY
        ));
    }
    let conn = open()?;
    let like = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, pdf_hash, source_name, source_dir, output_path, recipient, date,
                custom_text, internal_note, prefix, position_x, position_y,
                font_color, font_size, created_at
         FROM watermarks
         WHERE id LIKE ?1 OR recipient LIKE ?1 OR custom_text LIKE ?1
            OR date LIKE ?1 OR internal_note LIKE ?1
            OR source_name LIKE ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![like], |row| {
        Ok(WatermarkRecord {
            id:            row.get(0)?,
            pdf_hash:      row.get(1)?,
            source_name:   row.get(2)?,
            source_dir:    row.get(3)?,
            output_path:   row.get(4)?,
            recipient:     row.get(5)?,
            date:          row.get(6)?,
            custom_text:   row.get(7)?,
            internal_note: row.get(8)?,
            prefix:        row.get(9)?,
            position_x:    row.get(10)?,
            position_y:    row.get(11)?,
            font_color:    row.get(12)?,
            font_size:     row.get(13)?,
            created_at:    row.get(14)?,
        })
    })?;
    let mut records = Vec::new();
    for r in rows { records.push(r?); }
    Ok(records)
}

/// Export all records as a JSON string.
pub fn export_json() -> Result<String> {
    let records = all()?;
    Ok(serde_json::to_string_pretty(&records)?)
}

/// Update the internal note for an existing record.
/// Returns an error if no record with the given ID exists.
pub fn update_note(id: &str, note: Option<&str>) -> Result<()> {
    let conn = open()?;
    let rows = conn.execute(
        "UPDATE watermarks SET internal_note = ?1 WHERE id = ?2",
        params![note, id],
    )?;
    if rows == 0 {
        return Err(anyhow::anyhow!("No record found with ID: {}", id));
    }
    Ok(())
}

/// Import records from a JSON string (array of WatermarkRecord).
/// Skips records whose ID already exists in the registry.
/// Returns (imported, skipped).
pub fn import_json(json: &str) -> Result<(usize, usize)> {
    let records: Vec<WatermarkRecord> = serde_json::from_str(json)
        .map_err(|e| anyhow::anyhow!("Invalid JSON: {}", e))?;
    let conn = open()?;
    let mut imported = 0usize;
    let mut skipped  = 0usize;
    for r in &records {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM watermarks WHERE id = ?1",
            params![r.id],
            |row| row.get(0),
        )?;
        if count > 0 {
            skipped += 1;
            continue;
        }
        conn.execute(
            "INSERT INTO watermarks
                (id, pdf_hash, source_name, source_dir, output_path, recipient, date,
                 custom_text, internal_note, prefix, position_x, position_y,
                 font_color, font_size, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                r.id, r.pdf_hash, r.source_name, r.source_dir, r.output_path,
                r.recipient, r.date, r.custom_text, r.internal_note, r.prefix,
                r.position_x, r.position_y, r.font_color, r.font_size, r.created_at,
            ],
        )?;
        imported += 1;
    }
    Ok((imported, skipped))
}
