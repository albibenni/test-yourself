import React, { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { load } from "@tauri-apps/plugin-store";
import { TodoistApi } from "@doist/todoist-sdk";
import { check } from "@tauri-apps/plugin-updater";
import { STORE_FILENAME } from "../constants";

interface Project {
  id: string;
  name: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  accent: any;
  textColor: any;
  onThemeChange: (theme: any) => void;
  onAccentChange: (accent: any) => void;
  onTextColorChange: (textColor: any) => void;
  updateAvailable?: string | null;
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

function SettingsSection({ title, defaultOpen = true, forceOpen = false, children, storageKey }: { title: string, defaultOpen?: boolean, forceOpen?: boolean, children: React.ReactNode, storageKey: string }) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(`settings_section_${storageKey}`);
    return saved !== null ? saved === "true" : defaultOpen;
  });

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      localStorage.setItem(`settings_section_${storageKey}`, "true");
    }
  }, [forceOpen, storageKey]);

  const toggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem(`settings_section_${storageKey}`, String(newState));
  };
  return (
    <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: isOpen ? "1rem" : "0.5rem", marginBottom: "0.5rem" }}>
      <button 
        type="button" 
        onClick={toggle} 
        className="settings-accordion-btn"
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
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
      {isOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>{children}</div>}
    </div>
  );
}

export function SettingsModal({ isOpen, onClose, theme, accent, textColor, onThemeChange, onAccentChange, onTextColorChange, updateAvailable }: SettingsModalProps) {
  const [todoistToken, setTodoistToken] = useState("");
  const [vaultName, setVaultName] = useState("");
  
  const [defaultDate, setDefaultDate] = useState("tomorrow");
  const [defaultPriority, setDefaultPriority] = useState<number>(4);
  const [defaultProject, setDefaultProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(updateAvailable ? `Update v${updateAvailable} is available!` : "");
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    if (updateAvailable) {
      setUpdateStatus(`Update v${updateAvailable} is available!`);
    }
  }, [updateAvailable]);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error("Failed to fetch app version", err);
      }
    }
    void fetchVersion();
  }, []);

  const handleCheckUpdate = async () => {
    try {
      setUpdateStatus("Checking for updates...");
      const update = await check();
      if (update) {
        setUpdateStatus(`Downloading update v${update.version}...`);
        await update.downloadAndInstall();
        setUpdateStatus("Update installed. Restarting...");
        await relaunch();
      } else {
        setUpdateStatus("App is up to date!");
        setTimeout(() => setUpdateStatus(""), 3000);
      }
    } catch (error) {
      setUpdateStatus(`Failed to update: ${error}`);
      setTimeout(() => setUpdateStatus(""), 5000);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      if (isOpen) {
        const store = await load(STORE_FILENAME, { autoSave: false } as any);
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
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
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
    <>
      <div className="settings-sidebar-overlay" onClick={onClose} />
      <div className="settings-sidebar">
        <div className="settings-sidebar-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Settings</h2>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-secondary)', 
                cursor: 'pointer', 
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.25rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--text-primary) 10%, transparent)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              aria-label="Close settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        
        <SettingsSection title="Todoist Integration" defaultOpen={true} storageKey="todoist">
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
          
          <div className="form-group">
            <label>API Token</label>
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
        </SettingsSection>

        <SettingsSection title="Appearance" defaultOpen={false} storageKey="appearance">
          <div className="form-group">
            <label>Theme</label>
            <CustomSelect
              value={theme}
              onChange={onThemeChange}
              options={[
                { label: "System Default", value: "system" },
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
            />
          </div>

          <div className="form-group">
            <label>Text Tone</label>
            <CustomSelect
              value={textColor}
              onChange={onTextColorChange}
              options={[
                { label: "Slate (Cool Gray)", value: "slate" },
                { label: "Zinc (Neutral)", value: "zinc" },
                { label: "Neutral (True Gray)", value: "neutral" },
                { label: "Stone (Warm Gray)", value: "stone" },
                { label: "Accent (Tinted)", value: "accent" },
              ]}
            />
          </div>

          <div className="form-group">
            <label>Accent Color</label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              {[
                { id: "blue", color: "#3b82f6" },
                { id: "purple", color: "#a855f7" },
                { id: "green", color: "#10b981" },
                { id: "deep-green", color: "#047857" },
                { id: "rose", color: "#f43f5e" },
                { id: "red-brick", color: "#b91c1c" },
                { id: "orange", color: "#f97316" },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAccentChange(a.id)}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: a.color,
                    border: accent === a.id ? "2px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                    padding: 0,
                    outline: "none",
                    boxShadow: accent === a.id ? "0 0 0 2px var(--bg-surface)" : "none",
                    transition: "all 0.2s ease"
                  }}
                  aria-label={a.id}
                />
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="About" defaultOpen={false} forceOpen={!!updateAvailable} storageKey="about">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <label>App Updates {appVersion && <span style={{ fontSize: "0.8em", color: "var(--text-secondary)", marginLeft: "0.5rem", fontWeight: "normal" }}>(v{appVersion})</span>}</label>
                <div style={{ fontSize: "0.75rem", color: updateAvailable ? "var(--accent-color)" : "var(--text-secondary)", fontWeight: updateAvailable ? 600 : "normal" }}>
                  {updateStatus || "Check for new versions of Test Yourself."}
                </div>
              </div>
              <button
                className="button-secondary"
                onClick={() => void handleCheckUpdate()}
                disabled={!!updateStatus && updateStatus !== "App is up to date!" && !updateStatus.startsWith("Update v") && !updateStatus.startsWith("Failed")}
              >
                {updateAvailable || updateStatus.startsWith("Update v") ? "Install Update" : "Check for Updates"}
              </button>
            </div>
          </div>
        </SettingsSection>
        </div>

        <div className="settings-sidebar-footer">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" onClick={() => void handleSave()}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}
