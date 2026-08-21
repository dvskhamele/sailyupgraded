import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  createAgentTemplateWorkbook,
  formatAgentSpreadsheetValue,
  getAgentSpreadsheetFields,
  isAgentSpreadsheetImportable,
} from "@/lib/crm/agent-spreadsheet";

function workbookResponse(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = request.nextUrl.searchParams.get("template") === "1";

  if (template) {
    const workbook = createAgentTemplateWorkbook();
    return workbookResponse(workbook, "Agent_Import_Template.xlsx");
  }

  const customFields = await prismadb.custom_fields.findMany({ orderBy: { createdAt: "asc" } });
  const fields = getAgentSpreadsheetFields(customFields);
  const headers = fields.map((field) => field.label);
  const workbook = XLSX.utils.book_new();

  const agents = await prismadb.crm_Contacts.findMany({
    where: { deletedAt: null, role: "Agent" },
    include: {
      assigned_to_user: { select: { id: true, name: true, email: true } },
      assigned_accounts: { select: { id: true, name: true } },
      contact_type: { select: { id: true, name: true } },
      lead_source: { select: { id: true, name: true } },
      lead_status: { select: { id: true, name: true } },
      lead_type: { select: { id: true, name: true } },
    },
    orderBy: { cratedAt: "asc" },
  });
  const rows = agents.map((agent: any) => fields.map((field) => {
    if (field.custom) return formatAgentSpreadsheetValue(field, agent.custom_fields_data?.[field.key.slice(7)]);
    const lookupValues: Record<string, unknown> = {
      assigned_to: agent.assigned_to_user?.name ?? agent.assigned_to_user?.email ?? agent.assigned_to,
      accountsIDs: agent.assigned_accounts?.name ?? agent.accountsIDs,
      contact_type_id: agent.contact_type?.name ?? agent.contact_type_id,
      lead_source_id: agent.lead_source?.name ?? agent.lead_source_id,
      lead_status_id: agent.lead_status?.name ?? agent.lead_status_id,
      lead_type_id: agent.lead_type?.name ?? agent.lead_type_id,
    };
    return formatAgentSpreadsheetValue(field, lookupValues[field.key] ?? agent[field.key]);
  }));
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Agents");
  return workbookResponse(workbook, "agents.xlsx");
}
