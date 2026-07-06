export interface HelpSection {
  title: string;
  description: string;
  useCases?: string[];
  workflow?: string;
  benefits?: string[];
  examples?: string[];
}

export type HelpModule =
  | "opportunities"
  | "accounts"
  | "products"
  | "contacts"
  | "leads"
  | "customers"
  | "agents"
  | "reports"
  | "activities"
  | "retail-ai-activities"
  | "contracts"
  | "campaigns";

export const HELP_CONTENT: Record<HelpModule, HelpSection> = {
  opportunities: {
    title: "Opportunities",
    description: "Track potential sales deals from creation to close.",
    useCases: [
      "Manage pipeline stages for sales deals",
      "Track deal value, close dates, and assigned reps",
      "Link opportunities to accounts, contacts, and campaigns",
      "Add products/line items to opportunities"
    ],
    workflow: "Create an opportunity → Move through sales stages → Close won/lost",
    benefits: ["Clear pipeline visibility", "Improved sales forecasting", "Better deal tracking"]
  },
  accounts: {
    title: "Accounts (Companies)",
    description: "Manage company/organization records in your CRM.",
    useCases: [
      "Store company contact information",
      "Track interactions with companies",
      "Link accounts to contacts, opportunities, and tasks"
    ],
    workflow: "Create account → Add contacts → Manage related deals/activities",
    benefits: ["Centralized company data", "Better relationship tracking"]
  },
  products: {
    title: "Products",
    description: "Manage your product catalog and pricing.",
    useCases: [
      "Create and organize products/services",
      "Set pricing and currency for products",
      "Add products as line items to opportunities and contracts"
    ],
    benefits: ["Consistent product information", "Accurate deal pricing"]
  },
  contacts: {
    title: "Contacts",
    description: "Manage individual people you interact with.",
    useCases: [
      "Store contact details (name, email, phone)",
      "Track interactions and communication history",
      "Link contacts to accounts and opportunities"
    ],
    workflow: "Add contact → Link to account → Track activities",
    benefits: ["Complete contact profiles", "Improved communication tracking"]
  },
  leads: {
    title: "Leads",
    description: "Capture and qualify potential customers before converting to contacts/opportunities.",
    useCases: [
      "Capture incoming leads from various sources",
      "Qualify and score leads",
      "Convert qualified leads to contacts/opportunities"
    ],
    workflow: "Create lead → Qualify → Convert",
    benefits: ["Focus on high-quality leads", "Streamlined conversion process"]
  },
  customers: {
    title: "Customers",
    description: "Manage contacts marked as paying customers.",
    useCases: ["Track customer relationships", "Manage renewals and upsells"]
  },
  agents: {
    title: "Agents (Users)",
    description: "Manage CRM users and team members.",
    useCases: [
      "Assign deals and tasks to team members",
      "Track team performance"
    ]
  },
  reports: {
    title: "Reports & Dashboards",
    description: "Analyze CRM data and track performance metrics.",
    useCases: [
      "View pipeline reports",
      "Track sales performance",
      "Analyze activity trends"
    ]
  },
  activities: {
    title: "Activities",
    description: "Log all interactions with contacts and accounts.",
    useCases: [
      "Track calls, meetings, emails, and notes",
      "Link activities to CRM records",
      "Set reminders for follow-ups"
    ],
    workflow: "Create activity → Link to record → Mark as complete",
    benefits: ["Complete interaction history", "Better follow-up management"]
  },
  "retail-ai-activities": {
    title: "Retail AI Activities",
    description: "Manage AI-powered voice call logs and summaries from Retell AI.",
    useCases: [
      "View AI-generated call summaries",
      "Track sentiment analysis from calls",
      "Review call transcripts and recordings"
    ]
  },
  contracts: {
    title: "Contracts",
    description: "Manage contracts and agreements with customers.",
    useCases: [
      "Store contract documents and details",
      "Track contract status and renewal dates",
      "Link contracts to accounts and opportunities"
    ]
  },
  campaigns: {
    title: "Campaigns",
    description: "Manage marketing campaigns and track their effectiveness.",
    useCases: [
      "Create and organize marketing campaigns",
      "Track campaign performance",
      "Link leads and opportunities to campaigns"
    ]
  }
};
