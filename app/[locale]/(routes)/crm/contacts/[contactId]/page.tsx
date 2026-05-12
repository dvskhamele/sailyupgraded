import Container from "@/app/[locale]/(routes)/components/ui/Container";

import { BasicView } from "./components/BasicView";
import { FindSimilarButton } from "@/components/crm/find-similar-button";

import { getContact } from "@/actions/crm/get-contact";
import { getOpportunitiesFullByContactId } from "@/actions/crm/get-opportunities-with-includes-by-contactId";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getDocumentsByContactId } from "@/actions/documents/get-documents-by-contactId";
import { getAccountsByContactId } from "@/actions/crm/get-accounts-by-contactId";
import { getProductsByContactId } from "@/actions/crm/get-products-by-contactId";
import { getActivitiesByEntity } from "@/actions/crm/activities/get-activities-by-entity";

import AccountsView from "../../components/AccountsView";
import OpportunitiesView from "../../components/OpportunitiesView";
import DocumentsView from "../../components/DocumentsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTab } from "./components/HistoryTab";
import { ActivitiesSection } from "./components/ActivitiesSection";
import { ContactProductsSection } from "./components/ContactProductsSection";
import { ContactTimeline } from "./components/ContactTimeline";
import { buildContactTimelineEvents } from "@/lib/crm/timeline-events";
// import { ContactActivitySidebar } from "./components/ContactActivitySidebar";

const ContactViewPage = async (props: any) => {
  const params = await props.params;
  const { contactId } = params;
  const contact = await getContact(contactId);
  const opportunities = await getOpportunitiesFullByContactId(contactId);
  const documents = await getDocumentsByContactId(contactId);
  const accounts = await getAccountsByContactId(contactId);
  const products = await getProductsByContactId(contactId);
  const activities = await getActivitiesByEntity("contact", contactId);
  const crmData = await getAllCrmData();

  //  console.log(accounts, "accounts");

  if (!contact) return <div>Contact not found</div>;
  const timelineEvents = buildContactTimelineEvents({
    contact,
    activities: activities.data,
    products,
  });

  return (
    <Container
      title={`Contact detail view: ${contact?.first_name} ${contact?.last_name}`}
      description={"Everything you need to know about sales potential"}
    >
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relations">Relations</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <BasicView data={contact} />
              <ActivitiesSection contactId={contact.id} initialData={activities} />
              <ContactProductsSection products={products} />
              <FindSimilarButton entityType="contact" recordId={contactId} />
            </div>
            {/* <ContactActivitySidebar
              contactId={contact.id}
              initialContactStatus={Boolean(contact.status)}
              initialEvents={timelineEvents}
            /> */}
          </div>
        </TabsContent>
        <TabsContent value="relations">
          <div className="space-y-5">
            <AccountsView data={accounts} crmData={crmData} />
            <ContactProductsSection products={products} />
            <OpportunitiesView data={opportunities} crmData={crmData} />
            <DocumentsView data={documents} />
          </div>
        </TabsContent>
        <TabsContent value="timeline">
          <ContactTimeline events={timelineEvents} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab contactId={contactId} />
        </TabsContent>
      </Tabs>
    </Container>
  );
};

export default ContactViewPage;
