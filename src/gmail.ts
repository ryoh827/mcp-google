import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export function createGmailClient(auth: OAuth2Client): gmail_v1.Gmail {
  return google.gmail({ version: "v1", auth });
}

// --- Messages ---

export interface ListMessagesParams {
  query?: string;
  maxResults?: number;
  labelIds?: string[];
}

export async function listMessages(
  gmail: gmail_v1.Gmail,
  params: ListMessagesParams
) {
  const { query, maxResults = 10, labelIds } = params;

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    labelIds,
  });

  const messageIds = response.data.messages || [];
  if (messageIds.length === 0) return [];

  // Fetch metadata for each message
  const messages = await Promise.all(
    messageIds.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      return detail.data;
    })
  );

  return messages;
}

export interface GetMessageParams {
  messageId: string;
  format?: "full" | "metadata" | "minimal";
}

export async function getMessage(
  gmail: gmail_v1.Gmail,
  params: GetMessageParams
) {
  const { messageId, format = "full" } = params;

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format,
  });

  return response.data;
}

// --- Labels ---

export async function listLabels(gmail: gmail_v1.Gmail) {
  const response = await gmail.users.labels.list({
    userId: "me",
  });

  return response.data.labels || [];
}

// --- MIME Body Parsing ---

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractTextFromParts(
  parts: gmail_v1.Schema$MessagePart[] | undefined
): { plain: string | null; html: string | null } {
  let plain: string | null = null;
  let html: string | null = null;

  if (!parts) return { plain, html };

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plain = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      // Recurse into nested parts (e.g., multipart/alternative)
      const nested = extractTextFromParts(part.parts);
      if (!plain && nested.plain) plain = nested.plain;
      if (!html && nested.html) html = nested.html;
    }
  }

  return { plain, html };
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractMessageBody(message: gmail_v1.Schema$Message): string {
  const payload = message.payload;
  if (!payload) return "(no body)";

  // Single-part message
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multi-part message
  const { plain, html } = extractTextFromParts(payload.parts);
  if (plain) return plain;
  if (html) return stripHtmlTags(html);

  return "(no body)";
}

// --- Formatting ---

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return "";
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

function formatMessageSummary(message: gmail_v1.Schema$Message): string {
  const headers = message.payload?.headers;
  const lines = [
    `ID: ${message.id}`,
    `From: ${getHeader(headers, "From")}`,
    `To: ${getHeader(headers, "To")}`,
    `Subject: ${getHeader(headers, "Subject")}`,
    `Date: ${getHeader(headers, "Date")}`,
  ];
  if (message.snippet) {
    lines.push(`Snippet: ${message.snippet}`);
  }
  if (message.labelIds && message.labelIds.length > 0) {
    lines.push(`Labels: ${message.labelIds.join(", ")}`);
  }
  return lines.join("\n");
}

export function formatMessagesForDisplay(
  messages: gmail_v1.Schema$Message[]
): string {
  if (messages.length === 0) return "No messages found.";
  return messages.map(formatMessageSummary).join("\n---\n");
}

export function formatMessageForDisplay(
  message: gmail_v1.Schema$Message,
  includeBody: boolean = true
): string {
  const summary = formatMessageSummary(message);
  if (!includeBody) return summary;

  const body = extractMessageBody(message);
  const MAX_BODY_LENGTH = 10000;
  const truncatedBody =
    body.length > MAX_BODY_LENGTH
      ? body.substring(0, MAX_BODY_LENGTH) + "\n... (truncated)"
      : body;

  return `${summary}\n\nBody:\n${truncatedBody}`;
}

export function formatLabelsForDisplay(
  labels: gmail_v1.Schema$Label[]
): string {
  if (labels.length === 0) return "No labels found.";
  return labels
    .map((label) => {
      const lines = [`ID: ${label.id}`, `Name: ${label.name}`];
      if (label.type) lines.push(`Type: ${label.type}`);
      if (label.messagesTotal !== undefined) {
        lines.push(`Messages: ${label.messagesTotal} (${label.messagesUnread || 0} unread)`);
      }
      return lines.join("\n");
    })
    .join("\n---\n");
}
