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

export interface CreateEventParams {
  calendarId?: string;
  summary: string;
  start: string;
  end?: string;
  description?: string;
  location?: string;
  recurrence?: string[];
  timeZone?: string;
}

export async function createEvent(
  calendar: calendar_v3.Calendar,
  params: CreateEventParams
) {
  const {
    calendarId = "primary",
    summary,
    start,
    end,
    description,
    location,
    recurrence,
    timeZone,
  } = params;

  const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start);

  const startObj: calendar_v3.Schema$EventDateTime = isAllDay
    ? { date: start }
    : { dateTime: start, timeZone };

  let endObj: calendar_v3.Schema$EventDateTime;
  if (end) {
    const isEndAllDay = /^\d{4}-\d{2}-\d{2}$/.test(end);
    endObj = isEndAllDay ? { date: end } : { dateTime: end, timeZone };
  } else if (isAllDay) {
    // All-day event: end = next day
    const nextDay = new Date(start);
    nextDay.setDate(nextDay.getDate() + 1);
    endObj = { date: nextDay.toISOString().split("T")[0] };
  } else {
    // Timed event: end = start + 1 hour
    const endTime = new Date(new Date(start).getTime() + 60 * 60 * 1000);
    endObj = { dateTime: endTime.toISOString(), timeZone };
  }

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    start: startObj,
    end: endObj,
    description,
    location,
    recurrence,
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody,
  });

  return response.data;
}

export interface UpdateEventParams {
  calendarId?: string;
  eventId: string;
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

export async function updateEvent(
  calendar: calendar_v3.Calendar,
  params: UpdateEventParams
) {
  const {
    calendarId = "primary",
    eventId,
    summary,
    start,
    end,
    description,
    location,
    timeZone,
  } = params;

  // Fetch existing event first
  const existing = await calendar.events.get({ calendarId, eventId });
  const patch: calendar_v3.Schema$Event = {};

  if (summary !== undefined) patch.summary = summary;
  if (description !== undefined) patch.description = description;
  if (location !== undefined) patch.location = location;

  if (start !== undefined) {
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
    patch.start = isAllDay
      ? { date: start }
      : { dateTime: start, timeZone: timeZone || existing.data.start?.timeZone || undefined };
  }

  if (end !== undefined) {
    const isEndAllDay = /^\d{4}-\d{2}-\d{2}$/.test(end);
    patch.end = isEndAllDay
      ? { date: end }
      : { dateTime: end, timeZone: timeZone || existing.data.end?.timeZone || undefined };
  }

  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: patch,
  });

  return response.data;
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
