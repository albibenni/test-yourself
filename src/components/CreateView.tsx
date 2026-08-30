import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./CreateView.css";

type Note = { name: string; path: string; relative_path: string };
type Directory = { name: string; path: string; relative_path: string };
type SearchPage<T> = { items: T[]; has_more: boolean };
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

const SEARCH_PAGE_SIZE = 20;

function isHiddenPath(path: string) {
  return path.split(/[\\/]/).some((segment) => segment.startsWith("."));
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
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

function SearchLoading({ children }: { children: string }) {
  return (
    <p aria-live="polite" className="note-loading">
      <span aria-hidden="true" className="search-loader" />
      {children}
    </p>
  );
}

function DropdownSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  onOpen,
  invalid = false,
  required = false,
  loading = false,
}: {
  id: string;
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  onOpen?: () => void;
  invalid?: boolean;
  required?: boolean;
  loading?: boolean;
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
        disabled={enabledOptions.length === 0 && !loading}
        id={id}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpen?.();
            setOpen(true);
            selectAdjacentOption(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            onOpen?.();
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
          {loading && options.length === 0 ? (
            <p aria-live="polite" className="picker-select-loading">
              Loading options…
            </p>
          ) : (
            options.map((option) => (
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
            ))
          )}
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
  const [notesHasMore, setNotesHasMore] = useState(false);
  const [directoriesHaveMore, setDirectoriesHaveMore] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [available, setAvailable] = useState({ agy: false, codex: false });
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [shouldCheckCreationStatus, setShouldCheckCreationStatus] =
    useState(false);
  const [query, setQuery] = useState("");
  const [focusedNoteIndex, setFocusedNoteIndex] = useState(0);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const notePickerRef = useRef<HTMLDivElement>(null);
  const noteRequestId = useRef(0);
  const creationStatusRequested = useRef(false);
  const [outputQuery, setOutputQuery] = useState("");
  const [focusedOutputIndex, setFocusedOutputIndex] = useState(0);
  const [outputPickerOpen, setOutputPickerOpen] = useState(false);
  const outputPickerRef = useRef<HTMLDivElement>(null);
  const directoryRequestId = useRef(0);
  const [sourceFile, setSourceFile] = useState("");
  const [outputDirectory, setOutputDirectory] = useState(basePath);
  const [hasSelectedOutputDirectory, setHasSelectedOutputDirectory] =
    useState(false);
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
  const debouncedQuery = useDebouncedValue(query, 250);
  const debouncedOutputQuery = useDebouncedValue(outputQuery, 250);
  const requestCreationStatus = useCallback(
    () => setShouldCheckCreationStatus(true),
    [],
  );

  useEffect(() => {
    if (!shouldCheckCreationStatus || creationStatusRequested.current) {
      return;
    }
    creationStatusRequested.current = true;
    void invoke<{
      agy_available: boolean;
      codex_available: boolean;
      skills: string[];
    }>("creation_status")
      .then((creation) => {
        setSkills(Array.isArray(creation?.skills) ? creation.skills : []);
        setAvailable({
          agy: creation?.agy_available ?? false,
          codex: creation?.codex_available ?? false,
        });
        setEngine((current) => {
          if (creation?.[`${current}_available`]) return current;
          return creation?.agy_available ? "agy" : "codex";
        });
      })
      .catch(() => setStatus("Unable to load AI tools."))
      .finally(() => setAvailabilityChecked(true));
  }, [shouldCheckCreationStatus]);

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
      ) {
        if (!sourceFile) {
          noteRequestId.current += 1;
          setQuery("");
          setNotes([]);
          setNotesHasMore(false);
          setFocusedNoteIndex(0);
        }
        setNotePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [sourceFile]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        outputPickerRef.current &&
        !outputPickerRef.current.contains(event.target as Node)
      ) {
        if (!hasSelectedOutputDirectory) {
          directoryRequestId.current += 1;
          setOutputQuery("");
          setOutputDirectories([]);
          setDirectoriesHaveMore(false);
          setFocusedOutputIndex(0);
        }
        setOutputPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [hasSelectedOutputDirectory]);

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
  const requestNotesPage = useCallback(
    async (search: string, offset: number) => {
      const requestId = ++noteRequestId.current;
      setNotesLoading(true);
      try {
        const page = await invoke<SearchPage<Note>>("search_creation_library", {
          kind: "notes",
          query: search,
          offset,
          limit: SEARCH_PAGE_SIZE,
        });
        if (requestId !== noteRequestId.current) return;
        const items = Array.isArray(page?.items) ? page.items : [];
        setNotes((current) => (offset === 0 ? items : [...current, ...items]));
        setNotesHasMore(Boolean(page?.has_more));
      } catch {
        if (requestId === noteRequestId.current) {
          setStatus("Unable to search the selected directory.");
          setNotesHasMore(false);
        }
      } finally {
        if (requestId === noteRequestId.current) setNotesLoading(false);
      }
    },
    [],
  );
  const requestDirectoriesPage = useCallback(
    async (search: string, offset: number) => {
      const requestId = ++directoryRequestId.current;
      setDirectoriesLoading(true);
      try {
        const page = await invoke<SearchPage<Directory>>(
          "search_creation_library",
          {
            kind: "directories",
            query: search,
            offset,
            limit: SEARCH_PAGE_SIZE,
          },
        );
        if (requestId !== directoryRequestId.current) return;
        const items = Array.isArray(page?.items)
          ? page.items.filter(
              (directory) => !isHiddenPath(directory.relative_path),
            )
          : [];
        setOutputDirectories((current) =>
          offset === 0 ? items : [...current, ...items],
        );
        setDirectoriesHaveMore(Boolean(page?.has_more));
      } catch {
        if (requestId === directoryRequestId.current) {
          setStatus("Unable to search the selected directory.");
          setDirectoriesHaveMore(false);
        }
      } finally {
        if (requestId === directoryRequestId.current)
          setDirectoriesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (notePickerOpen) void requestNotesPage(debouncedQuery, 0);
  }, [debouncedQuery, notePickerOpen, requestNotesPage]);

  useEffect(() => {
    if (outputPickerOpen) void requestDirectoriesPage(debouncedOutputQuery, 0);
  }, [debouncedOutputQuery, outputPickerOpen, requestDirectoriesPage]);

  const activeNoteId =
    notePickerOpen && notes.length > 0
      ? `note-search-option-${focusedNoteIndex}`
      : undefined;
  const activeOutputId =
    outputPickerOpen && outputDirectories.length > 0
      ? `output-directory-option-${focusedOutputIndex}`
      : undefined;
  const descriptionRequired = !skill.trim();
  const missingRequirements = [
    !sourceFile && "a source note",
    descriptionRequired && !request.trim() && "a description of what to create",
    !outputDirectory && "an output directory",
  ].filter(Boolean);
  const matchingSkill = !skill || skill.toLowerCase().includes(creationType);

  function handleNoteSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setNotePickerOpen(true);
      setFocusedNoteIndex((current) =>
        Math.min(current + 1, Math.max(0, notes.length - 1)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedNoteIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const note = notes[focusedNoteIndex];
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
        Math.min(current + 1, Math.max(0, outputDirectories.length - 1)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOutputPickerOpen(true);
      setFocusedOutputIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const directory = outputDirectories[focusedOutputIndex];
      if (directory) selectOutputDirectory(directory.path);
    } else if (event.key === "Escape") {
      setOutputPickerOpen(false);
    }
  }

  function selectOutputDirectory(path: string) {
    const directory = outputDirectories.find((item) => item.path === path);
    setOutputDirectory(path);
    setHasSelectedOutputDirectory(true);
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
      current && skills.includes(current)
        ? current
        : (suggestedSkills[0] ?? ""),
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
                onFocus={() => {
                  requestCreationStatus();
                  setNotesLoading(true);
                  setNotePickerOpen(true);
                }}
                onChange={(event) => {
                  requestCreationStatus();
                  noteRequestId.current += 1;
                  setSourceFile("");
                  setQuery(event.target.value);
                  setNotes([]);
                  setNotesHasMore(false);
                  setNotesLoading(true);
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
                    noteRequestId.current += 1;
                    setQuery("");
                    setSourceFile("");
                    setNotes([]);
                    setNotesHasMore(false);
                    setNotesLoading(true);
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
                onScroll={(event) => {
                  const list = event.currentTarget;
                  if (
                    notesHasMore &&
                    !notesLoading &&
                    list.scrollHeight - list.scrollTop - list.clientHeight < 48
                  ) {
                    void requestNotesPage(debouncedQuery, notes.length);
                  }
                }}
                role="listbox"
              >
                {notesLoading && notes.length === 0 ? (
                  <SearchLoading>Searching notes…</SearchLoading>
                ) : notes.length === 0 ? (
                  <p aria-live="polite" className="note-empty">
                    No matching notes in the selected directory.
                  </p>
                ) : (
                  notes.map((note, index) => (
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
                {notesLoading && notes.length > 0 && (
                  <SearchLoading>Loading more notes…</SearchLoading>
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
                    requestCreationStatus();
                    directoryRequestId.current += 1;
                    setOutputDirectory(basePath);
                    setHasSelectedOutputDirectory(false);
                    setOutputQuery(event.target.value);
                    setOutputDirectories([]);
                    setDirectoriesHaveMore(false);
                    setDirectoriesLoading(true);
                    setFocusedOutputIndex(0);
                    setOutputPickerOpen(true);
                  }}
                  onFocus={() => {
                    requestCreationStatus();
                    setDirectoriesLoading(true);
                    setOutputPickerOpen(true);
                  }}
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
                      directoryRequestId.current += 1;
                      setOutputDirectory(basePath);
                      setHasSelectedOutputDirectory(false);
                      setOutputQuery("");
                      setOutputDirectories([]);
                      setDirectoriesHaveMore(false);
                      setDirectoriesLoading(true);
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
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    if (
                      directoriesHaveMore &&
                      !directoriesLoading &&
                      list.scrollHeight - list.scrollTop - list.clientHeight <
                        48
                    ) {
                      void requestDirectoriesPage(
                        debouncedOutputQuery,
                        outputDirectories.length,
                      );
                    }
                  }}
                  role="listbox"
                >
                  {directoriesLoading && outputDirectories.length === 0 ? (
                    <SearchLoading>Searching directories…</SearchLoading>
                  ) : outputDirectories.length === 0 ? (
                    <p aria-live="polite" className="note-empty">
                      No matching directories in the selected directory.
                    </p>
                  ) : (
                    outputDirectories.map((directory, index) => (
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
                  {directoriesLoading && outputDirectories.length > 0 && (
                    <SearchLoading>Loading more directories…</SearchLoading>
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
            onOpen={requestCreationStatus}
            options={[
              { value: "agy", label: "Antigravity" },
              { value: "codex", label: "Codex" },
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
            label="Skill"
            loading={!availabilityChecked}
            onChange={setSkill}
            onOpen={requestCreationStatus}
            options={[
              { value: "", label: "No specific skill" },
              ...orderedSkills.map((item) => ({
                value: item,
                label: `${item}${suggestedSkills.includes(item) ? " (suggested)" : ""}`,
              })),
            ]}
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
            aria-required={descriptionRequired}
            aria-invalid={
              showValidationErrors && descriptionRequired && !request.trim()
            }
            className={
              showValidationErrors && descriptionRequired && !request.trim()
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
            Required: select a source note
            {descriptionRequired ? " and describe what to create." : "."}
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
