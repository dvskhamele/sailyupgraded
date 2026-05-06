"use client";

import { useTranslations } from "next-intl";
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
  onFinish: () => void;
  initialValues?: Partial<UnifiedPersonFormValues>;
  defaultRole?: ContactRole;
};

export function NewContactForm({
  accounts,
  contactTypes = [],
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  onFinish,
  initialValues,
  defaultRole,
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
      initialValues={{
        role: defaultRole,
        ...initialValues,
      }}
      onSubmitAction={async () => undefined}
      offlineSync={{
        entity: "contact",
        operation: "create",
        queuedMessage: "Contact saved offline. It will sync in the next 5-minute cycle.",
      }}
      onSuccess={onFinish}
    />
  );
}
