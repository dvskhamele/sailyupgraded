const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const data = [
  {
    "First Name": "John",
    "Last Name": "Doe",
    "Email": "john.doe@example.com",
    "Mobile Phone": "+1234567890",
    "Office Phone": "+1234567891",
    "Position": "Insurance Agent",
    "Company": "ABC Insurance",
    "Website": "https://example.com",
    "Status": "Active",
  },
  {
    "First Name": "Jane",
    "Last Name": "Smith",
    "Email": "jane.smith@example.com",
    "Mobile Phone": "+1234567892",
    "Office Phone": "+1234567893",
    "Position": "Senior Agent",
    "Company": "XYZ Brokers",
    "Website": "https://xyzbrokers.com",
    "Status": "Active",
  },
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// Set column widths
ws["!cols"] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 30 },
  { wch: 15 },
  { wch: 15 },
  { wch: 20 },
  { wch: 25 },
  { wch: 30 },
  { wch: 10 },
];

XLSX.utils.book_append_sheet(wb, ws, "Agents");

const outDir = path.join(__dirname, "..", "public", "templates");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "agent-import-template.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`Template created at: ${outPath}`);