import type { InvokeArgs } from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateView } from "./CreateView";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

type LibraryEntry = {
  name: string;
  path: string;
  relative_path: string;
};

type SearchArgs = {
  kind?: string;
  offset?: number;
  limit?: number;
  query?: string;
};

function getSearchArgs(args: InvokeArgs | undefined): SearchArgs {
  if (
    !args ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    args instanceof ArrayBuffer ||
    args instanceof Uint8Array
  ) {
    return {};
  }
  return args as SearchArgs;
}

function searchPage(
  kind: string | undefined,
  args: InvokeArgs | undefined,
  notes: LibraryEntry[] = [],
  directories: LibraryEntry[] = [],
) {
  const searchArgs = getSearchArgs(args);
  const entries = kind === "directories" ? directories : notes;
  const query = searchArgs.query?.toLowerCase() ?? "";
  const matching = entries.filter((entry) =>
    entry.relative_path.toLowerCase().includes(query),
  );
  const offset = searchArgs.offset ?? 0;
  const limit = searchArgs.limit ?? matching.length;
  return {
    items: matching.slice(offset, offset + limit),
    has_more: offset + limit < matching.length,
  };
}

describe("CreateView", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads AI tools and skills when either selector is opened", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "creation_status") {
        return Promise.resolve({
          agy_available: true,
          codex_available: true,
          skills: ["quiz-master"],
        });
      }
      return Promise.resolve(undefined);
    });

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "AI tool" }));

    expect(await screen.findByRole("option", { name: "Codex" })).toBeVisible();
    expect(await screen.findByRole("button", { name: "Skill" })).toBeEnabled();
  });

  it("defaults to no specific skill when none match the creation type", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status") {
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["scenario"],
          });
        }
        if (command === "search_creation_library") {
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "Biology.md",
                path: "/SecondBrain/Biology.md",
                relative_path: "Biology.md",
              },
            ]),
          );
        }
        if (command === "generate_material") return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));
    fireEvent.click(
      await screen.findByRole("option", { name: /biology\.md/i }),
    );
    expect(await screen.findByText("No specific skill")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/what should it create/i), {
      target: { value: "Revision questions" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate quiz/i }));

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "generate_material",
      expect.objectContaining({ skill: "" }),
    );
  });

  it("allows generation without a description when a skill is selected", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status") {
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master"],
          });
        }
        if (command === "search_creation_library") {
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "Biology.md",
                path: "/SecondBrain/Biology.md",
                relative_path: "Biology.md",
              },
            ]),
          );
        }
        if (command === "generate_material") return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Skill" }));
    fireEvent.click(
      await screen.findByRole("option", { name: /quiz-master/i }),
    );
    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));
    fireEvent.click(
      await screen.findByRole("option", { name: /biology\.md/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /generate quiz/i }));

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "generate_material",
      expect.objectContaining({ request: "", skill: "quiz-master" }),
    );
    expect(screen.getByLabelText(/what should it create/i)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("shows an animated loader instead of an empty-state message while a search is pending", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    let resolveSearch: ((value: unknown) => void) | undefined;
    vi.mocked(invoke).mockImplementation(
      (command: string, _args?: InvokeArgs) => {
        if (command === "creation_status") {
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master"],
          });
        }
        if (command === "search_creation_library") {
          return new Promise((resolve) => {
            resolveSearch = resolve;
          });
        }
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));

    expect(await screen.findByText("Searching notes…")).toHaveClass(
      "note-loading",
    );
    expect(
      screen.queryByText(/no matching notes in the selected directory/i),
    ).not.toBeInTheDocument();

    resolveSearch?.({ items: [], has_more: false });
    expect(
      await screen.findByText(/no matching notes in the selected directory/i),
    ).toBeInTheDocument();
  });

  it("loads the shared library only when a picker opens and loads another page on scroll", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const notes = Array.from({ length: 21 }, (_, index) => ({
      name: `Note ${index + 1}.md`,
      path: `/SecondBrain/Note-${index + 1}.md`,
      relative_path: `Notes/Note ${index + 1}.md`,
    }));
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status") {
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master"],
          });
        }
        if (command === "search_creation_library") {
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind ?? "notes", args, notes),
          );
        }
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);

    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "search_creation_library"),
    ).toBe(false);

    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));
    expect(
      await screen.findByRole("option", { name: /note 1\.md/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /note 21\.md/i }),
    ).not.toBeInTheDocument();

    const list = screen.getByRole("listbox", { name: "Matching notes" });
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 100 },
    });
    fireEvent.scroll(list);

    expect(
      await screen.findByRole("option", { name: /note 21\.md/i }),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(
          ([command, args]) =>
            command === "search_creation_library" &&
            getSearchArgs(args).offset === 20,
        ),
    ).toHaveLength(1);
  });

  it("clears unfinished note and output-directory searches when focus leaves their pickers", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status") {
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master"],
          });
        }
        if (command === "search_creation_library") {
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        }
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const noteSearch = screen.getByRole("combobox", { name: /search notes/i });
    const directorySearch = screen.getByRole("combobox", {
      name: /search output directories/i,
    });

    fireEvent.change(noteSearch, { target: { value: "unfinished note" } });
    fireEvent.mouseDown(document.body);
    expect(noteSearch).toHaveValue("");

    fireEvent.change(directorySearch, {
      target: { value: "unfinished directory" },
    });
    fireEvent.mouseDown(document.body);
    expect(directorySearch).toHaveValue("");
  });

  it("filters notes from the shared directory and warns for an unrelated skill", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master", "scenario"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "Biology.md",
                path: "/SecondBrain/Biology.md",
                relative_path: "Biology.md",
              },
              {
                name: "History.md",
                path: "/SecondBrain/History.md",
                relative_path: "School/History.md",
              },
            ]),
          );
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));
    expect(
      await screen.findByRole("option", { name: /biology\.md/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search notes/i), {
      target: { value: "history" },
    });
    expect(await screen.findByText("History.md")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skill" }));
    fireEvent.click(screen.getByRole("option", { name: "scenario" }));
    expect(screen.getByText(/may not create a quiz/i)).toBeInTheDocument();
  });

  it("selects the focused search result with ArrowDown and Enter", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "First.md",
                path: "/SecondBrain/First.md",
                relative_path: "First.md",
              },
              {
                name: "Second.md",
                path: "/SecondBrain/Second.md",
                relative_path: "Second.md",
              },
            ]),
          );
        return Promise.resolve(undefined);
      },
    );
    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const search = await screen.findByLabelText(/search notes/i);
    fireEvent.focus(search);
    await screen.findByRole("option", { name: /first\.md/i });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(search).toHaveValue("Second.md");
    expect(screen.getByText("Selected note: Second.md")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /first\.md/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear selected note" }),
    );
    expect(search).toHaveValue("");
    expect(
      await screen.findByRole("option", { name: /first\.md/i }),
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("option", { name: /first\.md/i }),
    ).not.toBeInTheDocument();
  });

  it("exposes the note search as an expandable keyboard-operable listbox", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "First.md",
                path: "/SecondBrain/First.md",
                relative_path: "First.md",
              },
            ]),
          );
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const search = await screen.findByRole("combobox", {
      name: /search notes/i,
    });
    expect(search).toHaveAttribute("aria-expanded", "false");
    fireEvent.focus(search);
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: /first\.md/i }),
    ).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("uses the same accessible dropdown pattern for creation options", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: true,
            skills: ["quiz-master", "scenario"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const creationType = await screen.findByRole("button", {
      name: "Create",
    });
    expect(creationType).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(creationType);
    expect(screen.getByRole("listbox", { name: "Create" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Worksheet" }));

    expect(creationType).toHaveTextContent("Worksheet");
    expect(
      screen.queryByRole("listbox", { name: "Create" }),
    ).not.toBeInTheDocument();
  });

  it("offers a keyboard-accessible external-file chooser", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    expect(
      await screen.findByRole("button", { name: /choose external file/i }),
    ).toBeEnabled();
  });

  it("marks missing required fields when generation is requested", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /generate quiz/i }),
    );
    expect(
      screen.getByRole("combobox", { name: /search notes/i }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/what should it create/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("announces when the note search has no matches", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "Biology.md",
                path: "/SecondBrain/Biology.md",
                relative_path: "Biology.md",
              },
            ]),
          );
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.change(
      await screen.findByRole("combobox", { name: /search notes/i }),
      { target: { value: "physics" } },
    );
    expect(
      await screen.findByText(/no matching notes in the selected directory/i),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("shows live generation activity and a prompt response field", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(getSearchArgs(args).kind, args, [
              {
                name: "Biology.md",
                path: "/SecondBrain/Biology.md",
                relative_path: "Biology.md",
              },
            ]),
          );
        if (command === "generate_material") return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /search notes/i }));
    fireEvent.click(
      await screen.findByRole("option", { name: /biology\.md/i }),
    );
    fireEvent.change(screen.getByLabelText(/what should it create/i), {
      target: { value: "Ten revision questions" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate quiz/i }));

    expect(await screen.findByText(/generation activity/i)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /respond to a prompt/i }),
    ).toBeInTheDocument();
  });

  it("gives the external output-directory chooser a specific accessible name", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    expect(
      await screen.findByRole("button", { name: /choose external directory/i }),
    ).toBeEnabled();
  });

  it("searches output directories in the shared library", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: true,
            codex_available: false,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(
            searchPage(
              getSearchArgs(args).kind,
              args,
              [],
              [
                {
                  name: "Exercises",
                  path: "/SecondBrain/Exercises",
                  relative_path: "Exercises",
                },
                {
                  name: ".git",
                  path: "/SecondBrain/.git",
                  relative_path: ".git",
                },
              ],
            ),
          );
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const search = await screen.findByRole("combobox", {
      name: /search output directories/i,
    });
    fireEvent.focus(search);
    expect(
      await screen.findByRole("option", { name: /exercises/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /\.git/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /exercises/i }));
    expect(search).toHaveValue("Exercises");
    expect(
      screen.getByRole("button", { name: /choose external directory/i }),
    ).toBeInTheDocument();
  });

  it("shows an install command when the selected AI tool is unavailable", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation(
      (command: string, args?: InvokeArgs) => {
        if (command === "creation_status")
          return Promise.resolve({
            agy_available: false,
            codex_available: true,
            skills: ["quiz-master"],
          });
        if (command === "search_creation_library")
          return Promise.resolve(searchPage(getSearchArgs(args).kind, args));
        return Promise.resolve(undefined);
      },
    );

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);

    fireEvent.focus(
      await screen.findByRole("combobox", { name: /search notes/i }),
    );

    expect(
      await screen.findByText(/antigravity cli is not installed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "curl -fsSL https://antigravity.google/cli/install.sh | bash",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /antigravity installation guide/i }),
    ).toHaveAttribute("href", "https://antigravity.google/docs/cli/install/");
  });
});
