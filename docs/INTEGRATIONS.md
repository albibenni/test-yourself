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
Your Todoist API token is stored securely in your local environment (`localStorage` via the Tauri webview). It is never transmitted anywhere other than directly to the official Todoist REST API endpoints over secure HTTPS.
