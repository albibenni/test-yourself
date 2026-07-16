import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { STORE_FILENAME } from "../constants";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [todoistToken, setTodoistToken] = useState("");
  const [vaultName, setVaultName] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      if (isOpen) {
        const store = await load(STORE_FILENAME, { autoSave: false });
        const token = await store.get<string>("todoist_token");
        const vault = await store.get<string>("obsidian_vault");

        // Fallback to localStorage for backward compatibility initially
        setTodoistToken(token || localStorage.getItem("todoist_token") || "");
        setVaultName(vault || localStorage.getItem("obsidian_vault") || "");
      }
    }
    void fetchSettings();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false });
    await store.set("todoist_token", todoistToken);
    await store.set("obsidian_vault", vaultName);
    await store.save();

    // Clean up old unencrypted localStorage if present
    localStorage.removeItem("todoist_token");
    localStorage.removeItem("obsidian_vault");

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
            You can find this in Todoist Settings &gt; Integrations &gt;
            Developer.
          </small>
        </div>
        <div className="form-group">
          <label>Obsidian Vault Name</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              style={{ flex: 1 }}
              placeholder="e.g. MyVault"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
            />
            <button
              className="button-secondary"
              onClick={() => void selectVaultFolder()}
            >
              Browse...
            </button>
          </div>
          <small>Used to generate obsidian://open links.</small>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" onClick={() => void handleSave()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
