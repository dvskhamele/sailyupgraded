"use client";

import { useTranslations } from "next-intl";
import { createContact } from "@/actions/crm/contacts/create-contact";
import { UnifiedPersonForm, type UnifiedPersonFormValues } from "@/components/crm/unified-person-form";
import type { ContactRole } from "@/lib/contact-options";

type AccountOption = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

type Option = { id: string; name: string };

type NewContactFormProps = {
  accounts: AccountOption[];
  contactTypes?: Option[];
  leadSources?: Option[];
  leadStatuses?: Option[];
  leadTypes?: Option[];
  saleStages?: Option[];
  products?: Option[];
  onFinish: () => void;
  onCreated?: (contact: unknown, submittedData: UnifiedPersonFormValues) => void | Promise<void>;
  initialValues?: Partial<UnifiedPersonFormValues>;
  defaultRole?: ContactRole;
  hideOpportunitySection?: boolean;
  quickOpportunitySection?: boolean;
  quickEmptyDefaults?: boolean;
};

export function NewContactForm({
  accounts,
  contactTypes = [],
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  saleStages = [],
  products = [],
  onFinish,
  onCreated,
  initialValues,
  defaultRole,
  hideOpportunitySection = false,
  quickOpportunitySection = false,
  quickEmptyDefaults = false,
}: NewContactFormProps) {
  const t = useTranslations("CrmContactForm");

  return (
    <UnifiedPersonForm
      mode="create"
      submitButtonLabel={t("createButton")}
      successMessage={t("createSuccess")}
      submitTestId="contact-submit-btn"
      entityType="Contact"
      accounts={accounts}
      contactTypes={contactTypes}
      leadSources={leadSources}
      leadStatuses={leadStatuses}
      leadTypes={leadTypes}
      saleStages={saleStages}
      products={products}
      hideOpportunitySection={hideOpportunitySection}
      quickOpportunitySection={quickOpportunitySection}
      quickEmptyDefaults={quickEmptyDefaults}
      initialValues={{
        role: defaultRole,
        ...initialValues,
      }}
      onSubmitAction={(data) => createContact(data as any)}
      onSuccess={async (result, submittedData) => {
        onFinish();
        if (result?.data) {
          await onCreated?.(result.data, submittedData as UnifiedPersonFormValues);
        }
      }}
    />
  );
}
