const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  validateGroupUpdate,
} = require('../middlewares/validation.middleware');
const {
  getGroupController,
  updateGroupController,
  deactivateGroupController,
  listGroupUsersController,
} = require('../controllers/organization.controller');

const groupsRouter = express.Router();

groupsRouter.use(authMiddleware);

groupsRouter.get('/:groupId', getGroupController);
groupsRouter.patch('/:groupId', validateGroupUpdate, updateGroupController);
groupsRouter.delete('/:groupId', deactivateGroupController);
groupsRouter.get('/:groupId/users', listGroupUsersController);

module.exports = { groupsRouter };
