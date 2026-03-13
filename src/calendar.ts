import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export function createCalendarClient(auth: OAuth2Client): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth });
}

export interface ListEventsParams {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
}

export async function listEvents(
  calendar: calendar_v3.Calendar,
  params: ListEventsParams
) {
  const {
    calendarId = "primary",
    timeMin,
    timeMax,
    maxResults = 10,
    query,
  } = params;

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin || new Date().toISOString(),
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
    q: query,
  });

  return response.data.items || [];
}

export async function getEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string = "primary",
  eventId: string
) {
  const response = await calendar.events.get({ calendarId, eventId });
  return response.data;
}

export async function listCalendars(calendar: calendar_v3.Calendar) {
  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

function formatEventForDisplay(event: calendar_v3.Schema$Event): string {
  const start = event.start?.dateTime || event.start?.date || "N/A";
  const end = event.end?.dateTime || event.end?.date || "N/A";
  const lines = [
    `ID: ${event.id}`,
    `Summary: ${event.summary || "(no title)"}`,
    `Start: ${start}`,
    `End: ${end}`,
  ];
  if (event.location) lines.push(`Location: ${event.location}`);
  if (event.description) lines.push(`Description: ${event.description}`);
  if (event.attendees && event.attendees.length > 0) {
    const emails = event.attendees.map((a) => a.email).join(", ");
    lines.push(`Attendees: ${emails}`);
  }
  if (event.htmlLink) lines.push(`Link: ${event.htmlLink}`);
  return lines.join("\n");
}

export function formatEventsForDisplay(events: calendar_v3.Schema$Event[]): string {
  if (events.length === 0) return "No events found.";
  return events.map(formatEventForDisplay).join("\n---\n");
}
