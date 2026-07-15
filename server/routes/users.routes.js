const express = require('express');
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
  deleteUserController,
} = require('../controllers/users.controller');

const usersRouter = express.Router();

usersRouter.use(authMiddleware);

usersRouter.post('/', requireRole(['ADMIN']), validateAdminCreateUser, createUserController);
usersRouter.get('/', requireRole(['ADMIN']), listUsersController);
usersRouter.patch('/me/companion', validateCompanionPreference, updateOwnCompanionController);
usersRouter.get('/:id', getUserByIdController);
usersRouter.patch('/:id', validateUserUpdate, updateUserController);
usersRouter.delete('/:id', requireRole(['ADMIN']), deleteUserController);

module.exports = { usersRouter };
