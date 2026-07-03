const { AppError } = require('../utils/errors');
const { database } = require('../config/database');
const { sanitizeUser } = require('../models/user.model');
const { createCenterModel } = require('../models/center.model');
const { createGroupModel } = require('../models/group.model');
const { createAcademicYearModel } = require('../models/academicYear.model');
const {
  createCenterAssignmentModel,
  createGroupAssignmentModel,
} = require('../models/assignment.model');
const { findUserById } = require('./users.service');
const {
  CENTER_TYPES,
  ACADEMIC_YEAR_STAGES,
  CENTER_ASSIGNMENT_ROLES,
  GROUP_ASSIGNMENT_ROLES,
} = require('../utils/constants');
const {
  isAdmin,
  findAcademicYearById,
  findCenterById,
  findGroupById,
  getCenterGroups,
  getCenterUsers,
  getGroupUsers,
  getUserAssignments,
  getUserCenterAssignments,
  getUserGroupAssignments,
  canManageCenter,
  canManageGroup,
  hasCenterAccess,
  hasGroupAccess,
  syncUserPlacementFromAssignments,
} = require('../utils/organization.helpers');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function normalizeEnumValue(value, allowedValues, label, fallback = null) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!allowedValues.includes(normalized)) {
    throw new AppError(`El ${label} no es valido.`, 400);
  }

  return normalized;
}

function getCurrentAcademicYear() {
  const academicYears = database.getCollection('academicYears') || [];
  return academicYears.find((year) => year.isActive && year.isCurrent) || academicYears.find((year) => year.isActive) || null;
}

function assertUserExists(userId) {
  const user = findUserById(userId);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }
  if (!user.isActive) {
    throw new AppError('El usuario esta desactivado.', 400);
  }
  return user;
}

function assertCenterExists(centerId) {
  const center = findCenterById(centerId);
  if (!center) {
    throw new AppError('Centro no encontrado.', 404);
  }
  return center;
}

function assertGroupExists(groupId) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new AppError('Grupo no encontrado.', 404);
  }
  return group;
}

function assertAcademicYearExists(academicYearId) {
  if (!academicYearId) {
    return null;
  }

  const academicYear = findAcademicYearById(academicYearId);
  if (!academicYear) {
    throw new AppError('Curso escolar no encontrado.', 404);
  }
  return academicYear;
}

function buildAcademicYearSummary(academicYear) {
  if (!academicYear) {
    return null;
  }

  return createAcademicYearModel(academicYear);
}

function buildCenterSummary(center) {
  const groups = getCenterGroups(center.id).filter((group) => group.isActive);
  const users = getCenterUsers(center.id);

  return {
    ...center,
    academicYear: buildAcademicYearSummary(findAcademicYearById(center.academicYearId)),
    groupsCount: groups.length,
    usersCount: users.length,
  };
}

function buildGroupSummary(group) {
  const users = getGroupUsers(group.id);

  return {
    ...group,
    academicYear: buildAcademicYearSummary(findAcademicYearById(group.academicYearId)),
    center: findCenterById(group.centerId),
    usersCount: users.length,
  };
}

function listAcademicYears() {
  return (database.getCollection('academicYears') || []).map((academicYear) => buildAcademicYearSummary(academicYear));
}

function createAcademicYear(data) {
  const label = normalizeText(data.label);
  const startDate = normalizeText(data.startDate);
  const endDate = normalizeText(data.endDate);
  const stage = normalizeEnumValue(data.stage, Object.values(ACADEMIC_YEAR_STAGES), 'etapa educativa', null);

  if (!label) {
    throw new AppError('La etiqueta del curso escolar es obligatoria.', 400);
  }
  if (!startDate || !endDate) {
    throw new AppError('Las fechas del curso escolar son obligatorias.', 400);
  }

  const now = new Date().toISOString();
  const academicYears = database.getCollection('academicYears') || [];
  const academicYear = createAcademicYearModel({
    id: database.nextId('academicYears', 'academic-year'),
    label,
    startDate,
    endDate,
    stage,
    isCurrent: Boolean(data.isCurrent),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  academicYears.push(academicYear);
  database.setCollection('academicYears', academicYears);

  return buildAcademicYearSummary(academicYear);
}

function listCentersForUser(user) {
  const centers = database.getCollection('centers') || [];

  if (isAdmin(user)) {
    return centers.map(buildCenterSummary);
  }

  const centerIds = new Set(getUserCenterAssignments(user.id).map((assignment) => assignment.centerId));
  return centers.filter((center) => centerIds.has(center.id) && center.isActive).map(buildCenterSummary);
}

function getCenterDetails(centerId, user = null) {
  const center = assertCenterExists(centerId);

  if (user && !hasCenterAccess(user, center.id)) {
    throw new AppError('No autorizado para ver este centro.', 403);
  }

  return buildCenterSummary(center);
}

function createCenter(data, user) {
  if (!isAdmin(user)) {
    throw new AppError('No autorizado para crear centros.', 403);
  }

  const name = normalizeText(data.name);
  const code = normalizeOptionalText(data.code);
  const type = normalizeEnumValue(data.type, Object.values(CENTER_TYPES), 'tipo de centro', null);
  const academicYearId = normalizeOptionalText(data.academicYearId) || getCurrentAcademicYear()?.id || null;
  const city = normalizeOptionalText(data.city);

  if (!name) {
    throw new AppError('El nombre del centro es obligatorio.', 400);
  }

  assertAcademicYearExists(academicYearId);

  const now = new Date().toISOString();
  const centers = database.getCollection('centers') || [];
  const center = createCenterModel({
    id: database.nextId('centers', 'center'),
    name,
    code: code ? code.toUpperCase() : null,
    type,
    academicYearId,
    city,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  centers.push(center);
  database.setCollection('centers', centers);

  return buildCenterSummary(center);
}

function updateCenter(centerId, data, user) {
  const center = assertCenterExists(centerId);

  if (!isAdmin(user)) {
    throw new AppError('No autorizado para modificar centros.', 403);
  }

  if (data.name !== undefined) {
    const name = normalizeText(data.name);
    if (!name) {
      throw new AppError('El nombre del centro no puede estar vacio.', 400);
    }
    center.name = name;
  }

  if (data.code !== undefined) {
    const code = normalizeOptionalText(data.code);
    center.code = code ? code.toUpperCase() : null;
  }

  if (data.type !== undefined) {
    center.type = normalizeEnumValue(data.type, Object.values(CENTER_TYPES), 'tipo de centro', null);
  }

  if (data.academicYearId !== undefined) {
    const academicYearId = normalizeOptionalText(data.academicYearId);
    assertAcademicYearExists(academicYearId);
    center.academicYearId = academicYearId;
  }

  if (data.city !== undefined) {
    center.city = normalizeOptionalText(data.city);
  }

  center.updatedAt = new Date().toISOString();
  return buildCenterSummary(center);
}

function deactivateCenter(centerId, user) {
  const center = assertCenterExists(centerId);

  if (!isAdmin(user)) {
    throw new AppError('No autorizado para desactivar centros.', 403);
  }

  center.isActive = false;
  center.updatedAt = new Date().toISOString();

  const groups = database.getCollection('groups') || [];
  const groupIds = new Set(groups.filter((group) => group.centerId === center.id).map((group) => group.id));
  groups.forEach((group) => {
    if (group.centerId === center.id) {
      group.isActive = false;
      group.updatedAt = center.updatedAt;
    }
  });
  database.setCollection('groups', groups);

  const centerAssignments = database.getCollection('userCenterAssignments') || [];
  const affectedUserIds = new Set();
  centerAssignments.forEach((assignment) => {
    if (assignment.centerId === center.id) {
      assignment.isActive = false;
      assignment.updatedAt = center.updatedAt;
      affectedUserIds.add(assignment.userId);
    }
  });
  database.setCollection('userCenterAssignments', centerAssignments);

  const groupAssignments = database.getCollection('userGroupAssignments') || [];
  groupAssignments.forEach((assignment) => {
    const group = groups.find((item) => item.id === assignment.groupId);
    if (group && groupIds.has(group.id)) {
      assignment.isActive = false;
      assignment.updatedAt = center.updatedAt;
      affectedUserIds.add(assignment.userId);
    }
  });
  database.setCollection('userGroupAssignments', groupAssignments);

  affectedUserIds.forEach((userId) => syncUserPlacementFromAssignments(userId));

  return buildCenterSummary(center);
}

function listGroupsForCenter(centerId, user) {
  const center = assertCenterExists(centerId);
  if (!hasCenterAccess(user, center.id)) {
    throw new AppError('No autorizado para ver los grupos de este centro.', 403);
  }

  return getCenterGroups(center.id)
    .filter((group) => group.isActive)
    .map(buildGroupSummary);
}

function getGroupDetails(groupId, user = null) {
  const group = assertGroupExists(groupId);
  if (user && !hasGroupAccess(user, group.id)) {
    throw new AppError('No autorizado para ver este grupo.', 403);
  }

  return buildGroupSummary(group);
}

function createGroup(centerId, data, user) {
  const center = assertCenterExists(centerId);
  if (!canManageCenter(user, center.id) && !isAdmin(user)) {
    throw new AppError('No autorizado para crear grupos en este centro.', 403);
  }

  const name = normalizeText(data.name);
  const code = normalizeOptionalText(data.code);
  const stage = normalizeEnumValue(data.stage, Object.values(ACADEMIC_YEAR_STAGES), 'etapa educativa', null);
  const academicYearId = normalizeOptionalText(data.academicYearId) || center.academicYearId || getCurrentAcademicYear()?.id || null;
  const course = normalizeOptionalText(data.course);
  const shift = normalizeOptionalText(data.shift);

  if (!name) {
    throw new AppError('El nombre del grupo es obligatorio.', 400);
  }

  assertAcademicYearExists(academicYearId);

  const now = new Date().toISOString();
  const groups = database.getCollection('groups') || [];
  const group = createGroupModel({
    id: database.nextId('groups', 'group'),
    centerId: center.id,
    academicYearId,
    name,
    code: code ? code.toUpperCase() : null,
    stage,
    course,
    shift,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  groups.push(group);
  database.setCollection('groups', groups);

  return buildGroupSummary(group);
}

function updateGroup(groupId, data, user) {
  const group = assertGroupExists(groupId);
  if (!canManageGroup(user, group.id) && !isAdmin(user)) {
    throw new AppError('No autorizado para modificar este grupo.', 403);
  }

  if (data.name !== undefined) {
    const name = normalizeText(data.name);
    if (!name) {
      throw new AppError('El nombre del grupo no puede estar vacio.', 400);
    }
    group.name = name;
  }

  if (data.code !== undefined) {
    const code = normalizeOptionalText(data.code);
    group.code = code ? code.toUpperCase() : null;
  }

  if (data.stage !== undefined) {
    group.stage = normalizeEnumValue(data.stage, Object.values(ACADEMIC_YEAR_STAGES), 'etapa educativa', null);
  }

  if (data.academicYearId !== undefined) {
    const academicYearId = normalizeOptionalText(data.academicYearId);
    assertAcademicYearExists(academicYearId);
    group.academicYearId = academicYearId;
  }

  if (data.course !== undefined) {
    group.course = normalizeOptionalText(data.course);
  }

  if (data.shift !== undefined) {
    group.shift = normalizeOptionalText(data.shift);
  }

  group.updatedAt = new Date().toISOString();
  return buildGroupSummary(group);
}

function deactivateGroup(groupId, user) {
  const group = assertGroupExists(groupId);
  if (!canManageGroup(user, group.id) && !isAdmin(user)) {
    throw new AppError('No autorizado para desactivar este grupo.', 403);
  }

  group.isActive = false;
  group.updatedAt = new Date().toISOString();

  const assignments = database.getCollection('userGroupAssignments') || [];
  const affectedUserIds = new Set();
  assignments.forEach((assignment) => {
    if (assignment.groupId === group.id) {
      assignment.isActive = false;
      assignment.updatedAt = group.updatedAt;
      affectedUserIds.add(assignment.userId);
    }
  });
  database.setCollection('userGroupAssignments', assignments);
  affectedUserIds.forEach((userId) => syncUserPlacementFromAssignments(userId));

  return buildGroupSummary(group);
}

function normalizeCenterAssignmentRole(role, user) {
  if (role) {
    return normalizeEnumValue(role, Object.values(CENTER_ASSIGNMENT_ROLES), 'rol de asignacion de centro');
  }

  switch (String(user?.role || '').toUpperCase()) {
    case 'SCHOOL':
      return CENTER_ASSIGNMENT_ROLES.SCHOOL_MANAGER;
    case 'PROFESSIONAL':
      return CENTER_ASSIGNMENT_ROLES.PROFESSIONAL;
    case 'STUDENT':
      return CENTER_ASSIGNMENT_ROLES.STUDENT;
    case 'FAMILY':
      return CENTER_ASSIGNMENT_ROLES.FAMILY;
    default:
      return CENTER_ASSIGNMENT_ROLES.OTHER;
  }
}

function normalizeGroupAssignmentRole(role, user) {
  if (role) {
    return normalizeEnumValue(role, Object.values(GROUP_ASSIGNMENT_ROLES), 'rol de asignacion de grupo');
  }

  switch (String(user?.role || '').toUpperCase()) {
    case 'PROFESSIONAL':
      return GROUP_ASSIGNMENT_ROLES.PROFESSIONAL;
    case 'STUDENT':
      return GROUP_ASSIGNMENT_ROLES.STUDENT;
    case 'FAMILY':
      return GROUP_ASSIGNMENT_ROLES.FAMILY;
    default:
      return GROUP_ASSIGNMENT_ROLES.OTHER;
  }
}

function assignUserToCenter(centerId, userId, data, actorUser) {
  const center = assertCenterExists(centerId);
  const user = assertUserExists(userId);

  if (!canManageCenter(actorUser, center.id) && !isAdmin(actorUser)) {
    throw new AppError('No autorizado para asignar usuarios a este centro.', 403);
  }

  const assignments = database.getCollection('userCenterAssignments') || [];
  const existing = assignments.find((assignment) => assignment.userId === user.id && assignment.centerId === center.id);
  const role = normalizeCenterAssignmentRole(data.role, user);
  const desiredPrimary = data.isPrimary ?? (!getUserCenterAssignments(user.id).some((assignment) => assignment.isActive));
  const now = new Date().toISOString();

  let assignment;
  if (existing) {
    if (existing.isActive) {
      throw new AppError('El usuario ya esta asignado a este centro.', 409);
    }

    existing.role = role;
    existing.isPrimary = desiredPrimary;
    existing.isActive = true;
    existing.updatedAt = now;
    assignment = existing;
  } else {
    assignment = createCenterAssignmentModel({
      id: database.nextId('userCenterAssignments', 'uca'),
      userId: user.id,
      centerId: center.id,
      role,
      isPrimary: desiredPrimary,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    assignments.push(assignment);
  }

  if (assignment.isPrimary) {
    assignments.forEach((item) => {
      if (item.userId === user.id && item.centerId !== center.id && item.isActive) {
        item.isPrimary = false;
      }
    });
  }

  database.setCollection('userCenterAssignments', assignments);
  const updatedUser = syncUserPlacementFromAssignments(user.id);

  return {
    assignment,
    user: updatedUser || sanitizeUser(user),
    center: buildCenterSummary(center),
  };
}

function removeUserFromCenter(centerId, userId, actorUser) {
  const center = assertCenterExists(centerId);
  const user = assertUserExists(userId);

  if (!canManageCenter(actorUser, center.id) && !isAdmin(actorUser)) {
    throw new AppError('No autorizado para quitar usuarios de este centro.', 403);
  }

  const assignments = database.getCollection('userCenterAssignments') || [];
  const assignment = assignments.find((item) => item.userId === user.id && item.centerId === center.id);

  if (!assignment || !assignment.isActive) {
    throw new AppError('La asignacion no existe.', 404);
  }

  assignment.isActive = false;
  assignment.updatedAt = new Date().toISOString();

  const groupAssignments = database.getCollection('userGroupAssignments') || [];
  const centerGroupIds = new Set(getCenterGroups(center.id).map((group) => group.id));
  groupAssignments.forEach((item) => {
    if (item.userId === user.id && centerGroupIds.has(item.groupId)) {
      item.isActive = false;
      item.updatedAt = assignment.updatedAt;
    }
  });

  database.setCollection('userGroupAssignments', groupAssignments);
  database.setCollection('userCenterAssignments', assignments);
  const updatedUser = syncUserPlacementFromAssignments(user.id);

  return {
    assignment,
    user: updatedUser || sanitizeUser(user),
    center: buildCenterSummary(center),
  };
}

function ensureCenterAssignmentForGroup(user, centerId, role, isPrimary = undefined) {
  const assignments = database.getCollection('userCenterAssignments') || [];
  const existing = assignments.find((assignment) => assignment.userId === user.id && assignment.centerId === centerId);
  const now = new Date().toISOString();
  const normalizedRole = normalizeCenterAssignmentRole(role, user);
  const desiredPrimary = isPrimary ?? (!getUserCenterAssignments(user.id).some((assignment) => assignment.isActive));

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.updatedAt = now;
    }
    existing.role = normalizedRole;
    existing.isPrimary = desiredPrimary || existing.isPrimary;
    return existing;
  }

  const assignment = createCenterAssignmentModel({
    id: database.nextId('userCenterAssignments', 'uca'),
    userId: user.id,
    centerId,
    role: normalizedRole,
    isPrimary: desiredPrimary,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  assignments.push(assignment);
  database.setCollection('userCenterAssignments', assignments);
  return assignment;
}

function assignUserToGroup(groupId, userId, data, actorUser) {
  const group = assertGroupExists(groupId);
  const user = assertUserExists(userId);

  if (!canManageGroup(actorUser, group.id) && !isAdmin(actorUser)) {
    throw new AppError('No autorizado para asignar usuarios a este grupo.', 403);
  }

  const center = assertCenterExists(group.centerId);
  const role = normalizeGroupAssignmentRole(data.role, user);
  const desiredPrimary = data.isPrimary ?? (!getUserGroupAssignments(user.id).some((assignment) => assignment.isActive));
  const now = new Date().toISOString();
  const assignments = database.getCollection('userGroupAssignments') || [];
  const existing = assignments.find((assignment) => assignment.userId === user.id && assignment.groupId === group.id);

  if (!hasCenterAccess(actorUser, center.id) && !isAdmin(actorUser)) {
    throw new AppError('No autorizado para usar este centro.', 403);
  }

  if (existing && existing.isActive) {
    throw new AppError('El usuario ya esta asignado a este grupo.', 409);
  }

  ensureCenterAssignmentForGroup(user, center.id, role, desiredPrimary);

  let assignment;
  if (existing) {
    existing.role = role;
    existing.isPrimary = desiredPrimary;
    existing.isActive = true;
    existing.updatedAt = now;
    assignment = existing;
  } else {
    assignment = createGroupAssignmentModel({
      id: database.nextId('userGroupAssignments', 'uga'),
      userId: user.id,
      groupId: group.id,
      role,
      isPrimary: desiredPrimary,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    assignments.push(assignment);
  }

  if (assignment.isPrimary) {
    assignments.forEach((item) => {
      if (item.userId === user.id && item.groupId !== group.id && item.isActive) {
        item.isPrimary = false;
      }
    });
  }

  database.setCollection('userGroupAssignments', assignments);
  const updatedUser = syncUserPlacementFromAssignments(user.id);

  return {
    assignment,
    user: updatedUser || sanitizeUser(user),
    group: buildGroupSummary(group),
    center: buildCenterSummary(center),
  };
}

function removeUserFromGroup(groupId, userId, actorUser) {
  const group = assertGroupExists(groupId);
  const user = assertUserExists(userId);

  if (!canManageGroup(actorUser, group.id) && !isAdmin(actorUser)) {
    throw new AppError('No autorizado para quitar usuarios de este grupo.', 403);
  }

  const assignments = database.getCollection('userGroupAssignments') || [];
  const assignment = assignments.find((item) => item.userId === user.id && item.groupId === group.id);

  if (!assignment || !assignment.isActive) {
    throw new AppError('La asignacion no existe.', 404);
  }

  assignment.isActive = false;
  assignment.updatedAt = new Date().toISOString();
  database.setCollection('userGroupAssignments', assignments);
  const updatedUser = syncUserPlacementFromAssignments(user.id);

  return {
    assignment,
    user: updatedUser || sanitizeUser(user),
    group: buildGroupSummary(group),
  };
}

function listCenterUsersForRequest(centerId, user) {
  const center = assertCenterExists(centerId);
  if (!hasCenterAccess(user, center.id)) {
    throw new AppError('No autorizado para ver los usuarios de este centro.', 403);
  }

  return getCenterUsers(center.id);
}

function listGroupUsersForRequest(groupId, user) {
  const group = assertGroupExists(groupId);
  if (!hasGroupAccess(user, group.id)) {
    throw new AppError('No autorizado para ver los usuarios de este grupo.', 403);
  }

  return getGroupUsers(group.id);
}

function getAssignmentsForUserRequest(targetUserId, actorUser) {
  const targetUser = assertUserExists(targetUserId);
  if (!isAdmin(actorUser) && actorUser.id !== targetUser.id) {
    throw new AppError('No autorizado para ver estas asignaciones.', 403);
  }

  return getUserAssignments(targetUser.id);
}

module.exports = {
  listAcademicYears,
  createAcademicYear,
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
};
