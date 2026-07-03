const { getAllUsers, findUserById, updateUser, deactivateUser, createUser } = require('../services/users.service');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');

function listUsersController(_req, res, next) {
  try {
    return sendSuccess(res, { users: getAllUsers() }, 'Listado de usuarios.');
  } catch (error) {
    return next(error);
  }
}

function createUserController(req, res, next) {
  try {
    const user = createUser(req.body);
    return sendSuccess(res, { user }, 'Usuario creado correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function getUserByIdController(req, res, next) {
  try {
    const user = findUserById(req.params.id);
    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    if (req.user.role !== 'ADMIN' && req.user.id !== user.id) {
      throw new AppError('No autorizado para ver este usuario.', 403);
    }

    return sendSuccess(res, { user: user }, 'Usuario encontrado.');
  } catch (error) {
    return next(error);
  }
}

function updateUserController(req, res, next) {
  try {
    const canUpdateRole = req.user.role === 'ADMIN';

    if (req.user.role !== 'ADMIN' && req.user.id !== String(req.params.id)) {
      throw new AppError('No autorizado para modificar este usuario.', 403);
    }

    const user = updateUser(req.params.id, req.body, { canUpdateRole });
    return sendSuccess(res, { user }, 'Usuario actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function deactivateUserController(req, res, next) {
  try {
    if (req.user.role !== 'ADMIN') {
      throw new AppError('No autorizado.', 403);
    }

    const user = deactivateUser(req.params.id);
    return sendSuccess(res, { user }, 'Usuario desactivado correctamente.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  deactivateUserController,
};
