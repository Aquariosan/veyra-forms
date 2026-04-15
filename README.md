# veyra-forms

A form and survey builder MCP tool for AI agents. Define forms with typed fields, collect structured responses, and query results. Reads are always free. Write operations require [Veyra](https://veyra.to) commit mode authorization.

## Overview

`veyra-forms` lets AI agents programmatically create forms, submit responses, and read results — all backed by SQLite. Form creation and response submission are Class B operations.

## Installation

```bash
npm install
npm run build
```

Data is stored at `~/.veyra-forms/data.db`, created automatically on first run.

## MCP Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "veyra-forms": {
      "command": "node",
      "args": ["/absolute/path/to/veyra-forms/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Input | Class | Price |
|------|-------|-------|-------|
| `list_forms` | `{}` | — | FREE |
| `get_form` | `{ form_id }` | — | FREE |
| `get_responses` | `{ form_id }` | — | FREE |
| `create_form` | `{ title, fields: [{name, type, required?}], veyra_token? }` | B | €0.02 |
| `submit_response` | `{ form_id, data: {}, veyra_token? }` | B | €0.02 |
| `delete_form` | `{ form_id, veyra_token? }` | B | €0.02 |

### Field types

Any string is accepted as `type`. Common values: `text`, `email`, `number`, `boolean`, `date`, `textarea`.

## Examples

### Read (no token needed)

```json
// List all forms
{ "tool": "list_forms", "arguments": {} }

// Get a form and its field schema
{ "tool": "get_form", "arguments": { "form_id": "1712345678-abc1234" } }

// Get all responses for a form
{ "tool": "get_responses", "arguments": { "form_id": "1712345678-abc1234" } }
```

### Write (Veyra token required)

```json
// Create a form
{
  "tool": "create_form",
  "arguments": {
    "title": "Customer Feedback",
    "fields": [
      { "name": "name", "type": "text", "required": true },
      { "name": "email", "type": "email", "required": true },
      { "name": "rating", "type": "number", "required": true },
      { "name": "comment", "type": "textarea" }
    ],
    "veyra_token": "vt_..."
  }
}

// Submit a response
{
  "tool": "submit_response",
  "arguments": {
    "form_id": "1712345678-abc1234",
    "data": {
      "name": "Alice",
      "email": "alice@example.com",
      "rating": 5,
      "comment": "Excellent service!"
    },
    "veyra_token": "vt_..."
  }
}

// Delete a form (also deletes all responses)
{
  "tool": "delete_form",
  "arguments": { "form_id": "1712345678-abc1234", "veyra_token": "vt_..." }
}
```

### Error response when token is missing

```json
{
  "error": "VeyraCommitRequired",
  "message": "Write operations require Veyra commit mode.",
  "currentMode": "open",
  "requiredMode": "commit",
  "authorize_endpoint": "https://api.veyra.to/v1/authorize-action",
  "docs_url": "https://veyra.to"
}
```

## How Veyra Works

Veyra is a commit-mode authorization layer for AI agents. When an agent attempts a write:

1. The agent calls the tool without `veyra_token` → receives `VeyraCommitRequired` with `authorize_endpoint`.
2. The agent/user calls the authorize endpoint to obtain a token.
3. The agent retries with `veyra_token` set.
4. `veyra-forms` verifies the token via `@veyrahq/sdk-node` before executing the action.

See [veyra.to](https://veyra.to) for full documentation.

## License

MIT
