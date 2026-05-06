"use client";

import { useTranslations } from "next-intl";
import { UnifiedPersonForm } from "@/components/crm/unified-person-form";

type Option = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

type NewLeadFormProps = {
  accounts: AccountItem[];
  contactTypes?: Option[];
  leadSources: Option[];
  leadStatuses: Option[];
  leadTypes: Option[];
  onFinish?: () => void;
};

export function NewLeadForm({
  accounts,
  contactTypes = [],
  leadSources,
  leadStatuses,
  leadTypes,
  onFinish,
}: NewLeadFormProps) {
  const t = useTranslations("CrmLeadForm");

  return (
    <UnifiedPersonForm
      mode="create"
      submitButtonLabel={t("createButton")}
      successMessage={t("createSuccess")}
      submitTestId="lead-submit-btn"
      entityType="Lead"
      accounts={accounts}
      contactTypes={contactTypes}
      leadSources={leadSources}
      leadStatuses={leadStatuses}
      leadTypes={leadTypes}
      onSubmitAction={async () => undefined}
      offlineSync={{
        entity: "lead",
        operation: "create",
        queuedMessage: "Lead saved offline. It will sync in the next 5-minute cycle.",
      }}
      onSuccess={() => onFinish?.()}
    />
  );
}
