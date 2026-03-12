# mcp-gcal

MCP (Model Context Protocol) server for Google Calendar integration.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Google Cloud Console setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the JSON and save it as:

```
~/.mcp-gcal/credentials.json
```

Or set `GCAL_CREDENTIALS_PATH` environment variable to your preferred path.

### 3. Authenticate

```bash
npm run auth
```

This will display an authorization URL. Open it in your browser, grant access, and you will be redirected to a URL like:

```
http://localhost/?code=4/0AfrIep...&scope=...
```

Copy the `code` parameter value from the URL and paste it into the terminal prompt. The token will be saved to `~/.mcp-gcal/token.json`.

### 4. Build

```bash
npm run build
```

## Usage

### Claude Desktop / Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "gcal": {
      "command": "node",
      "args": ["/path/to/mcp-gcal/dist/index.js"]
    }
  }
}
```

Or with environment variables:

```json
{
  "mcpServers": {
    "gcal": {
      "command": "node",
      "args": ["/path/to/mcp-gcal/dist/index.js"],
      "env": {
        "GCAL_CREDENTIALS_PATH": "/path/to/credentials.json",
        "GCAL_TOKEN_PATH": "/path/to/token.json"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_events` | List upcoming events from Google Calendar |
| `get_event` | Get details of a specific event |
| `create_event` | Create a new event |
| `update_event` | Update an existing event |
| `delete_event` | Delete an event |
| `list_calendars` | List all available calendars |

## Development

```bash
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile TypeScript
npm run start  # Run compiled version
```

## License

ISC
