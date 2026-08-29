import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./CreateView.css";

type Note = { name: string; path: string; relative_path: string };
type Directory = { name: string; path: string; relative_path: string };
type CreationType = "quiz" | "worksheet" | "scenario";
type Engine = "agy" | "codex";
type DropdownOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

const labels: Record<CreationType, string> = {
  quiz: "Quiz",
  worksheet: "Worksheet",
  scenario: "Scenario",
};

const cliInstallDetails: Record<
  Engine,
  { name: string; command: string; url: string }
> = {
  agy: {
    name: "Antigravity",
    command: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
    url: "https://antigravity.google/docs/cli/install/",
  },
  codex: {
    name: "Codex",
    command: "curl -fsSL https://chatgpt.com/codex/install.sh | sh",
    url: "https://learn.chatgpt.com/docs/codex/cli",
  },
};

function isHiddenPath(path: string) {
  return path.split(/[\\/]/).some((segment) => segment.startsWith("."));
}

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="select-chevron"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DropdownSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  invalid = false,
  required = false,
}: {
  id: string;
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  invalid?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const enabledOptions = options.filter((option) => !option.disabled);
  const listboxId = `${id}-options`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function selectAdjacentOption(direction: 1 | -1) {
    const currentIndex = enabledOptions.findIndex(
      (option) => option.value === value,
    );
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      enabledOptions.length - 1,
    );
    const next = enabledOptions[nextIndex];
    if (next) onChange(next.value);
  }

  return (
    <div className="picker-select" ref={dropdownRef}>
      <label id={labelId}>{label}</label>
      <button
        aria-controls={listboxId}
        aria-describedby={valueId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-labelledby={labelId}
        aria-required={required || undefined}
        className={
          invalid
            ? "picker-select-trigger field-invalid"
            : "picker-select-trigger"
        }
        disabled={enabledOptions.length === 0}
        id={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            selectAdjacentOption(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            selectAdjacentOption(-1);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        type="button"
      >
        <span id={valueId}>{selected?.label ?? "Select an option"}</span>
        <SelectChevron />
      </button>
      {open && (
        <div
          aria-labelledby={labelId}
          className="picker-select-list"
          id={listboxId}
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={value === option.value}
              className={
                value === option.value
                  ? "picker-select-option active"
                  : "picker-select-option"
              }
              disabled={option.disabled}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreateView({
  basePath,
  onGenerated,
}: {
  basePath: string;
  onGenerated: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [outputDirectories, setOutputDirectories] = useState<Directory[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [available, setAvailable] = useState({ agy: false, codex: false });
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedNoteIndex, setFocusedNoteIndex] = useState(0);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const notePickerRef = useRef<HTMLDivElement>(null);
  const [outputQuery, setOutputQuery] = useState("");
  const [focusedOutputIndex, setFocusedOutputIndex] = useState(0);
  const [outputPickerOpen, setOutputPickerOpen] = useState(false);
  const outputPickerRef = useRef<HTMLDivElement>(null);
  const [sourceFile, setSourceFile] = useState("");
  const [outputDirectory, setOutputDirectory] = useState(basePath);
  const [creationType, setCreationType] = useState<CreationType>("quiz");
  const [skill, setSkill] = useState("");
  const [engine, setEngine] = useState<Engine>("agy");
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState("");
  const [generationOutput, setGenerationOutput] = useState("");
  const [sessionInput, setSessionInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");

  useEffect(() => {
    void Promise.all([
      invoke<Note[]>("list_markdown_notes"),
      invoke<Directory[]>("list_output_directories"),
      invoke<{
        agy_available: boolean;
        codex_available: boolean;
        skills: string[];
      }>("creation_status"),
    ])
      .then(([foundNotes, foundDirectories, creation]) => {
        setNotes(Array.isArray(foundNotes) ? foundNotes : []);
        setOutputDirectories(
          Array.isArray(foundDirectories) ? foundDirectories : [],
        );
        setSkills(Array.isArray(creation?.skills) ? creation.skills : []);
        setAvailable({
          agy: creation?.agy_available ?? false,
          codex: creation?.codex_available ?? false,
        });
        setEngine(creation?.agy_available ? "agy" : "codex");
      })
      .catch(() => setStatus("Unable to load notes or AI tools."))
      .finally(() => setAvailabilityChecked(true));
  }, []);

  useEffect(() => {
    let active = true;
    let unlistenOutput: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    void Promise.all([
      listen<string>("generation-output", ({ payload }) => {
        if (!active) return;
        setGenerationOutput((current) => `${current}${payload}`.slice(-50_000));
      }),
      listen<string>("generation-complete", ({ payload }) => {
        if (!active) return;
        setIsGenerating(false);
        setStatus(payload);
        onGenerated();
      }),
    ]).then(([removeOutput, removeComplete]) => {
      if (active) {
        unlistenOutput = removeOutput;
        unlistenComplete = removeComplete;
      } else {
        removeOutput();
        removeComplete();
      }
    });

    return () => {
      active = false;
      unlistenOutput?.();
      unlistenComplete?.();
    };
  }, [onGenerated]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        notePickerRef.current &&
        !notePickerRef.current.contains(event.target as Node)
      )
        setNotePickerOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        outputPickerRef.current &&
        !outputPickerRef.current.contains(event.target as Node)
      ) {
        setOutputPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const suggestedSkills = useMemo(
    () => skills.filter((item) => item.toLowerCase().includes(creationType)),
    [creationType, skills],
  );
  const orderedSkills = useMemo(
    () =>
      [...skills].sort(
        (left, right) =>
          Number(suggestedSkills.includes(right)) -
          Number(suggestedSkills.includes(left)),
      ),
    [skills, suggestedSkills],
  );
  const filteredNotes = useMemo(
    () =>
      notes.filter((note) =>
        note.relative_path.toLowerCase().includes(query.toLowerCase()),
      ),
    [notes, query],
  );
  const filteredOutputDirectories = useMemo(
    () =>
      outputDirectories.filter(
        (directory) =>
          !isHiddenPath(directory.relative_path) &&
          directory.relative_path
            .toLowerCase()
            .includes(outputQuery.toLowerCase()),
      ),
    [outputDirectories, outputQuery],
  );
  const activeNoteId =
    notePickerOpen && filteredNotes.length > 0
      ? `note-search-option-${focusedNoteIndex}`
      : undefined;
  const activeOutputId =
    outputPickerOpen && filteredOutputDirectories.length > 0
      ? `output-directory-option-${focusedOutputIndex}`
      : undefined;
  const missingRequirements = [
    !sourceFile && "a source note",
    !request.trim() && "a description of what to create",
    !skill && "a skill",
    !outputDirectory && "an output directory",
  ].filter(Boolean);
  const matchingSkill = skill.toLowerCase().includes(creationType);

  function handleNoteSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setNotePickerOpen(true);
      setFocusedNoteIndex((current) =>
        Math.min(current + 1, Math.max(0, filteredNotes.length - 1)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedNoteIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const note = filteredNotes[focusedNoteIndex];
      if (note) selectNote(note.path);
    } else if (event.key === "Escape") {
      setNotePickerOpen(false);
    }
  }

  function selectNote(path: string) {
    setSourceFile(path);
    const name =
      notes.find((note) => note.path === path)?.name ??
      path.split(/[\\/]/).pop() ??
      path;
    setQuery(name);
    setSelectionAnnouncement(`Selected note: ${name}`);
    setNotePickerOpen(false);
  }

  function handleOutputSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOutputPickerOpen(true);
      setFocusedOutputIndex((current) =>
        Math.min(
          current + 1,
          Math.max(0, filteredOutputDirectories.length - 1),
        ),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOutputPickerOpen(true);
      setFocusedOutputIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const directory = filteredOutputDirectories[focusedOutputIndex];
      if (directory) selectOutputDirectory(directory.path);
    } else if (event.key === "Escape") {
      setOutputPickerOpen(false);
    }
  }

  function selectOutputDirectory(path: string) {
    const directory = outputDirectories.find((item) => item.path === path);
    setOutputDirectory(path);
    setOutputQuery(
      directory?.relative_path === "."
        ? ""
        : (directory?.relative_path ?? path.split(/[\\/]/).pop() ?? path),
    );
    setFocusedOutputIndex(0);
    setOutputPickerOpen(false);
    setSelectionAnnouncement(
      `Output directory: ${directory?.relative_path ?? path}`,
    );
  }

  useEffect(() => {
    setSkill((current) =>
      suggestedSkills.includes(current)
        ? current
        : (suggestedSkills[0] ?? skills[0] ?? ""),
    );
  }, [skills, suggestedSkills]);

  async function chooseExternalOutput() {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: outputDirectory,
    });
    if (typeof selected === "string") selectOutputDirectory(selected);
  }

  async function chooseExternalSource() {
    const selected = await open({
      directory: false,
      multiple: false,
      defaultPath: basePath,
    });
    if (typeof selected === "string") selectNote(selected);
  }

  async function generate() {
    if (missingRequirements.length > 0) {
      setShowValidationErrors(true);
      setStatus("Please complete the highlighted required fields.");
      return;
    }
    try {
      setShowValidationErrors(false);
      setStatus("Starting generation…");
      setGenerationOutput("");
      setSessionInput("");
      setIsGenerating(true);
      await invoke("generate_material", {
        engine,
        outputDirectory,
        sourceFile,
        skill,
        request,
        creationType,
      });
      setStatus("Generation is running. Live output is shown below.");
    } catch (error) {
      setIsGenerating(false);
      setStatus(`Could not start generation: ${String(error)}`);
    }
  }

  async function sendSessionInput() {
    if (!sessionInput.trim()) return;
    try {
      await invoke("send_generation_input", { input: sessionInput });
      setSessionInput("");
    } catch (error) {
      setStatus(`Could not send response: ${String(error)}`);
    }
  }

  return (
    <section className="create-view" aria-labelledby="create-title">
      <header>
        <h1 id="create-title">Create study material</h1>
        <p>
          Choose a note, describe what you need, and generate it with your
          preferred AI tool.
        </p>
      </header>
      <div className="create-grid">
        <div className="create-source">
          <div className="note-picker" ref={notePickerRef}>
            <p aria-atomic="true" aria-live="polite" className="sr-only">
              {selectionAnnouncement}
            </p>
            <label htmlFor="note-search">
              Search notes or drop a file here
            </label>
            <div
              className="note-search-control"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0] as
                  | (File & { path?: string })
                  | undefined;
                if (file?.path) selectNote(file.path);
                else
                  setStatus(
                    "Use the file picker to select this external file.",
                  );
              }}
            >
              <input
                aria-activedescendant={activeNoteId}
                aria-autocomplete="list"
                aria-controls="note-search-results"
                aria-expanded={notePickerOpen}
                aria-haspopup="listbox"
                aria-required="true"
                aria-invalid={showValidationErrors && !sourceFile}
                className={
                  showValidationErrors && !sourceFile
                    ? "field-invalid"
                    : undefined
                }
                id="note-search"
                role="combobox"
                value={query}
                onFocus={() => setNotePickerOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFocusedNoteIndex(0);
                  setNotePickerOpen(true);
                }}
                onKeyDown={handleNoteSearchKeyDown}
                placeholder="Search your selected directory"
              />
              {(query || sourceFile) && (
                <button
                  aria-label="Clear selected note"
                  className="clear-note-search"
                  onClick={() => {
                    setQuery("");
                    setSourceFile("");
                    setFocusedNoteIndex(0);
                    setNotePickerOpen(true);
                    setSelectionAnnouncement("Selected note cleared.");
                  }}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
            <button
              className="external-file-picker"
              onClick={() => void chooseExternalSource()}
              type="button"
            >
              Choose external file
            </button>
            {notePickerOpen && (
              <div
                aria-label="Matching notes"
                className="note-list"
                id="note-search-results"
                role="listbox"
              >
                {filteredNotes.length === 0 ? (
                  <p aria-live="polite" className="note-empty">
                    No matching notes in the selected directory.
                  </p>
                ) : (
                  filteredNotes.map((note, index) => (
                    <button
                      aria-selected={focusedNoteIndex === index}
                      className={
                        sourceFile === note.path || focusedNoteIndex === index
                          ? "note active"
                          : "note"
                      }
                      id={`note-search-option-${index}`}
                      key={note.path}
                      onClick={() => selectNote(note.path)}
                      role="option"
                      type="button"
                    >
                      <strong>{note.name}</strong>
                      <span>{note.relative_path}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <section
            className="output-directory-card"
            aria-labelledby="output-directory-title"
          >
            <div>
              <h2 id="output-directory-title">Output directory</h2>
              <p>Where the generated study material will be saved.</p>
            </div>
            <div className="output-picker" ref={outputPickerRef}>
              <label className="sr-only" htmlFor="output-directory-search">
                Search output directories
              </label>
              <div className="note-search-control">
                <input
                  aria-activedescendant={activeOutputId}
                  aria-autocomplete="list"
                  aria-controls="output-directory-results"
                  aria-expanded={outputPickerOpen}
                  aria-haspopup="listbox"
                  aria-required="true"
                  id="output-directory-search"
                  onChange={(event) => {
                    setOutputQuery(event.target.value);
                    setFocusedOutputIndex(0);
                    setOutputPickerOpen(true);
                  }}
                  onFocus={() => setOutputPickerOpen(true)}
                  onKeyDown={handleOutputSearchKeyDown}
                  placeholder="Search your selected directory"
                  role="combobox"
                  value={outputQuery}
                />
                {outputQuery && (
                  <button
                    aria-label="Clear selected output directory"
                    className="clear-note-search"
                    onClick={() => {
                      setOutputDirectory(basePath);
                      setOutputQuery("");
                      setFocusedOutputIndex(0);
                      setOutputPickerOpen(true);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                aria-label="Choose external directory"
                className="external-file-picker"
                onClick={() => void chooseExternalOutput()}
                type="button"
              >
                Choose external directory
              </button>
              {outputPickerOpen && (
                <div
                  aria-label="Matching output directories"
                  className="note-list"
                  id="output-directory-results"
                  role="listbox"
                >
                  {filteredOutputDirectories.length === 0 ? (
                    <p aria-live="polite" className="note-empty">
                      No matching directories in the selected directory.
                    </p>
                  ) : (
                    filteredOutputDirectories.map((directory, index) => (
                      <button
                        aria-selected={outputDirectory === directory.path}
                        className={
                          outputDirectory === directory.path ||
                          focusedOutputIndex === index
                            ? "note active"
                            : "note"
                        }
                        id={`output-directory-option-${index}`}
                        key={directory.path}
                        onClick={() => selectOutputDirectory(directory.path)}
                        role="option"
                        type="button"
                      >
                        <strong>{directory.name}</strong>
                        <span>
                          {directory.relative_path === "."
                            ? "Selected directory"
                            : directory.relative_path}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {outputDirectory !== basePath && (
              <p className="creation-warning">
                This output is outside your current library and will not appear
                until you select that folder.
              </p>
            )}
          </section>
        </div>
        <div className="create-form">
          <DropdownSelect
            id="creation-type"
            label="Create"
            onChange={setCreationType}
            options={Object.entries(labels).map(([value, label]) => ({
              value: value as CreationType,
              label,
            }))}
            value={creationType}
          />
          <DropdownSelect
            id="engine"
            label="AI tool"
            onChange={setEngine}
            options={[
              { value: "agy", label: "Antigravity", disabled: !available.agy },
              { value: "codex", label: "Codex", disabled: !available.codex },
            ]}
            value={engine}
          />
          {availabilityChecked &&
            (Object.keys(cliInstallDetails) as Engine[])
              .filter((tool) => !available[tool])
              .map((tool) => {
                const details = cliInstallDetails[tool];
                return (
                  <section
                    aria-labelledby={`${tool}-install-title`}
                    className="cli-install-guide"
                    key={tool}
                  >
                    <p id={`${tool}-install-title`}>
                      <strong>{details.name} CLI is not installed.</strong>
                      Install it in Terminal, then reopen Test Yourself.
                    </p>
                    <code>{details.command}</code>
                    <a href={details.url} rel="noreferrer" target="_blank">
                      {details.name} installation guide
                    </a>
                  </section>
                );
              })}
          <DropdownSelect
            id="skill"
            invalid={showValidationErrors && !skill}
            label="Skill"
            onChange={setSkill}
            options={orderedSkills.map((item) => ({
              value: item,
              label: `${item}${suggestedSkills.includes(item) ? " (suggested)" : ""}`,
            }))}
            required
            value={skill}
          />
          {!matchingSkill && skill && (
            <p className="creation-warning">
              This skill may not create a {creationType}. Choose a suggested
              skill for a more specific result.
            </p>
          )}
          <label htmlFor="request">What should it create?</label>
          <textarea
            aria-required="true"
            aria-invalid={showValidationErrors && !request.trim()}
            className={
              showValidationErrors && !request.trim()
                ? "field-invalid"
                : undefined
            }
            id="request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={`Describe the ${creationType} you want`}
          />
          <button
            aria-describedby="generation-requirements"
            className="primary-btn"
            onClick={() => void generate()}
            type="button"
          >
            Generate {labels[creationType]}
          </button>
          <p className="generation-requirements" id="generation-requirements">
            Required: select a source note and describe what to create.
          </p>
          <p
            aria-atomic="true"
            className={
              status === "Please complete the highlighted required fields."
                ? "sr-only"
                : undefined
            }
            role="status"
          >
            {status}
          </p>
          {(isGenerating || generationOutput) && (
            <section
              aria-labelledby="generation-activity-title"
              className="generation-session"
            >
              <h2 id="generation-activity-title">Generation activity</h2>
              <pre aria-atomic="false" aria-live="polite" tabIndex={0}>
                {generationOutput || "Waiting for the AI tool…"}
              </pre>
              <label htmlFor="generation-input">Respond to a prompt</label>
              <div className="generation-input-row">
                <input
                  id="generation-input"
                  onChange={(event) => setSessionInput(event.target.value)}
                  placeholder="For example: y, or paste a sign-in code"
                  value={sessionInput}
                />
                <button
                  disabled={!isGenerating || !sessionInput.trim()}
                  onClick={() => void sendSessionInput()}
                  type="button"
                >
                  Send
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
