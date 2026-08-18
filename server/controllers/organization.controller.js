const {
  listAcademicYears,
  listCentersForUser,
  getCenterDetails,
  createCenter,
  updateCenter,
  deleteCenter,
  listGroupsForCenter,
  listGroupsForUser,
  getGroupDetails,
  createGroup,
  updateGroup,
  deleteGroup,
  assignUserToCenter,
  removeUserFromCenter,
  assignUserToGroup,
  removeUserFromGroup,
  listCenterUsersForRequest,
  listGroupUsersForRequest,
  getAssignmentsForUserRequest,
} = require('../services/organization.service');
const { database } = require('../config/database');
const { sendSuccess } = require('../utils/response');

function listAcademicYearsController(_req, res, next) {
  try {
    return sendSuccess(res, { academicYears: listAcademicYears() }, 'Cursos escolares cargados.');
  } catch (error) {
    return next(error);
  }
}

function listCentersController(req, res, next) {
  try {
    return sendSuccess(res, { centers: listCentersForUser(req.user) }, 'Centros cargados.');
  } catch (error) {
    return next(error);
  }
}

async function createCenterController(req, res, next) {
  try {
    const result = await createCenter(req.body, req.user);
    await database.flush();
    return sendSuccess(res, result, 'Centro creado correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function getCenterController(req, res, next) {
  try {
    const center = getCenterDetails(req.params.centerId, req.user);
    return sendSuccess(res, { center }, 'Centro encontrado.');
  } catch (error) {
    return next(error);
  }
}

async function updateCenterController(req, res, next) {
  try {
    const center = updateCenter(req.params.centerId, req.body, req.user);
    await database.flush();
    return sendSuccess(res, { center }, 'Centro actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

async function deleteCenterController(req, res, next) {
  try {
    const center = deleteCenter(req.params.centerId, req.user);
    await database.flush();
    return sendSuccess(res, { center }, 'Centro eliminado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function listCenterGroupsController(req, res, next) {
  try {
    const groups = listGroupsForCenter(req.params.centerId, req.user);
    return sendSuccess(res, { groups }, 'Grupos cargados.');
  } catch (error) {
    return next(error);
  }
}

function listGroupsController(req, res, next) {
  try {
    return sendSuccess(res, { groups: listGroupsForUser(req.user) }, 'Grupos cargados.');
  } catch (error) {
    return next(error);
  }
}

function listCenterUsersController(req, res, next) {
  try {
    const users = listCenterUsersForRequest(req.params.centerId, req.user);
    return sendSuccess(res, { users }, 'Usuarios del centro cargados.');
  } catch (error) {
    return next(error);
  }
}

async function createGroupController(req, res, next) {
  try {
    const group = createGroup(req.params.centerId, req.body, req.user);
    await database.flush();
    return sendSuccess(res, { group }, 'Grupo creado correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function getGroupController(req, res, next) {
  try {
    const group = getGroupDetails(req.params.groupId, req.user);
    return sendSuccess(res, { group }, 'Grupo encontrado.');
  } catch (error) {
    return next(error);
  }
}

async function updateGroupController(req, res, next) {
  try {
    const group = updateGroup(req.params.groupId, req.body, req.user);
    await database.flush();
    return sendSuccess(res, { group }, 'Grupo actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

async function deleteGroupController(req, res, next) {
  try {
    const group = deleteGroup(req.params.groupId, req.user);
    await database.flush();
    return sendSuccess(res, { group }, 'Grupo eliminado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function listGroupUsersController(req, res, next) {
  try {
    const users = listGroupUsersForRequest(req.params.groupId, req.user);
    return sendSuccess(res, { users }, 'Usuarios del grupo cargados.');
  } catch (error) {
    return next(error);
  }
}

async function assignUserToCenterController(req, res, next) {
  try {
    const result = assignUserToCenter(req.params.centerId, req.params.userId, req.body, req.user);
    await database.flush();
    return sendSuccess(res, result, 'Usuario asignado al centro correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

async function removeUserFromCenterController(req, res, next) {
  try {
    const result = removeUserFromCenter(req.params.centerId, req.params.userId, req.user);
    await database.flush();
    return sendSuccess(res, result, 'Usuario quitado del centro correctamente.');
  } catch (error) {
    return next(error);
  }
}

async function assignUserToGroupController(req, res, next) {
  try {
    const result = assignUserToGroup(req.params.groupId, req.params.userId, req.body, req.user);
    await database.flush();
    return sendSuccess(res, result, 'Usuario asignado al grupo correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

async function removeUserFromGroupController(req, res, next) {
  try {
    const result = removeUserFromGroup(req.params.groupId, req.params.userId, req.user);
    await database.flush();
    return sendSuccess(res, result, 'Usuario quitado del grupo correctamente.');
  } catch (error) {
    return next(error);
  }
}

function getUserAssignmentsController(req, res, next) {
  try {
    const result = getAssignmentsForUserRequest(req.params.userId, req.user);
    return sendSuccess(res, result, 'Asignaciones cargadas.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listAcademicYearsController,
  listCentersController,
  createCenterController,
  getCenterController,
  updateCenterController,
  deleteCenterController,
  listCenterGroupsController,
  listGroupsController,
  listCenterUsersController,
  createGroupController,
  getGroupController,
  updateGroupController,
  deleteGroupController,
  listGroupUsersController,
  assignUserToCenterController,
  removeUserFromCenterController,
  assignUserToGroupController,
  removeUserFromGroupController,
  getUserAssignmentsController,
};
