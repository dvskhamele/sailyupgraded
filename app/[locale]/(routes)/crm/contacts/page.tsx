import { Suspense } from "react";

import CrmTableSkeleton from "@/components/skeletons/crm-table-skeleton";

import Container from "../../components/ui/Container";
import ContactsView from "../components/ContactsView";
// import { ContactSearch } from "@/components/crm/ContactSearch";
import { getContacts } from "@/actions/crm/get-contacts";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getTranslations } from "next-intl/server";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const AccountsPage = async ({ searchParams }: Props) => {
  const t = await getTranslations("CrmPage");
  const crmData = await getAllCrmData();
  const contacts = await getContacts();
  const params = await searchParams;
  const roleParam = Array.isArray(params.role) ? params.role[0] : params.role;
  const normalizedRole = roleParam?.toLowerCase();

  const filteredContacts = normalizedRole
    ? contacts.filter((contact: any) => {
        const role = contact.contact_type?.name?.toLowerCase() ?? "";

        if (normalizedRole === "customer") {
          return role === "customer" || role === "client";
        }

        if (normalizedRole === "agent") {
          return role === "agent";
        }

        if (normalizedRole === "vendor") {
          return role === "vendor";
        }

        if (normalizedRole === "others") {
          return !["customer", "client", "agent", "vendor"].includes(role);
        }

        return true;
      })
    : contacts;

  return (
    <Container
      title={t("contacts.pageTitle")}
      description={t("contacts.pageDescription")}
    >
      <div className="flex flex-col space-y-4">
        {/* <ContactSearch crmData={crmData} /> */}
        <Suspense fallback={<CrmTableSkeleton />}>
          <ContactsView crmData={crmData} data={filteredContacts} />
        </Suspense>
      </div>
    </Container>
  );
};

export default AccountsPage;
