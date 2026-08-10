# Integrations Deep Dive

**Test Yourself** provides robust integrations for spacing out your repetitions and storing your knowledge natively in Markdown. This document dives deeper into how these integrations function under the hood, enabling you to build powerful, automated workflows.

## 1. Obsidian Deep Links

Obsidian is a highly customizable, local-first knowledge base that works on top of a local folder of plain text Markdown files. Because **Test Yourself** also uses a local directory of Markdown files, they pair perfectly together.

### How it works

The `obsidian://open` protocol allows external applications to open specific notes inside your vault.

When you use the scheduling feature in this application, it generates a URI like this:
`obsidian://open?vault=<Your-Vault-Name>&file=<Path/To/Quiz.md>`

- **`vault`**: This is pulled from your Settings. It must perfectly match the name of the folder your Obsidian vault is stored in.
- **`file`**: This is dynamically resolved based on the quiz you are viewing. The app concatenates the topic folder and the quiz filename (`<Topic>/<QuizTitle>.md`).

### Troubleshooting

If the deep link fails to open Obsidian:

1. Ensure Obsidian is installed and the `obsidian://` protocol handler is registered with your OS.
2. Verify that your vault name in Settings exactly matches the folder name of your vault (case-sensitive).
3. Ensure the base folder you selected in **Test Yourself** matches the root (or a valid subfolder) of your Obsidian vault.

## 2. Todoist Task Creation

Todoist is a task manager that provides a REST API. We use the `@doist/todoist-sdk` to interact directly with it.

### How it works

The application uses the API Token you provide in Settings to authenticate with Todoist. When you open the **Schedule Modal**, the app performs the following actions:

1. **Fetch Projects**: Calls `api.getProjects()` to populate your project selection dropdown.
2. **Fetch Tasks**: Calls `api.getTasks()` to aggregate tasks by their due dates. This populates the task counts (the green dots) on the interactive calendar, helping you balance your workload.
3. **Create Task**: When you submit the form, it sends a payload to `api.addTask()` containing:
   - `content`: The title of the task.
   - `description`: Contains the generated Obsidian deep link.
   - `dueString`: The selected ISO date string (e.g., `YYYY-MM-DD`).
   - `priority`: Mapped correctly to the Todoist API priority levels.

### Security

Your Todoist API token is stored in the operating system's native credential store (macOS Keychain, Windows Credential Manager, or the available Linux Secret Service). Clearing the token removes the credential. There is no fallback to plaintext browser storage or the Tauri store.

The backend exposes only `get_secret` and `set_secret` for the fixed `todoist_token` account; it does not expose arbitrary credential-store access to the frontend. The native credential lifecycle is tested with an in-memory keyring mock, so tests do not read, update, delete, or prompt for your real Keychain credential.

This implementation is currently **desktop-only**. The selected `keyring` backend deliberately rejects iOS and Android; a mobile-native credential-store implementation is required before Todoist integration is available on those platforms.

## 3. Deep Linking (Custom URL Scheme)

The app registers a custom URL scheme (`test-yourself://`) so you can launch it and directly open a specific quiz or worksheet from anywhere on your system.

### How it works

You can trigger a deep link via the browser or terminal:
`test-yourself://open?quiz=<Encoded-Path/To/Quiz.md>`

- The application listens for `get_initial_url` on startup, or the `deep-link-received` event if already running.
- It will automatically navigate to the target quiz or worksheet.

Desktop deep-link registration and single-instance handling are intentionally desktop-only. Mobile builds must use the platform's own universal-link/app-link configuration before equivalent flows can be supported.
