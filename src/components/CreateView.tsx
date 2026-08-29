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
type CreationType = "quiz" | "worksheet" | "scenario";
type Engine = "agy" | "codex";

const labels: Record<CreationType, string> = {
  quiz: "Quiz",
  worksheet: "Worksheet",
  scenario: "Scenario",
};

export function CreateView({
  basePath,
  onGenerated,
}: {
  basePath: string;
  onGenerated: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [available, setAvailable] = useState({ agy: false, codex: false });
  const [query, setQuery] = useState("");
  const [focusedNoteIndex, setFocusedNoteIndex] = useState(0);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const notePickerRef = useRef<HTMLDivElement>(null);
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
      invoke<{
        agy_available: boolean;
        codex_available: boolean;
        skills: string[];
      }>("creation_status"),
    ])
      .then(([foundNotes, creation]) => {
        setNotes(Array.isArray(foundNotes) ? foundNotes : []);
        setSkills(Array.isArray(creation?.skills) ? creation.skills : []);
        setAvailable({
          agy: creation?.agy_available ?? false,
          codex: creation?.codex_available ?? false,
        });
        setEngine(creation?.agy_available ? "agy" : "codex");
      })
      .catch(() => setStatus("Unable to load notes or AI tools."));
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
  const activeNoteId =
    notePickerOpen && filteredNotes.length > 0
      ? `note-search-option-${focusedNoteIndex}`
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

  useEffect(() => {
    setSkill((current) =>
      suggestedSkills.includes(current)
        ? current
        : (suggestedSkills[0] ?? skills[0] ?? ""),
    );
  }, [skills, suggestedSkills]);

  async function chooseOutput() {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: outputDirectory,
    });
    if (typeof selected === "string") setOutputDirectory(selected);
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
        <div ref={notePickerRef}>
          <p aria-atomic="true" aria-live="polite" className="sr-only">
            {selectionAnnouncement}
          </p>
          <label htmlFor="note-search">Search notes or drop a file here</label>
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
                setStatus("Use the file picker to select this external file.");
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
          <section
            className="output-directory-card"
            aria-labelledby="output-directory-title"
          >
            <div>
              <h2 id="output-directory-title">Output directory</h2>
              <p>Where the generated study material will be saved.</p>
            </div>
            <div className="output-row">
              <p className="output-directory-path" id="output-directory-path">
                {outputDirectory}
              </p>
              <button
                aria-label="Choose output directory"
                aria-describedby="output-directory-path"
                onClick={() => void chooseOutput()}
                type="button"
              >
                Choose…
              </button>
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
          <label htmlFor="creation-type">Create</label>
          <select
            id="creation-type"
            value={creationType}
            onChange={(event) =>
              setCreationType(event.target.value as CreationType)
            }
          >
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="engine">AI tool</label>
          <select
            id="engine"
            value={engine}
            onChange={(event) => setEngine(event.target.value as Engine)}
          >
            <option disabled={!available.agy} value="agy">
              agy
            </option>
            <option disabled={!available.codex} value="codex">
              Codex
            </option>
          </select>
          <label htmlFor="skill">Skill</label>
          <select
            id="skill"
            aria-invalid={showValidationErrors && !skill}
            className={
              showValidationErrors && !skill ? "field-invalid" : undefined
            }
            required
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
          >
            {orderedSkills.map((item) => (
              <option key={item} value={item}>
                {item}
                {suggestedSkills.includes(item) ? " (suggested)" : ""}
              </option>
            ))}
          </select>
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
