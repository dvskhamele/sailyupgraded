import { Prisma } from "@prisma/client";

type ActivityAssigneeRow = {
  id: string;
  assignedTo: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserAvatar: string | null;
};

type ActivityAssignee = {
  assignedTo: string | null;
  assigned_to_user: { id: string; name: string | null; avatar: string | null } | null;
};

export async function setActivityAssignment(
  prismaClient: any,
  activityId: string,
  assignedTo?: string | null
) {
  await prismaClient.$executeRaw`
    UPDATE crm_Activities
    SET assignedTo = ${assignedTo || null}
    WHERE id = ${activityId}
  `;
}

export async function getActivityAssignees(
  prismaClient: any,
  activityIds: string[]
): Promise<Map<string, ActivityAssignee>> {
  if (activityIds.length === 0) {
    return new Map();
  }

  const rows = await prismaClient.$queryRaw<ActivityAssigneeRow[]>`
    SELECT
      a.id,
      a.assignedTo,
      u.id AS assignedUserId,
      u.name AS assignedUserName,
      u.avatar AS assignedUserAvatar
    FROM crm_Activities a
    LEFT JOIN Users u ON u.id = a.assignedTo
    WHERE a.id IN (${Prisma.join(activityIds)})
  `;

  return new Map(
    rows.map((row: ActivityAssigneeRow) => [
      row.id,
      {
        assignedTo: row.assignedTo,
        assigned_to_user: row.assignedUserId
          ? {
              id: row.assignedUserId,
              name: row.assignedUserName,
              avatar: row.assignedUserAvatar,
            }
          : null,
      },
    ])
  );
}

export async function withActivityAssignee<T extends { id: string }>(
  prismaClient: any,
  activity: T | null
): Promise<(T & ActivityAssignee) | null> {
  if (!activity) {
    return null;
  }

  const assignees = await getActivityAssignees(prismaClient, [activity.id]);
  return {
    ...activity,
    ...(assignees.get(activity.id) ?? {
      assignedTo: null,
      assigned_to_user: null,
    }),
  };
}
