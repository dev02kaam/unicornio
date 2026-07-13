const { getDeletionImpact } = require('../services/deletion-impact.service');
const { sendSuccess } = require('../utils/response');

function getDeletionImpactController(req, res, next) {
  try {
    const impact = getDeletionImpact(req.params.resourceType, req.params.resourceId, req.user, req.query.relatedId || null);
    return sendSuccess(res, { impact }, 'Impacto de la eliminación calculado.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDeletionImpactController };
