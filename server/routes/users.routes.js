const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validateUserUpdate, validateAdminCreateUser } = require('../middlewares/validation.middleware');
const {
  createUserController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  deactivateUserController,
} = require('../controllers/users.controller');

const usersRouter = express.Router();

usersRouter.use(authMiddleware);

usersRouter.post('/', requireRole(['ADMIN']), validateAdminCreateUser, createUserController);
usersRouter.get('/', requireRole(['ADMIN']), listUsersController);
usersRouter.get('/:id', getUserByIdController);
usersRouter.patch('/:id', validateUserUpdate, updateUserController);
usersRouter.patch('/:id/deactivate', requireRole(['ADMIN']), deactivateUserController);

module.exports = { usersRouter };
