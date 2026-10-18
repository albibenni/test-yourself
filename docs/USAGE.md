# Test Yourself - Usage Guide

This guide covers everything you need to know to get the most out of **Test Yourself**, from navigating the interface to setting up powerful productivity integrations.

## Getting Started

1. **Select a Folder**: When you first launch the app, click **"Choose Folder"** to select a local directory on your computer that contains your Markdown files.
2. **Sync**: The app will recursively parse your markdown files and categorize them by topic (which are determined by the folder structure). You can manually refresh by clicking the sync icon next to the app title in the sidebar.
3. **Quizzes, Worksheets, and Questions**: The sidebar separates the supported study materials:
   - **Quizzes**: Standard `.md` files that parse into interactive Q&A flashcards.
   - **Worksheets**: Files ending in `.worksheet.md` that allow you to test complex flows (like architecture or authentication steps) using fill-in-the-blank exercises with `{{answer}}` syntax.
   - **Questions**: Files ending in `.question.md` that contain open-ended questions with individually revealed suggested answers.
4. **Select a File**: Click a study document in the sidebar to open it and start testing yourself!

## Keyboard Shortcuts

The app is highly optimized for keyboard usage to keep you in the flow:

- `Cmd + F` (Mac) or `Ctrl + F` (Windows/Linux): Instantly focuses the search bar so you can filter quizzes by title or topic.
- `Up Arrow` / `Down Arrow`: While focused in the search bar, use the arrow keys to navigate the filtered list of quizzes.
- `Enter`: Open the currently highlighted quiz.
- `Escape`: Instantly close any open modals (like the Settings or Schedule modals).

## Integrations

**Test Yourself** integrates seamlessly with **Todoist** and **Obsidian** to help you schedule follow-up reviews.

### Setup

1. Open the **Settings** modal (click the gear icon in the top right).
2. **Todoist**: Select **Connect Todoist** and complete the Todoist OAuth 2.0 authorization in your browser. The connection uses PKCE.
3. **Obsidian Vault Name**: Enter the exact name of your Obsidian vault (or use the "Browse" button to select the vault directory and automatically extract the name).

On desktop, Todoist OAuth credentials are saved in your operating system credential store, not in the app's regular settings file or browser storage. Connecting requires that credential store to be available; the app will show an error instead of storing credentials insecurely.

### Scheduling a Review

Once your settings are configured, you can use the **Schedule** button inside any open quiz:

1. Click **Schedule** at the top of a quiz.
2. The modal will automatically populate a task title like `Review Quiz: [Quiz Name]`.
3. Select a **Date** from the interactive calendar.
4. Select a **Priority** and **Project** (e.g., `#Inbox`).
5. Click **Add Task**.

This will instantly create a task in Todoist. The task description contains a `test-yourself://` deep link, so clicking it when the task is due opens the quiz or focused review directly in Test Yourself.

### Recommended and focused reviews

After a quiz is completed, Test Yourself stores question-level performance in the selected quiz folder and suggests a review date. The suggestion is only a starting point: the Todoist scheduling dialog still lets you freely change the date, priority, project, title, and description.

- An initial mistake produces an incorrect-only review suggestion for tomorrow.
- Completing that focused review produces a full-quiz suggestion in 3 days.
- Successful full reviews advance through 7, 14, and 30-day intervals.
- A failed longer review first schedules its incorrect questions for tomorrow, then shortens the following full review according to the previous interval.

Focused Todoist tasks contain a `test-yourself://review?set=...` deep link. Opening the task launches Test Yourself with only the questions saved in that review set. A later full-review task still contains the complete question suite.

Review history is written as immutable JSON events under `.test-yourself/events/`. Test Yourself also adds a stable `test-yourself-id` to a document's YAML frontmatter when that document is first reviewed. Keep both the Markdown documents and `.test-yourself/` in the same Git-synced Obsidian vault to make review links and learning progress available on another device. Test Yourself never runs Git commands; commit, push, pull, and conflict handling remain part of your existing Git workflow.

Existing browser-local progress is migrated automatically the first time this version opens the quiz folder. The original local copy is retained as a fallback. If two devices complete the same review before synchronizing, both attempts are retained and the merged learning state uses the more conservative interval.

## Mobile status

The iOS project and a compact settings layout exist, but the app is not yet a supported mobile release. Folder selection currently assumes desktop-style filesystem paths, which iOS and Android sandboxing do not provide persistently. Todoist scheduling is also unavailable on mobile until the desktop credential-store backend is replaced with a platform-native mobile implementation. Use the desktop app for the complete workflow today.

## File & Folder Structure

To ensure **Test Yourself** correctly parses your content, organize your local directory as follows:

### Folder Structure
The app categorizes files into **Topics** based on their immediate parent folder. 
For example, a file at `Computer Science/Security/Auth.md` will have the topic `Security`.

### 1. Quizzes (`.md`)
Standard quizzes test your knowledge using multiple-choice questions (A, B, C, D). 
- **Extension**: Must be `.md` (and not `.worksheet.md`).
- **Questions**: Must start with a number followed by a period or colon (e.g., `1. `, `Q1. `, `Question 1: `).
- **Options**: Must start with a letter (A-D) followed by a parenthesis or period (e.g., `A)`, `B.`). Checkboxes `[ ] A)` are also supported.
- **Answers**: The correct answer must be provided. It can be inline immediately after the options (e.g., `Correct answer: A` or `Answer: A`) or grouped at the end of the file under a **Solutions** heading (e.g., `1 - A`).
- **Explanations** (Optional): Add explanations using `Explanation:` or `Spiegazione:`.

#### Answer order

When you open a quiz, and whenever you use **Reset**, the app independently shuffles the options for every question and reassigns their displayed letters. The correct answer is remapped for that session, so marking, the score, and the review remain accurate. The shuffled order stays fixed while you answer the quiz; the original Markdown file and its answer key are never changed. Explanations remain attached to their original question.

Example:
```markdown
1. What does HTML stand for?
   A) Hyper Text Markup Language
   B) High Tech Multi Language
   
Correct answer: A
Explanation: HTML is the standard markup language for creating Web pages.
```

### 2. Worksheets (`.worksheet.md`)
Worksheets are fill-in-the-blank style exercises.
- **Extension**: Must end in `.worksheet.md`.
- **Syntax**: Use `{{answer}}` inline within the text to create an interactive text box where you will need to type the exact answer (case-insensitive).
- **YAML Frontmatter**: Any YAML frontmatter (`--- ... ---`) at the top of the file is automatically stripped out and ignored.

Example:
```markdown
To authorize a user in OAuth2 using PKCE, the client first generates a {{code_verifier}} and then hashes it to create the {{code_challenge}}.
```

### 3. Open Questions (`.question.md`)

Question documents require at least two consecutively numbered questions and exactly one matching suggested answer for each. The section headings may independently use English or Italian, case-insensitively: `Questions` or `Domande`, followed by `Suggested Answers` or `Risposte suggerite`.

Each numbered entry can contain multiline Markdown, including nested lists and fenced code blocks. In the app, write a response and reveal suggested answers one at a time.

The response field is optional: you may answer aloud, mentally, or in writing. After revealing the suggested answer, assess your own expressed knowledge as **Got it**, **Partially**, or **Didn't know**. The app does not automatically grade or compare your wording. Partial and unknown responses are included in the next focused review.

```markdown
# Authentication Review

## Questions

1. Why must authentication and authorization be evaluated separately?

2. What should happen when a valid identity has no matching policy?

## Risposte suggerite

1. Authentication establishes identity; authorization decides what that identity may do.

2. The request should be denied.
```
