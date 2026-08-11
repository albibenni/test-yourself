import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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
    fireEvent.click(screen.getByRole("button", { name: /check all answers/i }));

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

    fireEvent.click(screen.getByRole("button", { name: /check all answers/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /check all answers/i }));

    // Click Try Again
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    // Should revert back to initial state
    const newInputs = screen.getAllByRole("textbox");
    expect((newInputs[0] as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Score: 1 / 2")).not.toBeInTheDocument();
  });

  it("moves focus to the next unanswered question after Enter checks one", () => {
    render(
      <WorksheetViewer
        worksheet={{
          ...mockWorksheet,
          content: "1. First: {{first}}\n\n2. Second: {{second}}",
        }}
      />,
    );

    const [firstInput, secondInput] = screen.getAllByRole("textbox");
    fireEvent.change(firstInput, { target: { value: "first" } });
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: "Enter" });

    expect(firstInput).toBeDisabled();
    expect(secondInput).toHaveFocus();
  });

  it("cycles Tab and Shift+Tab between unanswered blanks instead of buttons", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    const [firstInput, secondInput] = screen.getAllByRole("textbox");
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: "Tab" });
    expect(secondInput).toHaveFocus();

    fireEvent.keyDown(secondInput, { key: "Tab", shiftKey: true });
    expect(firstInput).toHaveFocus();
  });

  it("lets keyboard users leave answer navigation with Escape", () => {
    render(<WorksheetViewer worksheet={mockWorksheet} />);

    const [firstInput] = screen.getAllByRole("textbox");
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: "Escape" });
    const tabEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    firstInput.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(false);
  });
});
