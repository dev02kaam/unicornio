const { z } = require('zod');

const opaqueIdSchema = z.string().trim().min(1).max(100);
const emptyBodySchema = z.object({}).strict();
const alertIdParamsSchema = z.object({
  alertId: opaqueIdSchema,
}).strict();

const alertTransferBodySchema = z.object({
  targetProfessionalId: z.string().trim().min(1).max(100),
  note: z.string().trim().min(1).max(2000),
}).strict();

const campaignIdParamsSchema = z.object({ campaignId: opaqueIdSchema }).strict();
const participantIdParamsSchema = z.object({ participantId: opaqueIdSchema }).strict();
const attemptIdParamsSchema = z.object({ attemptId: opaqueIdSchema }).strict();
const notificationIdParamsSchema = z.object({ notificationId: opaqueIdSchema }).strict();
const resultParamsSchema = z.object({
  campaignId: opaqueIdSchema,
  studentId: opaqueIdSchema,
}).strict();
const campaignCreateBodySchema = z.object({
  groupId: opaqueIdSchema,
  familyKeys: z.array(opaqueIdSchema).min(1).max(7),
  title: z.string().trim().min(1).max(160).optional(),
  plannedFor: z.string().trim().max(40).refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha no valida.').optional(),
}).strict();
const answerBodySchema = z.object({
  questionNumber: z.number().int().min(1).max(100),
  value: z.enum(['NEVER', 'SOMETIMES', 'OFTEN', 'ALWAYS']),
}).strict();
const alertResolutionBodySchema = z.object({
  note: z.string().trim().min(1).max(2000),
}).strict();

module.exports = {
  opaqueIdSchema,
  emptyBodySchema,
  alertIdParamsSchema,
  alertTransferBodySchema,
  campaignIdParamsSchema,
  participantIdParamsSchema,
  attemptIdParamsSchema,
  notificationIdParamsSchema,
  resultParamsSchema,
  campaignCreateBodySchema,
  answerBodySchema,
  alertResolutionBodySchema,
};
