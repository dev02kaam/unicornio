const express = require('express');
const { validateRequest } = require('../middlewares/schema.middleware');
const { paramsSchema } = require('../schemas/common.schemas');
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  validateAssignmentCreate,
  validateAssignmentDelete,
} = require('../middlewares/validation.middleware');
const {
  assignUserToCenterController,
  removeUserFromCenterController,
  assignUserToGroupController,
  removeUserFromGroupController,
  getUserAssignmentsController,
} = require('../controllers/organization.controller');

const assignmentsRouter = express.Router();

assignmentsRouter.use(authMiddleware);

assignmentsRouter.post('/centers/:centerId/users/:userId', validateRequest({ params: paramsSchema('centerId', 'userId') }), validateAssignmentCreate, assignUserToCenterController);
assignmentsRouter.delete('/centers/:centerId/users/:userId', validateRequest({ params: paramsSchema('centerId', 'userId') }), validateAssignmentDelete, removeUserFromCenterController);
assignmentsRouter.post('/groups/:groupId/users/:userId', validateRequest({ params: paramsSchema('groupId', 'userId') }), validateAssignmentCreate, assignUserToGroupController);
assignmentsRouter.delete('/groups/:groupId/users/:userId', validateRequest({ params: paramsSchema('groupId', 'userId') }), validateAssignmentDelete, removeUserFromGroupController);
assignmentsRouter.get('/users/:userId/assignments', validateRequest({ params: paramsSchema('userId') }), getUserAssignmentsController);

module.exports = { assignmentsRouter };
