use anyhow::Result;
use dirs::data_dir;
use std::path::PathBuf;

/// Returns the platform-appropriate data directory for GotchaMark.
/// Linux:   ~/.local/share/gotchamark/
/// Windows: %APPDATA%\gotchamark\
/// macOS:   ~/Library/Application Support/gotchamark/
pub fn app_data_dir() -> Result<PathBuf> {
    let mut path = data_dir().ok_or_else(|| anyhow::anyhow!("Could not determine data directory"))?;
    path.push("gotchamark");
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

/// Returns the path to the SQLite database file.
pub fn db_path() -> Result<PathBuf> {
    let mut path = app_data_dir()?;
    path.push("registry.db");
    Ok(path)
}
