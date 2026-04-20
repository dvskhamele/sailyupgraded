"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  score: number;
  matchType: "keyword" | "semantic" | "both";
}

export interface UnifiedSearchResults {
  accounts: SearchResult[];
  contacts: SearchResult[];
  leads: SearchResult[];
  opportunities: SearchResult[];
  campaigns: SearchResult[];
  templates: SearchResult[];
  projects: SearchResult[];
  tasks: SearchResult[];
  users: SearchResult[];
  documents: SearchResult[];
}

type SearchDateRange = {
  start: Date;
  end: Date;
};

function parseSearchDateRange(query: string): SearchDateRange | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);

  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function mergeResults(
  keywordIds: Set<string>,
  allRecords: { id: string; title: string; subtitle: string; url: string }[]
): SearchResult[] {
  const results: SearchResult[] = allRecords.map((r) => {
    const inKeyword = keywordIds.has(r.id);
    return { ...r, score: inKeyword ? 1 : 0, matchType: "keyword" };
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

export async function unifiedSearch(
  query: string,
  locale: string = "en"
): Promise<UnifiedSearchResults | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!query || query.trim().length < 2)
    return { error: "Query must be at least 2 characters" };

  const searchDateRange = parseSearchDateRange(query);

  try {
    const [
      kwAccounts,
      kwContacts,
      kwLeads,
      kwOpportunities,
      kwCampaigns,
      kwTemplates,
      kwProjects,
      kwTasks,
      kwUsers,
      kwDocuments,
    ] = await Promise.all([
      prismadb.crm_Accounts.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { email: { contains: query } },
            { website: { contains: query } },
            { office_phone: { contains: query } },
            ...(searchDateRange
              ? [
                  { createdAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, name: true, email: true },
      }),
      prismadb.crm_Contacts.findMany({
        where: {
          deletedAt: null,
          OR: [
            { first_name: { contains: query } },
            { last_name: { contains: query } },
            { email: { contains: query } },
            { personal_email: { contains: query } },
            { office_phone: { contains: query } },
            { mobile_phone: { contains: query } },
            { website: { contains: query } },
            { position: { contains: query } },
            { description: { contains: query } },
            ...(searchDateRange
              ? [
                  { created_on: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, first_name: true, last_name: true, email: true },
      }),
      prismadb.crm_Leads.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { company: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { jobTitle: { contains: query } },
            { description: { contains: query } },
            ...(searchDateRange
              ? [
                  { createdAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, firstName: true, lastName: true, company: true, email: true },
      }),
      prismadb.crm_Opportunities.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { next_step: { contains: query } },
          ],
          ...(searchDateRange
            ? {
                OR: [
                  { name: { contains: query } },
                  { description: { contains: query } },
                  { next_step: { contains: query } },
                  { close_date: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { created_on: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ],
              }
            : {}),
        },
        take: 10,
        select: { id: true, name: true, status: true, close_date: true },
      }),
      prismadb.crm_campaigns.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { from_name: { contains: query } },
            { reply_to: { contains: query } },
            ...(searchDateRange
              ? [
                  { created_on: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, name: true, status: true, description: true },
      }),
      prismadb.crm_campaign_templates.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { subject_default: { contains: query } },
            { content_html: { contains: query } },
            ...(searchDateRange
              ? [
                  { created_on: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, name: true, subject_default: true },
      }),
      prismadb.boards.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            ...(searchDateRange
              ? [{ createdAt: { gte: searchDateRange.start, lte: searchDateRange.end } }]
              : []),
          ],
        },
        take: 10,
        select: { id: true, title: true, description: true },
      }),
      prismadb.tasks.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
            ...(searchDateRange
              ? [
                  { createdAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { updatedAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, title: true, taskStatus: true },
      }),
      prismadb.users.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
            { username: { contains: query } },
            ...(searchDateRange
              ? [
                  { created_on: { gte: searchDateRange.start, lte: searchDateRange.end } },
                  { lastLoginAt: { gte: searchDateRange.start, lte: searchDateRange.end } },
                ]
              : []),
          ],
        },
        take: 10,
        select: { id: true, name: true, email: true },
      }),
      prismadb.documents.findMany({
        where: {
          parent_document_id: null,
          OR: [
            { document_name: { contains: query } },
            { summary: { contains: query } },
            { description: { contains: query } },
            ...(searchDateRange
              ? [{ createdAt: { gte: searchDateRange.start, lte: searchDateRange.end } }]
              : []),
          ],
        },
        take: 10,
        select: {
          id: true,
          document_name: true,
          summary: true,
          document_system_type: true,
          accounts: { select: { account: { select: { name: true } } }, take: 1 },
        },
      }),
    ]);

    const kwAccountIds = new Set(kwAccounts.map((r) => r.id));
    const kwContactIds = new Set(kwContacts.map((r) => r.id));
    const kwLeadIds = new Set(kwLeads.map((r) => r.id));
    const kwOpportunityIds = new Set(kwOpportunities.map((r) => r.id));

    const accounts = mergeResults(
      kwAccountIds,
      kwAccounts.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: r.email ?? "",
        url: `/${locale}/crm/accounts/${r.id}`,
      }))
    );

    const contacts = mergeResults(
      kwContactIds,
      kwContacts.map((r) => ({
        id: r.id,
        title: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        subtitle: r.email ?? "",
        url: `/${locale}/crm/contacts/${r.id}`,
      }))
    );

    const leads = mergeResults(
      kwLeadIds,
      kwLeads.map((r) => ({
        id: r.id,
        title:
          r.firstName || r.lastName
            ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()
            : (r.company ?? "Unknown Lead"),
        subtitle: r.email ?? r.company ?? "",
        url: `/${locale}/crm/leads/${r.id}`,
      }))
    );

    const opportunities = mergeResults(
      kwOpportunityIds,
      kwOpportunities.map((r) => ({
        id: r.id,
        title: r.name ?? "",
        subtitle: [r.status ?? "", r.close_date ? `Close: ${new Date(r.close_date).toLocaleDateString("en-GB")}` : ""]
          .filter(Boolean)
          .join(" · "),
        url: `/${locale}/crm/opportunities/${r.id}`,
      }))
    );

    const campaigns: SearchResult[] = kwCampaigns.map((r) => ({
      id: r.id,
      title: r.name ?? "",
      subtitle: r.description ?? r.status ?? "",
      url: `/${locale}/campaigns/${r.id}`,
      score: 0.5,
      matchType: "keyword",
    }));

    const templates: SearchResult[] = kwTemplates.map((r) => ({
      id: r.id,
      title: r.name ?? "",
      subtitle: r.subject_default ?? "",
      url: `/${locale}/campaigns/templates/${r.id}`,
      score: 0.5,
      matchType: "keyword",
    }));

    const projects: SearchResult[] = kwProjects.map((r) => ({
      id: r.id,
      title: r.title ?? "",
      subtitle: r.description ? r.description.slice(0, 80) : "",
      url: `/${locale}/projects/${r.id}`,
      score: 0.5,
      matchType: "keyword",
    }));

    const tasks: SearchResult[] = kwTasks.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.taskStatus ?? "",
      url: `/${locale}/tasks/${r.id}`,
      score: 0.5,
      matchType: "keyword",
    }));

    const users: SearchResult[] = kwUsers.map((r) => ({
      id: r.id,
      title: r.name ?? r.email ?? "Unknown User",
      subtitle: r.email ?? "",
      url: `/${locale}/admin/users`,
      score: 0.5,
      matchType: "keyword",
    }));

    const kwDocumentIds = new Set(kwDocuments.map((r) => r.id));

    const documents = mergeResults(
      kwDocumentIds,
      (kwDocuments as any[]).map((r) => ({
        id: r.id,
        title: r.document_name,
        subtitle: r.summary ?? r.accounts?.[0]?.account?.name ?? "",
        url: `/${locale}/documents?highlight=${r.id}`,
      }))
    );

    return {
      accounts,
      contacts,
      leads,
      opportunities,
      campaigns,
      templates,
      projects,
      tasks,
      users,
      documents,
    };
  } catch (error) {
    console.error("[UNIFIED_SEARCH]", error);
    return { error: "Search failed" };
  }
}
