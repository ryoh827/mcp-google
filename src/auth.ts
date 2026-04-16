import { google } from "googleapis";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/gmail.readonly",
];

interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

function getCredentialsPath(): string {
  return (
    process.env.GOOGLE_CREDENTIALS_PATH ||
    process.env.GCAL_CREDENTIALS_PATH ||
    path.join(process.env.HOME || "~", ".mcp-google", "credentials.json")
  );
}

function getTokenPath(): string {
  return (
    process.env.GOOGLE_TOKEN_PATH ||
    process.env.GCAL_TOKEN_PATH ||
    path.join(process.env.HOME || "~", ".mcp-google", "token.json")
  );
}

export function loadCredentials(): Credentials {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Credentials file not found at ${credentialsPath}.\n` +
        "Please download your OAuth 2.0 credentials from Google Cloud Console\n" +
        "and place them at the path above, or set GOOGLE_CREDENTIALS_PATH."
    );
  }
  return JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
}

export function createOAuth2Client(credentials: Credentials) {
  const creds = credentials.installed || credentials.web;
  if (!creds) {
    throw new Error("Invalid credentials format. Expected 'installed' or 'web' key.");
  }
  return new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris[0]
  );
}

export function getAuthenticatedClient() {
  const credentials = loadCredentials();
  const oauth2Client = createOAuth2Client(credentials);
  const tokenPath = getTokenPath();

  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `Token file not found at ${tokenPath}.\n` +
        "Please run 'npm run auth' to authenticate first."
    );
  }

  const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
  oauth2Client.setCredentials(token);

  // Auto-refresh token on expiry
  oauth2Client.on("tokens", (tokens) => {
    const currentToken = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    const updatedToken = { ...currentToken, ...tokens };
    fs.writeFileSync(tokenPath, JSON.stringify(updatedToken, null, 2));
  });

  return oauth2Client;
}

// CLI authentication flow
async function authenticate() {
  const credentials = loadCredentials();
  const oauth2Client = createOAuth2Client(credentials);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Authorize this app by visiting this URL:\n");
  console.log(authUrl);
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question("Enter the authorization code: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const { tokens } = await oauth2Client.getToken(code);

  const tokenPath = getTokenPath();
  const tokenDir = path.dirname(tokenPath);
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

  console.log(`\nToken saved to ${tokenPath}`);
  console.log("Authentication successful!");
}

// Run if called directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith("/auth.ts") ||
  process.argv[1].endsWith("/auth.js")
);

if (isMain) {
  authenticate().catch((err) => {
    console.error("Authentication failed:", err.message);
    process.exit(1);
  });
}
