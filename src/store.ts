import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DB_DIR = join(homedir(), ".veyra-forms");
const DB_PATH = join(DB_DIR, "data.db");

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    fields     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS responses (
    id           TEXT PRIMARY KEY,
    form_id      TEXT NOT NULL,
    data         TEXT NOT NULL,
    submitted_at TEXT NOT NULL
  );
`);

export interface FormField {
  name: string;
  type: string;
  required?: boolean;
}

export interface Form {
  id: string;
  title: string;
  fields: string;
  created_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  data: string;
  submitted_at: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listForms(): Form[] {
  return db.prepare("SELECT * FROM forms ORDER BY created_at DESC").all() as Form[];
}

export function getForm(id: string): Form | undefined {
  return db.prepare("SELECT * FROM forms WHERE id = ?").get(id) as Form | undefined;
}

export function getResponses(formId: string): FormResponse[] {
  return db
    .prepare("SELECT * FROM responses WHERE form_id = ? ORDER BY submitted_at DESC")
    .all(formId) as FormResponse[];
}

export function createForm(title: string, fields: FormField[]): Form {
  const now = new Date().toISOString();
  const id = generateId();
  db.prepare(
    "INSERT INTO forms (id, title, fields, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, title, JSON.stringify(fields), now);
  return getForm(id)!;
}

export function submitResponse(
  formId: string,
  data: Record<string, unknown>
): FormResponse {
  const form = getForm(formId);
  if (!form) throw new Error(`Form not found: ${formId}`);
  const now = new Date().toISOString();
  const id = generateId();
  db.prepare(
    "INSERT INTO responses (id, form_id, data, submitted_at) VALUES (?, ?, ?, ?)"
  ).run(id, formId, JSON.stringify(data), now);
  return db.prepare("SELECT * FROM responses WHERE id = ?").get(id) as FormResponse;
}

export function deleteForm(id: string): boolean {
  const result = db.prepare("DELETE FROM forms WHERE id = ?").run(id);
  db.prepare("DELETE FROM responses WHERE form_id = ?").run(id);
  return result.changes > 0;
}
