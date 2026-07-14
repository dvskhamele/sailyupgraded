// import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";
// import { NextResponse } from "next/server";

// export async function POST(req: Request) {
//   console.log("[LEAD CREATE DEBUG] Entry point", {
//     path: "app/api/crm/leads/create-lead-from-web/route.ts:POST",
//     database: getDatabaseUrlDiagnostics(),
//   });

//   if (req.headers.get("content-type") !== "application/json") {
//     return NextResponse.json(
//       { message: "Invalid content-type" },
//       { status: 400 }
//     );
//   }

//   const body = await req.json();
//   const headers = req.headers;
//   console.log("[LEAD CREATE DEBUG] Incoming lead payload", body);

//   if (!body) {
//     return NextResponse.json({ message: "No body" }, { status: 400 });
//   }
//   if (!headers) {
//     return NextResponse.json({ message: "No headers" }, { status: 400 });
//   }

//   const { firstName, lastName, account, job, email, phone, lead_source } = body;

//   //Validate auth with token from .env.local
//   const token = headers.get("authorization");

//   if (!token) {
//     return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
//   }

//   if (!process.env.NEXTCRM_TOKEN) {
//     return NextResponse.json(
//       { message: "NEXTCRM_TOKEN not defined in .env.local file" },
//       { status: 401 }
//     );
//   }

//   if (token.trim() !== process.env.NEXTCRM_TOKEN.trim()) {
//     console.log("Unauthorized");
//     return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
//   } else {
//     if (!lastName) {
//       return NextResponse.json(
//         { message: "Missing required fields" },
//         { status: 400 }
//       );
//     }
//     try {
//       const createPayload = {
//         v: 1,
//         firstName,
//         lastName,
//         company: account,
//         jobTitle: job,
//         email,
//         phone,
//       };
//       console.log("[LEAD CREATE DEBUG] Prisma create payload", createPayload);
//       console.log("[LEAD CREATE DEBUG] Executing prismadb.crm_Leads.create()");
//       const lead = await prismadb.crm_Leads.create({
//         data: {
//           ...createPayload,
//         },
//       });
//       console.log("[LEAD CREATE DEBUG] Create result", lead);
//       console.log("[LEAD CREATE DEBUG] Created lead ID", { id: lead.id });

//       const verificationLead = await prismadb.crm_Leads.findUnique({
//         where: { id: lead.id },
//       });
//       console.log("[LEAD CREATE DEBUG] Verification query result", verificationLead);

//       if (!verificationLead) {
//         console.error("[LEAD CREATE DEBUG] Verification query did not find created lead", {
//           id: lead.id,
//           database: getDatabaseUrlDiagnostics(),
//         });
//       }
//       console.log("[LEAD CREATE DEBUG] Completed without transaction rollback", {
//         id: lead.id,
//         note: "create-lead-from-web does not wrap crm_Leads.create() in a transaction",
//       });

//       return NextResponse.json({ message: "New lead created successfully" });
//       //return res.status(200).json({ json: "newContact" });
//     } catch (error) {
//       console.log(error);
//       return NextResponse.json(
//         { message: "Error creating new lead" },
//         { status: 500 }
//       );
//     }
//   }
// }


import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("[LEAD CREATE DEBUG] Entry point", {
    path: "app/api/crm/leads/create-lead-from-web/route.ts:POST",
    database: getDatabaseUrlDiagnostics(),
  });

  if (req.headers.get("content-type") !== "application/json") {
    return NextResponse.json(
      { message: "Invalid content-type" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const headers = req.headers;
  console.log("[LEAD CREATE DEBUG] Incoming lead payload", body);

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
    if (!lastName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }
    try {
      const createPayload = {
        v: 1,
        firstName,
        lastName,
        company: account,
        jobTitle: job,
        email,
        phone,
        // ── SOURCE FIX ──────────────────────────────────────────────
        // Persist the lead's origin (e.g. "linkedin", "instagram").
        // NOTE: pick the field that actually exists on the crm_Leads
        // Prisma model / drives the Source column in the UI:
        source_platform: lead_source,      // if the model has a string column
        // lead_source_id: <resolve lead_source → LeadSource record id>,
        // ────────────────────────────────────────────────────────────
      };
      console.log("[LEAD CREATE DEBUG] Prisma create payload", createPayload);
      console.log("[LEAD CREATE DEBUG] Executing prismadb.crm_Leads.create()");
      const lead = await prismadb.crm_Leads.create({
        data: {
          ...createPayload,
        },
      });
      console.log("[LEAD CREATE DEBUG] Create result", lead);
      console.log("[LEAD CREATE DEBUG] Created lead ID", { id: lead.id });

      const verificationLead = await prismadb.crm_Leads.findUnique({
        where: { id: lead.id },
      });
      console.log("[LEAD CREATE DEBUG] Verification query result", verificationLead);

      if (!verificationLead) {
        console.error("[LEAD CREATE DEBUG] Verification query did not find created lead", {
          id: lead.id,
          database: getDatabaseUrlDiagnostics(),
        });
      }
      console.log("[LEAD CREATE DEBUG] Completed without transaction rollback", {
        id: lead.id,
        note: "create-lead-from-web does not wrap crm_Leads.create() in a transaction",
      });

      return NextResponse.json({ message: "New lead created successfully" });
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: "Error creating new lead" },
        { status: 500 }
      );
    }
  }
}
