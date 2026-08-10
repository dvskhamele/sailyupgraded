const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// All importable Agent form fields — must stay in sync with
// lib/crm/agent-spreadsheet.ts LABELS map.
const HEADERS = [
  "Agent ID",
  "Role",
  "First Name",
  "Last Name",
  "Email",
  "Personal Email",
  "Phone",
  "Mobile Phone",
  "Office Phone",
  "Website",
  "Company",
  "Job Title",
  "Position",
  "Assigned Member",
  "Assigned Company",
  "Visibility",
  "Contact Type",
  "Lead Source",
  "Lead Status",
  "Lead Type",
  "Referred By",
  "Campaign",
  "Status",
  "Birthday",
  "Address Line 1",
  "Address Line 2",
  "Address",
  "City",
  "State",
  "Country",
  "Postal Code",
  "Description",
  "Notes",
  "Twitter",
  "Facebook",
  "LinkedIn",
  "Thread",
  "Instagram",
  "YouTube",
  "TikTok",
];

const sampleRow = {
  "Agent ID": "AGT-001",
  Role: "Agent",
  "First Name": "John",
  "Last Name": "Doe",
  Email: "john.doe@example.com",
  "Personal Email": "john.personal@example.com",
  Phone: "+12345678900",
  "Mobile Phone": "+12345678901",
  "Office Phone": "+12345678902",
  Website: "https://example.com",
  Company: "ABC Insurance",
  "Job Title": "Senior Agent",
  Position: "Insurance Agent",
  "Assigned Member": "",
  "Assigned Company": "",
  Visibility: "all_members",
  "Contact Type": "",
  "Lead Source": "",
  "Lead Status": "",
  "Lead Type": "",
  "Referred By": "",
  Campaign: "",
  Status: "active",
  Birthday: "1985-06-15",
  "Address Line 1": "123 Main St",
  "Address Line 2": "Suite 100",
  Address: "123 Main St, Suite 100",
  City: "New York",
  State: "NY",
  Country: "United States",
  "Postal Code": "10001",
  Description: "Experienced insurance agent",
  Notes: "Internal notes here",
  Twitter: "https://twitter.com/johndoe",
  Facebook: "https://facebook.com/johndoe",
  LinkedIn: "https://linkedin.com/in/johndoe",
  Thread: "johndoe",
  Instagram: "https://instagram.com/johndoe",
  YouTube: "https://youtube.com/@johndoe",
  TikTok: "https://tiktok.com/@johndoe",
};

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet([sampleRow], { header: HEADERS });

// Set column widths
ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

XLSX.utils.book_append_sheet(wb, ws, "Agents");

const outDir = path.join(__dirname, "..", "public", "templates");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "agent-import-template.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`Template created at: ${outPath}`);
console.log(`Total columns: ${HEADERS.length}`);
