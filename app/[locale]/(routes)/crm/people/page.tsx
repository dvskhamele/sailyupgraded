import { Suspense } from "react";

import Container from "../../components/ui/Container";
import CrmTableSkeleton from "@/components/skeletons/crm-table-skeleton";
import PeopleView from "./components/PeopleView";
import { getUnifiedPeople } from "@/actions/crm/people/get-people";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
} from "@/lib/email/sender-policy";
import { getEmailFromAddress } from "@/lib/env";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PeoplePage = async ({ searchParams }: Props) => {
  const search = await searchParams;
  const qParam = Array.isArray(search.q) ? search.q[0] : search.q || (Array.isArray(search.query) ? search.query[0] : search.query);
  const typeParam = Array.isArray(search.type) ? search.type[0] : search.type;
  const countryParam = Array.isArray(search.country) ? search.country[0] : search.country;
  const stateParam = Array.isArray(search.state) ? search.state[0] : search.state;
  const cityParam = Array.isArray(search.city) ? search.city[0] : search.city;
  const companyParam = Array.isArray(search.company) ? search.company[0] : search.company;
  const jobTitleParam = Array.isArray(search.jobTitle) ? search.jobTitle[0] : search.jobTitle;

  const pageParam = Array.isArray(search.page) ? search.page[0] : search.page;
  const limitParam = Array.isArray(search.limit) ? search.limit[0] : search.limit;
  const statusParam = Array.isArray(search.status) ? search.status[0] : search.status;
  const roleParam = Array.isArray(search.role) ? search.role[0] : search.role;
  const hasEmailParam = Array.isArray(search.hasEmail) ? search.hasEmail[0] : search.hasEmail;
  const hasPhoneParam = Array.isArray(search.hasPhone) ? search.hasPhone[0] : search.hasPhone;
  const hasLinkedinParam = Array.isArray(search.hasLinkedin) ? search.hasLinkedin[0] : search.hasLinkedin;
  const hasCompanyParam = Array.isArray(search.hasCompany) ? search.hasCompany[0] : search.hasCompany;

  const validQuery = typeof qParam === "string" ? qParam : undefined;
  const validType = typeParam === "Account" || typeParam === "Contact" ? typeParam : "All";
  const validCountry = typeof countryParam === "string" ? countryParam : undefined;
  const validState = typeof stateParam === "string" ? stateParam : undefined;
  const validCity = typeof cityParam === "string" ? cityParam : undefined;
  const validCompany = typeof companyParam === "string" ? companyParam : undefined;
  const validJobTitle = typeof jobTitleParam === "string" ? jobTitleParam : undefined;
  const validStatus = typeof statusParam === "string" ? statusParam : undefined;
  const validRole = typeof roleParam === "string" ? roleParam : undefined;
  const validHasEmail = hasEmailParam === "true" ? true : undefined;
  const validHasPhone = hasPhoneParam === "true" ? true : undefined;
  const validHasLinkedin = hasLinkedinParam === "true" ? true : undefined;
  const validHasCompany = hasCompanyParam === "true" ? true : undefined;
  const validPage = Math.max(1, parseInt(typeof pageParam === "string" ? pageParam : "1", 10) || 1);
  const validLimit = Math.max(1, parseInt(typeof limitParam === "string" ? limitParam : "20", 10) || 20);

  const configuredEmailFrom = getEmailFromAddress();
  const defaultEmailFrom = isAllowedSmtp2GoSender(configuredEmailFrom)
    ? configuredEmailFrom
    : DEFAULT_SMTP2GO_SENDER;

  const peopleResult = await getUnifiedPeople({
    query: validQuery,
    type: validType,
    country: validCountry,
    state: validState,
    city: validCity,
    company: validCompany,
    jobTitle: validJobTitle,
    status: validStatus,
    role: validRole,
    hasEmail: validHasEmail,
    hasPhone: validHasPhone,
    hasLinkedin: validHasLinkedin,
    hasCompany: validHasCompany,
    limit: validLimit,
    page: validPage,
  });

  const peopleData = peopleResult?.success ? peopleResult.data : [];
  const peopleTotal = peopleResult?.success ? peopleResult.total : 0;
  const peoplePage = peopleResult?.page || validPage;
  const peopleLimit = peopleResult?.limit || validLimit;
  const peopleTotalPages = peopleResult?.totalPages || Math.max(1, Math.ceil(peopleTotal / peopleLimit));
  const peopleStats = peopleResult?.stats || {
    totalAccounts: 0,
    totalContacts: 0,
    totalRecords: 0,
  };

  return (
    <Container
      title="People"
      description="Unified directory combining Contacts and Accounts across the complete dataset"
    >
      <div className="flex flex-col space-y-4">
        <Suspense fallback={<CrmTableSkeleton />}>
          <PeopleView
            initialData={peopleData}
            initialStats={peopleStats}
            initialTotal={peopleTotal}
            initialPage={peoplePage}
            initialLimit={peopleLimit}
            initialTotalPages={peopleTotalPages}
            defaultEmailFrom={defaultEmailFrom}
          />
        </Suspense>
      </div>
    </Container>
  );
};

export default PeoplePage;
