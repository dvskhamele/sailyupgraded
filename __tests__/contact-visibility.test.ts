import {
  CONTACT_VISIBILITY_ALL_MEMBERS,
  CONTACT_VISIBILITY_ASSIGNED_MEMBER,
  buildContactVisibilityFilter,
  normalizeContactVisibility,
} from "@/lib/crm/contact-visibility";

describe("contact visibility", () => {
  it("normalizes assigned-member display values", () => {
    expect(normalizeContactVisibility("assigned_member")).toBe(
      CONTACT_VISIBILITY_ASSIGNED_MEMBER,
    );
    expect(normalizeContactVisibility("Assigned member")).toBe(
      CONTACT_VISIBILITY_ASSIGNED_MEMBER,
    );
    expect(normalizeContactVisibility("assigned member")).toBe(
      CONTACT_VISIBILITY_ASSIGNED_MEMBER,
    );
    expect(normalizeContactVisibility("all_members")).toBe(
      CONTACT_VISIBILITY_ALL_MEMBERS,
    );
    expect(normalizeContactVisibility("All Member")).toBe(
      CONTACT_VISIBILITY_ALL_MEMBERS,
    );
  });

  it("only exposes assigned-member contacts to the assigned user", () => {
    expect(buildContactVisibilityFilter({ id: "user-1", role: "member" })).toEqual({
      AND: [
        {
          OR: [
            { visible_to_name: null },
            { visible_to_name: "" },
            {
              visible_to_name: {
                in: [
                  "all_members",
                  "all member",
                  "all members",
                  "All Member",
                  "All members",
                  "All Members",
                  "all_member",
                  "all",
                ],
              },
            },
            {
              visible_to_name: {
                in: [
                  "assigned_member",
                  "assigned member",
                  "Assigned member",
                  "Assigned Member",
                  "assigned_members",
                  "assigned",
                ],
              },
              assigned_to: "user-1",
            },
          ],
        },
      ],
    });
  });

  it("keeps legacy all-member visibility when the DB column is missing", () => {
    expect(buildContactVisibilityFilter({ id: "user-1", role: "member" }, false)).toEqual({});
  });
});
