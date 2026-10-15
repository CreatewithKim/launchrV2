import { describe, expect, it } from "vitest";
import { formatCsv } from "./csv";

describe("formatCsv", () => {
  it("produces a headered CSV and escapes commas, quotes, and multiline values", () => {
    const csv = formatCsv([
      { name: "Amina, Yusuf", note: "Said \"hello\"\nand asked for details", phone: "+15550101" },
    ], ["name", "note", "phone"]);

    expect(csv).toBe("name,note,phone\r\n\"Amina, Yusuf\",\"Said \"\"hello\"\"\nand asked for details\",+15550101\r\n");
  });

  it("uses empty cells for unavailable data", () => {
    expect(formatCsv([{ name: "Theo", email: null }], ["name", "email"])).toBe("name,email\r\nTheo,\r\n");
  });
});
