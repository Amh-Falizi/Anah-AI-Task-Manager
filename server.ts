import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "super_secret_dev_key";

app.use(express.json());

// Initialize Database Storage
const DB_FILE = path.join(process.cwd(), "database.sqlite");

let dbPromise: Promise<any>;

async function initDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      deadline TEXT NOT NULL,
      assigneeId TEXT,
      creatorId TEXT NOT NULL,
      branchName TEXT,
      parentId TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      ownerId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      teamId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      UNIQUE(teamId, userId)
    );
  `);

  // Migrate existing data from db.json if present
  const JSON_DB_FILE = path.join(process.cwd(), "db.json");
  if (fs.existsSync(JSON_DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(JSON_DB_FILE, "utf-8"));
      const userCount = await db.get("SELECT COUNT(*) as count FROM users");
      if (userCount.count === 0 && data.users && data.users.length > 0) {
        for (const u of data.users) {
          await db.run(
            "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)",
            [u.id, u.name, u.email, u.passwordHash, u.role]
          );
        }
        for (const t of data.tasks) {
          await db.run(
            "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [t.id, t.title, t.description, t.status, t.priority, t.deadline, t.assigneeId, t.creatorId, t.branchName, t.parentId || null, t.createdAt]
          );
        }
        console.log("Migrated data from db.json to database.sqlite");
      }
      fs.renameSync(JSON_DB_FILE, JSON_DB_FILE + ".bak");
    } catch (e) {
      console.error("Migration error", e);
    }
  }

  return db;
}

dbPromise = initDb();

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "dev_front" | "dev_back";
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  assigneeId: string | null;
  creatorId: string;
  branchName: string | null;
  parentId?: string | null;
  createdAt: string;
}

// Authentication Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

/* --- API ROUTES --- */

// Register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const db = await dbPromise;
  
  const existing = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (existing) {
    return res.status(400).json({ error: "Email already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const id = uuidv4();
  const assignedRole = role || "dev_front";

  await db.run(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)",
    [id, name, email, passwordHash, assignedRole]
  );

  const token = jwt.sign({ id, role: assignedRole }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ token, user: { id, name, email, role: assignedRole } });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const db = await dbPromise;
  
  const user = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Get Me
app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const user = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.put("/api/users/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { name, role } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "Name and role are required." });
  }
  await db.run(
    "UPDATE users SET name = ?, role = ? WHERE id = ?",
    [name, role, req.user.id]
  );
  const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.user.id);
  res.json(updatedUser);
});

// Get Users (for assigning tasks)
app.get("/api/users", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const users = await db.all("SELECT id, name, role FROM users");
  res.json(users);
});

// Get Tasks
app.get("/api/tasks", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const tasks = await db.all("SELECT * FROM tasks");
  res.json(tasks);
});

// Create Task
app.post("/api/tasks", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const newTask: Task = {
    id: uuidv4(),
    title: req.body.title,
    description: req.body.description || "",
    status: req.body.status || "todo",
    priority: req.body.priority || "medium",
    deadline: req.body.deadline || new Date().toISOString(),
    assigneeId: req.body.assigneeId || null,
    creatorId: req.user.id,
    branchName: req.body.branchName || null,
    parentId: req.body.parentId || null,
    createdAt: new Date().toISOString(),
  };

  await db.run(
    "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [newTask.id, newTask.title, newTask.description, newTask.status, newTask.priority, newTask.deadline, newTask.assigneeId, newTask.creatorId, newTask.branchName, newTask.parentId, newTask.createdAt]
  );
  
  if (newTask.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", newTask.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", newTask.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", newTask.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", newTask.parentId);
           }
       }
    }
  }

  res.json(newTask);
});

// Update Task
app.put("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (req.user.role !== "admin" && task.creatorId !== req.user.id && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: "Only admins, creators, or assignees can edit tasks." });
  }

  const updated = { ...task, ...req.body, id: task.id };

  await db.run(
    "UPDATE tasks SET title=?, description=?, status=?, priority=?, deadline=?, assigneeId=?, branchName=?, parentId=? WHERE id=?",
    [updated.title, updated.description, updated.status, updated.priority, updated.deadline, updated.assigneeId, updated.branchName, updated.parentId, updated.id]
  );
  
  if (updated.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", updated.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", updated.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", updated.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", updated.parentId);
           }
       }
    }
  }

  res.json(updated);
});

// Delete Task
app.delete("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (req.user.role !== "admin" && task.creatorId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the task creator can delete tasks." });
  }

  await db.run("DELETE FROM tasks WHERE id = ?", req.params.id);
  // Optional: Also delete subtasks
  await db.run("DELETE FROM tasks WHERE parentId = ?", req.params.id);
  
  if (task.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ?", task.parentId);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ?", task.parentId);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ?", task.parentId);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ?", task.parentId);
           }
       } else if (parentTask.status === 'done') {
           // If no subtasks left, it just stays whatever it is, unless we want to change it. 
           // Standard approach is to keep it, so we don't do anything.
       }
    }
  }

  res.json({ success: true });
});

// Generate Branch Name
app.post("/api/tasks/branch", authenticateToken, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const countResult = await db.get("SELECT COUNT(*) as count FROM tasks");
    const nextNumber = (countResult.count || 0) + 1;
    
    // Generate an ID like KAN-1, KAN-2, etc. If the user wants a short Jira-like branch name
    const branchName = `KAN-${nextNumber}`;
    
    res.json({ branchName });
  } catch (error: any) {
    console.error("Branch Generation Error:", error);
    res.status(500).json({ error: "Failed to generate branch name." });
  }
});


// Teams APIs
app.get("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const teams = await db.all("SELECT * FROM teams");
  res.json(teams);
});

app.post("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { name, description } = req.body;
  const teamId = uuidv4();
  await db.run(
    "INSERT INTO teams (id, name, description, ownerId, createdAt) VALUES (?, ?, ?, ?, ?)",
    [teamId, name, description || "", req.user.id, new Date().toISOString()]
  );
  // add owner to members
  await db.run(
    "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
    [uuidv4(), teamId, req.user.id, new Date().toISOString()]
  );
  const newTeam = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  res.json(newTeam);
});

app.get("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const members = await db.all(`
    SELECT u.id, u.name, u.email, u.role, tm.joinedAt, tm.teamId
    FROM team_members tm
    JOIN users u ON tm.userId = u.id
    WHERE tm.teamId = ?
  `, req.params.id);
  res.json(members);
});

app.post("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { userId } = req.body;
  const teamId = req.params.id;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can add members." });
  }

  try {
    const newMemberId = uuidv4();
    await db.run(
      "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
      [newMemberId, teamId, userId, new Date().toISOString()]
    );
    res.json({ success: true, memberId: newMemberId });
  } catch (err: any) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "User is already in team" });
    } else {
      res.status(500).json({ error: "Failed to add member" });
    }
  }
});

app.delete("/api/teams/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (req.user.role !== "admin" && team.ownerId !== req.user.id && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: "Only admins or the team owner can remove members." });
  }

  await db.run("DELETE FROM team_members WHERE teamId = ? AND userId = ?", [req.params.id, req.params.userId]);
  res.json({ success: true });
});

app.delete("/api/teams/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);
  
  if (req.user.role !== "admin" && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can delete this team." });
  }

  await db.run("DELETE FROM teams WHERE id = ?", req.params.id);
  await db.run("DELETE FROM team_members WHERE teamId = ?", req.params.id);
  res.json({ success: true });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
