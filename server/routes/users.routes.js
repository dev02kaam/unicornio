const express = require('express');
const { validateRequest } = require('../middlewares/schema.middleware');
const { paramsSchema, emptyBodySchema } = require('../schemas/common.schemas');
const { ownProfileBodySchema } = require('../schemas/users.schemas');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const {
  validateUserUpdate,
  validateAdminCreateUser,
  validateCompanionPreference,
} = require('../middlewares/validation.middleware');
const {
  createUserController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  updateOwnCompanionController,
  updateOwnProfileController,
  deleteUserController,
} = require('../controllers/users.controller');

const usersRouter = express.Router();

usersRouter.use(authMiddleware);

usersRouter.post('/', requireRole(['ADMIN']), validateAdminCreateUser, createUserController);
usersRouter.get('/', requireRole(['ADMIN']), listUsersController);
usersRouter.patch('/me/profile', validateRequest({ body: ownProfileBodySchema }), updateOwnProfileController);
usersRouter.patch('/me/companion', validateCompanionPreference, updateOwnCompanionController);
usersRouter.get('/:id', validateRequest({ params: paramsSchema('id') }), getUserByIdController);
usersRouter.patch('/:id', requireRole(['ADMIN']), validateRequest({ params: paramsSchema('id') }), validateUserUpdate, updateUserController);
usersRouter.delete('/:id', requireRole(['ADMIN']), validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), deleteUserController);

module.exports = { usersRouter };
