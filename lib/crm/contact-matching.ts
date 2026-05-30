import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";

export async function findOrCreateContact(data: {
  phone?: string;
  email?: string;
  name?: string;
  source?: string;
}) {
  // 1. Match by phone
  if (data.phone) {
    const contactByPhone = await prismadb.crm_Contacts.findFirst({
      where: {
        OR: [
          { phone: data.phone },
          { mobile_phone: data.phone },
          { office_phone: data.phone },
        ],
        deletedAt: null,
      },
    });
    if (contactByPhone) return contactByPhone;
  }

  // 2. Match by email
  if (data.email) {
    const contactByEmail = await prismadb.crm_Contacts.findFirst({
      where: {
        OR: [
          { email: data.email },
          { personal_email: data.email },
        ],
        deletedAt: null,
      },
    });
    if (contactByEmail) return contactByEmail;
  }

  // 3. Match by exact name (if provided)
  if (data.name) {
    const parts = data.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      const contactByName = await prismadb.crm_Contacts.findFirst({
        where: {
          first_name: firstName,
          last_name: lastName,
          deletedAt: null,
        },
      });
      if (contactByName) return contactByName;
    }
  }

  // 4. Create new contact if not found
  const names = data.name?.trim().split(/\s+/) || ["Retail AI", "Lead"];
  const firstName = names.length > 1 ? names[0] : "";
  const lastName = names.length > 1 ? names.slice(1).join(" ") : names[0];

  console.log("[CONTACT CREATE DEBUG] Entry point", {
    path: "lib/crm/contact-matching.ts:findOrCreateContact",
    database: getDatabaseUrlDiagnostics(),
  });
  console.log("[CONTACT CREATE DEBUG] Incoming payload", data);
  console.log("[CONTACT CREATE DEBUG] Prisma create payload", {
    first_name: firstName,
    last_name: lastName,
    email: data.email || null,
    phone: data.phone || null,
    description: `Automatically created from ${data.source || "Retail AI Call"}`,
    role: "Customer",
    status: true,
  });
  console.log("[CONTACT CREATE DEBUG] Executing prismadb.crm_Contacts.create()");
  const contact = await prismadb.crm_Contacts.create({
    data: {
      first_name: firstName,
      last_name: lastName,
      email: data.email || null,
      phone: data.phone || null,
      description: `Automatically created from ${data.source || "Retail AI Call"}`,
      role: "Customer",
      status: true,
    },
  });
  console.log("[CONTACT CREATE DEBUG] Create result", contact);
  console.log("[CONTACT CREATE DEBUG] Created contact ID", { id: contact.id });

  const verificationContact = await prismadb.crm_Contacts.findUnique({
    where: { id: contact.id },
  });
  console.log("[CONTACT CREATE DEBUG] Verification query result", verificationContact);

  return contact;
}
