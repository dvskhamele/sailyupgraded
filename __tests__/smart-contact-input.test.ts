import {
  buildSmartContactInitialValues,
  extractOpportunitySignals,
} from "@/lib/smart-contact-input";

describe("smart contact quick input parser", () => {
  it.each([
    ["john@@gmail..com", "john@gmail.com"],
    ["john gmail com", "john@gmail.com"],
    ["john(at)gmail(dot)com", "john@gmail.com"],
    ["JOHN@GMAIL.COM ", "john@gmail.com"],
    ["wealthpathway7@gmailcom", "wealthpathway7@gmail.com"],
    ["wealthpathway7 @ gmail . com", "wealthpathway7@gmail.com"],
    ["john..walker@gmail.com", "john.walker@gmail.com"],
    ["john_walker@@yahoo.co", "john_walker@yahoo.co"],
  ])("repairs email input %s", (input, email) => {
    expect(buildSmartContactInitialValues(input).email).toBe(email);
  });

  it.each([
    ["2145559988", "+12145559988"],
    ["+12145559988", "+12145559988"],
    ["+1 (214)-555--9988", "+12145559988"],
    ["214.555.9988", "+12145559988"],
    ["214 555 9988", "+12145559988"],
    ["02145559988", "+12145559988"],
    ["214-555-998899", "+12145559988"],
    ["call me at two one four five five five nine nine eight eight", "+12145559988"],
    ["214five559988", "+12145559988"],
    ["tx2145559988", "+12145559988"],
  ])("normalizes US phone input %s", (input, phone) => {
    expect(buildSmartContactInitialValues(input).phone).toBe(phone);
  });

  it.each([
    ["john from dalls texs", "Dallas", "Texas"],
    ["hosuton tx", "Houston", "Texas"],
    ["newyork", "New York", "New York"],
    ["CA los angeles", "Los Angeles", "California"],
    ["75001 tx", "Addison", "Texas"],
    ["75205 dallas", "Dallas", "Texas"],
    ["dallastexas", "Dallas", "Texas"],
  ])("infers US location from %s", (input, city, state) => {
    const values = buildSmartContactInitialValues(input);
    expect(values.city).toBe(city);
    expect(values.state).toBe(state);
    expect(values.country).toBe("United States");
  });

  it.each([
    ["Ravi Patel indore mp 98765-43210 ravi@gmail,com near c21 mall", "Ravi", "Patel", "+919876543210", "ravi@gmail.com", "Indore", "Madhya Pradesh"],
    ["mahesh khandwa mp 9876543210 mahesh at yahoo dot com", "", "Mahesh", "+919876543210", "mahesh@yahoo.com", "Khandwa", "Madhya Pradesh"],
    ["452001 near rajwada indore", "", "Unknown", "", "contact@gmail.com", "Indore", "Madhya Pradesh"],
    ["ram lal jaipur rajasthan 9876543210 ram@gmailcom", "Ram", "Lal", "+919876543210", "ram@gmail.com", "Jaipur", "Rajasthan"],
    ["Hyd Telangana 9876543210 john@yahoo.co", "", "John", "+919876543210", "john@yahoo.co", "Hyderabad", "Telangana"],
    ["john@gmailcom +91-9876543210 banglore", "", "John", "+919876543210", "john@gmail.com", "Bangalore", "Karnataka"],
  ])("parses India contact input %s", (input, firstName, lastName, phone, email, city, state) => {
    const values = buildSmartContactInitialValues(input);
    expect(values.first_name).toBe(firstName);
    expect(values.last_name).toBe(lastName);
    expect(values.phone).toBe(phone);
    expect(values.email).toBe(email);
    expect(values.city).toBe(city);
    expect(values.state).toBe(state);
    expect(values.country).toBe("India");
  });

  it.each([
    ["Need 500k policy smoker", "Life Insurance", "500000"],
    ["iul polcy needed", "Life Insurance", ""],
    ["need medcare supplment", "Medicare", ""],
    ["Need crm demo call 9876543210 from indore budget 2 lakh", "CRM Software", "200000"],
    ["Need ai caller + crm + meta ads automation", "Automation", ""],
    ["5 lakh budget need software urgent", "CRM Software", "500000"],
    ["Need 1cr coverage age51 diabetic", "Life Insurance", "10000000"],
    ["Need milk collection software for village society", "Dairy Software", ""],
  ])("extracts opportunity signals from %s", (input, product, budget) => {
    const signals = extractOpportunitySignals(input);
    expect(signals.products).toContain(product);
    if (budget) expect(signals.budget).toBe(budget);
  });
});
