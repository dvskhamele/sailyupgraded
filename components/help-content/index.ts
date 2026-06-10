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
  | "companies" 
  | "products" 
  | "contacts" 
  | "leads" 
  | "customers" 
  | "agents" 
  | "reports" 
  | "activities" 
  | "ai_templates";

export const HELP_CONTENT: Record<HelpModule, HelpSection> = {
  opportunities: {
    title: "What are Opportunities?",
    description: "Opportunities represent potential deals or sales that your team is actively working on.",
    useCases: [
      "Track sales progress",
      "Manage deal stages",
      "Forecast revenue",
      "Assign ownership",
      "Monitor conversions"
    ],
    workflow: "Lead → Contact → Opportunity → Won/Lost",
    benefits: [
      "Better sales tracking",
      "Accurate forecasting",
      "Pipeline visibility"
    ]
  },
  companies: {
    title: "What are Companies?",
    description: "Companies represent businesses or organizations associated with your contacts and opportunities.",
    useCases: [
      "Store company information",
      "Manage business relationships",
      "Associate contacts",
      "Track company interactions"
    ],
    benefits: [
      "Better account management",
      "Organized customer data"
    ]
  },
  products: {
    title: "What are Products?",
    description: "Products represent services or items your business sells.",
    useCases: [
      "Build quotes",
      "Associate products with opportunities",
      "Track sales",
      "Calculate revenue"
    ],
    benefits: [
      "Revenue tracking",
      "Product performance insights"
    ]
  },
  contacts: {
    title: "What are Contacts?",
    description: "Contacts are individual people stored within your CRM.",
    useCases: [
      "Store customer information",
      "Track communications",
      "Associate with companies",
      "Manage relationships"
    ],
    benefits: [
      "Better communication management",
      "Organized customer records"
    ]
  },
  leads: {
    title: "What are Leads?",
    description: "Leads are potential customers who have shown interest in your products or services.",
    useCases: [
      "Capture prospects",
      "Qualify customers",
      "Convert into contacts",
      "Convert into opportunities"
    ],
    workflow: "Lead → Qualified → Contact → Opportunity",
    benefits: [
      "Improved lead management",
      "Better conversion tracking"
    ]
  },
  customers: {
    title: "What are Customers?",
    description: "Customers are individuals or companies that have completed business with your organization.",
    useCases: [
      "Manage relationships",
      "Track customer history",
      "Monitor renewals",
      "Improve retention"
    ],
    benefits: [
      "Stronger customer relationships",
      "Better customer lifecycle management"
    ]
  },
  agents: {
    title: "What are Agents?",
    description: "Agents are users, brokers, representatives, or team members responsible for managing opportunities and customer interactions.",
    useCases: [
      "Assign opportunities",
      "Track performance",
      "Monitor productivity",
      "Manage workloads"
    ],
    benefits: [
      "Better accountability",
      "Performance visibility"
    ]
  },
  reports: {
    title: "What are Reports?",
    description: "Reports provide insights into business performance and sales activities.",
    useCases: [
      "Analyze revenue",
      "Monitor pipeline",
      "Track conversions",
      "Measure team performance"
    ],
    benefits: [
      "Better decision-making",
      "Business visibility",
      "Performance tracking"
    ]
  },
  activities: {
    title: "What are Activities?",
    description: "Activities are actions and interactions performed within the CRM.",
    examples: [
      "Calls",
      "Emails",
      "Meetings",
      "Tasks",
      "Follow-ups"
    ],
    benefits: [
      "Activity tracking",
      "Improved collaboration",
      "Better customer engagement"
    ]
  },
  ai_templates: {
    title: "What are AI Activities Templates?",
    description: "AI Activity Templates help automate repetitive workflows and standardize activity creation.",
    useCases: [
      "Automate follow-ups",
      "Generate activity structures",
      "Improve consistency",
      "Save time"
    ],
    benefits: [
      "Increased productivity",
      "Faster execution",
      "Standardized processes"
    ]
  }
};
