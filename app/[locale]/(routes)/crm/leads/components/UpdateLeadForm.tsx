"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { updateLead } from "@/actions/crm/leads/update-lead";
import { getAddressLine1 } from "@/lib/crm-address";
import { UnifiedPersonForm } from "@/components/crm/unified-person-form";

type Option = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

type UpdateLeadFormProps = {
  initialData: any;
  setOpen: (value: boolean) => void;
  accounts: AccountItem[];
  contactTypes?: Option[];
  leadSources: Option[];
  leadStatuses: Option[];
  leadTypes: Option[];
  saleStages?: Option[];
  products?: Option[];
};

export function UpdateLeadForm({
  initialData,
  setOpen,
  accounts,
  contactTypes = [],
  leadSources,
  leadStatuses,
  leadTypes,
  saleStages = [],
  products = [],
}: UpdateLeadFormProps) {
  const t = useTranslations("CrmLeadForm");
  const router = useRouter();

  if (!initialData) {
    return null;
  }

  const initialValues = {
    ...initialData,
    serial: initialData.serial != null ? String(initialData.serial) : "",
    first_name: initialData.first_name ?? initialData.firstName ?? "",
    last_name: initialData.last_name ?? initialData.lastName ?? "",
    company: initialData.company ?? "",
    jobTitle: initialData.jobTitle ?? "",
    description: initialData.description ?? "",
    email: initialData.email ?? "",
    personal_email: initialData.personal_email ?? "",
    phone: initialData.phone ?? "",
    office_phone: initialData.office_phone ?? "",
    mobile_phone: initialData.mobile_phone ?? "",
    website: initialData.website ?? "",
    country: initialData.country ?? "United States",
    address: initialData.address ?? "",
    address_line1: getAddressLine1(initialData.address, initialData.address_line1),
    address_line2: initialData.address_line2 ?? "",
    city: initialData.city ?? "",
    state: initialData.state ?? "",
    postal_code: initialData.postal_code ?? "",
    position: initialData.position ?? "",
    status: initialData.status ?? true,
    role: initialData.role ?? "Customer",
    contact_type_id: initialData.contact_type_id ?? "",
    lead_source_id: initialData.lead_source_id ?? "",
    lead_status_id: initialData.lead_status_id ?? "",
    lead_type_id: initialData.lead_type_id ?? "",
    refered_by: initialData.refered_by ?? "",
    campaign: initialData.campaign ?? "",
    assigned_to: initialData.assigned_to ?? "",
    assigned_account:
      initialData.assigned_account ??
      initialData.accountsIDs ??
      initialData.assigned_accounts?.id ??
      "",
    social_twitter: initialData.social_twitter ?? "",
    social_facebook: initialData.social_facebook ?? "",
    social_linkedin: initialData.social_linkedin ?? "",
    social_skype: initialData.social_skype ?? "",
    social_instagram: initialData.social_instagram ?? "",
    social_youtube: initialData.social_youtube ?? "",
    social_tiktok: initialData.social_tiktok ?? "",
    birthday_year: initialData.birthday ? new Date(initialData.birthday).getFullYear().toString() : "",
    birthday_month: initialData.birthday ? (new Date(initialData.birthday).getMonth() + 1).toString() : "",
    birthday_day: initialData.birthday ? new Date(initialData.birthday).getDate().toString() : "",
  };

  return (
    <UnifiedPersonForm
      mode="update"
      submitButtonLabel={t("updateButton")}
      successMessage={t("updateSuccess")}
      entityType="Lead"
      accounts={accounts}
      contactTypes={contactTypes}
      leadSources={leadSources}
      leadStatuses={leadStatuses}
      leadTypes={leadTypes}
      saleStages={saleStages}
      products={products}
      initialValues={initialValues}
      onSubmitAction={(data) => updateLead(data as any)}
      onSuccess={() => {
        setOpen(false);
        router.refresh();
      }}
    />
  );
}
