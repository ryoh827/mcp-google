# mcp-google

MCP (Model Context Protocol) server for Google services integration (Calendar, Tasks).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Google Cloud Console setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API** and **Google Tasks API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the JSON and save it as:

```
~/.mcp-google/credentials.json
```

Or set `GOOGLE_CREDENTIALS_PATH` environment variable to your preferred path.

### 3. Authenticate

```bash
npm run auth
```

This will display an authorization URL. Open it in your browser, grant access, and you will be redirected to a URL like:

```
http://localhost/?code=4/0AfrIep...&scope=...
```

Copy the `code` parameter value from the URL and paste it into the terminal prompt. The token will be saved to `~/.mcp-google/token.json`.

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
    "google": {
      "command": "node",
      "args": ["/path/to/mcp-google/dist/index.js"]
    }
  }
}
```

Or with environment variables:

```json
{
  "mcpServers": {
    "google": {
      "command": "node",
      "args": ["/path/to/mcp-google/dist/index.js"],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "/path/to/credentials.json",
        "GOOGLE_TOKEN_PATH": "/path/to/token.json"
      }
    }
  }
}
```

> **Note:** Legacy environment variables `GCAL_CREDENTIALS_PATH` and `GCAL_TOKEN_PATH` are still supported for backward compatibility.

## Available Tools

### Calendar

| Tool | Description |
|------|-------------|
| `list_events` | List upcoming events from Google Calendar |
| `get_event` | Get details of a specific event |
| `create_event` | Create a new event |
| `update_event` | Update an existing event |
| `delete_event` | Delete an event |
| `list_calendars` | List all available calendars |

### Tasks

| Tool | Description |
|------|-------------|
| `list_task_lists` | List all task lists |
| `list_tasks` | List tasks from a task list |
| `get_task` | Get details of a specific task |
| `create_task` | Create a new task |
| `update_task` | Update an existing task (title, notes, due date, status) |
| `delete_task` | Delete a task |

## Development

```bash
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile TypeScript
npm run start  # Run compiled version
```

## License

ISC
