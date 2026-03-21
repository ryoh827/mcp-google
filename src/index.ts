#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "./auth.js";
import {
  createCalendarClient,
  listEvents,
  getEvent,
  listCalendars,
  formatEventsForDisplay,
} from "./calendar.js";
import {
  createTasksClient,
  listTaskLists,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getTask,
  formatTasksForDisplay,
  formatTaskListsForDisplay,
} from "./tasks.js";

const server = new McpServer({
  name: "mcp-google",
  version: "2.0.0",
});

// Lazy initialization of clients
let calendarClient: ReturnType<typeof createCalendarClient> | null = null;
let tasksClient: ReturnType<typeof createTasksClient> | null = null;

async function getCalendar() {
  if (!calendarClient) {
    const auth = await getAuthenticatedClient();
    calendarClient = createCalendarClient(auth);
  }
  return calendarClient;
}

async function getTasks() {
  if (!tasksClient) {
    const auth = await getAuthenticatedClient();
    tasksClient = createTasksClient(auth);
  }
  return tasksClient;
}

// --- Tools ---

server.tool(
  "list_events",
  "List upcoming events from Google Calendar",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: primary)"),
    timeMin: z.string().optional().describe("Start time in ISO 8601 format (default: now)"),
    timeMax: z.string().optional().describe("End time in ISO 8601 format"),
    maxResults: z.number().optional().describe("Maximum number of events to return (default: 10)"),
    query: z.string().optional().describe("Free text search query"),
  },
  async (params) => {
    try {
      const events = await listEvents(await getCalendar(), params);
      return {
        content: [
          {
            type: "text" as const,
            text: formatEventsForDisplay(events),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error listing events: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_event",
  "Get details of a specific event",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: primary)"),
    eventId: z.string().describe("Event ID"),
  },
  async (params) => {
    try {
      const event = await getEvent(await getCalendar(), params.calendarId, params.eventId);
      return {
        content: [
          {
            type: "text" as const,
            text: formatEventsForDisplay([event]),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error getting event: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_calendars",
  "List all available calendars",
  {},
  async () => {
    try {
      const calendars = await listCalendars(await getCalendar());
      if (calendars.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No calendars found." }],
        };
      }
      const text = calendars
        .map((cal) => {
          const lines = [`ID: ${cal.id}`, `Name: ${cal.summary}`];
          if (cal.description) lines.push(`Description: ${cal.description}`);
          if (cal.primary) lines.push("(Primary)");
          return lines.join("\n");
        })
        .join("\n---\n");
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error listing calendars: ${message}` }],
        isError: true,
      };
    }
  }
);

// --- Tasks Tools ---

server.tool(
  "list_task_lists",
  "List all Google Tasks task lists",
  {
    maxResults: z.number().optional().describe("Maximum number of task lists to return (default: 20)"),
  },
  async (params) => {
    try {
      const taskLists = await listTaskLists(await getTasks(), params.maxResults);
      return {
        content: [{ type: "text" as const, text: formatTaskListsForDisplay(taskLists) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error listing task lists: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_tasks",
  "List tasks from a Google Tasks task list",
  {
    taskListId: z.string().optional().describe("Task list ID (default: @default)"),
    maxResults: z.number().optional().describe("Maximum number of tasks to return (default: 20)"),
    showCompleted: z.boolean().optional().describe("Whether to show completed tasks (default: false)"),
    showHidden: z.boolean().optional().describe("Whether to show hidden tasks (default: false)"),
    dueMin: z.string().optional().describe("Minimum due date (RFC 3339 format)"),
    dueMax: z.string().optional().describe("Maximum due date (RFC 3339 format)"),
  },
  async (params) => {
    try {
      const tasks = await listTasks(await getTasks(), params);
      return {
        content: [{ type: "text" as const, text: formatTasksForDisplay(tasks) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error listing tasks: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_task",
  "Get details of a specific task",
  {
    taskListId: z.string().optional().describe("Task list ID (default: @default)"),
    taskId: z.string().describe("Task ID"),
  },
  async (params) => {
    try {
      const task = await getTask(await getTasks(), params.taskListId, params.taskId);
      return {
        content: [{ type: "text" as const, text: formatTasksForDisplay([task]) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error getting task: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "create_task",
  "Create a new task in Google Tasks",
  {
    taskListId: z.string().optional().describe("Task list ID (default: @default)"),
    title: z.string().describe("Task title"),
    notes: z.string().optional().describe("Task notes/description"),
    due: z.string().optional().describe("Due date in RFC 3339 format (e.g., 2026-03-15T00:00:00.000Z)"),
  },
  async (params) => {
    try {
      const task = await createTask(await getTasks(), params);
      return {
        content: [{ type: "text" as const, text: `Task created successfully.\n${formatTasksForDisplay([task])}` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error creating task: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_task",
  "Update an existing task in Google Tasks",
  {
    taskListId: z.string().optional().describe("Task list ID (default: @default)"),
    taskId: z.string().describe("Task ID to update"),
    title: z.string().optional().describe("New task title"),
    notes: z.string().optional().describe("New task notes/description"),
    due: z.string().optional().describe("New due date in RFC 3339 format"),
    status: z.enum(["needsAction", "completed"]).optional().describe("Task status: 'needsAction' or 'completed'"),
  },
  async (params) => {
    try {
      const task = await updateTask(await getTasks(), params);
      return {
        content: [{ type: "text" as const, text: `Task updated successfully.\n${formatTasksForDisplay([task])}` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error updating task: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "delete_task",
  "Delete a task from Google Tasks",
  {
    taskListId: z.string().optional().describe("Task list ID (default: @default)"),
    taskId: z.string().describe("Task ID to delete"),
  },
  async (params) => {
    try {
      await deleteTask(await getTasks(), params.taskListId, params.taskId);
      return {
        content: [{ type: "text" as const, text: `Task ${params.taskId} deleted successfully.` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error deleting task: ${message}` }],
        isError: true,
      };
    }
  }
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-google server started on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
