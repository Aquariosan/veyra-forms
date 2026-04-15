#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as store from "./store.js";
import { requireVeyra } from "./veyra.js";

const server = new Server(
  { name: "veyra-forms", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_forms",
      description: "List all forms. FREE — no token required.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_form",
      description: "Retrieve a form by ID including its field schema. FREE — no token required.",
      inputSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "The form ID" },
        },
        required: ["form_id"],
      },
    },
    {
      name: "get_responses",
      description: "Get all submitted responses for a form. FREE — no token required.",
      inputSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "The form ID" },
        },
        required: ["form_id"],
      },
    },
    {
      name: "create_form",
      description: "Create a new form with a field schema. Requires Veyra commit mode (Class B — €0.02).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Form title" },
          fields: {
            type: "array",
            description: "Array of field definitions",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", description: "e.g. text, email, number, boolean" },
                required: { type: "boolean" },
              },
              required: ["name", "type"],
            },
          },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["title", "fields"],
      },
    },
    {
      name: "submit_response",
      description: "Submit a response to a form. Requires Veyra commit mode (Class B — €0.02).",
      inputSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "The form ID to submit to" },
          data: {
            type: "object",
            description: "Key-value pairs matching the form fields",
            additionalProperties: true,
          },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["form_id", "data"],
      },
    },
    {
      name: "delete_form",
      description: "Delete a form and all its responses. Requires Veyra commit mode (Class B — €0.02).",
      inputSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "The form ID to delete" },
          veyra_token: { type: "string", description: "Veyra authorization token" },
        },
        required: ["form_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_forms": {
      const forms = store.listForms();
      return {
        content: [{ type: "text", text: JSON.stringify({ count: forms.length, forms }) }],
      };
    }

    case "get_form": {
      const { form_id } = args as { form_id: string };
      const form = store.getForm(form_id);
      if (!form) {
        return { content: [{ type: "text", text: JSON.stringify({ found: false, form_id }) }] };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              found: true,
              ...form,
              fields: JSON.parse(form.fields),
            }),
          },
        ],
      };
    }

    case "get_responses": {
      const { form_id } = args as { form_id: string };
      const responses = store.getResponses(form_id);
      const parsed = responses.map((r) => ({ ...r, data: JSON.parse(r.data) }));
      return {
        content: [{ type: "text", text: JSON.stringify({ count: parsed.length, form_id, responses: parsed }) }],
      };
    }

    case "create_form": {
      const { title, fields, veyra_token } = args as {
        title: string;
        fields: store.FormField[];
        veyra_token?: string;
      };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      const form = store.createForm(title, fields);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              commit_mode: "verified",
              ...form,
              fields: JSON.parse(form.fields),
            }),
          },
        ],
      };
    }

    case "submit_response": {
      const { form_id, data, veyra_token } = args as {
        form_id: string;
        data: Record<string, unknown>;
        veyra_token?: string;
      };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      try {
        const response = store.submitResponse(form_id, data);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                commit_mode: "verified",
                ...response,
                data: JSON.parse(response.data),
              }),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }

    case "delete_form": {
      const { form_id, veyra_token } = args as { form_id: string; veyra_token?: string };
      const check = await requireVeyra(veyra_token);
      if (!check.ok) {
        return { content: [{ type: "text", text: JSON.stringify(check.error, null, 2) }] };
      }
      const deleted = store.deleteForm(form_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, form_id, deleted, commit_mode: "verified" }),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "UnknownTool", tool: name }) }],
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("veyra-forms server error:", err);
  process.exit(1);
});
