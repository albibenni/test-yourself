import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [todoistToken, setTodoistToken] = useState("");
  const [vaultName, setVaultName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTodoistToken(localStorage.getItem("todoist_token") || "");
      setVaultName(localStorage.getItem("obsidian_vault") || "");
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem("todoist_token", todoistToken);
    localStorage.setItem("obsidian_vault", vaultName);
    onClose();
  };

  const selectVaultFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        // Extract the folder name from the path
        const isWindows = selected.includes("\\");
        const parts = selected.split(isWindows ? "\\" : "/");
        const folderName = parts[parts.length - 1];
        if (folderName) {
          setVaultName(folderName);
        }
      }
    } catch (err) {
      console.error("Failed to select vault directory", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Settings</h2>
        <div className="form-group">
          <label>Todoist API Token</label>
          <input
            type="password"
            placeholder="Enter your Todoist API token"
            value={todoistToken}
            onChange={(e) => setTodoistToken(e.target.value)}
          />
          <small>
            You can find this in Todoist Settings &gt; Integrations &gt; Developer.
          </small>
        </div>
        <div className="form-group">
          <label>Obsidian Vault Name</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              style={{ flex: 1 }}
              placeholder="e.g. MyVault"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
            />
            <button className="button-secondary" onClick={() => void selectVaultFolder()}>
              Browse...
            </button>
          </div>
          <small>Used to generate obsidian://open links.</small>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
