import {
  SKIP_VALUE,
  suggestContactImportMapping,
} from "@/lib/crm/contact-import";

describe("suggestContactImportMapping", () => {
  it("maps company name to assigned company instead of full name", () => {
    const mapping = suggestContactImportMapping([
      "Company Name",
      "First Name",
      "Email Address",
    ]);

    expect(mapping.assigned_account).toBe("Company Name");
    expect(mapping.first_name).toBe("First Name");
    expect(mapping.email).toBe("Email Address");
    expect(mapping.name).toBe(SKIP_VALUE);
  });

  it("does not reuse the same header for multiple fields", () => {
    const mapping = suggestContactImportMapping([
      "First Name",
      "Last Name",
      "Company Name",
      "Phone",
    ]);

    const selectedHeaders = Object.values(mapping).filter((value) => value !== SKIP_VALUE);
    expect(new Set(selectedHeaders).size).toBe(selectedHeaders.length);
  });
});
