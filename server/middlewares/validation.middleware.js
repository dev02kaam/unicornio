const { z } = require('zod');
const { validateRequest } = require('./schema.middleware');
const { isPastOrTodayDate } = require('../utils/validators');
const {
  CENTER_TYPES,
  ACADEMIC_YEAR_STAGES,
  CENTER_ASSIGNMENT_ROLES,
  GROUP_ASSIGNMENT_ROLES,
  UNICORN_GENDERS,
} = require('../utils/constants');

const id = z.string().trim().min(1).max(100);
const shortText = z.string().trim().min(1).max(120);
const email = z.string().trim().max(254).email().transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isPastOrTodayDate, 'La fecha no es valida.');
const role = z.enum(['ADMIN', 'TEACHER', 'PROFESSIONAL', 'STUDENT', 'FAMILY']);

const registerSchema = z.object({
  name: shortText,
  email,
  password,
  birthDate: dateOnly,
  ageRange: z.string().trim().min(1).max(20).optional(),
}).strict();

const loginSchema = z.object({ email, password }).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).strict();
const companionSchema = z.object({
  unicornGender: z.enum(Object.values(UNICORN_GENDERS)),
}).strict();

const optionalUserFields = {
  name: shortText.optional(),
  email: email.optional(),
  password: password.optional(),
  role: role.optional(),
  schoolId: id.nullable().optional(),
  groupId: id.nullable().optional(),
  linkedStudentId: id.nullable().optional(),
  birthDate: z.union([dateOnly, z.literal(''), z.null()]).optional(),
  ageRange: z.string().trim().max(20).nullable().optional(),
};
const userUpdateSchema = z.object(optionalUserFields).strict()
  .refine((value) => Object.keys(value).length > 0, 'El cuerpo no contiene cambios.');
const adminCreateUserSchema = z.object({
  name: shortText,
  email,
  password,
  role,
  schoolId: id.nullable().optional(),
  groupId: id.nullable().optional(),
  linkedStudentId: id.nullable().optional(),
  birthDate: z.union([dateOnly, z.literal(''), z.null()]).optional(),
  ageRange: z.string().trim().max(20).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (['TEACHER', 'PROFESSIONAL', 'STUDENT'].includes(value.role) && !value.schoolId) {
    context.addIssue({ code: 'custom', path: ['schoolId'], message: 'El centro es obligatorio.' });
  }
  if (value.role === 'FAMILY' && !value.linkedStudentId) {
    context.addIssue({ code: 'custom', path: ['linkedStudentId'], message: 'El alumno vinculado es obligatorio.' });
  }
  if (value.role === 'STUDENT' && !value.birthDate) {
    context.addIssue({ code: 'custom', path: ['birthDate'], message: 'La fecha de nacimiento es obligatoria.' });
  }
  if (value.role === 'FAMILY' && value.schoolId) {
    context.addIssue({ code: 'custom', path: ['schoolId'], message: 'La familia se vincula mediante el alumno.' });
  }
});

const centerFields = {
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40).optional(),
  type: z.enum(Object.values(CENTER_TYPES)).optional(),
  academicYearId: id.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  questionnaireSupportContact: z.string().trim().min(1).max(254).optional(),
};
const centerCreateSchema = z.object({
  ...centerFields,
  userName: shortText.optional(),
  userEmail: email.optional(),
  userPassword: password.optional(),
}).strict().superRefine((value, context) => {
  const linked = [value.userName, value.userEmail, value.userPassword];
  if (linked.some(Boolean) && linked.some((item) => !item)) {
    context.addIssue({ code: 'custom', message: 'La cuenta vinculada requiere nombre, email y contrasena.' });
  }
});
const centerUpdateSchema = z.object({
  ...Object.fromEntries(Object.entries(centerFields).map(([key, schema]) => [key, schema.optional()])),
}).strict().refine((value) => Object.keys(value).length > 0, 'El cuerpo no contiene cambios.');

const groupFields = {
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  stage: z.enum(Object.values(ACADEMIC_YEAR_STAGES)).optional(),
  academicYearId: id.optional(),
  course: z.string().trim().min(1).max(40).optional(),
  shift: z.string().trim().min(1).max(40).optional(),
};
const groupCreateSchema = z.object(groupFields).strict();
const groupUpdateSchema = z.object({
  ...Object.fromEntries(Object.entries(groupFields).map(([key, schema]) => [key, schema.optional()])),
}).strict().refine((value) => Object.keys(value).length > 0, 'El cuerpo no contiene cambios.');

const assignmentRoles = [...new Set([
  ...Object.values(CENTER_ASSIGNMENT_ROLES),
  ...Object.values(GROUP_ASSIGNMENT_ROLES),
])];
const assignmentCreateSchema = z.object({
  role: z.enum(assignmentRoles).optional(),
  isPrimary: z.boolean().optional(),
}).strict();
const emptyBodySchema = z.object({}).strict();
const consentRequestSchema = z.object({
  studentId: id,
  familyUserId: id,
  legalTextVersionId: id,
  centerId: id.optional(),
  campaignId: id.nullable().optional(),
}).strict();
const consentRevokeSchema = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();
const legalTextVersionCreateSchema = z.object({
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(60_000),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const body = (schema) => validateRequest({ body: schema });

module.exports = {
  validateRegister: body(registerSchema),
  validateLogin: body(loginSchema),
  validateChangePassword: body(changePasswordSchema),
  validateCompanionPreference: body(companionSchema),
  validateUserUpdate: body(userUpdateSchema),
  validateAdminCreateUser: body(adminCreateUserSchema),
  validateCenterCreate: body(centerCreateSchema),
  validateCenterUpdate: body(centerUpdateSchema),
  validateGroupCreate: body(groupCreateSchema),
  validateGroupUpdate: body(groupUpdateSchema),
  validateAssignmentCreate: body(assignmentCreateSchema),
  validateAssignmentDelete: body(emptyBodySchema),
  validateConsentRequest: body(consentRequestSchema),
  validateConsentRevoke: body(consentRevokeSchema),
  validateLegalTextVersionCreate: body(legalTextVersionCreateSchema),
  emptyBodySchema,
  idSchema: id,
};
