import { prismadb } from "../lib/prisma";

async function main() {
  try {
    const contacts = await prismadb.crm_Contacts.count();
    const leads = await prismadb.crm_Leads.count();
    const accounts = await prismadb.crm_Accounts.count();
    const opportunities = await prismadb.crm_Opportunities.count();
    const users = await prismadb.users.count();

    console.log({
      contacts,
      leads,
      accounts,
      opportunities,
      users
    });
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await prismadb.$disconnect();
  }
}

main();
