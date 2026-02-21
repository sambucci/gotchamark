use anyhow::Result;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::config::db_path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatermarkRecord {
    pub id: String,
    pub pdf_hash: String,
    pub output_path: Option<String>,
    pub recipient: Option<String>,
    pub sent_date: Option<String>,
    pub custom_text: Option<String>,
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
            id           TEXT PRIMARY KEY,
            pdf_hash     TEXT NOT NULL,
            output_path  TEXT,
            recipient    TEXT,
            sent_date    TEXT,
            custom_text  TEXT,
            prefix       TEXT,
            position_x   REAL NOT NULL DEFAULT 0.05,
            position_y   REAL NOT NULL DEFAULT 0.95,
            font_color   TEXT NOT NULL DEFAULT '#000000',
            font_size    REAL NOT NULL DEFAULT 8.0,
            created_at   TEXT NOT NULL
        );",
    )?;
    Ok(())
}

pub fn insert(record: &WatermarkRecord) -> Result<()> {
    let conn = open()?;
    conn.execute(
        "INSERT INTO watermarks
            (id, pdf_hash, output_path, recipient, sent_date, custom_text,
             prefix, position_x, position_y, font_color, font_size, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![
            record.id,
            record.pdf_hash,
            record.output_path,
            record.recipient,
            record.sent_date,
            record.custom_text,
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

pub fn all() -> Result<Vec<WatermarkRecord>> {
    let conn = open()?;
    let mut stmt = conn.prepare(
        "SELECT id, pdf_hash, output_path, recipient, sent_date, custom_text,
                prefix, position_x, position_y, font_color, font_size, created_at
         FROM watermarks ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WatermarkRecord {
            id:          row.get(0)?,
            pdf_hash:    row.get(1)?,
            output_path: row.get(2)?,
            recipient:   row.get(3)?,
            sent_date:   row.get(4)?,
            custom_text: row.get(5)?,
            prefix:      row.get(6)?,
            position_x:  row.get(7)?,
            position_y:  row.get(8)?,
            font_color:  row.get(9)?,
            font_size:   row.get(10)?,
            created_at:  row.get(11)?,
        })
    })?;
    let mut records = Vec::new();
    for r in rows { records.push(r?); }
    Ok(records)
}

pub fn search(query: &str) -> Result<Vec<WatermarkRecord>> {
    let conn = open()?;
    let like = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, pdf_hash, output_path, recipient, sent_date, custom_text,
                prefix, position_x, position_y, font_color, font_size, created_at
         FROM watermarks
         WHERE id LIKE ?1 OR recipient LIKE ?1 OR custom_text LIKE ?1 OR sent_date LIKE ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![like], |row| {
        Ok(WatermarkRecord {
            id:          row.get(0)?,
            pdf_hash:    row.get(1)?,
            output_path: row.get(2)?,
            recipient:   row.get(3)?,
            sent_date:   row.get(4)?,
            custom_text: row.get(5)?,
            prefix:      row.get(6)?,
            position_x:  row.get(7)?,
            position_y:  row.get(8)?,
            font_color:  row.get(9)?,
            font_size:   row.get(10)?,
            created_at:  row.get(11)?,
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

/// Export all records as a CSV string.
pub fn export_csv() -> Result<String> {
    let records = all()?;
    let mut out = String::from(
        "id,pdf_hash,output_path,recipient,sent_date,custom_text,prefix,position_x,position_y,font_color,font_size,created_at\n"
    );
    for r in records {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{},{},{}\n",
            csv_field(&r.id),
            csv_field(&r.pdf_hash),
            csv_field(&r.output_path.unwrap_or_default()),
            csv_field(&r.recipient.unwrap_or_default()),
            csv_field(&r.sent_date.unwrap_or_default()),
            csv_field(&r.custom_text.unwrap_or_default()),
            csv_field(&r.prefix.unwrap_or_default()),
            r.position_x,
            r.position_y,
            csv_field(&r.font_color),
            r.font_size,
            csv_field(&r.created_at),
        ));
    }
    Ok(out)
}

fn csv_field(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
