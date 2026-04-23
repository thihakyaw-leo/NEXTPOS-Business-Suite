#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use mac_address::get_mac_address;
use sha2::{Digest, Sha256};
use std::process::Command;

#[tauri::command]
fn get_hardware_id() -> Result<String, String> {
    let motherboard_serial = normalize_component(read_motherboard_serial(), "UNKNOWN-BOARD");
    let hostname = normalize_component(
        hostname::get()
            .ok()
            .map(|value| value.to_string_lossy().to_string()),
        "UNKNOWN-HOST",
    );
    let mac_address = normalize_component(
        get_mac_address()
            .ok()
            .flatten()
            .map(|value| value.to_string()),
        "UNKNOWN-MAC",
    );

    let raw_fingerprint = format!(
        "board:{motherboard_serial}|host:{hostname}|mac:{mac_address}"
    );

    let mut hasher = Sha256::new();
    hasher.update(raw_fingerprint.as_bytes());

    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(target_os = "windows")]
fn read_motherboard_serial() -> Option<String> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-CimInstance Win32_BaseBoard | Select-Object -First 1 -ExpandProperty SerialNumber)",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let serial = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if serial.is_empty() {
        None
    } else {
        Some(serial)
    }
}

#[cfg(not(target_os = "windows"))]
fn read_motherboard_serial() -> Option<String> {
    None
}

fn normalize_component(value: Option<String>, fallback: &str) -> String {
    match value {
        Some(value) => {
            let trimmed = value.trim();

            if trimmed.is_empty() {
                fallback.to_string()
            } else {
                trimmed.to_uppercase()
            }
        }
        None => fallback.to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_hardware_id])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
