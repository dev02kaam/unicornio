const {
  listAcademicYears,
  listCentersForUser,
  getCenterDetails,
  createCenter,
  updateCenter,
  deactivateCenter,
  listGroupsForCenter,
  getGroupDetails,
  createGroup,
  updateGroup,
  deactivateGroup,
  assignUserToCenter,
  removeUserFromCenter,
  assignUserToGroup,
  removeUserFromGroup,
  listCenterUsersForRequest,
  listGroupUsersForRequest,
  getAssignmentsForUserRequest,
} = require('../services/organization.service');
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

function createCenterController(req, res, next) {
  try {
    const result = createCenter(req.body, req.user);
    return sendSuccess(res, result, 'Centro y cuenta vinculada creados correctamente.', 201);
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

function updateCenterController(req, res, next) {
  try {
    const center = updateCenter(req.params.centerId, req.body, req.user);
    return sendSuccess(res, { center }, 'Centro actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function deactivateCenterController(req, res, next) {
  try {
    const center = deactivateCenter(req.params.centerId, req.user);
    return sendSuccess(res, { center }, 'Centro desactivado correctamente.');
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

function listCenterUsersController(req, res, next) {
  try {
    const users = listCenterUsersForRequest(req.params.centerId, req.user);
    return sendSuccess(res, { users }, 'Usuarios del centro cargados.');
  } catch (error) {
    return next(error);
  }
}

function createGroupController(req, res, next) {
  try {
    const group = createGroup(req.params.centerId, req.body, req.user);
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

function updateGroupController(req, res, next) {
  try {
    const group = updateGroup(req.params.groupId, req.body, req.user);
    return sendSuccess(res, { group }, 'Grupo actualizado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function deactivateGroupController(req, res, next) {
  try {
    const group = deactivateGroup(req.params.groupId, req.user);
    return sendSuccess(res, { group }, 'Grupo desactivado correctamente.');
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

function assignUserToCenterController(req, res, next) {
  try {
    const result = assignUserToCenter(req.params.centerId, req.params.userId, req.body, req.user);
    return sendSuccess(res, result, 'Usuario asignado al centro correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function removeUserFromCenterController(req, res, next) {
  try {
    const result = removeUserFromCenter(req.params.centerId, req.params.userId, req.user);
    return sendSuccess(res, result, 'Usuario quitado del centro correctamente.');
  } catch (error) {
    return next(error);
  }
}

function assignUserToGroupController(req, res, next) {
  try {
    const result = assignUserToGroup(req.params.groupId, req.params.userId, req.body, req.user);
    return sendSuccess(res, result, 'Usuario asignado al grupo correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function removeUserFromGroupController(req, res, next) {
  try {
    const result = removeUserFromGroup(req.params.groupId, req.params.userId, req.user);
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
  deactivateCenterController,
  listCenterGroupsController,
  listCenterUsersController,
  createGroupController,
  getGroupController,
  updateGroupController,
  deactivateGroupController,
  listGroupUsersController,
  assignUserToCenterController,
  removeUserFromCenterController,
  assignUserToGroupController,
  removeUserFromGroupController,
  getUserAssignmentsController,
};
