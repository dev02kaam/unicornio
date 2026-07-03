const { database } = require('../config/database');
const { sanitizeUser } = require('../models/user.model');

function getCollection(name) {
  return database.getCollection(name) || [];
}

function isAdmin(user) {
  return String(user?.role || '').toUpperCase() === 'ADMIN';
}

function isSchool(user) {
  return String(user?.role || '').toUpperCase() === 'SCHOOL';
}

function isProfessional(user) {
  return String(user?.role || '').toUpperCase() === 'PROFESSIONAL';
}

function findAcademicYearById(id) {
  return getCollection('academicYears').find((item) => item.id === String(id)) || null;
}

function findCenterById(id) {
  return getCollection('centers').find((item) => item.id === String(id)) || null;
}

function findGroupById(id) {
  return getCollection('groups').find((item) => item.id === String(id)) || null;
}

function getUserCenterAssignments(userId, { activeOnly = true } = {}) {
  return getCollection('userCenterAssignments').filter((assignment) => (
    assignment.userId === String(userId) && (!activeOnly || assignment.isActive)
  ));
}

function getUserGroupAssignments(userId, { activeOnly = true } = {}) {
  return getCollection('userGroupAssignments').filter((assignment) => (
    assignment.userId === String(userId) && (!activeOnly || assignment.isActive)
  ));
}

function getCenterAssignments(centerId, { activeOnly = true } = {}) {
  return getCollection('userCenterAssignments').filter((assignment) => (
    assignment.centerId === String(centerId) && (!activeOnly || assignment.isActive)
  ));
}

function getGroupAssignments(groupId, { activeOnly = true } = {}) {
  return getCollection('userGroupAssignments').filter((assignment) => (
    assignment.groupId === String(groupId) && (!activeOnly || assignment.isActive)
  ));
}

function getCenterGroups(centerId) {
  return getCollection('groups').filter((group) => group.centerId === String(centerId));
}

function getCenterUsers(centerId) {
  const assignments = getCenterAssignments(centerId);
  const users = getCollection('users');

  return assignments
    .map((assignment) => {
      const user = users.find((item) => item.id === assignment.userId);
      return user ? { user: sanitizeUser(user), assignment } : null;
    })
    .filter(Boolean);
}

function getGroupUsers(groupId) {
  const assignments = getGroupAssignments(groupId);
  const users = getCollection('users');

  return assignments
    .map((assignment) => {
      const user = users.find((item) => item.id === assignment.userId);
      return user ? { user: sanitizeUser(user), assignment } : null;
    })
    .filter(Boolean);
}

function hasCenterAccess(user, centerId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  return getUserCenterAssignments(user.id).some((assignment) => assignment.centerId === String(centerId));
}

function hasGroupAccess(user, groupId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (getUserGroupAssignments(user.id).some((assignment) => assignment.groupId === String(groupId))) {
    return true;
  }

  const group = findGroupById(groupId);
  return group ? hasCenterAccess(user, group.centerId) : false;
}

function canManageCenter(user, centerId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (!isSchool(user)) {
    return false;
  }

  return getUserCenterAssignments(user.id).some((assignment) => assignment.centerId === String(centerId));
}

function canManageGroup(user, groupId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  const group = findGroupById(groupId);
  return group ? canManageCenter(user, group.centerId) : false;
}

function syncUserPlacementFromAssignments(userId) {
  const users = getCollection('users');
  const user = users.find((item) => item.id === String(userId));

  if (!user) {
    return null;
  }

  const centerAssignments = getUserCenterAssignments(userId);
  const groupAssignments = getUserGroupAssignments(userId);

  const primaryCenter = centerAssignments.find((assignment) => assignment.isPrimary) || centerAssignments[0] || null;
  const primaryGroup = groupAssignments.find((assignment) => assignment.isPrimary) || groupAssignments[0] || null;

  user.schoolId = primaryCenter ? primaryCenter.centerId : null;
  user.groupId = primaryGroup ? primaryGroup.groupId : null;
  user.updatedAt = new Date().toISOString();

  return sanitizeUser(user);
}

function getUserAssignments(userId) {
  const user = getCollection('users').find((item) => item.id === String(userId));

  if (!user) {
    return null;
  }

  return {
    user: sanitizeUser(user),
    centers: getUserCenterAssignments(userId).map((assignment) => ({
      ...assignment,
      center: findCenterById(assignment.centerId),
    })),
    groups: getUserGroupAssignments(userId).map((assignment) => {
      const group = findGroupById(assignment.groupId);
      return {
        ...assignment,
        group,
        center: group ? findCenterById(group.centerId) : null,
      };
    }),
  };
}

module.exports = {
  isAdmin,
  isSchool,
  isProfessional,
  findAcademicYearById,
  findCenterById,
  findGroupById,
  getUserCenterAssignments,
  getUserGroupAssignments,
  getCenterAssignments,
  getGroupAssignments,
  getCenterGroups,
  getCenterUsers,
  getGroupUsers,
  hasCenterAccess,
  hasGroupAccess,
  canManageCenter,
  canManageGroup,
  syncUserPlacementFromAssignments,
  getUserAssignments,
};
