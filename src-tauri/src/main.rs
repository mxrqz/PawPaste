#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clipboard_win::{formats, get_clipboard, set_clipboard};
use enigo::{Enigo, MouseControllable};
use rsautogui::{keyboard, keyboard::Vk};
use selection::get_text;
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};
use window_shadows::set_shadow;
use window_vibrancy::apply_acrylic;

#[tauri::command]
fn paste_text() {
    keyboard::key_down(Vk::Control);
    keyboard::key_tap(Vk::V);
    keyboard::key_up(Vk::Control);
}

#[tauri::command]
fn copy_text() -> Result<String, String> {
    let text = get_text();
    set_clipboard(formats::Unicode, &text).map_err(|e| e.to_string())?;
    let result: String = get_clipboard(formats::Unicode).map_err(|e| e.to_string())?;
    assert_eq!(result, text);
    Ok(text)
}

#[tauri::command]
fn get_mouse_location() -> Result<String, String> {
    let enigo = Enigo::new();
    let cursor_location = enigo.mouse_location();
    let position_string = format!("({}, {})", cursor_location.0, cursor_location.1);
    Ok(position_string)
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit").accelerator("CommandOrControl+Q");
    let tray_menu = SystemTrayMenu::new().add_item(quit);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            paste_text,
            copy_text,
            get_mouse_location
        ])
        .system_tray(SystemTray::new().with_id("PawPaste").with_menu(tray_menu).with_tooltip("PawPaste"))
        .setup(|app| {
            let paw_paste = app.get_window("pawpaste").unwrap();
            let paw_copy = app.get_window("pawcopy").unwrap();

            #[cfg(any(windows, target_os = "macos"))]
            set_shadow(&paw_paste, true).unwrap();
            set_shadow(&paw_copy, true).unwrap();

            #[cfg(target_os = "windows")]
            apply_acrylic(&paw_paste, Some((125, 125, 125, 125)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
            apply_acrylic(&paw_copy, Some((125, 125, 125, 125)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
            
            Ok(())
        })
        .on_system_tray_event(|_app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
