import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { TodoistProvider } from "../providers/TodoistProvider";
import { check } from "@tauri-apps/plugin-updater";
import { STORE_FILENAME } from "../constants";
import type { ThemeType, TextColor, AccentColor } from "../types";
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
          className={`segment-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
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
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState("appearance");
  const [todoistToken, setTodoistToken] = useState("");
  const [initialTodoistToken, setInitialTodoistToken] = useState("");
  const [isTokenInSecureStore, setIsTokenInSecureStore] = useState(false);
  const [vaultName, setVaultName] = useState("");

  const [defaultDate, setDefaultDate] = useState("tomorrow");
  const [defaultPriority, setDefaultPriority] = useState<number>(4);
  const [defaultProject, setDefaultProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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
      const fallbackToken = await store.get<string>("todoist_token");
      const vault = await store.get<string>("obsidian_vault");

      const loadedToken =
        secureToken ||
        fallbackToken ||
        window.localStorage.getItem("todoist_token") ||
        "";
      setTodoistToken(loadedToken);
      setInitialTodoistToken(loadedToken);
      setVaultName(
        vault || window.localStorage.getItem("obsidian_vault") || "",
      );

      const defDate = await store.get<string>("default_todoist_date");
      const defPri = await store.get<number>("default_todoist_priority");
      const defProj = await store.get<string>("default_todoist_project");
      if (defDate) setDefaultDate(defDate);
      if (defPri !== undefined) setDefaultPriority(defPri);
      if (defProj !== undefined) setDefaultProject(defProj);
    }
    void fetchSettings();
  }, []);

  useEffect(() => {
    async function fetchProjects() {
      if (!todoistToken) return;
      setLoadingProjects(true);
      try {
        const provider = new TodoistProvider(todoistToken);
        const projs = await provider.getProjects();
        setProjects(projs);
      } catch (err) {
        console.warn("Failed to fetch projects for settings", err);
      } finally {
        setLoadingProjects(false);
      }
    }
    const timeout = setTimeout(() => {
      void fetchProjects();
    }, 500);
    return () => clearTimeout(timeout);
  }, [todoistToken]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });
      try {
        if (
          todoistToken !== initialTodoistToken ||
          (todoistToken && !isTokenInSecureStore)
        ) {
          await setSecureToken("todoist_token", todoistToken);
          setInitialTodoistToken(todoistToken);
          setIsTokenInSecureStore(true);
        }
        await store.delete("todoist_token");
      } catch (err) {
        console.warn("Secure store unavailable. Falling back.", err);
        await store.set("todoist_token", todoistToken);
      }
      await store.set("obsidian_vault", vaultName);
      await store.set("default_todoist_date", defaultDate);
      await store.set("default_todoist_priority", defaultPriority);
      await store.set("default_todoist_project", defaultProject);
      await store.save();

      window.localStorage.removeItem("todoist_token");
      window.localStorage.removeItem("obsidian_vault");

      onSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectVaultFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const isWindows = selected.includes("\\");
        const parts = selected.split(isWindows ? "\\" : "/");
        const folderName = parts[parts.length - 1];
        if (folderName) {
          setVaultName(folderName);
        }
      }
    } catch (err) {
      console.warn("Failed to select vault directory", err);
    }
  };

  const tabs = [
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
        <div className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? "active" : ""}`}
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
          {activeTab === "appearance" && (
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
                        outline: "none",
                        boxShadow:
                          accent === a.id
                            ? "0 0 0 2px var(--bg-surface)"
                            : "0 2px 5px rgba(0,0,0,0.1)",
                        transition: "all 0.2s ease",
                      }}
                      aria-label={a.id}
                    />
                  ))}
                </div>
              </SettingsCard>
            </div>
          )}

          {activeTab === "todoist" && (
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
                title="Todoist API Token"
                subtitle="Find this in Todoist Settings > Integrations > Developer."
              >
                <input
                  type="password"
                  className="settings-input"
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
                    <select
                      className="settings-input"
                      value={defaultProject}
                      onChange={(e) => setDefaultProject(e.target.value)}
                      disabled={loadingProjects}
                    >
                      <option value="">Inbox (Default)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </SettingsCard>
            </div>
          )}

          {activeTab === "about" && (
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
          )}
        </div>
      </div>
    </div>
  );
}
