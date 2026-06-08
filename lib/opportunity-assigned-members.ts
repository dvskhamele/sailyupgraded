export const ALL_ASSIGNED_MEMBERS_VALUE = "__all_members__";

export type OpportunityAssignedMemberOption = {
  id: string;
  name: string;
};

export type OpportunityWithAssignedMember = {
  assigned_to?: string | null;
  assigned_to_user?: {
    name?: string | null;
  } | null;
};

function normalizeAssignedMemberId(memberId: string | null | undefined) {
  return memberId?.trim() ?? "";
}

export function getAssignedMemberOptions<
  TOpportunity extends OpportunityWithAssignedMember,
>(opportunities: TOpportunity[]): OpportunityAssignedMemberOption[] {
  const membersById = new Map<string, string>();

  for (const opportunity of opportunities) {
    const memberId = normalizeAssignedMemberId(opportunity.assigned_to);

    if (!memberId || membersById.has(memberId)) {
      continue;
    }

    membersById.set(
      memberId,
      opportunity.assigned_to_user?.name?.trim() || memberId,
    );
  }

  return Array.from(membersById.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((firstMember, secondMember) =>
      firstMember.name.localeCompare(secondMember.name),
    );
}

export function filterOpportunitiesByAssignedMember<
  TOpportunity extends OpportunityWithAssignedMember,
>(opportunities: TOpportunity[], selectedMemberId: string): TOpportunity[] {
  if (selectedMemberId === ALL_ASSIGNED_MEMBERS_VALUE) {
    return opportunities;
  }

  return opportunities.filter(
    (opportunity) =>
      normalizeAssignedMemberId(opportunity.assigned_to) === selectedMemberId,
  );
}
