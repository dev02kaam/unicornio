const { z } = require('zod');

const invitationCreateBodySchema = z.object({
  email: z.string().trim().max(254).email(),
  role: z.enum(['STUDENT', 'FAMILY']),
  centerId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  studentUserId: z.string().uuid().optional(),
}).strict();

const invitationTokenParamsSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

const invitationAcceptBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128),
}).strict();

module.exports = {
  invitationCreateBodySchema,
  invitationTokenParamsSchema,
  invitationAcceptBodySchema,
};
