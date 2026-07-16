# Test Yourself - Usage Guide

This guide covers everything you need to know to get the most out of **Test Yourself**, from navigating the interface to setting up powerful productivity integrations.

## Getting Started

1. **Select a Folder**: When you first launch the app, click **"Choose Folder"** to select a local directory on your computer that contains your Markdown quiz files.
2. **Sync**: The app will recursively parse your markdown files and categorize them by topic (which are determined by the folder structure). You can manually refresh by clicking the sync icon next to the app title in the sidebar.
3. **Select a Quiz**: Click on a quiz from the sidebar to open it in the main view and start answering questions!

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
