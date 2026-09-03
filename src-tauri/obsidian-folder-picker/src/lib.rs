use tauri::{plugin::PluginHandle, Runtime};

#[cfg(target_os = "ios")]
use serde::Deserialize;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_obsidian_folder_picker);

#[cfg(target_os = "ios")]
#[derive(Debug, Deserialize)]
struct FolderPickerResponse {
    path: Option<String>,
}

pub struct ObsidianFolderPicker<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "ios")]
impl<R: Runtime> ObsidianFolderPicker<R> {
    pub async fn pick(&self) -> Result<Option<String>, String> {
        self.0
            .run_mobile_plugin_async::<FolderPickerResponse>("pickFolder", ())
            .await
            .map(|response| response.path)
            .map_err(|error| error.to_string())
    }
}

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("obsidian-folder-picker")
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let handle = api.register_ios_plugin(init_plugin_obsidian_folder_picker)?;

            #[cfg(not(target_os = "ios"))]
            let _handle = api;

            #[cfg(target_os = "ios")]
            app.manage(ObsidianFolderPicker(handle));
            let _ = app;
            Ok(())
        })
        .build()
}
