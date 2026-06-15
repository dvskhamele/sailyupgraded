import React, { Suspense } from "react";

import TeamsView from "./TeamsView";
import Container from "../../components/ui/Container";
import { getTeams } from "@/actions/crm/teams/get-teams";

const TeamsPage = async () => {
  const teamsResult = await getTeams();
  const teams = teamsResult.data || [];

  return (
    <Container title="Teams" description="Manage your teams">
      <Suspense fallback={<div>Loading...</div>}>
        <TeamsView data={teams} />
      </Suspense>
    </Container>
  );
};

export default TeamsPage;