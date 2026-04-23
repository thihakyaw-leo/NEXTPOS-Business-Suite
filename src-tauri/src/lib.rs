#[tauri::command]
fn print_receipt(receipt_text: String) -> Result<String, String> {
    // Hardware Output Emulation
    // In production, an ESC/POS connection crate would reside here.
    println!("========== THERMAL PRINTER MOCK ==========");
    println!("{}", receipt_text);
    println!("==========================================");
    
    Ok("Mock Receipt Printed Successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![print_receipt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
