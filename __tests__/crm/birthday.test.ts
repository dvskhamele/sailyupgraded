import {
  parseBirthday,
  formatBirthday,
  formatBirthdayDisplay,
  birthdayToParts,
  formatBirthdayForContactDb,
  formatBirthdayForLeadDb,
} from "@/lib/crm/birthday";

describe("CRM Birthday utilities", () => {
  describe("parseBirthday", () => {
    it("parses valid DD/MM/YYYY strings", () => {
      const date = parseBirthday("25/12/1990");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(1990);
      expect(date?.getMonth()).toBe(11); // December (0-indexed)
      expect(date?.getDate()).toBe(25);
    });

    it("parses single digit D/M/YYYY strings", () => {
      const date = parseBirthday("5/8/1985");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(1985);
      expect(date?.getMonth()).toBe(7); // August
      expect(date?.getDate()).toBe(5);
    });

    it("parses ISO YYYY-MM-DD strings", () => {
      const date = parseBirthday("1995-04-18");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(1995);
      expect(date?.getMonth()).toBe(3); // April
      expect(date?.getDate()).toBe(18);
    });

    it("parses ISO strings with time portions safely", () => {
      const date = parseBirthday("2000-01-15T00:00:00.000Z");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2000);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(15);
    });

    it("parses native Date instances without timezone drift", () => {
      const inputDate = new Date(1988, 5, 20);
      const parsed = parseBirthday(inputDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(1988);
      expect(parsed?.getMonth()).toBe(5);
      expect(parsed?.getDate()).toBe(20);
    });

    it("parses object with birthday parts", () => {
      const parsed = parseBirthday({
        birthday_year: "1992",
        birthday_month: "10",
        birthday_day: "30",
      });
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(1992);
      expect(parsed?.getMonth()).toBe(9); // October
      expect(parsed?.getDate()).toBe(30);
    });

    it("rejects invalid dates like Feb 31", () => {
      expect(parseBirthday("31/02/1990")).toBeNull();
      expect(parseBirthday("1990-02-31")).toBeNull();
      expect(
        parseBirthday({
          birthday_year: "1990",
          birthday_month: "2",
          birthday_day: "31",
        })
      ).toBeNull();
    });

    it("handles leap years correctly", () => {
      // 2024 is leap year
      expect(parseBirthday("29/02/2024")).not.toBeNull();
      // 2023 is not leap year
      expect(parseBirthday("29/02/2023")).toBeNull();
    });

    it("returns null for empty/null/undefined inputs", () => {
      expect(parseBirthday(null)).toBeNull();
      expect(parseBirthday(undefined)).toBeNull();
      expect(parseBirthday("")).toBeNull();
      expect(parseBirthday("   ")).toBeNull();
      expect(parseBirthday("invalid-date")).toBeNull();
    });
  });

  describe("formatBirthday / formatBirthdayDisplay", () => {
    it("formats dates as DD/MM/YYYY", () => {
      expect(formatBirthday("1990-12-25")).toBe("25/12/1990");
      expect(formatBirthday("25/12/1990")).toBe("25/12/1990");
      expect(formatBirthday("5/8/1985")).toBe("05/08/1985");
      expect(formatBirthday(new Date(1990, 11, 25))).toBe("25/12/1990");
      expect(formatBirthdayDisplay("1990-12-25")).toBe("25/12/1990");
    });

    it("returns empty string for invalid dates", () => {
      expect(formatBirthday(null)).toBe("");
      expect(formatBirthday("invalid")).toBe("");
      expect(formatBirthdayDisplay("")).toBe("");
    });
  });

  describe("birthdayToParts", () => {
    it("converts birthday to parts", () => {
      expect(birthdayToParts("25/12/1990")).toEqual({
        birthday_year: "1990",
        birthday_month: "12",
        birthday_day: "25",
      });
      expect(birthdayToParts("1985-08-05")).toEqual({
        birthday_year: "1985",
        birthday_month: "8",
        birthday_day: "5",
      });
    });

    it("returns empty parts for invalid or empty inputs", () => {
      expect(birthdayToParts(null)).toEqual({
        birthday_year: "",
        birthday_month: "",
        birthday_day: "",
      });
      expect(birthdayToParts("")).toEqual({
        birthday_year: "",
        birthday_month: "",
        birthday_day: "",
      });
    });
  });

  describe("formatBirthdayForContactDb", () => {
    it("formats valid dates as DD/MM/YYYY string for Contact DB", () => {
      expect(formatBirthdayForContactDb("1990-12-25")).toBe("25/12/1990");
      expect(formatBirthdayForContactDb("5/8/1985")).toBe("05/08/1985");
      expect(
        formatBirthdayForContactDb({
          birthday_year: "1990",
          birthday_month: "12",
          birthday_day: "25",
        })
      ).toBe("25/12/1990");
    });

    it("returns null for empty/invalid inputs", () => {
      expect(formatBirthdayForContactDb(null)).toBeNull();
      expect(formatBirthdayForContactDb("")).toBeNull();
    });
  });

  describe("formatBirthdayForLeadDb", () => {
    it("formats valid dates as UTC midnight Date for Lead DB", () => {
      const date = formatBirthdayForLeadDb("25/12/1990");
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe("1990-12-25T00:00:00.000Z");
    });

    it("returns null for empty/invalid inputs", () => {
      expect(formatBirthdayForLeadDb(null)).toBeNull();
      expect(formatBirthdayForLeadDb("")).toBeNull();
    });
  });
});
