#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "./auth.js";
import {
  createCalendarClient,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  listCalendars,
  formatEventsForDisplay,
  formatEventCreatedForDisplay,
} from "./calendar.js";

const server = new McpServer({
  name: "mcp-gcal",
  version: "1.0.0",
});

// Lazy initialization of calendar client
let calendarClient: ReturnType<typeof createCalendarClient> | null = null;

function getCalendar() {
  if (!calendarClient) {
    const auth = getAuthenticatedClient();
    calendarClient = createCalendarClient(auth);
  }
  return calendarClient;
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
      const events = await listEvents(getCalendar(), params);
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
      const event = await getEvent(getCalendar(), params.calendarId, params.eventId);
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
  "create_event",
  "Create a new event in Google Calendar",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: primary)"),
    summary: z.string().describe("Event title"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startDateTime: z.string().describe("Start date/time in ISO 8601 format"),
    endDateTime: z.string().describe("End date/time in ISO 8601 format"),
    timeZone: z.string().optional().describe("Time zone (e.g., Asia/Tokyo)"),
    attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
  },
  async (params) => {
    try {
      const event = await createEvent(getCalendar(), params);
      return {
        content: [
          {
            type: "text" as const,
            text: formatEventCreatedForDisplay(event),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error creating event: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_event",
  "Update an existing event in Google Calendar",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: primary)"),
    eventId: z.string().describe("Event ID to update"),
    summary: z.string().optional().describe("New event title"),
    description: z.string().optional().describe("New event description"),
    location: z.string().optional().describe("New event location"),
    startDateTime: z.string().optional().describe("New start date/time in ISO 8601 format"),
    endDateTime: z.string().optional().describe("New end date/time in ISO 8601 format"),
    timeZone: z.string().optional().describe("Time zone (e.g., Asia/Tokyo)"),
  },
  async (params) => {
    try {
      const event = await updateEvent(getCalendar(), params);
      return {
        content: [
          {
            type: "text" as const,
            text: `Event updated successfully.\n${formatEventsForDisplay([event])}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error updating event: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "delete_event",
  "Delete an event from Google Calendar",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: primary)"),
    eventId: z.string().describe("Event ID to delete"),
  },
  async (params) => {
    try {
      await deleteEvent(getCalendar(), params.calendarId, params.eventId);
      return {
        content: [
          {
            type: "text" as const,
            text: `Event ${params.eventId} deleted successfully.`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error deleting event: ${message}` }],
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
      const calendars = await listCalendars(getCalendar());
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

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-gcal server started on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
