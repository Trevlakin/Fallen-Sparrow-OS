import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_MEMBER_ROLE_LABELS, type TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { ChecklistItemRow, type ChecklistItemData } from "@/components/checklist/ChecklistItem";
import { PinPad } from "@/components/checklist/PinPad";
import {
  checklistApi,
  ChecklistApiError,
  formatChecklistTime,
  formatExtraTaskDuration,
  getChecklistSessionToken,
  greetingForHour,
  setChecklistSessionToken,
  todayISO,
  type ChecklistEmployee,
  type ExtraTask,
  type TodayChecklistSop,
} from "@/lib/checklistApi";
import { isPinSession } from "@/lib/pinSession";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";

type Screen = "loading" | "select" | "pin" | "checklist";

export function ChecklistPage() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [employees, setEmployees] = useState<ChecklistEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<ChecklistEmployee | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sops, setSops] = useState<TodayChecklistSop[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [sessionDate] = useState(todayISO());
  const [showConfetti, setShowConfetti] = useState(false);
  const [extraTasks, setExtraTasks] = useState<ExtraTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);

  const loadExtraTasks = useCallback(async () => {
    try {
      const tasks = await checklistApi.listExtraTasksToday(sessionDate);
      setExtraTasks(tasks);
    } catch {
      setExtraTasks([]);
    }
  }, [sessionDate]);

  const loadToday = useCallback(async (token: string) => {
    sessionTokenRef.current = token;
    setChecklistSessionToken(token);
    const data = await checklistApi.getToday(sessionDate);
    setDisplayName(data.teamMember.displayName);
    setSops(data.sops);
    setProgress(data.overallProgress);
    setScreen("checklist");
    await loadExtraTasks();
  }, [sessionDate, loadExtraTasks]);

  useEffect(() => {
    void (async () => {
      try {
        const existingToken = getChecklistSessionToken();
        if (existingToken && isPinSession()) {
          await loadToday(existingToken);
          return;
        }

        const res = await checklistApi.listEmployees();
        setEmployees(res.employees);
        setScreen("select");
      } catch {
        if (isPinSession()) {
          setPinError("Session expired. Please sign in again.");
          setScreen("select");
          return;
        }
        setPinError("Unable to load employees");
        setScreen("select");
      }
    })();
  }, [loadToday]);

  useEffect(() => {
    if (progress.total > 0 && progress.completed === progress.total) {
      setShowConfetti(true);
      const t = window.setTimeout(() => setShowConfetti(false), 2500);
      return () => window.clearTimeout(t);
    }
    setShowConfetti(false);
  }, [progress]);

  const submitPin = async (pinValue: string) => {
    if (!selectedEmployee) return;
    setPinError("");
    try {
      const res = await checklistApi.login(selectedEmployee.id, pinValue);
      await loadToday(res.sessionToken);
    } catch (err) {
      setPinError(
        err instanceof ChecklistApiError ? err.message : "Incorrect PIN, try again",
      );
      setChecklistSessionToken(null);
      sessionTokenRef.current = null;
    }
  };

  const appendPinDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      void submitPin(next).finally(() => setPin(""));
    }
  };

  const toggleItem = async (sopId: string, item: ChecklistItemData) => {
    const prev = sops;
    const optimistic = sops.map((sop) => {
      if (sop.id !== sopId) return sop;
      const items = sop.items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              completed: !row.completed,
              completedAt: !row.completed ? new Date().toISOString() : null,
            }
          : row,
      );
      const completedCount = items.filter((i) => i.completed).length;
      return { ...sop, items, completedCount, totalCount: items.length };
    });
    setSops(optimistic);
    const nextProgress = optimistic.reduce(
      (acc, sop) => ({
        completed: acc.completed + sop.completedCount,
        total: acc.total + sop.totalCount,
      }),
      { completed: 0, total: 0 },
    );
    setProgress(nextProgress);

    try {
      if (item.completed) {
        await checklistApi.uncomplete(item.id);
      } else {
        await checklistApi.complete(item.id);
      }
      emitData(DATA_EVENTS.sops);
    } catch {
      setSops(prev);
      const rollback = prev.reduce(
        (acc, sop) => ({
          completed: acc.completed + sop.completedCount,
          total: acc.total + sop.totalCount,
        }),
        { completed: 0, total: 0 },
      );
      setProgress(rollback);
    }
  };

  const addExtraTask = async () => {
    if (!newTaskText.trim()) return;
    setAddingTask(true);
    try {
      const task = await checklistApi.addExtraTask(
        newTaskText.trim(),
        displayName,
        sessionDate,
      );
      setExtraTasks((prev) => [task, ...prev]);
      setNewTaskText("");
    } catch {
      window.alert("Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const markExtraTaskDone = async (taskId: string) => {
    try {
      const updated = await checklistApi.updateExtraTaskStatus(taskId, "done");
      setExtraTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updated : task)),
      );
    } catch {
      window.alert("Failed to update task");
    }
  };

  if (screen === "loading") {
    return (
      <div className="checklist-page">
        <p className="text-muted checklist-loading">Loading checklist...</p>
      </div>
    );
  }

  if (screen === "select") {
    return (
      <div className="checklist-page checklist-select-page">
        <header className="checklist-pin-header">
          <span className="wordmark-sm">FALLEN SPARROW</span>
          <p>Select your name</p>
        </header>
        <ul className="checklist-employee-list">
          {employees.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                className="checklist-employee-btn"
                onClick={() => {
                  setSelectedEmployee(employee);
                  setPin("");
                  setPinError("");
                  setScreen("pin");
                }}
              >
                <span className="employee-avatar">
                  {employee.displayName.slice(0, 2).toUpperCase()}
                </span>
                <span className="checklist-employee-name">{employee.displayName}</span>
                <span className="role-tag">
                  {TEAM_MEMBER_ROLE_LABELS[employee.role as TeamMemberRole] ??
                    employee.role.replace(/_/g, " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (screen === "pin") {
    return (
      <div className="checklist-page checklist-pin-page">
        <header className="checklist-pin-header">
          <span className="wordmark-sm">FALLEN SPARROW</span>
          <p>Enter your PIN</p>
          {selectedEmployee && (
            <p className="text-muted">{selectedEmployee.displayName}</p>
          )}
        </header>
        <PinPad
          pin={pin}
          error={pinError}
          onDigit={appendPinDigit}
          onClear={() => {
            setPin("");
            setPinError("");
          }}
          onBack={() => setPin((p) => p.slice(0, -1))}
        />
        <button
          type="button"
          className="btn-text checklist-back-link"
          onClick={() => {
            setSelectedEmployee(null);
            setScreen("select");
          }}
        >
          Back to employee list
        </button>
      </div>
    );
  }

  return (
    <div className="checklist-page">
      {showConfetti && <div className="checklist-confetti" aria-hidden />}
      <header className="checklist-header">
        <span className="wordmark-sm">FALLEN SPARROW</span>
        <h1>
          {greetingForHour()}, {displayName}
        </h1>
        <p className="text-muted">
          {new Date(`${sessionDate}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <div className="checklist-progress">
        <div className="sop-progress-track">
          <div
            className="sop-progress-fill"
            style={{
              width:
                progress.total > 0
                  ? `${Math.round((progress.completed / progress.total) * 100)}%`
                  : "0%",
            }}
          />
        </div>
        <span>
          {progress.completed} / {progress.total} complete
        </span>
      </div>

      {progress.total > 0 && progress.completed === progress.total && (
        <div className="checklist-done-banner">All done for today! ✓</div>
      )}

      {sops.map((sop) => (
        <section key={sop.id} className="checklist-sop-section">
          <h2>{sop.title}</h2>
          <ul className="checklist-items">
            {sop.items.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={{
                  id: item.id,
                  text: item.text,
                  completed: item.completed,
                  completedAt: item.completedAt,
                }}
                onToggle={(row) => void toggleItem(sop.id, row)}
              />
            ))}
          </ul>
        </section>
      ))}

      <section className="checklist-extras">
        <h2 className="checklist-extras-title">Today&apos;s extras</h2>

        {extraTasks.map((task) => (
          <div
            key={task.id}
            className={`checklist-extra-task${
              task.status === "done" ? " checklist-extra-task--done" : ""
            }`}
          >
            <div className="checklist-extra-task-body">
              <div
                className={`checklist-extra-task-text${
                  task.status === "done" ? " checklist-extra-task-text--done" : ""
                }`}
              >
                {task.description}
              </div>
              <div className="checklist-extra-task-meta">
                Logged {formatChecklistTime(task.loggedAt)}
                {task.completedAt
                  ? ` · Done ${formatChecklistTime(task.completedAt)} · ${formatExtraTaskDuration(task.loggedAt, task.completedAt)}`
                  : null}
              </div>
            </div>

            {task.status !== "done" ? (
              <button
                type="button"
                className="checklist-extra-done-btn"
                onClick={() => void markExtraTaskDone(task.id)}
              >
                Done
              </button>
            ) : (
              <span className="checklist-extra-check" aria-hidden>
                ✓
              </span>
            )}
          </div>
        ))}

        <div className="checklist-extra-add">
          <input
            type="text"
            className="checklist-extra-input"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void addExtraTask();
              }
            }}
            placeholder="Something came up? Add it here..."
          />
          <button
            type="button"
            className="checklist-extra-add-btn"
            disabled={addingTask || !newTaskText.trim()}
            onClick={() => void addExtraTask()}
          >
            + Add
          </button>
        </div>
      </section>
    </div>
  );
}
