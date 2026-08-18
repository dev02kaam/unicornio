const express = require('express');
const { validateRequest } = require('../middlewares/schema.middleware');
const { paramsSchema, emptyBodySchema } = require('../schemas/common.schemas');
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  validateGroupUpdate,
} = require('../middlewares/validation.middleware');
const {
  getGroupController,
  listGroupsController,
  updateGroupController,
  deleteGroupController,
  listGroupUsersController,
} = require('../controllers/organization.controller');

const groupsRouter = express.Router();

groupsRouter.use(authMiddleware);

groupsRouter.get('/', listGroupsController);
groupsRouter.get('/:groupId', validateRequest({ params: paramsSchema('groupId') }), getGroupController);
groupsRouter.patch('/:groupId', validateRequest({ params: paramsSchema('groupId') }), validateGroupUpdate, updateGroupController);
groupsRouter.delete('/:groupId', validateRequest({ params: paramsSchema('groupId'), body: emptyBodySchema }), deleteGroupController);
groupsRouter.get('/:groupId/users', validateRequest({ params: paramsSchema('groupId') }), listGroupUsersController);

module.exports = { groupsRouter };
