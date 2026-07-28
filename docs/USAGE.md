# Test Yourself - Usage Guide

This guide covers everything you need to know to get the most out of **Test Yourself**, from navigating the interface to setting up powerful productivity integrations.

## Getting Started

1. **Select a Folder**: When you first launch the app, click **"Choose Folder"** to select a local directory on your computer that contains your Markdown files.
2. **Sync**: The app will recursively parse your markdown files and categorize them by topic (which are determined by the folder structure). You can manually refresh by clicking the sync icon next to the app title in the sidebar.
3. **Quizzes and Worksheets**: The sidebar features two tabs to help organize your study materials:
   - **Quizzes**: Standard `.md` files that parse into interactive Q&A flashcards.
   - **Worksheets**: Files ending in `.worksheet.md` that allow you to test complex flows (like architecture or authentication steps) using fill-in-the-blank exercises with `{{answer}}` syntax.
4. **Select a File**: Click on a quiz or worksheet from the sidebar to open it in the main view and start testing yourself!

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
2. **Todoist API Token**: Enter your token. You can find this in Todoist by going to _Settings > Integrations > Developer_.
3. **Obsidian Vault Name**: Enter the exact name of your Obsidian vault (or use the "Browse" button to select the vault directory and automatically extract the name).

### Scheduling a Review

Once your settings are configured, you can use the **Schedule** button inside any open quiz:

1. Click **Schedule** at the top of a quiz.
2. The modal will automatically populate a task title like `Review Quiz: [Quiz Name]`.
3. Select a **Date** from the interactive calendar.
4. Select a **Priority** and **Project** (e.g., `#Inbox`).
5. Click **Add Task**.

This will instantly create a task in your Todoist! The task description will automatically contain a deep link to your Obsidian vault (`obsidian://open?vault=...&file=...`), so when the task is due, clicking the link in Todoist will immediately open the exact markdown file in Obsidian for review.

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
