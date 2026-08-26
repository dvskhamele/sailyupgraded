import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { searchLeads } from "@/actions/crm/leads/search-leads";

const DEFAULT_TAKE = 20;

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? searchParams.get("search") ?? "";
  const take = numberParam(searchParams.get("take"), DEFAULT_TAKE);

  const leads = await searchLeads({
    search: query,
    take,
  });

  return NextResponse.json({ leads, total: leads.length });
}
