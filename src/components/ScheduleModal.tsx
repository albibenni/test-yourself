import { useState, useEffect, useRef } from "react";
import { useTodoist } from "../hooks/useTodoist";
import type { QuizMetadata } from "../types";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: QuizMetadata | null;
  onSuccess?: (dateText: string) => void;
}

interface Project {
  id: string;
  name: string;
}

interface TaskCountMap {
  [dateString: string]: number; // YYYY-MM-DD -> count
}

export function ScheduleModal({
  isOpen,
  onClose,
  quiz,
  onSuccess,
}: ScheduleModalProps) {
  const [taskContent, setTaskContent] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [dueDateString, setDueDateString] = useState("tomorrow");
  const [dueDateText, setDueDateText] = useState("Tomorrow");
  const [priority, setPriority] = useState<number>(4); // 4=P1, 1=P4
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taskCounts, setTaskCounts] = useState<TaskCountMap>({});

  const {
    getProjects,
    getTasks,
    addTask,
    getVaultName,
    getDefaultSettings,
    loading,
    error,
    setError,
  } = useTodoist();

  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showProjectSelectDropdown, setShowProjectSelectDropdown] =
    useState(false);
  const [showInfoDropdown, setShowInfoDropdown] = useState(false);

  const calRef = useRef<HTMLDivElement>(null);
  const priRef = useRef<HTMLDivElement>(null);
  const projRef = useRef<HTMLDivElement>(null);
  const hashProjRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
      if (priRef.current && !priRef.current.contains(e.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (projRef.current && !projRef.current.contains(e.target as Node)) {
        setShowProjectSelectDropdown(false);
      }
      if (
        hashProjRef.current &&
        !hashProjRef.current.contains(e.target as Node)
      ) {
        setShowProjectDropdown(false);
      }
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfoDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && quiz) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskContent(`Review Quiz: ${quiz.title}`);
      setTaskDescription("");
      setShowCalendar(false);
      setCurrentMonth(new Date());
      setShowPriorityDropdown(false);
      setShowProjectDropdown(false);
      setShowProjectSelectDropdown(false);
      setShowInfoDropdown(false);

      void getDefaultSettings().then(
        ({ defaultDate, defaultPriority, defaultProject }) => {
          let exactDate = defaultDate;
          const d = new Date();
          if (defaultDate === "tomorrow") {
            d.setDate(d.getDate() + 1);
            exactDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          } else if (
            defaultDate === "in 7 days" ||
            defaultDate === "next week"
          ) {
            d.setDate(d.getDate() + 7);
            exactDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          } else if (
            defaultDate === "in 14 days" ||
            defaultDate === "in 2 weeks"
          ) {
            d.setDate(d.getDate() + 14);
            exactDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          } else if (defaultDate === "today") {
            exactDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }

          setDueDateString(exactDate);
          setPriority(defaultPriority);
          if (defaultProject) {
            setSelectedProjectId(defaultProject);
          }

          if (defaultDate === "today") setDueDateText("Today");
          else if (defaultDate === "tomorrow") setDueDateText("Tomorrow");
          else if (defaultDate === "in 7 days" || defaultDate === "next week")
            setDueDateText("Next Week");
          else if (defaultDate === "in 14 days" || defaultDate === "in 2 weeks")
            setDueDateText("In 2 Weeks");
          else setDueDateText(defaultDate);

          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 50);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, quiz]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setError("");

      getProjects()
        .then((projs) => {
          setProjects(projs);
          if (projs.length > 0) {
            // Only set default to Inbox if we haven't already set it from presets
            setSelectedProjectId((prev) => prev || projs[0].id);
          }
        })
        .catch(console.error);

      getTasks()
        .then((tasks) => {
          const counts: TaskCountMap = {};
          tasks.forEach((t) => {
            if (t.due && t.due.date) {
              counts[t.due.date] = (counts[t.due.date] || 0) + 1;
            }
          });
          setTaskCounts(counts);
        })
        .catch(console.error);
    }
  }, [isOpen, getProjects, getTasks, setError]);

  const handleSchedule = async () => {
    if (!quiz) return;
    setError("");

    try {
      const vaultName = await getVaultName();

      const relativePath = quiz.topic
        ? `${quiz.topic}/${quiz.title}.md`
        : `${quiz.title}.md`;
      const encodedVault = encodeURIComponent(vaultName);
      const encodedFile = encodeURIComponent(relativePath);

      const obsidianLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
      const finalDescription = taskDescription.trim()
        ? `${taskDescription}\n\n[Open in Obsidian](${obsidianLink})`
        : `[Open in Obsidian](${obsidianLink})`;

      await addTask({
        content: taskContent,
        description: finalDescription,
        dueString: dueDateString,
        priority: priority,
        projectId: selectedProjectId || undefined,
      });
      const [y, m, d] = dueDateString.split("-");
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const month = dateObj.toLocaleString("en-US", { month: "long" });
      const dayNum = dateObj.getDate();
      const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      onSuccess?.(`${month} ${getOrdinal(dayNum)}`);
      onClose();
    } catch (err) {
      // Error is handled in the hook, but we can catch to prevent unhandled rejection
      console.error(err);
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
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
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
      setDueDateText(
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      );
    }

    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }

    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

    for (let day = 1; day <= daysInMonth; day++) {
      const yyyy = year;
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const count = taskCounts[dateStr] || 0;

      const isSelected = dueDateString === dateStr;
      const isToday = todayStr === dateStr;

      days.push(
        <button
          key={day}
          className={`cal-day ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "is-today" : ""}`}
          onClick={() => handleDateSelect(year, month, day)}
        >
          <span className="cal-date-num">{day}</span>
          {count > 0 && <span className="cal-task-count">{count}</span>}
        </button>,
      );
    }

    return (
      <div className="calendar-popover">
        <div className="cal-header">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
            &lt;
          </button>
          <span>
            {currentMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
            &gt;
          </button>
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
    switch (p) {
      case 4:
        return "#d1453b"; // P1
      case 3:
        return "#eb8909"; // P2
      case 2:
        return "#246fe0"; // P3
      default:
        return "currentColor"; // P4
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let text = e.target.value;

    // Autoclose logic on type
    setShowCalendar(false);
    setShowPriorityDropdown(false);
    setShowProjectSelectDropdown(false);

    // Project hashtag parsing
    const hashtagMatch = text.match(/#(\S*)$/);
    if (hashtagMatch) {
      setShowProjectDropdown(true);
      setProjectSearchQuery(hashtagMatch[1].toLowerCase());
    } else {
      setShowProjectDropdown(false);
    }

    // Date parsing
    const tomRegex = /(^|\s)(tom|tomorrow)(\s|$)/i;
    if (tomRegex.test(text)) {
      text = text.replace(tomRegex, "$1$3");
      setDueDateText("Tomorrow");
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setDueDateString(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }

    const todRegex = /(^|\s)(tod|today)(\s|$)/i;
    if (todRegex.test(text)) {
      text = text.replace(todRegex, "$1$3");
      setDueDateText("Today");
      const d = new Date();
      setDueDateString(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }

    const shorthandRegex = /(^|\s)(\d+d|\d+w|\d+m)(\s|$)/i;
    const shorthandMatch = text.match(shorthandRegex);
    if (shorthandMatch) {
      text = text.replace(shorthandRegex, "$1$3");
      const matchText = shorthandMatch[2].toLowerCase();
      const num = parseInt(matchText.replace(/\D/g, ""));
      const unit = matchText.includes("d")
        ? "d"
        : matchText.includes("w")
          ? "w"
          : "m";

      const d = new Date();
      let label = "";

      if (unit === "d") {
        d.setDate(d.getDate() + num);
        label = `In ${num} Day${num === 1 ? "" : "s"}`;
      } else if (unit === "w") {
        d.setDate(d.getDate() + num * 7);
        label = `In ${num} Week${num === 1 ? "" : "s"}`;
      } else if (unit === "m") {
        d.setDate(d.getDate() + num * 30);
        label = `In ${num} Month${num === 1 ? "" : "s"}`;
      }

      setDueDateText(label);
      setDueDateString(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }

    // Priority parsing (p1, p2, p3, p4)
    const pRegex = /(^|\s)p([1-4])(\s|$)/i;
    const pMatch = text.match(pRegex);
    if (pMatch) {
      text = text.replace(pRegex, "$1$3");
      const pLevel = parseInt(pMatch[2]);
      const apiPriority = 5 - pLevel; // p1->4, p2->3, p3->2, p4->1
      setPriority(apiPriority);
    }

    // Clean up double spaces
    text = text.replace(/\s{2,}/g, " ");
    if (text.startsWith(" ")) text = text.substring(1);

    setTaskContent(text);
  };

  const handleProjectSelect = (p: Project) => {
    setSelectedProjectId(p.id);
    setShowProjectDropdown(false);
    setTaskContent((prev) => prev.replace(/#\S*$/, "").trim() + " ");
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearchQuery),
  );

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [taskContent, isOpen]);

  if (!isOpen || !quiz) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content quick-add-modal">
        {error && <div className="error-message">{error}</div>}

        <div
          className="quick-add-input-wrapper"
          style={{ position: "relative" }}
          ref={hashProjRef}
        >
          <textarea
            ref={inputRef}
            className="quick-add-input"
            value={taskContent}
            onChange={handleContentChange}
            placeholder="Task name"
            rows={1}
            style={{ resize: "none", overflow: "hidden" }}
          />
          <textarea
            className="quick-add-input quick-add-desc"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Description"
            rows={1}
            style={{ fontSize: "13px", color: "#ccc", resize: "none" }}
          />
          {showProjectDropdown && filteredProjects.length > 0 && (
            <div className="project-dropdown">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  className="project-dropdown-item"
                  onClick={() => handleProjectSelect(p)}
                >
                  <span style={{ color: "#8f8f8f", marginRight: "8px" }}>
                    #
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="quick-add-actions">
          <div className="quick-add-action-group">
            <div style={{ position: "relative" }} ref={calRef}>
              <button
                className="action-pill date-pill"
                onClick={() => setShowCalendar(!showCalendar)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {dueDateText}
              </button>
              {showCalendar && renderCalendar()}
            </div>

            <div style={{ position: "relative" }} ref={priRef}>
              <button
                className="action-pill"
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
              >
                <svg
                  className="action-icon flag-icon"
                  style={{ color: getPriorityColor(priority) }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={priority > 1 ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                <span style={{ marginLeft: "16px" }}>
                  Priority {5 - priority}
                </span>
              </button>
              {showPriorityDropdown && (
                <div className="project-dropdown" style={{ minWidth: "120px" }}>
                  {[4, 3, 2, 1].map((p) => (
                    <button
                      key={p}
                      className="project-dropdown-item"
                      onClick={() => {
                        setPriority(p);
                        setShowPriorityDropdown(false);
                      }}
                    >
                      <svg
                        style={{
                          color: getPriorityColor(p),
                          marginRight: "8px",
                        }}
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={p > 1 ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                        <line x1="4" y1="22" x2="4" y2="15"></line>
                      </svg>
                      Priority {5 - p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} ref={projRef}>
              <button
                className="action-pill"
                onClick={() =>
                  setShowProjectSelectDropdown(!showProjectSelectDropdown)
                }
                disabled={loading || projects.length === 0}
              >
                <svg
                  className="action-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span style={{ marginLeft: "16px" }}>
                  {projects.find((p) => p.id === selectedProjectId)?.name ||
                    "Inbox"}
                </span>
              </button>
              {showProjectSelectDropdown && (
                <div className="project-dropdown">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      className="project-dropdown-item"
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setShowProjectSelectDropdown(false);
                      }}
                    >
                      <span style={{ color: "#8f8f8f", marginRight: "8px" }}>
                        #
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} ref={infoRef}>
              <button
                className="action-pill"
                onClick={() => setShowInfoDropdown(!showInfoDropdown)}
                title="Typing Shortcuts"
                style={{ padding: "0 8px" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
              {showInfoDropdown && (
                <div
                  className="project-dropdown"
                  style={{
                    minWidth: "220px",
                    padding: "12px",
                    fontSize: "13px",
                    color: "#ccc",
                    whiteSpace: "normal",
                    lineHeight: "1.5",
                    left: "0",
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      marginBottom: "10px",
                      fontWeight: "bold",
                      color: "#fff",
                    }}
                  >
                    Typing Shortcuts
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>today / tod</b>: Schedule for today
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>tomorrow / tom</b>: Schedule for tomorrow
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>Xd</b>: Schedule in X days (e.g., 7d, 14d)
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>Xw</b>: Schedule in X weeks (e.g., 1w, 2w)
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>Xm</b>: Schedule in X months (e.g., 1m, 2m)
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <b>p1-p4</b>: Set priority (e.g., p1)
                  </div>
                  <div>
                    <b>#project</b>: Assign to project (e.g., #Inbox)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="quick-add-footer">
            <button
              className="button-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => void handleSchedule()}
              disabled={loading || !!error}
            >
              {loading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
