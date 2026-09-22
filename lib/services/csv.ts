import { z } from "zod";
import { workoutCreateSchema } from "@/lib/validation/workouts";

export const workoutCsvHeaders = [
  "date",
  "week_number",
  "workout_type",
  "title",
  "planned_distance_km",
  "planned_duration_min",
  "planned_pace_text",
  "planned_rpe",
  "purpose",
  "warmup",
  "main_set",
  "cooldown",
  "strength_training",
  "notes",
] as const;

export const workoutCsvRowSchema = workoutCreateSchema.omit({
  completed: true,
  skipped: true,
});

export type WorkoutCsvRow = z.infer<typeof workoutCsvRowSchema>;

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: readonly string[], rows: Record<string, unknown>[]) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\n");
}

export function parseWorkoutCsv(csvText: string): { rows: WorkoutCsvRow[]; errors: string[] } {
  const normalized = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return { rows: [], errors: ["CSV content is empty."] };

  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  const headers = splitCsvLine(lines[0] ?? "");
  const missing = workoutCsvHeaders.filter((header) => !headers.includes(header));
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`Missing required headers: ${missing.join(", ")}`);
  }

  const rows: WorkoutCsvRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index] ?? "");
    const raw: Record<string, unknown> = {};

    headers.forEach((header, headerIndex) => {
      raw[header] = cells[headerIndex] ?? "";
    });

    try {
      const parsed = workoutCsvRowSchema.parse({
        ...raw,
        planned_pace_seconds_per_km: undefined,
      });
      rows.push(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const detail = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        errors.push(`Row ${index + 1} is invalid: ${detail}`);
      } else {
        errors.push(`Row ${index + 1} could not be parsed.`);
      }
    }
  }

  return { rows, errors };
}
