# AdZU Student Task & Deadline Tracker

A clean university-themed web app for Ateneo de Zamboanga University students to organize subjects, track deadlines, and mark work as done. It now includes real account registration/login plus MySQL persistence so each user has a separate workspace you can inspect in phpMyAdmin.

## Features

- Register and log in with a secured password hash
- Store users, subjects, and tasks in MySQL/MariaDB
- Add subjects with preset colors, a color picker, or custom hex values
- Add tasks with due dates, notes, and priority tags
- Delete subjects together with their related tasks
- Track work across `To Do` and `Done`
- Filter tasks by search, status, subject, and priority
- View an upcoming timeline for deadlines

## Tech Stack

- Flask for the backend API and session auth
- React + Vite for the frontend
- MySQL/MariaDB for persistence
- phpMyAdmin for database inspection and management

## Database Setup

Start Apache and MySQL in XAMPP first.

Use these defaults unless you changed your local MySQL credentials:

- `MYSQL_HOST=127.0.0.1`
- `MYSQL_PORT=3306`
- `MYSQL_USER=root`
- `MYSQL_PASSWORD=`
- `MYSQL_DB=adzu_task_tracker`

The Flask app can create the database and tables automatically on first API use. If you want to import the schema manually in phpMyAdmin, use [database/schema.sql](/Applications/XAMPP/xamppfiles/htdocs/AdZU%20Task%20Tracker/database/schema.sql:1).

## Run Locally

1. Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Start the Flask backend:

```bash
python3 app.py
```

3. In another terminal, start the React frontend:

```bash
npm run dev
```

4. Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Production Build

Build the frontend:

```bash
npm run build
```

After building, Flask can serve the compiled app from `adzu-tracker/dist`.

## Portfolio Framing

Built a full-stack student productivity tracker with React, Flask, and MySQL. Implemented account registration/login, secure password hashing, per-user subject and task management, calendar-style deadline visibility, and a polished university-themed interface backed by a relational database.
