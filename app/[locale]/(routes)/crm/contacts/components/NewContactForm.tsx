"use client";

import { useTranslations } from "next-intl";
import { createContact } from "@/actions/crm/contacts/create-contact";
import { UnifiedPersonForm, type UnifiedPersonFormValues } from "@/components/crm/unified-person-form";

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
  onFinish: () => void;
  initialValues?: Partial<UnifiedPersonFormValues>;
};

export function NewContactForm({
  accounts,
  contactTypes = [],
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  onFinish,
  initialValues,
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
      initialValues={initialValues}
      onSubmitAction={(data) => createContact(data as any)}
      onSuccess={onFinish}
    />
  );
}
