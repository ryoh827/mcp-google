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

export interface CreateEventParams {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
}

export async function createEvent(
  calendar: calendar_v3.Calendar,
  params: CreateEventParams
) {
  const {
    calendarId = "primary",
    summary,
    description,
    location,
    startDateTime,
    endDateTime,
    timeZone,
    attendees,
  } = params;

  const event: calendar_v3.Schema$Event = {
    summary,
    description,
    location,
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
  };

  if (attendees && attendees.length > 0) {
    event.attendees = attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return response.data;
}

export interface UpdateEventParams {
  calendarId?: string;
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
}

export async function updateEvent(
  calendar: calendar_v3.Calendar,
  params: UpdateEventParams
) {
  const { calendarId = "primary", eventId, ...updates } = params;

  // Fetch existing event first
  const existing = await calendar.events.get({ calendarId, eventId });
  const event = existing.data;

  if (updates.summary !== undefined) event.summary = updates.summary;
  if (updates.description !== undefined) event.description = updates.description;
  if (updates.location !== undefined) event.location = updates.location;
  if (updates.startDateTime) {
    event.start = {
      dateTime: updates.startDateTime,
      timeZone: updates.timeZone || event.start?.timeZone || undefined,
    };
  }
  if (updates.endDateTime) {
    event.end = {
      dateTime: updates.endDateTime,
      timeZone: updates.timeZone || event.end?.timeZone || undefined,
    };
  }

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });

  return response.data;
}

export async function deleteEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string = "primary",
  eventId: string
) {
  await calendar.events.delete({ calendarId, eventId });
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

export function formatEventCreatedForDisplay(event: calendar_v3.Schema$Event): string {
  return `Event created successfully.\n${formatEventForDisplay(event)}`;
}
