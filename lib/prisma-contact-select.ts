import { cache } from "react";
import {
  pickExistingDbModelFields,
  pickSupportedModelFields,
} from "@/lib/prisma-model-fields";

const contactScalarListFieldValues = {
  id: true,
  serial: true,
  account: true,
  assigned_to: true,
  birthday: true,
  created_by: true,
  createdBy: true,
  created_on: true,
  cratedAt: true,
  last_activity: true,
  updatedAt: true,
  updatedBy: true,
  last_activity_by: true,
  description: true,
  company: true,
  jobTitle: true,
  email: true,
  personal_email: true,
  phone: true,
  first_name: true,
  last_name: true,
  visible_to_name: true,
  office_phone: true,
  mobile_phone: true,
  website: true,
  address: true,
  address_line1: true,
  address_line2: true,
  city: true,
  state: true,
  country: true,
  postal_code: true,
  position: true,
  status: true,
  role: true,
  lead_source_id: true,
  lead_status_id: true,
  lead_type_id: true,
  refered_by: true,
  campaign: true,
  social_twitter: true,
  social_facebook: true,
  social_linkedin: true,
  social_skype: true,
  social_instagram: true,
  social_youtube: true,
  social_tiktok: true,
  contact_type_id: true,
  tags: true,
  notes: true,
  custom_fields_data: true,
  accountsIDs: true,
} as const;

const contactListRelationSelect = {
  contact_type: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_source: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_status: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_type: {
    select: {
      id: true,
      name: true,
    },
  },
  assigned_to_user: {
    select: {
      name: true,
    },
  },
  crate_by_user: {
    select: {
      name: true,
    },
  },
  assigned_accounts: {
    select: {
      id: true,
      name: true,
    },
  },
  opportunities: {
    select: {
      opportunity: {
        select: {
          id: true,
          name: true,
          budget: true,
          category: true,
        },
      },
    },
  },
  documents: {
    select: {
      document: {
        select: {
          id: true,
          document_name: true,
        },
      },
    },
  },
} as const;

const contactDetailRelationSelect = {
  contact_type: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_source: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_status: {
    select: {
      id: true,
      name: true,
    },
  },
  lead_type: {
    select: {
      id: true,
      name: true,
    },
  },
  assigned_accounts: {
    select: {
      id: true,
      name: true,
    },
  },
  assigned_to_user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  crate_by_user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  opportunities: {
    select: {
      opportunity: {
        select: {
          id: true,
          name: true,
          sales_stage: true,
          close_date: true,
          budget: true,
          expected_revenue: true,
          category: true,
          currency: true,
          description: true,
        },
      },
    },
  },
  documents: {
    select: {
      document: {
        select: {
          id: true,
          document_name: true,
          document_type: true,
          document_file_url: true,
          document_file_mimeType: true,
          createdAt: true,
          created_by: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  },
} as const;

const getContactScalarListFields = cache(async () =>
  pickExistingDbModelFields("crm_Contacts", contactScalarListFieldValues)
);

const getContactListRelationFields = cache(async () =>
  pickSupportedModelFields("crm_Contacts", contactListRelationSelect)
);

const getContactDetailRelationFields = cache(async () =>
  pickSupportedModelFields("crm_Contacts", contactDetailRelationSelect)
);

export const getCrmContactListSelect = cache(async () => ({
  ...(await getContactScalarListFields()),
  ...(await getContactListRelationFields()),
}));

export const getCrmContactDetailSelect = cache(async () => ({
  ...(await getContactScalarListFields()),
  ...(await getContactDetailRelationFields()),
}));
