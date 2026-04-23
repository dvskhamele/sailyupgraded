import { Suspense } from "react";

import CrmTableSkeleton from "@/components/skeletons/crm-table-skeleton";

import Container from "../../components/ui/Container";
import ContactsView from "../components/ContactsView";
// import { ContactSearch } from "@/components/crm/ContactSearch";
import { getContacts } from "@/actions/crm/get-contacts";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getTranslations } from "next-intl/server";

const AccountsPage = async () => {
  const t = await getTranslations("CrmPage");
  const crmData = await getAllCrmData();
  const contacts = await getContacts();
  return (
    <Container
      title={t("contacts.pageTitle")}
      description={t("contacts.pageDescription")}
    >
      <div className="flex flex-col space-y-4">
        {/* <ContactSearch crmData={crmData} /> */}
        <Suspense fallback={<CrmTableSkeleton />}>
          <ContactsView crmData={crmData} data={contacts} />
        </Suspense>
      </div>
    </Container>
  );
};

export default AccountsPage;
