import { customerSegments } from "../drizzle/schema";

export type ParsedCustomerImportRow = {
  rowNumber: number;
  fullName: string;
  email: string;
  phone: string;
  industry: string;
  segment: (typeof customerSegments)[number];
};

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(cell => cell.length > 0)) records.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell.length > 0)) records.push(row);
  return records;
}

function normaliseHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function valueFor(row: string[], indexByHeader: Map<string, number>, names: string[]): string {
  for (const name of names) {
    const index = indexByHeader.get(name);
    if (index !== undefined) return row[index]?.trim() ?? "";
  }
  return "";
}

function validSegment(value: string): (typeof customerSegments)[number] {
  const normalized = value.trim().toLowerCase();
  const segment = customerSegments.find(candidate => candidate.toLowerCase() === normalized);
  return segment ?? "New";
}

export function parseCustomerCsv(content: string, defaultIndustry: string): ParsedCustomerImportRow[] {
  const [header, ...records] = parseCsvRecords(content);
  if (!header?.length) return [];

  const indexByHeader = new Map(header.map((value, index) => [normaliseHeader(value), index]));
  return records.map((row, index) => ({
    rowNumber: index + 2,
    fullName: valueFor(row, indexByHeader, ["name", "fullname", "customername", "contactname"]),
    email: valueFor(row, indexByHeader, ["email", "emailaddress"]),
    phone: valueFor(row, indexByHeader, ["phone", "phonenumber", "whatsapp", "whatsappnumber", "mobile"]),
    industry: valueFor(row, indexByHeader, ["industry", "industryname", "sector"]) || defaultIndustry.trim(),
    segment: validSegment(valueFor(row, indexByHeader, ["segment", "customersegment"])),
  }));
}
