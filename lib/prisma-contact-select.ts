import { cache } from "react";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";

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
  email: true,
  personal_email: true,
  first_name: true,
  last_name: true,
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
  accountsIDs: true,
} as const;

const contactListRelationSelect = {
  contact_type: {
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

export const getCrmContactListSelect = cache(async () => ({
  ...(await getContactScalarListFields()),
  ...contactListRelationSelect,
}));

export const getCrmContactDetailSelect = cache(async () => ({
  ...(await getContactScalarListFields()),
  ...contactDetailRelationSelect,
}));
