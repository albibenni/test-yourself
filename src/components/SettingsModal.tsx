import React, { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { TodoistApi } from "@doist/todoist-sdk";
import { STORE_FILENAME } from "../constants";

interface Project {
  id: string;
  name: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomSelectProps {
  value: string | number;
  options: { label: React.ReactNode; value: string | number }[];
  onChange: (value: any) => void;
  disabled?: boolean;
}

function CustomSelect({ value, options, onChange, disabled }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div style={{ position: "relative", width: "100%" }} ref={containerRef}>
      <button
        type="button"
        className="custom-select-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption ? selectedOption.label : "Select..."}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && !disabled && (
        <div className="project-dropdown" style={{ top: "calc(100% + 4px)", left: 0, right: 0, width: "100%", zIndex: 10, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
          {options.filter((o) => o.value !== value).map((o) => (
            <button
              key={o.value}
              type="button"
              className="project-dropdown-item"
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [todoistToken, setTodoistToken] = useState("");
  const [vaultName, setVaultName] = useState("");
  
  const [defaultDate, setDefaultDate] = useState("tomorrow");
  const [defaultPriority, setDefaultPriority] = useState<number>(4);
  const [defaultProject, setDefaultProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      if (isOpen) {
        const store = await load(STORE_FILENAME, { autoSave: false });
        const token = await store.get<string>("todoist_token");
        const vault = await store.get<string>("obsidian_vault");

        // Fallback to localStorage for backward compatibility initially
        setTodoistToken(token || localStorage.getItem("todoist_token") || "");
        setVaultName(vault || localStorage.getItem("obsidian_vault") || "");
        
        const defDate = await store.get<string>("default_todoist_date");
        const defPri = await store.get<number>("default_todoist_priority");
        const defProj = await store.get<string>("default_todoist_project");
        if (defDate) setDefaultDate(defDate);
        if (defPri) setDefaultPriority(defPri);
        if (defProj) setDefaultProject(defProj);
      }
    }
    void fetchSettings();
  }, [isOpen]);

  useEffect(() => {
    async function fetchProjects() {
      if (!todoistToken || !isOpen) return;
      setLoadingProjects(true);
      try {
        const api = new TodoistApi(todoistToken);
        const response = await api.getProjects();
        // The API might return { results: Project[] } or Project[] directly depending on the SDK version
        const projs = (response as any).results || response;
        setProjects(projs as Project[]);
      } catch (err) {
        console.error("Failed to fetch projects for settings", err);
      } finally {
        setLoadingProjects(false);
      }
    }
    const timeout = setTimeout(() => {
      void fetchProjects();
    }, 500);
    return () => clearTimeout(timeout);
  }, [todoistToken, isOpen]);

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
    await store.set("default_todoist_date", defaultDate);
    await store.set("default_todoist_priority", defaultPriority);
    await store.set("default_todoist_project", defaultProject);
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
        
        <h3 style={{ marginTop: "0.5rem", fontSize: "1rem", color: "var(--text-primary)" }}>Todoist Presets</h3>
        
        <div className="form-group">
          <label>Default Schedule Date</label>
          <CustomSelect
            value={defaultDate}
            onChange={setDefaultDate}
            options={[
              { label: "Today", value: "today" },
              { label: "Tomorrow", value: "tomorrow" },
              { label: "Next Week (7 days)", value: "in 7 days" },
              { label: "In 2 Weeks (14 days)", value: "in 14 days" },
            ]}
          />
        </div>

        <div className="form-group">
          <label>Default Priority</label>
          <CustomSelect
            value={defaultPriority}
            onChange={(val) => setDefaultPriority(Number(val))}
            options={[
              { label: <span style={{ color: "#d1453b" }}>Priority 1</span>, value: 4 },
              { label: <span style={{ color: "#eb8909" }}>Priority 2</span>, value: 3 },
              { label: <span style={{ color: "#246fe0" }}>Priority 3</span>, value: 2 },
              { label: <span>Priority 4</span>, value: 1 },
            ]}
          />
        </div>

        <div className="form-group">
          <label>Default Project</label>
          <CustomSelect
            value={defaultProject}
            onChange={setDefaultProject}
            disabled={loadingProjects}
            options={[
              { label: "Inbox (Default)", value: "" },
              ...projects.map((p) => ({ label: p.name, value: p.id })),
            ]}
          />
          {loadingProjects && <small>Loading projects...</small>}
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
