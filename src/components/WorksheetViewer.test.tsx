import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorksheetViewer } from "./WorksheetViewer";

describe("WorksheetViewer", () => {
  const mockWorksheet = {
    title: "Test Worksheet",
    path: "/path/to/worksheet",
    topic: "Test Topic",
    content: "This is a {{test}} of the {{worksheet}} system.",
    last_modified: 1234567890,
  };

  beforeEach(() => {
    // Render before each test
  });

  it("renders the text and input fields correctly", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    expect(screen.getByText(/This is a/i)).toBeInTheDocument();
    expect(screen.getByText(/of the/i)).toBeInTheDocument();
    expect(screen.getByText(/system./i)).toBeInTheDocument();

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
  });

  it("calculates score correctly for all correct answers", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    const inputs = screen.getAllByRole("textbox");

    // Type correct answers
    fireEvent.change(inputs[0], { target: { value: "test" } });
    fireEvent.change(inputs[1], { target: { value: "worksheet" } });

    // Check answers
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    // Check score
    expect(screen.getByText("Score: 2 / 2")).toBeInTheDocument();
    expect(inputs[0]).toHaveClass("correct");
    expect(inputs[1]).toHaveClass("correct");
  });

  it("calculates score correctly for partial correct answers (case-insensitive)", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    const inputs = screen.getAllByRole("textbox");

    // Type mixed answers
    fireEvent.change(inputs[0], { target: { value: "TEST" } }); // Correct (case insensitive)
    fireEvent.change(inputs[1], { target: { value: "wrong" } }); // Incorrect

    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    expect(screen.getByText("Score: 1 / 2")).toBeInTheDocument();
    expect(inputs[0]).toHaveClass("correct");
    expect(inputs[1]).toHaveClass("incorrect");

    // Should show the correction for the wrong answer
    expect(
      screen.getByText("worksheet", { selector: ".worksheet-correction" }),
    ).toBeInTheDocument();
  });

  it("resets the worksheet correctly", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    const inputs = screen.getAllByRole("textbox");

    // Type an answer
    fireEvent.change(inputs[0], { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    // Click Try Again
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    // Should revert back to initial state
    const newInputs = screen.getAllByRole("textbox");
    expect((newInputs[0] as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Score: 1 / 2")).not.toBeInTheDocument();
  });
});
