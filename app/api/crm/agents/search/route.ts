import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getActiveUsersForSearch } from "@/lib/crm/agent-search";

const DEFAULT_TAKE = 50;

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
  const data = await getActiveUsersForSearch({
    search: searchParams.get("search") ?? "",
    skip: numberParam(searchParams.get("skip"), 0),
    take: numberParam(searchParams.get("take"), DEFAULT_TAKE),
  });

  return NextResponse.json(data);
}
