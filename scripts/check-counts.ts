import { prisma } from "../lib/prisma";

async function main() {
  try {
    const contacts = await prisma.crm_Contacts.count();
    const leads = await prisma.crm_Leads.count();
    const accounts = await prisma.crm_Accounts.count();
    const opportunities = await prisma.crm_Opportunities.count();
    const users = await prisma.users.count();

    console.log({
      contacts,
      leads,
      accounts,
      opportunities,
      users
    });
  } catch (error) {
    console.error("Error checking database:", error);
  }
}

main();
