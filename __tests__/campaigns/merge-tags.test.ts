import { resolveMergeTags } from "@/lib/campaigns/merge-tags";

describe("resolveMergeTags", () => {
  const target = {
    first_name: "John",
    last_name: "Smith",
    email: "john@acme.com",
    company: "Acme Inc",
    position: "CEO",
  };

  it("replaces all known merge tags", () => {
    const html = "<p>Hi {{first_name}} {{last_name}}, from {{company}}</p>";
    expect(resolveMergeTags(html, target)).toBe(
      "<p>Hi John Smith, from Acme Inc</p>"
    );
  });

  it("replaces {{email}} and {{position}}", () => {
    const html = "{{email}} - {{position}}";
    expect(resolveMergeTags(html, target)).toBe("john@acme.com - CEO");
  });

  it("leaves unknown tags as-is", () => {
    const html = "{{unknown_tag}}";
    expect(resolveMergeTags(html, target)).toBe("{{unknown_tag}}");
  });

  it("handles missing target fields gracefully (uses empty string)", () => {
    const html = "{{first_name}} {{company}}";
    expect(resolveMergeTags(html, { last_name: "Smith" })).toBe(" ");
  });

  it("replaces camelCase tags (firstName, lastName, company, email)", () => {
    const text = "Hello {{firstName}} {{lastName}} from {{company}}! Email: {{email}}";
    expect(
      resolveMergeTags(text, {
        firstName: "Rahul",
        lastName: "Sharma",
        company: "NextCRM",
        email: "rahul@example.com",
      })
    ).toBe("Hello Rahul Sharma from NextCRM! Email: rahul@example.com");
  });

  it("resolves camelCase tags when only snake_case fields provided in target", () => {
    const text = "Hi {{firstName}} {{lastName}}!";
    expect(
      resolveMergeTags(text, {
        first_name: "Amit",
        last_name: "Patel",
      })
    ).toBe("Hi Amit Patel!");
  });
});
