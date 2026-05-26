"use client";

import { useTranslations } from "next-intl";
import { UnifiedPersonForm, type UnifiedPersonFormValues } from "@/components/crm/unified-person-form";
import { localLeadRepository, type LocalLeadEntity } from "@/lib/offline-first/storage";

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
  saleStages?: Option[];
  products?: Option[];
  onFinish?: () => void;
};

function findName(options: Option[], id?: string | null) {
  return options.find((option) => option.id === id)?.name;
}

export function NewLeadForm({
  accounts,
  contactTypes = [],
  leadSources,
  leadStatuses,
  leadTypes,
  saleStages = [],
  products = [],
  onFinish,
}: NewLeadFormProps) {
  const t = useTranslations("CrmLeadForm");

  const createLocalLead = async (data: UnifiedPersonFormValues) => {
    const lead = await localLeadRepository.create({
      ...data,
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lead_source: data.lead_source_id
        ? { name: findName(leadSources, data.lead_source_id) }
        : null,
      lead_status: data.lead_status_id
        ? { name: findName(leadStatuses, data.lead_status_id) }
        : null,
      lead_type: data.lead_type_id
        ? { name: findName(leadTypes, data.lead_type_id) }
        : null,
      contact_type: data.contact_type_id
        ? { name: findName(contactTypes, data.contact_type_id) }
        : null,
    } as Omit<LocalLeadEntity, "id" | "created_at" | "updated_at" | "sync_status">);

    return { data: lead };
  };

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
      saleStages={saleStages}
      products={products}
      onSubmitAction={createLocalLead}
      onSuccess={() => onFinish?.()}
    />
  );
}
