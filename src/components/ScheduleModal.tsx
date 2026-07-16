import { useState, useEffect } from "react";
import { TodoistApi } from "@doist/todoist-sdk";
import type { Quiz } from "../types";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
}

interface Project {
  id: string;
  name: string;
}

export function ScheduleModal({ isOpen, onClose, quiz }: ScheduleModalProps) {
  const [dueDate, setDueDate] = useState("tomorrow");
  const [priority, setPriority] = useState<number>(4); // Todoist API: 4=P1, 3=P2, 2=P3, 1=P4
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess(false);
      const token = localStorage.getItem("todoist_token");
      if (token) {
        setLoading(true);
        const api = new TodoistApi(token);
        api
          .getProjects()
          .then((projs) => {
            setProjects(projs);
            if (projs.length > 0) {
              setSelectedProjectId(projs[0].id);
            }
          })
          .catch(() => {
            setError("Failed to fetch Todoist projects. Check your token.");
          })
          .finally(() => setLoading(false));
      } else {
        setError("Please configure your Todoist API Token in Settings first.");
      }
    }
  }, [isOpen]);

  const handleSchedule = async () => {
    if (!quiz) return;
    const token = localStorage.getItem("todoist_token");
    if (!token) {
      setError("Missing Todoist token.");
      return;
    }

    setLoading(true);
    setError("");

    const api = new TodoistApi(token);
    const vaultName = localStorage.getItem("obsidian_vault") || "Vault";
    
    // Topic is the relative path from the selected root folder. 
    // Title is the filename without extension.
    const relativePath = quiz.topic ? `${quiz.topic}/${quiz.title}.md` : `${quiz.title}.md`;
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(relativePath);
    
    const obsidianLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
    const taskContent = `Review Quiz: ${quiz.title} [Open in Obsidian](${obsidianLink})`;

    try {
      await api.addTask({
        content: taskContent,
        dueString: dueDate,
        priority: priority,
        projectId: selectedProjectId || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError("Failed to create task.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !quiz) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Schedule in Todoist</h2>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Task created successfully!</div>}
        
        <div className="form-group">
          <label>Task Content</label>
          <input type="text" value={`Review Quiz: ${quiz.title}`} disabled />
        </div>
        <div className="form-group">
          <label>Due Date (Natural Language)</label>
          <input
            type="text"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="e.g. tomorrow, tom, next week"
          />
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          >
            <option value={4}>Priority 1 (Urgent)</option>
            <option value={3}>Priority 2</option>
            <option value={2}>Priority 3</option>
            <option value={1}>Priority 4 (Normal)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loading || projects.length === 0}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose} disabled={loading || success}>
            Cancel
          </button>
          <button className="button-primary" onClick={handleSchedule} disabled={loading || !!error || success}>
            {loading ? "Scheduling..." : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
