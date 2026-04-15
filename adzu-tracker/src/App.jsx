import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Flag,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'

const SUBJECT_KEY = 'adzu-tracker-subjects'
const TASK_KEY = 'adzu-tracker-tasks'
const SESSION_KEY = 'adzu-tracker-session'

const DEMO_SUBJECT_IDS = new Set(['subj-1', 'subj-2', 'subj-3'])
const DEMO_TASK_IDS = new Set(['task-1', 'task-2', 'task-3'])

const priorityOptions = [
  { value: 'High', tone: 'priority-high' },
  { value: 'Medium', tone: 'priority-medium' },
  { value: 'Low', tone: 'priority-low' },
]

const paletteOptions = ['#1253B4', '#003A8F', '#082E77', '#F5B800', '#3B82F6', '#83BAFF', '#0F766E', '#D946EF', '#F97316', '#111827']

const emptyFilters = {
  status: 'all',
  subjectId: 'all',
  priority: 'all',
  query: '',
}

function App() {
  const [session, setSession] = useState(() => loadSession())
  const [subjects, setSubjects] = useState(() => loadSubjects())
  const [tasks, setTasks] = useState(() => loadTasks())
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    instructor: '',
    color: paletteOptions[0],
  })
  const [taskForm, setTaskForm] = useState({
    title: '',
    subjectId: '',
    dueDate: getRelativeDate(2),
    priority: 'Medium',
    notes: '',
  })
  const [loginForm, setLoginForm] = useState({
    name: '',
    email: '',
  })
  const [subjectToDelete, setSubjectToDelete] = useState('')
  const [filters, setFilters] = useState(emptyFilters)

  useEffect(() => {
    window.localStorage.setItem(SUBJECT_KEY, JSON.stringify(subjects))
  }, [subjects])

  useEffect(() => {
    window.localStorage.setItem(TASK_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      return
    }

    window.localStorage.removeItem(SESSION_KEY)
  }, [session])

  useEffect(() => {
    if (!taskForm.subjectId && subjects[0]) {
      setTaskForm((current) => ({ ...current, subjectId: subjects[0].id }))
    }

    if (taskForm.subjectId && !subjects.some((subject) => subject.id === taskForm.subjectId)) {
      setTaskForm((current) => ({ ...current, subjectId: subjects[0]?.id || '' }))
    }
  }, [subjects, taskForm.subjectId])

  useEffect(() => {
    if (subjectToDelete && !subjects.some((subject) => subject.id === subjectToDelete)) {
      setSubjectToDelete('')
    }
  }, [subjects, subjectToDelete])

  const enrichedTasks = tasks
    .map((task) => {
      const subject = subjects.find((item) => item.id === task.subjectId)
      const dueLabel = formatDisplayDate(task.dueDate)
      const daysLeft = getDaysUntil(task.dueDate)
      const urgency = getUrgency(task.status, daysLeft)

      return {
        ...task,
        subject,
        dueLabel,
        daysLeft,
        urgency,
      }
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'todo' ? -1 : 1
      }

      return new Date(a.dueDate) - new Date(b.dueDate)
    })

  const filteredTasks = enrichedTasks.filter((task) => {
    const query = filters.query.trim().toLowerCase()
    const matchesQuery =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      task.subject?.name.toLowerCase().includes(query)

    const matchesStatus = filters.status === 'all' || task.status === filters.status
    const matchesSubject = filters.subjectId === 'all' || task.subjectId === filters.subjectId
    const matchesPriority = filters.priority === 'all' || task.priority === filters.priority

    return matchesQuery && matchesStatus && matchesSubject && matchesPriority
  })

  const pendingCount = enrichedTasks.filter((task) => task.status === 'todo').length
  const completedCount = enrichedTasks.filter((task) => task.status === 'done').length
  const overdueCount = enrichedTasks.filter((task) => task.urgency === 'overdue').length
  const dueSoonCount = enrichedTasks.filter((task) => task.urgency === 'soon').length
  const groupedTimeline = groupTasksByDate(enrichedTasks.filter((task) => task.status === 'todo'))
  const subjectTaskCount = subjectToDelete
    ? tasks.filter((task) => task.subjectId === subjectToDelete).length
    : 0

  function handleLoginSubmit(event) {
    event.preventDefault()

    const trimmedName = loginForm.name.trim()

    if (!trimmedName) {
      return
    }

    setSession({
      name: trimmedName,
      email: loginForm.email.trim(),
    })
  }

  function handleLogout() {
    setSession(null)
  }

  function handleSubjectSubmit(event) {
    event.preventDefault()

    const normalizedColor = normalizeColor(subjectForm.color)

    if (!subjectForm.name.trim() || !normalizedColor) {
      return
    }

    const newSubject = {
      id: crypto.randomUUID(),
      name: subjectForm.name.trim(),
      instructor: subjectForm.instructor.trim(),
      color: normalizedColor,
    }

    setSubjects((current) => [...current, newSubject])
    setSubjectForm({
      name: '',
      instructor: '',
      color: paletteOptions[(subjects.length + 1) % paletteOptions.length],
    })
    setTaskForm((current) => ({ ...current, subjectId: current.subjectId || newSubject.id }))
  }

  function handleDeleteSubject() {
    if (!subjectToDelete) {
      return
    }

    const subject = subjects.find((item) => item.id === subjectToDelete)

    if (!subject) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${subject.name}? This will also remove ${subjectTaskCount} related task${subjectTaskCount === 1 ? '' : 's'}.`,
    )

    if (!confirmed) {
      return
    }

    setSubjects((current) => current.filter((item) => item.id !== subjectToDelete))
    setTasks((current) => current.filter((task) => task.subjectId !== subjectToDelete))
    setFilters((current) => ({
      ...current,
      subjectId: current.subjectId === subjectToDelete ? 'all' : current.subjectId,
    }))
    setSubjectToDelete('')
  }

  function handleTaskSubmit(event) {
    event.preventDefault()

    if (!taskForm.title.trim() || !taskForm.subjectId || !taskForm.dueDate) {
      return
    }

    const newTask = {
      id: crypto.randomUUID(),
      title: taskForm.title.trim(),
      subjectId: taskForm.subjectId,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      status: 'todo',
      notes: taskForm.notes.trim(),
    }

    setTasks((current) => [newTask, ...current])
    setTaskForm((current) => ({
      ...current,
      title: '',
      dueDate: getRelativeDate(2),
      priority: 'Medium',
      notes: '',
    }))
  }

  function toggleTaskStatus(taskId) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === 'done' ? 'todo' : 'done' }
          : task,
      ),
    )
  }

  function deleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  function updateSubjectColor(value) {
    setSubjectForm((current) => ({ ...current, color: value }))
  }

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <div className="background-orb orb-one"></div>
        <div className="background-orb orb-two"></div>

        <main className="auth-layout">
          <section className="auth-copy glass-panel">
            <div className="eyebrow">
              <Sparkles size={16} />
              Ateneo de Zamboanga University
            </div>
            <h1>Student Task &amp; Deadline Tracker</h1>
            <p>
              Track your classes, deadlines, and priorities in one clean workspace made for
              busy AdZU students.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature">
                <LayoutDashboard size={18} />
                Color-coded subjects and task priorities
              </div>
              <div className="auth-feature">
                <CalendarDays size={18} />
                Timeline view for upcoming deadlines
              </div>
              <div className="auth-feature">
                <CheckCircle2 size={18} />
                Local-first persistence with quick daily check-ins
              </div>
            </div>
          </section>

          <section className="auth-card glass-panel">
            <div className="section-heading stacked">
              <div>
                <span className="section-kicker">Local sign in</span>
                <h2>Enter your student workspace</h2>
              </div>
            </div>

            <form className="task-form" onSubmit={handleLoginSubmit}>
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={loginForm.name}
                  onChange={(event) => setLoginForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label>
                School email
                <input
                  type="email"
                  placeholder="Optional"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>

              <button type="submit" className="primary-button">
                <UserRound size={18} />
                Continue to tracker
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one"></div>
      <div className="background-orb orb-two"></div>

      <header className="hero-card glass-panel">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            Ateneo de Zamboanga University
          </div>
          <h1>Student Task &amp; Deadline Tracker</h1>
          <p>
            A calm, university-themed workspace for classes, deadlines, and daily momentum.
            Built for students who want Notion-lite clarity without the clutter.
          </p>

          <div className="hero-actions">
            <div className="hero-stat">
              <strong>{pendingCount}</strong>
              <span>active tasks</span>
            </div>
            <div className="hero-stat">
              <strong>{dueSoonCount}</strong>
              <span>due this week</span>
            </div>
            <div className="hero-stat">
              <strong>{subjects.length}</strong>
              <span>subjects tracked</span>
            </div>
          </div>
        </div>

        <div className="hero-brand">
          <div className="brand-badge">{session.name}</div>
          <img src="/adzu-seal.png" alt="Ateneo de Zamboanga University seal" className="brand-seal" />
          <button type="button" className="logout-button" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="left-column">
          <div className="stats-grid">
            <StatCard icon={<LayoutDashboard size={18} />} label="Pending" value={pendingCount} tone="blue" />
            <StatCard icon={<Clock3 size={18} />} label="Overdue" value={overdueCount} tone="gold" />
            <StatCard icon={<CheckCircle2 size={18} />} label="Completed" value={completedCount} tone="slate" />
          </div>

          <section className="glass-panel panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Workspace</span>
                <h2>Add a new task</h2>
              </div>
              <div className="pill-chip">localStorage enabled</div>
            </div>

            {subjects.length === 0 ? (
              <div className="empty-state form-empty-state">
                <ListTodo size={28} />
                <p>Add your first subject first, then you can start logging tasks and deadlines here.</p>
              </div>
            ) : (
              <form className="task-form" onSubmit={handleTaskSubmit}>
                <label>
                  Task title
                  <input
                    type="text"
                    placeholder="Ex. Research proposal outline"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>

                <div className="field-row">
                  <label>
                    Subject
                    <select
                      value={taskForm.subjectId}
                      onChange={(event) => setTaskForm((current) => ({ ...current, subjectId: event.target.value }))}
                    >
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Due date
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="field-row">
                  <label>
                    Priority
                    <select
                      value={taskForm.priority}
                      onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  Notes
                  <textarea
                    rows="4"
                    placeholder="Optional reminders, links, task breakdown, or meeting notes"
                    value={taskForm.notes}
                    onChange={(event) => setTaskForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <button type="submit" className="primary-button">
                  <Plus size={18} />
                  Save task
                </button>
              </form>
            )}
          </section>

          <section className="glass-panel panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Planner</span>
                <h2>Task board</h2>
              </div>
            </div>

            <div className="filters-row">
              <label className="search-field">
                <Filter size={16} />
                <input
                  type="text"
                  placeholder="Search tasks or subjects"
                  value={filters.query}
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                />
              </label>

              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="all">All status</option>
                <option value="todo">To do</option>
                <option value="done">Done</option>
              </select>

              <select
                value={filters.subjectId}
                onChange={(event) => setFilters((current) => ({ ...current, subjectId: event.target.value }))}
              >
                <option value="all">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.priority}
                onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="all">All priorities</option>
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="task-list">
              {filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <ListTodo size={28} />
                  <p>
                    {tasks.length === 0
                      ? 'No tasks yet. Add your first deadline to start building your tracker.'
                      : 'No tasks match your current filters.'}
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <article key={task.id} className={`task-card ${task.status === 'done' ? 'is-done' : ''}`}>
                    <div className="task-main">
                      <button
                        type="button"
                        className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
                        onClick={() => toggleTaskStatus(task.id)}
                        aria-label={`Mark ${task.title} as ${task.status === 'done' ? 'to do' : 'done'}`}
                      >
                        <CheckCircle2 size={18} />
                      </button>

                      <div className="task-copy">
                        <div className="task-topline">
                          <span className="subject-chip" style={{ '--subject-color': task.subject?.color || '#1253B4' }}>
                            {task.subject?.name || 'Unknown subject'}
                          </span>
                          <span className={`priority-chip ${getPriorityTone(task.priority)}`}>
                            <Flag size={12} />
                            {task.priority}
                          </span>
                          <span className={`status-chip ${task.urgency}`}>{getUrgencyLabel(task)}</span>
                        </div>

                        <h3>{task.title}</h3>
                        <p>{task.notes || 'No extra notes added yet.'}</p>

                        <div className="task-meta">
                          <span>
                            <CalendarDays size={14} />
                            {task.dueLabel}
                          </span>
                          {task.subject?.instructor ? <span>{task.subject.instructor}</span> : null}
                        </div>
                      </div>
                    </div>

                    <button type="button" className="icon-button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="right-column">
          <section className="glass-panel panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Subjects</span>
                <h2>Color-coded classes</h2>
              </div>
            </div>

            <form className="subject-form" onSubmit={handleSubjectSubmit}>
              <input
                type="text"
                placeholder="Subject code or title"
                value={subjectForm.name}
                onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Instructor name"
                value={subjectForm.instructor}
                onChange={(event) => setSubjectForm((current) => ({ ...current, instructor: event.target.value }))}
              />

              <div className="palette-row" role="radiogroup" aria-label="Choose subject color">
                {paletteOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`swatch ${normalizeColor(subjectForm.color) === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => updateSubjectColor(color)}
                    aria-label={`Select ${color}`}
                  />
                ))}
              </div>

              <div className="custom-color-row">
                <label>
                  Color picker
                  <input
                    type="color"
                    value={normalizeColor(subjectForm.color) || paletteOptions[0]}
                    onChange={(event) => updateSubjectColor(event.target.value)}
                  />
                </label>

                <label>
                  Hex color
                  <input
                    type="text"
                    placeholder="#1253B4"
                    value={subjectForm.color}
                    onChange={(event) => updateSubjectColor(event.target.value)}
                  />
                </label>
              </div>

              <p className="helper-text">Pick a preset, use the color wheel, or paste your own hex code.</p>

              <div className="subject-actions">
                <button type="submit" className="secondary-button">
                  <Plus size={16} />
                  Add subject
                </button>

                <div className="delete-subject-group">
                  <select value={subjectToDelete} onChange={(event) => setSubjectToDelete(event.target.value)}>
                    <option value="">Choose subject to delete</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>

                  <button type="button" className="danger-button" onClick={handleDeleteSubject} disabled={!subjectToDelete}>
                    <Trash2 size={16} />
                    Delete subject
                  </button>
                </div>
              </div>
            </form>

            <div className="subject-list">
              {subjects.length === 0 ? (
                <div className="empty-state compact">
                  <ListTodo size={24} />
                  <p>Add a subject to start organizing your semester.</p>
                </div>
              ) : (
                subjects.map((subject) => {
                  const activeTasks = tasks.filter((task) => task.subjectId === subject.id && task.status === 'todo').length
                  return (
                    <article key={subject.id} className="subject-card">
                      <span className="subject-accent" style={{ background: subject.color }}></span>
                      <div>
                        <h3>{subject.name}</h3>
                        <p>{subject.instructor || 'Instructor not added yet'}</p>
                      </div>
                      <strong>{activeTasks}</strong>
                    </article>
                  )
                })
              )}
            </div>
          </section>

          <section className="glass-panel panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Calendar view</span>
                <h2>Upcoming timeline</h2>
              </div>
            </div>

            <div className="timeline-list">
              {groupedTimeline.length === 0 ? (
                <div className="empty-state compact">
                  <Clock3 size={24} />
                  <p>No upcoming tasks yet. Your next deadlines will appear here.</p>
                </div>
              ) : (
                groupedTimeline.map((group) => (
                  <div key={group.date} className="timeline-group">
                    <div className="timeline-date">
                      <strong>{group.label}</strong>
                      <span>{group.items.length} task{group.items.length > 1 ? 's' : ''}</span>
                    </div>

                    <div className="timeline-items">
                      {group.items.map((task) => (
                        <div key={task.id} className="timeline-card">
                          <span className="timeline-dot" style={{ background: task.subject?.color || '#1253B4' }}></span>
                          <div>
                            <h4>{task.title}</h4>
                            <p>{task.subject?.name || 'Unknown subject'}</p>
                          </div>
                          <span className={`mini-chip ${getPriorityTone(task.priority)}`}>{task.priority}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, tone }) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function loadSession() {
  try {
    const saved = window.localStorage.getItem(SESSION_KEY)

    if (!saved) {
      return null
    }

    const parsed = JSON.parse(saved)
    return parsed?.name ? parsed : null
  } catch {
    return null
  }
}

function loadSubjects() {
  const saved = readArray(SUBJECT_KEY)

  if (!saved.length) {
    return []
  }

  return saved.filter((subject) => subject?.id && !DEMO_SUBJECT_IDS.has(subject.id))
}

function loadTasks() {
  const saved = readArray(TASK_KEY)

  if (!saved.length) {
    return []
  }

  return saved.filter((task) => task?.id && !DEMO_TASK_IDS.has(task.id))
}

function readArray(key) {
  try {
    const saved = window.localStorage.getItem(key)

    if (!saved) {
      return []
    }

    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getRelativeDate(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getDaysUntil(value) {
  const today = new Date()
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const due = new Date(`${value}T00:00:00`)
  const difference = due.getTime() - current.getTime()
  return Math.round(difference / 86400000)
}

function getUrgency(status, daysLeft) {
  if (status === 'done') {
    return 'done'
  }

  if (daysLeft < 0) {
    return 'overdue'
  }

  if (daysLeft <= 3) {
    return 'soon'
  }

  return 'upcoming'
}

function getUrgencyLabel(task) {
  if (task.status === 'done') {
    return 'Completed'
  }

  if (task.urgency === 'overdue') {
    return 'Overdue'
  }

  if (task.daysLeft === 0) {
    return 'Due today'
  }

  if (task.daysLeft === 1) {
    return 'Due tomorrow'
  }

  if (task.urgency === 'soon') {
    return `Due in ${task.daysLeft} days`
  }

  return 'Upcoming'
}

function groupTasksByDate(tasks) {
  const groups = tasks.reduce((accumulator, task) => {
    if (!accumulator[task.dueDate]) {
      accumulator[task.dueDate] = []
    }

    accumulator[task.dueDate].push(task)
    return accumulator
  }, {})

  return Object.entries(groups)
    .sort(([first], [second]) => new Date(first) - new Date(second))
    .slice(0, 6)
    .map(([date, items]) => ({
      date,
      label: formatDisplayDate(date),
      items,
    }))
}

function getPriorityTone(priority) {
  return `priority-${priority.toLowerCase()}`
}

function normalizeColor(value) {
  const trimmed = value.trim()
  return /^#([0-9a-f]{6})$/i.test(trimmed) ? trimmed.toUpperCase() : ''
}

export default App
