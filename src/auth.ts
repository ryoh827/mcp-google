import { google } from "googleapis";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks",
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

export async function getAuthenticatedClient() {
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

  // Auto-save refreshed tokens to disk
  oauth2Client.on("tokens", (tokens) => {
    try {
      const currentToken = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
      const updatedToken = { ...currentToken, ...tokens };
      fs.writeFileSync(tokenPath, JSON.stringify(updatedToken, null, 2));
      console.error("Token refreshed and saved to disk.");
    } catch (err) {
      console.error("Failed to save refreshed token:", err);
    }
  });

  // Proactively refresh if access token is expired or expiring within 5 minutes
  const now = Date.now();
  const expiryDate = token.expiry_date || 0;
  const bufferMs = 5 * 60 * 1000;

  if (expiryDate < now + bufferMs) {
    try {
      console.error("Access token expired or expiring soon, refreshing...");
      const { credentials: refreshedCredentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshedCredentials);
      // Token is saved via the "tokens" event handler above
    } catch (err: unknown) {
      // Check structured OAuth error field first, fall back to string match
      const oauthError =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      const message = err instanceof Error ? err.message : String(err);
      if (oauthError === "invalid_grant" || message.includes("invalid_grant")) {
        throw new Error(
          "Refresh token has expired (invalid_grant). Re-authentication is required.\n" +
            "Run 'npm run auth' to re-authenticate.\n" +
            "Tip: If your Google Cloud project is in 'Testing' mode, refresh tokens expire after 7 days.\n" +
            "Move to 'Production' mode in the OAuth consent screen to get long-lived refresh tokens."
        );
      }
      throw err;
    }
  }

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
