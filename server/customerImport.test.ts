import { describe, expect, it } from "vitest";
import { parseCustomerCsv } from "./customerImport";

describe("parseCustomerCsv", () => {
  it("maps customer contact and segmentation columns, including quoted values", () => {
    const rows = parseCustomerCsv(
      "Name,Email,Phone,Industry,Segment\n\"Amina, Yusuf\",amina@example.com,+15550101,Retail,VIP\nTheo,theo@example.com,+15550102,,Frequent Buyer\n",
      "Hospitality",
    );

    expect(rows).toEqual([
      { rowNumber: 2, fullName: "Amina, Yusuf", email: "amina@example.com", phone: "+15550101", industry: "Retail", segment: "VIP" },
      { rowNumber: 3, fullName: "Theo", email: "theo@example.com", phone: "+15550102", industry: "Hospitality", segment: "Frequent Buyer" },
    ]);
  });

  it("accepts common contact header aliases and defaults unknown segments to New", () => {
    const rows = parseCustomerCsv("Full Name,WhatsApp Number,Sector,Customer Segment\nInez,+15550103,Wellness,Priority\n", "Unspecified");

    expect(rows[0]).toMatchObject({ fullName: "Inez", phone: "+15550103", industry: "Wellness", segment: "New" });
  });
});
