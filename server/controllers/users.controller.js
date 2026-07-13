const { getAllUsers, findUserById, updateUser, deleteUser, createUser } = require('../services/users.service');
const { database } = require('../config/database');
const { sanitizeUser } = require('../models/user.model');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');

function listUsersController(_req, res, next) {
  try {
    return sendSuccess(res, { users: getAllUsers() }, 'Listado de usuarios.');
  } catch (error) {
    return next(error);
  }
}

async function createUserController(req, res, next) {
  try {
    const user = createUser(req.body);
    await database.flush();
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

    return sendSuccess(res, { user: sanitizeUser(user) }, 'Usuario encontrado.');
  } catch (error) {
    return next(error);
  }
}

async function updateUserController(req, res, next) {
  try {
    const canUpdateRole = req.user.role === 'ADMIN';

    if (req.user.role !== 'ADMIN' && req.user.id !== String(req.params.id)) {
      throw new AppError('No autorizado para modificar este usuario.', 403);
    }

    const user = updateUser(req.params.id, req.body, { canUpdateRole });
    await database.flush();
    return sendSuccess(res, { user }, 'Usuario actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

async function deleteUserController(req, res, next) {
  try {
    if (req.user.role !== 'ADMIN') {
      throw new AppError('No autorizado.', 403);
    }

    const user = deleteUser(req.params.id);
    await database.flush();
    return sendSuccess(res, { user }, 'Usuario eliminado correctamente.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  deleteUserController,
};
