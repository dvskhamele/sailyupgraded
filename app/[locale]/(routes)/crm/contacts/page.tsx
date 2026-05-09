import { Suspense } from "react";

import CrmTableSkeleton from "@/components/skeletons/crm-table-skeleton";

import Container from "../../components/ui/Container";
import ContactsView from "../components/ContactsView";
// import { ContactSearch } from "@/components/crm/ContactSearch";
import { getContacts } from "@/actions/crm/get-contacts";
import { getTranslations } from "next-intl/server";
import { getContactRoleView } from "@/lib/contact-options";
import { getContactFormOptionsData } from "@/lib/crm/contact-form-options";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const AccountsPage = async ({ searchParams }: Props) => {
  const t = await getTranslations("CrmPage");
  const search = await searchParams;
  const roleParam = Array.isArray(search.role) ? search.role[0] : search.role;
  const roleView = getContactRoleView(roleParam);
  const crmData = await getContactFormOptionsData();
  const contacts = await getContacts(roleParam);

  return (
    <Container
      title={roleView.pageTitle}
      description={t("contacts.pageDescription")}
    >
      <div className="flex flex-col space-y-4">
        {/* <ContactSearch crmData={crmData} /> */}
        <Suspense fallback={<CrmTableSkeleton />}>
          <ContactsView
            crmData={crmData}
            data={contacts}
            activeRole={roleParam}
          />
        </Suspense>
      </div>
    </Container>
  );
};

export default AccountsPage;
