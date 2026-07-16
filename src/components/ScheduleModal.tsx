import { useState, useEffect, useRef } from "react";
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

interface TaskCountMap {
  [dateString: string]: number; // YYYY-MM-DD -> count
}

export function ScheduleModal({ isOpen, onClose, quiz }: ScheduleModalProps) {
  const [taskContent, setTaskContent] = useState("");
  const [dueDateString, setDueDateString] = useState("tomorrow");
  const [dueDateText, setDueDateText] = useState("Tomorrow");
  const [priority, setPriority] = useState<number>(4); // 4=P1, 1=P4
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taskCounts, setTaskCounts] = useState<TaskCountMap>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (quiz && !taskContent) {
      setTaskContent(`Review Quiz: ${quiz.title}`);
    }
  }, [quiz, taskContent]);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess(false);
      const token = localStorage.getItem("todoist_token");
      if (token) {
        setLoading(true);
        const api = new TodoistApi(token);
        
        // Fetch projects
        api.getProjects()
          .then((response: any) => {
            const projs = Array.isArray(response) ? response : (response.results || response.items || []);
            setProjects(projs);
            if (projs.length > 0 && !selectedProjectId) {
              setSelectedProjectId(projs[0].id);
            }
          })
          .catch(() => setError("Failed to fetch Todoist projects. Check your token."));
          
        // Fetch tasks to count them by date
        api.getTasks()
          .then((response: any) => {
            const tasks = Array.isArray(response) ? response : (response.results || response.items || []);
            const counts: TaskCountMap = {};
            tasks.forEach((t: any) => {
              if (t.due && t.due.date) {
                counts[t.due.date] = (counts[t.due.date] || 0) + 1;
              }
            });
            setTaskCounts(counts);
          })
          .catch(console.error)
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
    
    const relativePath = quiz.topic ? `${quiz.topic}/${quiz.title}.md` : `${quiz.title}.md`;
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(relativePath);
    
    const obsidianLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
    const fullContent = `${taskContent} [Open in Obsidian](${obsidianLink})`;

    try {
      await api.addTask({
        content: fullContent,
        dueString: dueDateString,
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

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    setDueDateString(dateStr);
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (d.toDateString() === today.toDateString()) {
      setDueDateText("Today");
    } else if (d.toDateString() === tomorrow.toDateString()) {
      setDueDateText("Tomorrow");
    } else {
      setDueDateText(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
    
    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    // Padding for first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const yyyy = year;
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const count = taskCounts[dateStr] || 0;
      
      const isSelected = dueDateString === dateStr;
      
      days.push(
        <button 
          key={day} 
          className={`cal-day ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDateSelect(year, month, day)}
        >
          <span className="cal-date-num">{day}</span>
          {count > 0 && <span className="cal-task-count">{count}</span>}
        </button>
      );
    }

    return (
      <div className="calendar-popover">
        <div className="cal-header">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>&lt;</button>
          <span>{currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>&gt;</button>
        </div>
        <div className="cal-grid">
          <div className="cal-dow">Su</div>
          <div className="cal-dow">Mo</div>
          <div className="cal-dow">Tu</div>
          <div className="cal-dow">We</div>
          <div className="cal-dow">Th</div>
          <div className="cal-dow">Fr</div>
          <div className="cal-dow">Sa</div>
          {days}
        </div>
      </div>
    );
  };

  const getPriorityColor = (p: number) => {
    switch(p) {
      case 4: return "#d1453b"; // P1
      case 3: return "#eb8909"; // P2
      case 2: return "#246fe0"; // P3
      default: return "currentColor"; // P4
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    
    // Date parsing
    const tomRegex = /(^|\s)(tom|tomorrow)(\s|$)/i;
    if (tomRegex.test(text)) {
      text = text.replace(tomRegex, '$1$3');
      setDueDateText("Tomorrow");
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setDueDateString(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    const todRegex = /(^|\s)(tod|today)(\s|$)/i;
    if (todRegex.test(text)) {
      text = text.replace(todRegex, '$1$3');
      setDueDateText("Today");
      const d = new Date();
      setDueDateString(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    // Priority parsing (p1, p2, p3, p4)
    const pRegex = /(^|\s)p([1-4])(\s|$)/i;
    const pMatch = text.match(pRegex);
    if (pMatch) {
      text = text.replace(pRegex, '$1$3');
      const pLevel = parseInt(pMatch[2]);
      const apiPriority = 5 - pLevel; // p1->4, p2->3, p3->2, p4->1
      setPriority(apiPriority);
    }

    // Clean up double spaces
    text = text.replace(/\s{2,}/g, ' ');
    if (text.startsWith(' ')) text = text.substring(1);

    setTaskContent(text);
  };

  if (!isOpen || !quiz) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content quick-add-modal">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Task created successfully!</div>}
        
        <div className="quick-add-input-wrapper">
          <input 
            type="text" 
            className="quick-add-input"
            value={taskContent} 
            onChange={handleContentChange}
            placeholder="Task name"
          />
        </div>
        
        <div className="quick-add-actions">
          <div className="quick-add-action-group">
            <div style={{ position: 'relative' }}>
              <button 
                className="action-pill date-pill" 
                onClick={() => setShowCalendar(!showCalendar)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                {dueDateText}
              </button>
              {showCalendar && renderCalendar()}
            </div>
            
            <div className="custom-select-wrapper">
              <svg className="action-icon flag-icon" style={{ color: getPriorityColor(priority) }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={priority > 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
              <select 
                className="action-pill select-pill"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                <option value={4}>Priority 1</option>
                <option value={3}>Priority 2</option>
                <option value={2}>Priority 3</option>
                <option value={1}>Priority 4</option>
              </select>
            </div>
            
            <div className="custom-select-wrapper">
              <svg className="action-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              <select 
                className="action-pill select-pill"
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
          </div>
          
          <div className="quick-add-footer">
            <button className="button-secondary" onClick={onClose} disabled={loading || success}>
              Cancel
            </button>
            <button className="button-primary" onClick={handleSchedule} disabled={loading || !!error || success}>
              {loading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
