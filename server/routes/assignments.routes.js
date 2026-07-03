const express = require('express');
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

assignmentsRouter.post('/centers/:centerId/users/:userId', validateAssignmentCreate, assignUserToCenterController);
assignmentsRouter.delete('/centers/:centerId/users/:userId', validateAssignmentDelete, removeUserFromCenterController);
assignmentsRouter.post('/groups/:groupId/users/:userId', validateAssignmentCreate, assignUserToGroupController);
assignmentsRouter.delete('/groups/:groupId/users/:userId', validateAssignmentDelete, removeUserFromGroupController);
assignmentsRouter.get('/users/:userId/assignments', getUserAssignmentsController);

module.exports = { assignmentsRouter };
