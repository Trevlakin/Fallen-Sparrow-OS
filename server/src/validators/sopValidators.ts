import { z } from "zod";
import { TEAM_MEMBER_ROLES } from "@fallen-sparrow/shared/constants";

const teamMemberRoleSchema = z.enum(TEAM_MEMBER_ROLES);

export const CreateSopSchema = z.object({
  title: z.string().min(1).max(255),
  roles: z.array(teamMemberRoleSchema).min(1),
  sortOrder: z.number().int().optional(),
});

export const UpdateSopSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  roles: z.array(teamMemberRoleSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const CreateChecklistItemSchema = z.object({
  text: z.string().min(1).max(500),
  sortOrder: z.number().int().optional(),
});

export const UpdateChecklistItemSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const CreateTeamMemberSchema = z.object({
  name: z.string().min(1).max(255),
  role: teamMemberRoleSchema,
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").optional(),
});

export const UpdateTeamMemberSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: teamMemberRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const ChangePinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const PinLoginSchema = z.object({
  teamMemberId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
});

/** Legacy admin SOP editor (Operations-era payload). */
export const LegacySopEditorSchema = z.object({
  title: z.string().min(1),
  role: teamMemberRoleSchema.nullable().optional(),
  frequency: z.string().min(1),
  items: z.array(
    z.object({
      label: z.string().min(1),
      sortOrder: z.number().int().min(0),
    }),
  ).min(1),
});

export const SessionDateSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
