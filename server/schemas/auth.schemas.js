const { z } = require('zod');

const email = z.string().trim().min(3).max(254).email().transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe usar el formato AAAA-MM-DD.');

const loginBodySchema = z.object({
  email,
  password,
  mfaCode: z.string().regex(/^\d{6}$/).optional(),
}).strict();

const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password,
  birthDate: dateOnly,
  ageRange: z.string().trim().min(1).max(20).optional(),
}).strict();

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).strict();

const oidcCallbackSchema = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(20).max(1024).optional(),
  iss: z.string().url().max(2048).optional(),
  error: z.string().min(1).max(200).optional(),
  error_description: z.string().max(1000).optional(),
  error_uri: z.string().url().max(2048).optional(),
  session_state: z.string().max(1024).optional(),
}).strict();

module.exports = {
  loginBodySchema,
  registerBodySchema,
  changePasswordBodySchema,
  oidcCallbackSchema,
};
