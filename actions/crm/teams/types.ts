import { z } from "zod";

export const CreateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

export const UpdateTeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const DeleteTeamSchema = z.object({
  id: z.string().uuid(),
});

export const RestoreTeamSchema = z.object({
  teamId: z.string().uuid(),
});

export const AssignUserSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
});

export const BulkAssignUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user is required"),
  teamId: z.string().uuid(),
});

export const RemoveUserFromTeamSchema = z.object({
  userId: z.string().uuid(),
});
