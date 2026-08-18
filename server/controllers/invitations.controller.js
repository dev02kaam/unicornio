const { issueInvitation, acceptInvitation } = require('../services/invitations.service');
const { sendSuccess } = require('../utils/response');

async function createInvitationController(req, res, next) {
  try {
    const result = await issueInvitation(req.body, { internalId: req.auth.sub, role: req.user.role });
    return sendSuccess(res, result, 'Invitacion creada.', 201);
  } catch (error) {
    return next(error);
  }
}

async function acceptInvitationController(req, res, next) {
  try {
    const user = await acceptInvitation(req.params.token, req.body);
    return sendSuccess(res, { user }, 'Invitacion aceptada.', 201);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createInvitationController, acceptInvitationController };
