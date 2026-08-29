import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateView } from "./CreateView";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("CreateView", () => {
  it("filters notes from the shared directory and warns for an unrelated skill", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "creation_status")
        return Promise.resolve({
          agy_available: true,
          codex_available: true,
          skills: ["quiz-master", "scenario"],
        });
      if (command === "list_markdown_notes")
        return Promise.resolve([
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
        ]);
      return Promise.resolve(undefined);
    });

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    expect(
      await screen.findByRole("option", { name: /biology\.md/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search notes/i), {
      target: { value: "history" },
    });
    expect(screen.getByText("History.md")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Skill"), {
      target: { value: "scenario" },
    });
    expect(screen.getByText(/may not create a quiz/i)).toBeInTheDocument();
  });

  it("selects the focused search result with ArrowDown and Enter", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "creation_status")
        return Promise.resolve({
          agy_available: true,
          codex_available: false,
          skills: ["quiz-master"],
        });
      if (command === "list_markdown_notes")
        return Promise.resolve([
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
        ]);
      return Promise.resolve(undefined);
    });
    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const search = await screen.findByLabelText(/search notes/i);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(search).toHaveValue("Second.md");
    expect(
      screen.queryByRole("option", { name: /first\.md/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear selected note" }),
    );
    expect(search).toHaveValue("");
    expect(
      screen.getByRole("option", { name: /first\.md/i }),
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("option", { name: /first\.md/i }),
    ).not.toBeInTheDocument();
  });

  it("exposes the note search as an expandable keyboard-operable listbox", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "creation_status")
        return Promise.resolve({
          agy_available: true,
          codex_available: false,
          skills: ["quiz-master"],
        });
      if (command === "list_markdown_notes")
        return Promise.resolve([
          {
            name: "First.md",
            path: "/SecondBrain/First.md",
            relative_path: "First.md",
          },
        ]);
      return Promise.resolve(undefined);
    });

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    const search = await screen.findByRole("combobox", {
      name: /search notes/i,
    });
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /first\.md/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("offers a keyboard-accessible external-file chooser", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "creation_status")
        return Promise.resolve({
          agy_available: true,
          codex_available: false,
          skills: ["quiz-master"],
        });
      if (command === "list_markdown_notes") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<CreateView basePath="/SecondBrain" onGenerated={vi.fn()} />);
    expect(
      await screen.findByRole("button", { name: /choose external file/i }),
    ).toBeEnabled();
  });
});
