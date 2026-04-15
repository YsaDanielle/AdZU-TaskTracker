import os
import re
from pathlib import Path

import pymysql
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "adzu-tracker" / "dist"
SESSION_COOKIE_NAME = "adzu_tracker_session"
PASSWORD_HASH_METHOD = "pbkdf2:sha256"


app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIST),
    static_url_path="",
)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "adzu-task-tracker-dev-secret")
app.config["SESSION_COOKIE_NAME"] = SESSION_COOKIE_NAME
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["MYSQL_HOST"] = os.getenv("MYSQL_HOST", "127.0.0.1")
app.config["MYSQL_PORT"] = int(os.getenv("MYSQL_PORT", "3306"))
app.config["MYSQL_USER"] = os.getenv("MYSQL_USER", "root")
app.config["MYSQL_PASSWORD"] = os.getenv("MYSQL_PASSWORD", "")
app.config["MYSQL_DB"] = os.getenv("MYSQL_DB", "adzu_task_tracker")
app.config["DB_READY"] = False


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  instructor VARCHAR(120) DEFAULT '',
  color VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject_id INT NOT NULL,
  title VARCHAR(190) NOT NULL,
  due_date DATE NOT NULL,
  priority ENUM('High', 'Medium', 'Low') NOT NULL DEFAULT 'Medium',
  status ENUM('todo', 'done') NOT NULL DEFAULT 'todo',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""


def mysql_config(include_database=True):
    config = {
        "host": app.config["MYSQL_HOST"],
        "port": app.config["MYSQL_PORT"],
        "user": app.config["MYSQL_USER"],
        "password": app.config["MYSQL_PASSWORD"],
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": True,
    }

    if include_database:
        config["database"] = app.config["MYSQL_DB"]

    return config


def initialize_database():
    if app.config["DB_READY"]:
        return

    bootstrap = pymysql.connect(**mysql_config(include_database=False))
    try:
        with bootstrap.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{app.config['MYSQL_DB']}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        bootstrap.close()

    connection = pymysql.connect(**mysql_config())
    try:
        with connection.cursor() as cursor:
            for statement in [part.strip() for part in SCHEMA_SQL.split(";") if part.strip()]:
                cursor.execute(statement)
    finally:
        connection.close()

    app.config["DB_READY"] = True


def get_db_connection():
    initialize_database()
    return pymysql.connect(**mysql_config())


def current_user_id():
    return session.get("user_id")


def require_user():
    user_id = current_user_id()

    if not user_id:
        return None, (jsonify({"message": "Please log in first."}), 401)

    return user_id, None


def serialize_subject(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "instructor": row["instructor"] or "",
        "color": row["color"],
    }


def serialize_task(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "subjectId": row["subject_id"],
        "dueDate": row["due_date"].isoformat(),
        "priority": row["priority"],
        "status": row["status"],
        "notes": row["notes"] or "",
    }


def valid_hex_color(value):
    if not isinstance(value, str):
        return False

    value = value.strip()
    if len(value) != 7 or not value.startswith("#"):
        return False

    return all(character in "0123456789abcdefABCDEF" for character in value[1:])


def valid_password(password):
    if len(password) < 8:
        return False

    has_uppercase = re.search(r"[A-Z]", password)
    has_lowercase = re.search(r"[a-z]", password)
    has_digit = re.search(r"\d", password)
    has_special = re.search(r"[^A-Za-z0-9]", password)

    return all([has_uppercase, has_lowercase, has_digit, has_special])


@app.errorhandler(pymysql.MySQLError)
def handle_mysql_error(error):
    return jsonify(
        {
            "message": "Database connection failed. Check your XAMPP MySQL server and credentials.",
            "details": str(error),
        }
    ), 500


@app.get("/api/health")
def health_check():
    initialize_database()
    return jsonify({"status": "ok"})


@app.get("/api/session")
def get_session():
    user_id = current_user_id()

    if not user_id:
        return jsonify({"user": None})

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, full_name, email FROM users WHERE id = %s",
                (user_id,),
            )
            user = cursor.fetchone()
    finally:
        connection.close()

    if not user:
        session.clear()
        return jsonify({"user": None})

    return jsonify(
        {
            "user": {
                "id": user["id"],
                "name": user["full_name"],
                "email": user["email"],
            }
        }
    )


@app.post("/api/register")
def register():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not name or not email or not password:
        return jsonify({"message": "Name, email, and password are required."}), 400

    if not valid_password(password):
        return jsonify(
            {
                "message": "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
            }
        ), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            existing = cursor.fetchone()

            if existing:
                return jsonify({"message": "That email is already registered."}), 409

            cursor.execute(
                """
                INSERT INTO users (full_name, email, password_hash)
                VALUES (%s, %s, %s)
                """,
                (name, email, generate_password_hash(password, method=PASSWORD_HASH_METHOD)),
            )
            user_id = cursor.lastrowid
    finally:
        connection.close()

    session["user_id"] = user_id
    return jsonify({"user": {"id": user_id, "name": name, "email": email}}), 201


@app.post("/api/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"message": "Email and password are required."}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, full_name, email, password_hash FROM users WHERE email = %s",
                (email,),
            )
            user = cursor.fetchone()
    finally:
        connection.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"message": "Invalid email or password."}), 401

    session["user_id"] = user["id"]
    return jsonify(
        {
            "user": {
                "id": user["id"],
                "name": user["full_name"],
                "email": user["email"],
            }
        }
    )


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out."})


@app.get("/api/subjects")
def list_subjects():
    user_id, error = require_user()
    if error:
        return error

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, instructor, color
                FROM subjects
                WHERE user_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (user_id,),
            )
            subjects = [serialize_subject(row) for row in cursor.fetchall()]
    finally:
        connection.close()

    return jsonify({"subjects": subjects})


@app.post("/api/subjects")
def create_subject():
    user_id, error = require_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    instructor = (payload.get("instructor") or "").strip()
    color = (payload.get("color") or "").strip().upper()

    if not name:
        return jsonify({"message": "Subject name is required."}), 400

    if not valid_hex_color(color):
        return jsonify({"message": "Use a valid hex color like #1253B4."}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO subjects (user_id, name, instructor, color)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, name, instructor, color),
            )
            subject_id = cursor.lastrowid
            cursor.execute(
                "SELECT id, name, instructor, color FROM subjects WHERE id = %s",
                (subject_id,),
            )
            subject = serialize_subject(cursor.fetchone())
    finally:
        connection.close()

    return jsonify({"subject": subject}), 201


@app.delete("/api/subjects/<int:subject_id>")
def delete_subject(subject_id):
    user_id, error = require_user()
    if error:
        return error

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM subjects WHERE id = %s AND user_id = %s",
                (subject_id, user_id),
            )
            subject = cursor.fetchone()

            if not subject:
                return jsonify({"message": "Subject not found."}), 404

            cursor.execute(
                "DELETE FROM subjects WHERE id = %s AND user_id = %s",
                (subject_id, user_id),
            )
    finally:
        connection.close()

    return jsonify({"message": "Subject deleted."})


@app.get("/api/tasks")
def list_tasks():
    user_id, error = require_user()
    if error:
        return error

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, subject_id, title, due_date, priority, status, notes
                FROM tasks
                WHERE user_id = %s
                ORDER BY created_at DESC, id DESC
                """,
                (user_id,),
            )
            tasks = [serialize_task(row) for row in cursor.fetchall()]
    finally:
        connection.close()

    return jsonify({"tasks": tasks})


@app.post("/api/tasks")
def create_task():
    user_id, error = require_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    subject_id = payload.get("subjectId")
    due_date = payload.get("dueDate")
    priority = payload.get("priority") or "Medium"
    notes = (payload.get("notes") or "").strip()

    if not title or not subject_id or not due_date:
        return jsonify({"message": "Title, subject, and due date are required."}), 400

    if priority not in {"High", "Medium", "Low"}:
        return jsonify({"message": "Choose High, Medium, or Low priority."}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM subjects WHERE id = %s AND user_id = %s",
                (subject_id, user_id),
            )
            subject = cursor.fetchone()

            if not subject:
                return jsonify({"message": "Select a valid subject."}), 400

            cursor.execute(
                """
                INSERT INTO tasks (user_id, subject_id, title, due_date, priority, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, subject_id, title, due_date, priority, notes),
            )
            task_id = cursor.lastrowid
            cursor.execute(
                """
                SELECT id, subject_id, title, due_date, priority, status, notes
                FROM tasks
                WHERE id = %s
                """,
                (task_id,),
            )
            task = serialize_task(cursor.fetchone())
    finally:
        connection.close()

    return jsonify({"task": task}), 201


@app.patch("/api/tasks/<int:task_id>")
def update_task(task_id):
    user_id, error = require_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    status = payload.get("status")

    if status not in {"todo", "done"}:
        return jsonify({"message": "Status must be todo or done."}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tasks
                SET status = %s
                WHERE id = %s AND user_id = %s
                """,
                (status, task_id, user_id),
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "Task not found."}), 404

            cursor.execute(
                """
                SELECT id, subject_id, title, due_date, priority, status, notes
                FROM tasks
                WHERE id = %s
                """,
                (task_id,),
            )
            task = serialize_task(cursor.fetchone())
    finally:
        connection.close()

    return jsonify({"task": task})


@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    user_id, error = require_user()
    if error:
        return error

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM tasks WHERE id = %s AND user_id = %s",
                (task_id, user_id),
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "Task not found."}), 404
    finally:
        connection.close()

    return jsonify({"message": "Task deleted."})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"message": "Not found."}), 404

    if path and (FRONTEND_DIST / path).exists():
        return send_from_directory(FRONTEND_DIST, path)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")

    return jsonify(
        {
            "message": "Frontend build not found. Run `npm run build` inside `adzu-tracker` first.",
        }
    ), 503


if __name__ == "__main__":
    app.run(debug=True)
