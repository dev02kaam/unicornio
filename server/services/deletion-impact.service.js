const { database } = require('../config/database');
const { AppError } = require('../utils/errors');
const {
  isAdmin,
  isSchool,
  canManageGroup,
  hasCenterAccess,
  findCenterById,
  findGroupById,
  getCenterGroups,
} = require('../utils/organization.helpers');

function active(items) {
  return items.filter((item) => item.isActive !== false);
}

function effect(label, count, detail) {
  return { label, count, detail };
}

function findUserById(userId) {
  return (database.getCollection('users') || []).find((user) => user.id === String(userId)) || null;
}

function assertUserCanDelete(actor, user) {
  if (!isAdmin(actor)) {
    throw new AppError('No autorizado para eliminar usuarios.', 403);
  }
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }
}

function getUserImpact(userId, actor) {
  const user = findUserById(userId);
  assertUserCanDelete(actor, user);

  const centerAssignments = active(database.getCollection('userCenterAssignments') || [])
    .filter((assignment) => assignment.userId === user.id);
  const groupAssignments = active(database.getCollection('userGroupAssignments') || [])
    .filter((assignment) => assignment.userId === user.id);
  const linkedFamilies = active(database.getCollection('users') || [])
    .filter((candidate) => candidate.linkedStudentId === user.id);
  const consents = database.getCollection('consents') || [];
  const relatedConsents = consents.filter((consent) => (
    consent.studentId === user.id || consent.familyUserId === user.id || consent.requestedByUserId === user.id
  ));

  return {
    resourceType: 'users',
    resourceName: user.name,
    action: 'eliminar',
    effects: [
      effect('Asignaciones propias', centerAssignments.length + groupAssignments.length, 'Se eliminarán junto con el usuario.'),
      effect('Familias vinculadas', linkedFamilies.length, 'Seguirán existiendo, pero mostrarán que el usuario vinculado fue eliminado.'),
      effect('Consentimientos relacionados', relatedConsents.length, 'El historial se conserva y mostrará una referencia eliminada.'),
    ].filter((item) => item.count > 0),
  };
}

function getCenterImpact(centerId, actor) {
  const center = findCenterById(centerId);
  if (!center) throw new AppError('Centro no encontrado.', 404);
  if (!isAdmin(actor)) throw new AppError('No autorizado para eliminar centros.', 403);

  const groups = active(getCenterGroups(center.id));
  const linkedUsers = active(database.getCollection('users') || [])
    .filter((user) => user.schoolId === center.id);
  const consents = (database.getCollection('consents') || [])
    .filter((consent) => consent.centerId === center.id);

  return {
    resourceType: 'centers',
    resourceName: center.name,
    action: 'eliminar',
    effects: [
      effect('Grupos vinculados', groups.length, 'Seguirán existiendo y marcarán que su centro fue eliminado.'),
      effect('Usuarios vinculados', linkedUsers.length, 'Seguirán existiendo y marcarán que su centro fue eliminado.'),
      effect('Consentimientos del centro', consents.length, 'El historial se conserva y marcará el centro como eliminado.'),
    ].filter((item) => item.count > 0),
  };
}

function getGroupImpact(groupId, actor) {
  const group = findGroupById(groupId);
  if (!group) throw new AppError('Grupo no encontrado.', 404);
  if (!canManageGroup(actor, group.id) && !isAdmin(actor)) {
    throw new AppError('No autorizado para eliminar este grupo.', 403);
  }

  const linkedUserIds = new Set([
    ...active(database.getCollection('users') || [])
      .filter((user) => user.groupId === group.id)
      .map((user) => user.id),
    ...active(database.getCollection('userGroupAssignments') || [])
      .filter((assignment) => assignment.groupId === group.id)
      .map((assignment) => assignment.userId),
  ]);

  return {
    resourceType: 'groups',
    resourceName: group.name,
    action: 'eliminar',
    effects: [
      effect('Usuarios vinculados', linkedUserIds.size, 'Seguirán existiendo y marcarán que su grupo fue eliminado.'),
    ].filter((item) => item.count > 0),
  };
}

function getGroupUserImpact(groupId, userId, actor) {
  const group = findGroupById(groupId);
  const user = findUserById(userId);
  if (!group || !user) throw new AppError('No se encontró la asignación solicitada.', 404);
  if (!isSchool(actor)) throw new AppError('Solo el centro puede quitar usuarios de grupos.', 403);
  if (!hasCenterAccess(actor, group.centerId)) throw new AppError('No autorizado para gestionar este grupo.', 403);

  const assignment = active(database.getCollection('userGroupAssignments') || [])
    .find((item) => item.groupId === group.id && item.userId === user.id);
  if (!assignment) throw new AppError('La asignación no existe.', 404);

  return {
    resourceType: 'group-users',
    resourceName: user.name,
    action: 'quitar del grupo',
    effects: [effect('Grupo afectado', 1, `Dejará de estar asignado a ${group.name}.`)],
  };
}

function getDeletionImpact(resourceType, resourceId, actor, relatedId = null) {
  switch (resourceType) {
    case 'users': return getUserImpact(resourceId, actor);
    case 'centers': return getCenterImpact(resourceId, actor);
    case 'groups': return getGroupImpact(resourceId, actor);
    case 'group-users': return getGroupUserImpact(resourceId, relatedId, actor);
    default: throw new AppError('Tipo de eliminación no válido.', 400);
  }
}

module.exports = { getDeletionImpact };
