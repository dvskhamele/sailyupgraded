import {
  fieldAppliesToEntity,
  filterCustomFieldsForEntity,
  normalizeCustomField,
} from "@/lib/custom-fields";

const fields = [
  {
    id: "customer-field",
    name: "Customer Field",
    type: "text",
    applies_to: ["Contact:Customer"],
  },
  {
    id: "agent-field",
    name: "Agent Field",
    type: "text",
    applies_to: ["Contact:Agent"],
  },
  {
    id: "all-contact-field",
    name: "All Contact Field",
    type: "text",
    applies_to: ["Contact"],
  },
];

describe("custom field role scoping", () => {
  it("normalizes role-specific contact scopes", () => {
    expect(normalizeCustomField(fields[0]).applies_to).toEqual(["Contact"]);
    expect(normalizeCustomField(fields[0]).contact_role).toBe("Customer");
  });

  it("shows only fields for the selected contact role plus all-contact fields", () => {
    expect(
      filterCustomFieldsForEntity(fields, "Contact", "Customer").map((field) => field.id),
    ).toEqual(["customer-field", "all-contact-field"]);

    expect(
      filterCustomFieldsForEntity(fields, "Contact", "Agent").map((field) => field.id),
    ).toEqual(["agent-field", "all-contact-field"]);
  });

  it("matches role values case-insensitively", () => {
    expect(fieldAppliesToEntity(fields[0], "Contact", "customer")).toBe(true);
    expect(fieldAppliesToEntity(fields[0], "Contact", "Agent")).toBe(false);
  });
});
