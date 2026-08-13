import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { load } from "@tauri-apps/plugin-store";
import { check } from "@tauri-apps/plugin-updater";
import React, { useEffect, useState } from "react";
import { STORE_FILENAME } from "../constants";
import { TodoistProvider } from "../providers/TodoistProvider";
import {
  beginTodoistAuthorization,
  completeTodoistAuthorization,
  getAuthorizedTodoistToken,
  isTodoistOAuthSecret,
} from "../todoistOAuth";
import type { AccentColor, TextColor, ThemeType } from "../types";
import { getSecureToken, setSecureToken } from "../utils/secureStore";
import "./SettingsView.css";

interface Project {
  id: string;
  name: string;
}

interface SettingsViewProps {
  onClose: () => void;
  theme: ThemeType;
  accent: AccentColor;
  textColor: TextColor;
  onThemeChange: (theme: ThemeType) => void;
  onAccentChange: (accent: AccentColor) => void;
  onTextColorChange: (textColor: TextColor) => void;
  updateAvailable?: string | null;
  onSaveSuccess?: () => void;
  onSaveError?: (message: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  basePath?: string | null;
  onSelectFolder?: () => void;
  onSelectVaultFolder?: () => void;
  selectedVaultFolder?: string | null;
  onUpdateBasePath?: (newPath: string) => void;
}

function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: React.ReactNode; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented-control">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`segment-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingsCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="settings-card-content">{children}</div>
    </div>
  );
}

export function SettingsView({
  onClose,
  theme,
  accent,
  textColor,
  onThemeChange,
  onAccentChange,
  onTextColorChange,
  updateAvailable,
  onSaveSuccess,
  onSaveError,
  onDirtyChange,
  basePath,
  onSelectFolder,
  onSelectVaultFolder,
  selectedVaultFolder,
  onUpdateBasePath,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!selectedVaultFolder) return;
    const normalizedPath = selectedVaultFolder.replace(/\\/g, "/");
    const folderName = normalizedPath.split("/").filter(Boolean).pop();
    if (folderName) setVaultName(folderName);
  }, [selectedVaultFolder]);

  const [customBasePath, setCustomBasePath] = useState(basePath || "");
  const [todoistToken, setTodoistToken] = useState("");
  const [initialTodoistToken, setInitialTodoistToken] = useState("");
  const [_isTokenInSecureStore, setIsTokenInSecureStore] = useState(false);
  const [vaultName, setVaultName] = useState("");
  const [initialVaultName, setInitialVaultName] = useState("");

  const [defaultDate, setDefaultDate] = useState("tomorrow");
  const [initialDefaultDate, setInitialDefaultDate] = useState("tomorrow");
  const [defaultPriority, setDefaultPriority] = useState<number>(4);
  const [initialDefaultPriority, setInitialDefaultPriority] =
    useState<number>(4);
  const [defaultProject, setDefaultProject] = useState("");
  const [initialDefaultProject, setInitialDefaultProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isDefaultProjectOpen, setIsDefaultProjectOpen] = useState(false);
  const [todoistAuthStatus, setTodoistAuthStatus] = useState<
    "disconnected" | "connected" | "connecting"
  >("disconnected");

  const [updateStatus, setUpdateStatus] = useState(
    updateAvailable ? `Update v${updateAvailable} is available!` : "",
  );
  const [appVersion, setAppVersion] = useState<string>("");
  const [isArchLinux, setIsArchLinux] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const version = await getVersion();
        setAppVersion(version);
        try {
          const isArch = await invoke<boolean>("is_arch_linux");
          setIsArchLinux(isArch);
        } catch (err) {
          console.warn("is_arch_linux command not found or failed", err);
        }
      } catch (err) {
        console.warn("Failed to fetch app version", err);
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
        const handledByLinux = await invoke<boolean>("custom_linux_relaunch");
        if (!handledByLinux) {
          await relaunch();
        }
      } else {
        setUpdateStatus("App is up to date!");
        setTimeout(() => setUpdateStatus(""), 3000);
      }
    } catch (error) {
      setUpdateStatus(
        `Failed to update: ${error instanceof Error ? error.message : String(error)}`,
      );
      setTimeout(() => setUpdateStatus(""), 5000);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });
      const secureToken = await getSecureToken("todoist_token");
      setIsTokenInSecureStore(!!secureToken);
      const vault = await store.get<string>("obsidian_vault");

      const loadedToken = secureToken || "";
      const isOAuth = isTodoistOAuthSecret(secureToken);
      setTodoistAuthStatus(isOAuth ? "connected" : "disconnected");
      setTodoistToken(isOAuth ? "" : loadedToken);
      setInitialTodoistToken(isOAuth ? "" : loadedToken);
      const loadedVault =
        vault || window.localStorage.getItem("obsidian_vault") || "";
      setVaultName(loadedVault);
      setInitialVaultName(loadedVault);

      const defDate = await store.get<string>("default_todoist_date");
      const defPri = await store.get<number>("default_todoist_priority");
      const defProj = await store.get<string>("default_todoist_project");
      if (defDate) {
        setDefaultDate(defDate);
        setInitialDefaultDate(defDate);
      }
      if (defPri !== undefined) {
        setDefaultPriority(defPri);
        setInitialDefaultPriority(defPri);
      }
      if (defProj !== undefined && defProj !== null) {
        setDefaultProject(defProj);
        setInitialDefaultProject(defProj);
      }
    }
    void fetchSettings();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("deep-link-received", async (event) => {
      try {
        if (!(await completeTodoistAuthorization(event.payload))) return;
        setTodoistAuthStatus("connected");
        setTodoistToken("");
      } catch (error) {
        setTodoistAuthStatus("disconnected");
        onSaveError?.(
          error instanceof Error
            ? error.message
            : "Todoist authorization failed.",
        );
      }
    }).then((remove) => {
      unlisten = remove;
    });
    return () => unlisten?.();
  }, [onSaveError]);

  useEffect(() => {
    const isDirty =
      todoistToken !== initialTodoistToken ||
      vaultName !== initialVaultName ||
      defaultDate !== initialDefaultDate ||
      defaultPriority !== initialDefaultPriority ||
      defaultProject !== initialDefaultProject;
    onDirtyChange?.(isDirty);
  }, [
    todoistToken,
    initialTodoistToken,
    vaultName,
    initialVaultName,
    defaultDate,
    initialDefaultDate,
    defaultPriority,
    initialDefaultPriority,
    defaultProject,
    initialDefaultProject,
    onDirtyChange,
  ]);

  useEffect(() => {
    async function fetchProjects() {
      if (!todoistToken && todoistAuthStatus !== "connected") return;
      const token = await getAuthorizedTodoistToken();
      if (!token) return;
      setLoadingProjects(true);
      try {
        const api = new TodoistProvider(token);
        const projs = await api.getProjects();
        setProjects(projs);
      } catch (err) {
        console.warn("Failed to fetch Todoist projects", err);
      } finally {
        setLoadingProjects(false);
      }
    }
    void fetchProjects();
  }, [todoistToken, todoistAuthStatus]);

  const connectTodoist = async () => {
    try {
      setTodoistAuthStatus("connecting");
      await beginTodoistAuthorization();
    } catch (error) {
      setTodoistAuthStatus("disconnected");
      onSaveError?.(
        error instanceof Error
          ? error.message
          : "Could not start Todoist authorization.",
      );
    }
  };

  const disconnectTodoist = async () => {
    await setSecureToken("todoist_token", "");
    setTodoistToken("");
    setInitialTodoistToken("");
    setTodoistAuthStatus("disconnected");
    setProjects([]);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });

      if (todoistToken) {
        if (todoistToken !== initialTodoistToken || !_isTokenInSecureStore) {
          try {
            await setSecureToken("todoist_token", todoistToken);
            await store.set("todoist_token", "");
            setIsTokenInSecureStore(true);
          } catch (err) {
            throw new Error(
              `Unable to save the Todoist token to secure storage: ${String(err)}`,
            );
          }
        }
      } else {
        await setSecureToken("todoist_token", "");
        await store.set("todoist_token", "");
        window.localStorage.removeItem("todoist_token");
      }

      await store.set("obsidian_vault", vaultName);
      await store.set("default_todoist_date", defaultDate);
      await store.set("default_todoist_priority", defaultPriority);
      await store.set("default_todoist_project", defaultProject);

      await store.save();

      setInitialTodoistToken(todoistToken);
      setInitialVaultName(vaultName);
      setInitialDefaultDate(defaultDate);
      setInitialDefaultPriority(defaultPriority);
      setInitialDefaultProject(defaultProject);

      onSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to save settings", error);
      onSaveError?.(
        `Could not save settings: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectVaultFolder = async () => {
    if (onSelectVaultFolder) {
      await onSelectVaultFolder();
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        fileAccessMode: "scoped",
      });
      if (selected && typeof selected === "string") {
        const isWindows = selected.includes("\\");
        const parts = selected.split(isWindows ? "\\" : "/");
        const folderName = parts[parts.length - 1];
        if (folderName) {
          setVaultName(folderName);
        }
        return;
      }
    } catch (err) {
      console.warn("Failed to select vault directory", err);
    }
  };

  const tabs = [
    {
      id: "general",
      label: "General",
      subtitle: "Storage & Directory",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      subtitle: "Interface theme",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ),
    },
    {
      id: "todoist",
      label: "Integrations",
      subtitle: "API and vault",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      ),
    },
    {
      id: "about",
      label: "About",
      subtitle: "Updates & info",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      ),
    },
  ];

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case "general":
        return (
          <div className="settings-section">
            <h2 className="settings-section-title">General</h2>
            <p className="settings-section-subtitle">
              Manage your quiz directory and storage.
            </p>
            <SettingsCard
              title="Quiz Directory"
              subtitle="Folder path containing your Markdown quizzes and worksheets."
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div className="settings-input-group">
                  <input
                    type="text"
                    className="settings-input"
                    aria-label="Quiz directory path"
                    placeholder="e.g. /Users/username/Quizzes"
                    value={customBasePath}
                    onChange={(e) => setCustomBasePath(e.target.value)}
                  />
                  {onSelectFolder && (
                    <button
                      className="button-secondary"
                      onClick={() => void onSelectFolder()}
                    >
                      Browse...
                    </button>
                  )}
                </div>
                {customBasePath !== (basePath || "") && (
                  <button
                    className="button-primary"
                    onClick={() => {
                      if (onUpdateBasePath && customBasePath.trim()) {
                        onUpdateBasePath(customBasePath.trim());
                      }
                    }}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: "0.25rem",
                    }}
                  >
                    Set Folder Path
                  </button>
                )}
              </div>
            </SettingsCard>
          </div>
        );

      case "appearance":
        return (
          <div className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <p className="settings-section-subtitle">
              Adapt the interface to your needs on this device.
            </p>
            <SettingsCard
              title="Theme"
              subtitle="Scale the text and contrast across the interface."
            >
              <SegmentedControl
                value={theme}
                onChange={onThemeChange}
                options={[
                  { label: "System", value: "system" },
                  { label: "Light", value: "light" },
                  { label: "Dark", value: "dark" },
                ]}
              />
            </SettingsCard>

            <SettingsCard
              title="Text Tone"
              subtitle="Choose the primary text color scheme."
            >
              <SegmentedControl
                value={textColor}
                onChange={onTextColorChange}
                options={[
                  { label: "Slate", value: "slate" },
                  { label: "Zinc", value: "zinc" },
                  { label: "Neutral", value: "neutral" },
                  { label: "Stone", value: "stone" },
                  { label: "Accent", value: "accent" },
                ]}
              />
            </SettingsCard>

            <SettingsCard
              title="Accent Color"
              subtitle="Select the primary brand color for buttons and highlights."
            >
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  flexWrap: "wrap",
                  padding: "0.5rem 0",
                }}
              >
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
                    onClick={() => onAccentChange(a.id as AccentColor)}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      backgroundColor: a.color,
                      border:
                        accent === a.id
                          ? "3px solid var(--text-primary)"
                          : "3px solid transparent",
                      cursor: "pointer",
                      boxShadow:
                        accent === a.id
                          ? "0 0 0 2px var(--bg-surface)"
                          : "0 2px 5px rgba(0,0,0,0.1)",
                      transition: "all 0.2s ease",
                    }}
                    aria-label={a.id}
                    aria-pressed={accent === a.id}
                  />
                ))}
              </div>
            </SettingsCard>
          </div>
        );

      case "todoist":
      case "integrations":
        return (
          <div className="settings-section">
            <h2 className="settings-section-title">Integrations</h2>
            <p className="settings-section-subtitle">
              Manage your connections to external services.
            </p>
            <SettingsCard
              title="Obsidian Vault"
              subtitle="Used to generate obsidian://open links to your quizzes."
            >
              <div className="settings-input-group">
                <input
                  type="text"
                  className="settings-input"
                  aria-label="Obsidian vault name"
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
            </SettingsCard>

            <SettingsCard
              title="Todoist"
              subtitle={
                todoistAuthStatus === "connected"
                  ? "Connected securely with Todoist."
                  : "Connect your Todoist account securely."
              }
            >
              <div className="settings-row">
                <button
                  className="button-secondary"
                  disabled={todoistAuthStatus === "connecting"}
                  onClick={() => void connectTodoist()}
                >
                  {todoistAuthStatus === "connecting"
                    ? "Opening Todoist…"
                    : todoistAuthStatus === "connected"
                      ? "Reconnect Todoist"
                      : "Connect Todoist"}
                </button>
                {todoistAuthStatus === "connected" && (
                  <button
                    className="button-secondary"
                    onClick={() => void disconnectTodoist()}
                  >
                    Disconnect
                  </button>
                )}
              </div>
              <label className="settings-label" htmlFor="todoist-token">
                Personal API token (legacy)
              </label>
              <input
                id="todoist-token"
                type="password"
                className="settings-input"
                aria-label="Todoist API token"
                placeholder="Enter your Todoist API token"
                value={todoistToken}
                onChange={(e) => setTodoistToken(e.target.value)}
              />
            </SettingsCard>

            <SettingsCard
              title="Todoist Defaults"
              subtitle="Set default scheduling options for tasks."
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <label className="settings-label">Default Date</label>
                  <SegmentedControl
                    value={defaultDate}
                    onChange={setDefaultDate}
                    options={[
                      { label: "Today", value: "today" },
                      { label: "Tomorrow", value: "tomorrow" },
                      { label: "7 Days", value: "in 7 days" },
                      { label: "30 Days", value: "in 30 days" },
                    ]}
                  />
                </div>
                <div>
                  <label className="settings-label">Default Priority</label>
                  <SegmentedControl
                    value={defaultPriority}
                    onChange={(val) => setDefaultPriority(Number(val))}
                    options={[
                      {
                        label: <span style={{ color: "#d1453b" }}>P1</span>,
                        value: 4,
                      },
                      {
                        label: <span style={{ color: "#eb8909" }}>P2</span>,
                        value: 3,
                      },
                      {
                        label: <span style={{ color: "#246fe0" }}>P3</span>,
                        value: 2,
                      },
                      { label: "P4", value: 1 },
                    ]}
                  />
                </div>
                <div>
                  <label className="settings-label">Default Project</label>
                  <div className="settings-select-wrapper">
                    <button
                      type="button"
                      className="settings-input settings-select-button"
                      aria-haspopup="listbox"
                      aria-expanded={isDefaultProjectOpen}
                      aria-label="Default project"
                      disabled={loadingProjects}
                      onClick={() => setIsDefaultProjectOpen((open) => !open)}
                    >
                      {projects.find((p) => p.id === defaultProject)?.name ||
                        "Inbox (Default)"}
                      <span aria-hidden="true">⌄</span>
                    </button>
                    {isDefaultProjectOpen && (
                      <div
                        className="settings-select-menu"
                        role="listbox"
                        aria-label="Default project options"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={!defaultProject}
                          className="settings-select-option"
                          onClick={() => {
                            setDefaultProject("");
                            setIsDefaultProjectOpen(false);
                          }}
                        >
                          Inbox (Default)
                        </button>
                        {projects.map((p) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={defaultProject === p.id}
                            className="settings-select-option"
                            key={p.id}
                            onClick={() => {
                              setDefaultProject(p.id);
                              setIsDefaultProjectOpen(false);
                            }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SettingsCard>
          </div>
        );

      case "about":
        return (
          <div className="settings-section">
            <h2 className="settings-section-title">About</h2>
            <p className="settings-section-subtitle">
              Information and updates.
            </p>
            <SettingsCard
              title="App Version"
              subtitle={
                isArchLinux
                  ? "Managed by your system package manager."
                  : updateStatus || "Check for new versions of Test Yourself."
              }
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>
                  v{appVersion}
                </span>
                {isArchLinux ? (
                  <span
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Run yay -S test-yourself to update
                  </span>
                ) : (
                  <button
                    className="button-primary"
                    onClick={() => void handleCheckUpdate()}
                    disabled={
                      !!updateStatus &&
                      updateStatus !== "App is up to date!" &&
                      !updateStatus.startsWith("Update v") &&
                      !updateStatus.startsWith("Failed")
                    }
                  >
                    {updateAvailable || updateStatus.startsWith("Update v")
                      ? "Install Update"
                      : "Check for Updates"}
                  </button>
                )}
              </div>
            </SettingsCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header-sticky">
        <div className="settings-header-top">
          <div className="settings-title-group">
            <h1 className="settings-main-title">Settings</h1>
            <p className="settings-main-subtitle">
              Manage your integrations, preferences, and data from one place.
            </p>
          </div>
          <div className="settings-actions-top">
            <button
              className="button-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-layout">
        {!isMobile ? (
          /* Desktop View: Original v2.4.3 2-Column Sidebar Layout */
          <div className="settings-desktop-view">
            <div className="settings-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`settings-nav-item ${
                    (activeTab || "general") === tab.id ? "active" : ""
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="settings-nav-icon">{tab.icon}</div>
                  <div className="settings-nav-text">
                    <div className="settings-nav-label">{tab.label}</div>
                    <div className="settings-nav-subtitle">{tab.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="settings-content-area">
              {renderTabContent(activeTab || "general")}
            </div>
          </div>
        ) : (
          /* Mobile View: Inline Expandable Accordions */
          <div className="settings-mobile-view">
            <div className="settings-accordion-list">
              {tabs.map((tab) => (
                <div key={tab.id} className="settings-accordion-item">
                  <button
                    type="button"
                    className={`settings-nav-item ${
                      activeTab === tab.id ? "active" : ""
                    }`}
                    onClick={() =>
                      setActiveTab(activeTab === tab.id ? "" : tab.id)
                    }
                    aria-expanded={activeTab === tab.id}
                  >
                    <div className="settings-nav-icon">{tab.icon}</div>
                    <div className="settings-nav-text">
                      <div className="settings-nav-label">{tab.label}</div>
                      <div className="settings-nav-subtitle">
                        {tab.subtitle}
                      </div>
                    </div>
                    <div className="settings-accordion-chevron">
                      <svg
                        style={{
                          transform:
                            activeTab === tab.id
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </button>

                  {activeTab === tab.id && (
                    <div className="settings-accordion-content">
                      {renderTabContent(tab.id)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
