import { google, tasks_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export function createTasksClient(auth: OAuth2Client): tasks_v1.Tasks {
  return google.tasks({ version: "v1", auth });
}

// --- Task Lists ---

export async function listTaskLists(
  tasks: tasks_v1.Tasks,
  maxResults: number = 20
) {
  const response = await tasks.tasklists.list({ maxResults });
  return response.data.items || [];
}

// --- Tasks ---

export interface ListTasksParams {
  taskListId?: string;
  maxResults?: number;
  showCompleted?: boolean;
  showHidden?: boolean;
  dueMin?: string;
  dueMax?: string;
}

export async function listTasks(
  tasks: tasks_v1.Tasks,
  params: ListTasksParams
) {
  const {
    taskListId = "@default",
    maxResults = 20,
    showCompleted = false,
    showHidden = false,
    dueMin,
    dueMax,
  } = params;

  const response = await tasks.tasks.list({
    tasklist: taskListId,
    maxResults,
    showCompleted,
    showHidden,
    dueMin,
    dueMax,
  });

  return response.data.items || [];
}

export interface CreateTaskParams {
  taskListId?: string;
  title: string;
  notes?: string;
  due?: string;
}

export async function createTask(
  tasks: tasks_v1.Tasks,
  params: CreateTaskParams
) {
  const { taskListId = "@default", title, notes, due } = params;

  const task: tasks_v1.Schema$Task = {
    title,
    notes,
    due,
  };

  const response = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: task,
  });

  return response.data;
}

export interface UpdateTaskParams {
  taskListId?: string;
  taskId: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: "needsAction" | "completed";
}

export async function updateTask(
  tasks: tasks_v1.Tasks,
  params: UpdateTaskParams
) {
  const { taskListId = "@default", taskId, ...updates } = params;

  // Fetch existing task first
  const existing = await tasks.tasks.get({
    tasklist: taskListId,
    task: taskId,
  });
  const task = existing.data;

  if (updates.title !== undefined) task.title = updates.title;
  if (updates.notes !== undefined) task.notes = updates.notes;
  if (updates.due !== undefined) task.due = updates.due;
  if (updates.status !== undefined) {
    task.status = updates.status;
    if (updates.status === "completed") {
      task.completed = new Date().toISOString();
    } else {
      task.completed = null as unknown as string;
    }
  }

  const response = await tasks.tasks.update({
    tasklist: taskListId,
    task: taskId,
    requestBody: task,
  });

  return response.data;
}

export async function deleteTask(
  tasks: tasks_v1.Tasks,
  taskListId: string = "@default",
  taskId: string
) {
  await tasks.tasks.delete({
    tasklist: taskListId,
    task: taskId,
  });
}

export async function getTask(
  tasks: tasks_v1.Tasks,
  taskListId: string = "@default",
  taskId: string
) {
  const response = await tasks.tasks.get({
    tasklist: taskListId,
    task: taskId,
  });
  return response.data;
}

// --- Formatting ---

function formatTaskForDisplay(task: tasks_v1.Schema$Task): string {
  const status = task.status === "completed" ? "✅" : "⬜";
  const lines = [
    `${status} ${task.title || "(no title)"}`,
    `  ID: ${task.id}`,
  ];
  if (task.due) lines.push(`  Due: ${task.due}`);
  if (task.notes) lines.push(`  Notes: ${task.notes}`);
  if (task.status === "completed" && task.completed) {
    lines.push(`  Completed: ${task.completed}`);
  }
  return lines.join("\n");
}

export function formatTasksForDisplay(
  tasks: tasks_v1.Schema$Task[]
): string {
  if (tasks.length === 0) return "No tasks found.";
  return tasks.map(formatTaskForDisplay).join("\n---\n");
}

export function formatTaskListsForDisplay(
  taskLists: tasks_v1.Schema$TaskList[]
): string {
  if (taskLists.length === 0) return "No task lists found.";
  return taskLists
    .map((tl) => `ID: ${tl.id}\nName: ${tl.title}`)
    .join("\n---\n");
}
