const { z } = require('zod');

const ownProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();

module.exports = { ownProfileBodySchema };
