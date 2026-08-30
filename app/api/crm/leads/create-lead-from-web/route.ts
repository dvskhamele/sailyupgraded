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
    return NextResponse.json({ message: "Invalid content-type" }, { status: 400 });
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

  const {
    firstName, lastName, account, job, email, phone, lead_source,
    // Identifiers the extensions send. Stored so /api/integrations/outreach/check
    // can recognise this person later and not message them twice.
    linkedin_url, instagram_url, facebook_url, username, source_platform,
  } = body;

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
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }
    try {
      // ── SOURCE FIX ──────────────────────────────────────────────────
      // The UI Source column reads lead_source_id. The crm_Lead_Sources
      // records use ids like "linkedin-source", "facebook-source", etc.
      // Map the incoming platform to that id; create the record if it's a
      // new platform (e.g. tiktok) so it never fails.
      const sourceKey = (lead_source || "linkedin").toString().toLowerCase().trim();
      const sourceId = `${sourceKey}-source`; // e.g. "linkedin-source"
      await prismadb.crm_Lead_Sources.upsert({
        where: { id: sourceId },
        update: {},
        create: {
          id: sourceId,
          name: sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1),
        },
      });
      // ────────────────────────────────────────────────────────────────

      // Whichever platform this lead came from, keep the identifier. The
      // outreach check matches on these columns, so a lead saved without one
      // is invisible to deduplication.
      const socialFields: Record<string, string> = {};
      const fit = (value: unknown) => String(value || "").slice(0, 191);

      if (linkedin_url) socialFields.social_linkedin = fit(linkedin_url);
      if (instagram_url) socialFields.social_instagram = fit(instagram_url);
      if (facebook_url) socialFields.social_facebook = fit(facebook_url);
      if (username) socialFields.username = fit(username);
      if (source_platform) socialFields.source_platform = fit(source_platform);

      const createPayload = {
        v: 1,
        firstName,
        lastName,
        company: account,
        jobTitle: job,
        email,
        phone,
        lead_source_id: sourceId, // ← this is what the UI displays
        ...socialFields,
      };
      console.log("[LEAD CREATE DEBUG] Prisma create payload", createPayload);
      const lead = await prismadb.crm_Leads.create({ data: { ...createPayload } });
      console.log("[LEAD CREATE DEBUG] Created lead ID", { id: lead.id });

      return NextResponse.json({ message: "New lead created successfully" });
    } catch (error) {
      console.log(error);
      return NextResponse.json({ message: "Error creating new lead" }, { status: 500 });
    }
  }
}
