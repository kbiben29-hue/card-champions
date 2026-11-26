//! Card Champions desktop shell. The app itself is the web build in `dist/`; card pictures are
//! loaded by the web page from marvelcdb.com.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Card Champions");
}
