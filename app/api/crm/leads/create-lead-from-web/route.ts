import { prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { setOrganizationContext } from "@/lib/organization-context";

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    return NextResponse.json(
      { message: "Invalid content-type" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const headers = req.headers;

  if (!body) {
    return NextResponse.json({ message: "No body" }, { status: 400 });
  }
  if (!headers) {
    return NextResponse.json({ message: "No headers" }, { status: 400 });
  }

  const { firstName, lastName, account, job, email, phone, lead_source } = body;

  //Validate auth with token from .env.local
  const token = headers.get("authorization");

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXTCRM_TOKEN) {
    return NextResponse.json(
      { message: "NEXTCRM_TOKEN not defined in .env.local file" },
      { status: 401 }
    );
  }

  if (token.trim() !== process.env.NEXTCRM_TOKEN.trim()) {
    console.log("Unauthorized");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  } else {
    const organizationId = process.env.NEXTCRM_REMOTE_ORGANIZATION_ID;
    if (!organizationId) {
      return NextResponse.json(
        { message: "NEXTCRM_REMOTE_ORGANIZATION_ID is required" },
        { status: 500 },
      );
    }
    setOrganizationContext(organizationId);

    if (!lastName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }
    try {
      const createPayload = {
        organizationId,
        v: 1,
        firstName,
        lastName,
        company: account,
        jobTitle: job,
        email,
        phone,
      };
      const lead = await prismadb.crm_Leads.create({
        data: {
          ...createPayload,
        },
      });

      return NextResponse.json({ message: "New lead created successfully" });
      //return res.status(200).json({ json: "newContact" });
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: "Error creating new lead" },
        { status: 500 }
      );
    }
  }
}
