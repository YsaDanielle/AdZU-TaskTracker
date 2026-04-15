import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const STORAGE_KEY = "adzu-student-task-deadline-tracker";

const SUBJECT_COLORS = [
  { name: "Blue", value: "#1d5f9c", light: "#e8f3ff" },
  { name: "Gold", value: "#d89c1d", light: "#fff3d7" },
  { name: "Crimson", value: "#b64c4c", light: "#ffe0e0" },
  { name: "Forest", value: "#2f7d62", light: "#ddf6ed" },
  { name: "Plum", value: "#7a4b8e", light: "#f0e4f6" },
  { name: "Slate", value: "#45556c", light: "#e8edf4" }
];

const PRIORITY_STYLES = {
  High: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  Medium: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  Low: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
};

const initialData = {
  subjects: [
    {
      id: "subj-theology",
      name: "Theo 131",
      code: "Faith and Community",
      color: SUBJECT_COLORS[0]
    },
    {
      id: "subj-cs",
      name: "CS 221",
      code: "Human Computer Interaction",
      color: SUBJECT_COLORS[1]
    },
    {
      id: "subj-econ",
      name: "Econ 102",
      code: "Applied Economics",
      color: SUBJECT_COLORS[3]
    }
  ],
  tasks: [
    {
      id: "task-1",
      title: "Finalize HCI wireframe prototype",
      subjectId: "subj-cs",
      dueDate: offsetDate(1),
      priority: "High",
      status: "todo",
      notes: "Polish mobile nav flow and add annotations for usability rationale."
    },
    {
      id: "task-2",
      title: "Reflection paper outline",
      subjectId: "subj-theology",
      dueDate: offsetDate(3),
      priority: "Medium",
      status: "in-progress",
      notes: "Connect lecture notes with community immersion observations."
    },
    {
      id: "task-3",
      title: "Quiz reviewer for price elasticity",
      subjectId: "subj-econ",
      dueDate: offsetDate(5),
      priority: "Low",
      status: "done",
      notes: "Summarize formulas and two practice examples."
    }
  ]
};

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.tasks)) return initialData;
    return parsed;
  } catch {
    return initialData;
  }
}

function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function App() {
  const [data, setData] = useState(() => loadState());
  const [taskForm, setTaskForm] = useState(() => ({
    title: "",
    subjectId: initialData.subjects[0].id,
    dueDate: offsetDate(2),
    priority: "Medium",
    notes: ""
  }));
  const [subjectForm, setSubjectForm] = useState(() => ({
    name: "",
    code: "",
    colorValue: SUBJECT_COLORS[0].value
  }));
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    saveState(data);
  }, [data]);

  useEffect(() => {
    if (data.subjects.length === 0) return;
    setTaskForm((current) => {
      if (data.subjects.some((subject) => subject.id === current.subjectId)) {
        return current;
      }
      return { ...current, subjectId: data.subjects[0].id };
    });
  }, [data.subjects]);

  const subjectMap = useMemo(
    () => Object.fromEntries(data.subjects.map((subject) => [subject.id, subject])),
    [data.subjects]
  );

  const filteredTasks = useMemo(() => {
    return data.tasks
      .filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          task.notes.toLowerCase().includes(search.toLowerCase()) ||
          (subjectMap[task.subjectId]?.name || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || task.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [data.tasks, search, statusFilter, priorityFilter, subjectMap]);

  const groupedTasks = useMemo(
    () => ({
      todo: filteredTasks.filter((task) => task.status === "todo"),
      "in-progress": filteredTasks.filter((task) => task.status === "in-progress"),
      done: filteredTasks.filter((task) => task.status === "done")
    }),
    [filteredTasks]
  );

  const stats = useMemo(() => {
    const total = data.tasks.length;
    const done = data.tasks.filter((task) => task.status === "done").length;
    const upcoming = data.tasks.filter((task) => daysUntil(task.dueDate) <= 3 && task.status !== "done").length;
    const subjects = data.subjects.length;
    return { total, done, upcoming, subjects };
  }, [data.tasks, data.subjects.length]);

  const upcomingTasks = useMemo(
    () =>
      [...data.tasks]
        .filter((task) => task.status !== "done")
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5),
    [data.tasks]
  );

  const calendarDays = useMemo(() => buildCalendar(filteredTasks), [filteredTasks]);

  function handleTaskSubmit(event) {
    event.preventDefault();
    if (!taskForm.title.trim() || !taskForm.subjectId || !taskForm.dueDate) return;
    const newTask = {
      id: crypto.randomUUID(),
      title: taskForm.title.trim(),
      subjectId: taskForm.subjectId,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      status: "todo",
      notes: taskForm.notes.trim()
    };
    setData((current) => ({ ...current, tasks: [newTask, ...current.tasks] }));
    setTaskForm((current) => ({
      ...current,
      title: "",
      dueDate: offsetDate(2),
      priority: "Medium",
      notes: ""
    }));
  }

  function handleSubjectSubmit(event) {
    event.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) return;
    const color = SUBJECT_COLORS.find((item) => item.value === subjectForm.colorValue) || SUBJECT_COLORS[0];
    const subject = {
      id: crypto.randomUUID(),
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim(),
      color
    };
    setData((current) => ({ ...current, subjects: [...current.subjects, subject] }));
    setSubjectForm({
      name: "",
      code: "",
      colorValue: SUBJECT_COLORS[0].value
    });
    setTaskForm((current) => ({ ...current, subjectId: subject.id }));
  }

  function updateTaskStatus(taskId, status) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
    }));
  }

  function deleteTask(taskId) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId)
    }));
  }

  function resetDemo() {
    setData(initialData);
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTaskForm({
      title: "",
      subjectId: initialData.subjects[0].id,
      dueDate: offsetDate(2),
      priority: "Medium",
      notes: ""
    });
  }

  return html`
    <div className="grid-fade min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="animate-fade mb-5 rounded-[28px] border border-white/70 bg-adzu-navy px-6 py-6 text-white shadow-soft sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-adzu-gold">
                Ateneo de Zamboanga University
              </p>
              <h1 className="font-display text-4xl leading-tight sm:text-5xl">
                Student Task & Deadline Tracker
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-200 sm:text-base">
                Keep subjects, requirements, and due dates in one calm workspace built for real student life.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              ${statCard("Tasks", stats.total, "Everything on your plate")}
              ${statCard("Done", stats.done, "Completed this cycle")}
              ${statCard("Urgent", stats.upcoming, "Due within 3 days")}
              ${statCard("Subjects", stats.subjects, "Color-coded and organized")}
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-5 lg:grid-cols-[1.15fr,0.85fr]">
          <section className="space-y-5">
            <div className="glass-panel animate-rise rounded-[28px] border border-white/70 p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-adzu-blue">
                    Dashboard View
                  </p>
                  <h2 className="mt-2 font-display text-3xl text-adzu-navy">Plan the week with clarity</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  ${["board", "calendar"].map(
                    (item) => html`
                      <button
                        key=${item}
                        className=${`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          view === item
                            ? "bg-adzu-navy text-white"
                            : "bg-white text-adzu-navy ring-1 ring-slate-200 hover:bg-adzu-sky"
                        }`}
                        onClick=${() => setView(item)}
                      >
                        ${item === "board" ? "Board View" : "Calendar View"}
                      </button>
                    `
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-adzu-blue"
                  placeholder="Search tasks, notes, or subjects"
                  value=${search}
                  onInput=${(event) => setSearch(event.target.value)}
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  value=${statusFilter}
                  onChange=${(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  value=${priorityFilter}
                  onChange=${(event) => setPriorityFilter(event.target.value)}
                >
                  <option value="all">All priorities</option>
                  <option value="High">High priority</option>
                  <option value="Medium">Medium priority</option>
                  <option value="Low">Low priority</option>
                </select>
              </div>
            </div>

            ${view === "board"
              ? html`
                  <div className="grid gap-4 xl:grid-cols-3">
                    ${renderColumn("To Do", "todo", groupedTasks.todo, subjectMap, updateTaskStatus, deleteTask)}
                    ${renderColumn(
                      "In Progress",
                      "in-progress",
                      groupedTasks["in-progress"],
                      subjectMap,
                      updateTaskStatus,
                      deleteTask
                    )}
                    ${renderColumn("Done", "done", groupedTasks.done, subjectMap, updateTaskStatus, deleteTask)}
                  </div>
                `
              : html`
                  <div className="glass-panel animate-rise rounded-[28px] border border-white/70 p-5 shadow-soft">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-adzu-blue">
                          Month Snapshot
                        </p>
                        <h3 className="mt-2 font-display text-2xl text-adzu-navy">
                          ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())}
                        </h3>
                      </div>
                      <div className="rounded-full bg-adzu-sky px-4 py-2 text-sm font-medium text-adzu-navy">
                        ${filteredTasks.length} visible deadline${filteredTasks.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (label) => html`<div key=${label} className="py-2">${label}</div>`
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      ${calendarDays.map((day) => {
                        const hasTasks = day.tasks.length > 0;
                        return html`
                          <div
                            key=${day.dateKey}
                            className=${`min-h-32 rounded-3xl border p-3 text-left ${
                              day.isCurrentMonth
                                ? "border-slate-200 bg-white/85"
                                : "border-transparent bg-white/40 text-slate-400"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span
                                className=${`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  day.isToday ? "bg-adzu-navy text-white" : "bg-adzu-sky text-adzu-navy"
                                }`}
                              >
                                ${day.dayNumber}
                              </span>
                              ${hasTasks
                                ? html`<span className="text-[11px] font-semibold text-adzu-blue">${day.tasks.length}</span>`
                                : null}
                            </div>
                            <div className="space-y-2">
                              ${day.tasks.slice(0, 3).map((task) => {
                                const subject = subjectMap[task.subjectId];
                                return html`
                                  <div
                                    key=${task.id}
                                    className="rounded-2xl px-2.5 py-2 text-xs font-medium"
                                    style=${{
                                      backgroundColor: subject?.color.light || "#eef2ff",
                                      color: subject?.color.value || "#1d5f9c"
                                    }}
                                  >
                                    <div className="truncate">${task.title}</div>
                                    <div className="truncate opacity-75">${subject?.name || "Subject"}</div>
                                  </div>
                                `;
                              })}
                              ${day.tasks.length > 3
                                ? html`<div className="text-xs font-medium text-slate-500">
                                    +${day.tasks.length - 3} more
                                  </div>`
                                : null}
                            </div>
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                `}
          </section>

          <aside className="space-y-5">
            <section className="glass-panel animate-rise rounded-[28px] border border-white/70 p-5 shadow-soft">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-adzu-blue">
                  Quick Add
                </p>
                <h3 className="mt-2 font-display text-2xl text-adzu-navy">Capture a task fast</h3>
              </div>

              <form className="space-y-3" onSubmit=${handleTaskSubmit}>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  placeholder="Task title"
                  value=${taskForm.title}
                  onInput=${(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                    value=${taskForm.subjectId}
                    onChange=${(event) => setTaskForm({ ...taskForm, subjectId: event.target.value })}
                  >
                    ${data.subjects.map(
                      (subject) => html`<option key=${subject.id} value=${subject.id}>${subject.name}</option>`
                    )}
                  </select>
                  <input
                    type="date"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                    value=${taskForm.dueDate}
                    onInput=${(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
                  />
                </div>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  value=${taskForm.priority}
                  onChange=${(event) => setTaskForm({ ...taskForm, priority: event.target.value })}
                >
                  <option value="High">High priority</option>
                  <option value="Medium">Medium priority</option>
                  <option value="Low">Low priority</option>
                </select>
                <textarea
                  rows="3"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  placeholder="Notes, instructions, links, or rubric reminders"
                  value=${taskForm.notes}
                  onInput=${(event) => setTaskForm({ ...taskForm, notes: event.target.value })}
                ></textarea>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-adzu-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-adzu-blue"
                >
                  Add task
                </button>
              </form>
            </section>

            <section className="glass-panel animate-rise rounded-[28px] border border-white/70 p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-adzu-blue">
                    Subjects
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-adzu-navy">Color-coded classes</h3>
                </div>
                <button
                  className="rounded-full bg-adzu-sky px-3 py-2 text-xs font-semibold text-adzu-navy"
                  onClick=${resetDemo}
                >
                  Reset demo
                </button>
              </div>

              <div className="mb-4 grid gap-3">
                ${data.subjects.map((subject) => html`
                  <div key=${subject.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
                    <span
                      className="h-4 w-4 rounded-full"
                      style=${{ backgroundColor: subject.color.value }}
                    ></span>
                    <div>
                      <div className="font-semibold text-adzu-navy">${subject.name}</div>
                      <div className="text-sm text-slate-500">${subject.code}</div>
                    </div>
                  </div>
                `)}
              </div>

              <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit=${handleSubjectSubmit}>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  placeholder="Subject name"
                  value=${subjectForm.name}
                  onInput=${(event) => setSubjectForm({ ...subjectForm, name: event.target.value })}
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-adzu-blue"
                  placeholder="Subject code or description"
                  value=${subjectForm.code}
                  onInput=${(event) => setSubjectForm({ ...subjectForm, code: event.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  ${SUBJECT_COLORS.map((color) => html`
                    <button
                      key=${color.value}
                      type="button"
                      className=${`flex items-center justify-center rounded-2xl px-3 py-3 text-xs font-semibold ring-2 transition ${
                        subjectForm.colorValue === color.value ? "ring-adzu-navy" : "ring-transparent"
                      }`}
                      style=${{ backgroundColor: color.light, color: color.value }}
                      onClick=${() => setSubjectForm({ ...subjectForm, colorValue: color.value })}
                    >
                      ${color.name}
                    </button>
                  `)}
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl border border-adzu-navy px-4 py-3 text-sm font-semibold text-adzu-navy transition hover:bg-adzu-sky"
                >
                  Add subject
                </button>
              </form>
            </section>

            <section className="glass-panel animate-rise rounded-[28px] border border-white/70 p-5 shadow-soft">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-adzu-blue">
                  Next Up
                </p>
                <h3 className="mt-2 font-display text-2xl text-adzu-navy">Upcoming deadlines</h3>
              </div>

              <div className="space-y-3">
                ${upcomingTasks.length === 0
                  ? html`
                      <div className="rounded-3xl bg-adzu-sky px-4 py-5 text-sm text-adzu-navy">
                        You’re all caught up. Add a task to see the next deadlines here.
                      </div>
                    `
                  : upcomingTasks.map((task) => {
                      const subject = subjectMap[task.subjectId];
                      return html`
                        <div key=${task.id} className="rounded-3xl bg-white/80 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-adzu-navy">${task.title}</div>
                              <div className="mt-1 text-sm text-slate-500">
                                ${subject?.name || "Subject"} · ${formatDate(task.dueDate)}
                              </div>
                            </div>
                            <span className=${`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}>
                              ${task.priority}
                            </span>
                          </div>
                          <div className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                            ${deadlineTone(task.dueDate)}
                          </div>
                        </div>
                      `;
                    })}
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  `;
}

function statCard(label, value, hint) {
  return html`
    <div className="rounded-3xl bg-white/10 px-4 py-4 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-200">${label}</div>
      <div className="mt-2 text-3xl font-bold text-white">${value}</div>
      <div className="mt-1 text-xs text-slate-300">${hint}</div>
    </div>
  `;
}

function renderColumn(label, status, tasks, subjectMap, updateTaskStatus, deleteTask) {
  const nextStatus =
    status === "todo" ? "in-progress" : status === "in-progress" ? "done" : "todo";
  const actionLabel =
    status === "todo" ? "Start" : status === "in-progress" ? "Complete" : "Reopen";

  return html`
    <div className="glass-panel animate-rise rounded-[28px] border border-white/70 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-adzu-blue">${label}</p>
          <h3 className="mt-2 font-display text-2xl text-adzu-navy">${tasks.length}</h3>
        </div>
        <div className="rounded-full bg-adzu-sky px-3 py-1 text-xs font-semibold text-adzu-navy">
          ${status.replace("-", " ")}
        </div>
      </div>

      <div className="space-y-3">
        ${tasks.length === 0
          ? html`
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/55 px-4 py-8 text-center text-sm text-slate-500">
                No tasks here right now.
              </div>
            `
          : tasks.map((task) => {
              const subject = subjectMap[task.subjectId];
              return html`
                <article key=${task.id} className="rounded-3xl bg-white/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style=${{
                            backgroundColor: subject?.color.light || "#eef2ff",
                            color: subject?.color.value || "#1d5f9c"
                          }}
                        >
                          ${subject?.name || "Subject"}
                        </span>
                        <span className=${`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}>
                          ${task.priority}
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-adzu-navy">${task.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">${task.notes || "No notes added yet."}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-600">${formatDate(task.dueDate)}</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">${deadlineTone(task.dueDate)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full bg-adzu-navy px-3 py-2 text-xs font-semibold text-white transition hover:bg-adzu-blue"
                        onClick=${() => updateTaskStatus(task.id, nextStatus)}
                      >
                        ${actionLabel}
                      </button>
                      <button
                        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                        onClick=${() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })}
      </div>
    </div>
  `;
}

function buildCalendar(tasks) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (6 - end.getDay()));

  const items = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = cursor.toISOString().slice(0, 10);
    items.push({
      dateKey,
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === now.getMonth(),
      isToday: dateKey === new Date().toISOString().slice(0, 10),
      tasks: tasks.filter((task) => task.dueDate === dateKey)
    });
  }
  return items;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateString));
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateString);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function deadlineTone(dateString) {
  const delta = daysUntil(dateString);
  if (delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"} overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta} days`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
