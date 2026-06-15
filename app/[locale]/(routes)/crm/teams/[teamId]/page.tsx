import Container from "@/app/[locale]/(routes)/components/ui/Container";
import React from "react";
import { BasicView } from "./components/BasicView";
import { HistoryTab } from "./components/HistoryTab";
import { MembersView } from "./components/MembersView";
import { getTeam } from "@/actions/crm/teams/get-team";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getUsers } from "@/actions/get-users";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamDetailPageProps {
  params: Promise<{
    locale: string;
    teamId: string;
  }>;
}

const TeamDetailPage = async (props: TeamDetailPageProps) => {
  const params = await props.params;
  const { teamId } = params;
  const teamResult = await getTeam(teamId);
  const crmData = await getAllCrmData();
  const allUsers = await getUsers();
  const allTeams = crmData.teams || [];

  if (!teamResult.data) return <div>Team not found</div>;

  return (
    <Container
      title={`Team: ${teamResult.data.name}`}
      description={"Manage your team and its members"}
    >
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="space-y-5">
            <BasicView data={teamResult.data} />
            <MembersView
              teamId={teamId}
              members={teamResult.data.members || []}
              allUsers={allUsers}
              allTeams={allTeams}
            />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab teamId={teamId} />
        </TabsContent>
      </Tabs>
    </Container>
  );
};

export default TeamDetailPage;