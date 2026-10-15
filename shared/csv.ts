export type CsvValue = string | number | boolean | Date | null | undefined;

function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function formatCsv(rows: Array<Record<string, CsvValue>>, columns?: string[]): string {
  const headers = columns ?? Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const lines = [headers.map(escapeCsvCell).join(",")];
  rows.forEach(row => lines.push(headers.map(header => escapeCsvCell(row[header])).join(",")));
  return `${lines.join("\r\n")}\r\n`;
}

export function csvFileName(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.csv`;
}
