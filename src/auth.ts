import { google } from "googleapis";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import { URL } from "node:url";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

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
    process.env.GCAL_CREDENTIALS_PATH ||
    path.join(process.env.HOME || "~", ".mcp-gcal", "credentials.json")
  );
}

function getTokenPath(): string {
  return (
    process.env.GCAL_TOKEN_PATH ||
    path.join(process.env.HOME || "~", ".mcp-gcal", "token.json")
  );
}

export function loadCredentials(): Credentials {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Credentials file not found at ${credentialsPath}.\n` +
        "Please download your OAuth 2.0 credentials from Google Cloud Console\n" +
        "and place them at the path above, or set GCAL_CREDENTIALS_PATH."
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
    REDIRECT_URI
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

/**
 * Wait for the OAuth callback on a local HTTP server.
 * Returns the authorization code from the query string.
 */
function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", REDIRECT_URI);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>Authentication failed</h1><p>${error}</p><p>You can close this window.</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p>");
          server.close();
          resolve(code);
          return;
        }

        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>No authorization code received</h1><p>Please try again.</p>");
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Internal error</h1>");
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Listening on ${REDIRECT_URI} for OAuth callback...`);
    });

    server.on("error", (err) => {
      reject(new Error(`Failed to start local server on port ${REDIRECT_PORT}: ${err.message}`));
    });
  });
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

  console.log("Opening browser for authorization...\n");
  console.log("If the browser does not open automatically, visit this URL:\n");
  console.log(authUrl);
  console.log();

  // Try to open browser automatically
  const { exec } = await import("node:child_process");
  const platform = process.platform;
  const openCmd =
    platform === "darwin" ? "open" :
    platform === "win32" ? "start" :
    "xdg-open";
  exec(`${openCmd} "${authUrl}"`);

  // Wait for the callback
  const code = await waitForAuthCode();

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
