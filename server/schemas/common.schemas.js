const { z } = require('zod');

const opaqueIdSchema = z.string().trim().min(1).max(100);
const emptyBodySchema = z.object({}).strict();
const emptyQuerySchema = z.object({}).strict();

function paramsSchema(...names) {
  return z.object(Object.fromEntries(names.map((name) => [name, opaqueIdSchema]))).strict();
}

module.exports = { opaqueIdSchema, emptyBodySchema, emptyQuerySchema, paramsSchema };
