"use client";

import { useTranslations } from "next-intl";
import { createLead } from "@/actions/crm/leads/create-lead";
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
      accounts={accounts}
      contactTypes={contactTypes}
      leadSources={leadSources}
      leadStatuses={leadStatuses}
      leadTypes={leadTypes}
      onSubmitAction={(data) => createLead(data as any)}
      onSuccess={() => onFinish?.()}
    />
  );
}
