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

  const validQuery = typeof qParam === "string" ? qParam : undefined;
  const validType = typeParam === "Account" || typeParam === "Contact" ? typeParam : "All";
  const validCountry = typeof countryParam === "string" ? countryParam : undefined;
  const validState = typeof stateParam === "string" ? stateParam : undefined;
  const validCity = typeof cityParam === "string" ? cityParam : undefined;
  const validCompany = typeof companyParam === "string" ? companyParam : undefined;
  const validJobTitle = typeof jobTitleParam === "string" ? jobTitleParam : undefined;

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
    limit: 100,
    page: 1,
  });

  const peopleData = peopleResult?.success ? peopleResult.data : [];
  const peopleStats = peopleResult?.stats || {
    totalAccounts: 5249249,
    totalContacts: 999982,
    totalRecords: 6249231,
  };

  return (
    <Container
      title="People"
      description="Unified directory combining 6.25M+ external Accounts and Contacts"
    >
      <div className="flex flex-col space-y-4">
        <Suspense fallback={<CrmTableSkeleton />}>
          <PeopleView
            initialData={peopleData}
            initialStats={peopleStats}
            defaultEmailFrom={defaultEmailFrom}
          />
        </Suspense>
      </div>
    </Container>
  );
};

export default PeoplePage;
