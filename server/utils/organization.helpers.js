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

function isTeacher(user) {
  return String(user?.role || '').toUpperCase() === 'TEACHER';
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

function findUserById(id) {
  return getCollection('users').find((item) => item.id === String(id)) || null;
}

function findFamilyForStudent(studentId) {
  return getCollection('users').find((item) => (
    item.isActive
    && String(item.role || '').toUpperCase() === 'FAMILY'
    && String(item.linkedStudentId || '') === String(studentId)
  )) || null;
}

function buildUserSummary(user) {
  return user ? sanitizeUser(user) : null;
}

function findPrimaryTeacherForGroup(groupId) {
  if (!groupId) {
    return null;
  }

  const users = getCollection('users');
  const teacherAssignment = getGroupAssignments(groupId)
    .find((assignment) => {
      const user = users.find((item) => item.id === assignment.userId);
      return user?.isActive && String(user.role || '').toUpperCase() === 'TEACHER';
    });

  return teacherAssignment ? users.find((item) => item.id === teacherAssignment.userId) || null : null;
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

function findPrimaryCenterIdForUser(userId) {
  const assignments = getUserCenterAssignments(userId);
  const primaryAssignment = assignments.find((assignment) => assignment.isPrimary) || assignments[0] || null;
  return primaryAssignment ? primaryAssignment.centerId : null;
}

function findPrimaryGroupIdForUser(userId) {
  const assignments = getUserGroupAssignments(userId);
  const primaryAssignment = assignments.find((assignment) => assignment.isPrimary) || assignments[0] || null;
  return primaryAssignment ? primaryAssignment.groupId : null;
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

  if (getUserCenterAssignments(user.id).some((assignment) => assignment.centerId === String(centerId))) {
    return true;
  }

  if (String(user?.role || '').toUpperCase() === 'FAMILY' && user.linkedStudentId) {
    return findPrimaryCenterIdForUser(user.linkedStudentId) === String(centerId);
  }

  return false;
}

function hasGroupAccess(user, groupId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  const role = String(user.role || '').toUpperCase();
  if (role === 'STUDENT') {
    const primaryGroupId = findPrimaryGroupIdForUser(user.id) || user.groupId;
    return Boolean(primaryGroupId && String(primaryGroupId) === String(groupId));
  }

  if (getUserGroupAssignments(user.id).some((assignment) => assignment.groupId === String(groupId))) {
    return true;
  }

  const group = findGroupById(groupId);
  if (!group) {
    return false;
  }

  if (role === 'FAMILY' && user.linkedStudentId) {
    return findPrimaryGroupIdForUser(user.linkedStudentId) === group.id;
  }

  return hasCenterAccess(user, group.centerId);
}

function canManageCenter(user, centerId) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (!isSchool(user) && !isTeacher(user)) {
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
  database.persistUsers();

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

function getDashboardContextForUser(user) {
  if (!user) {
    return null;
  }

  const role = String(user.role || '').toUpperCase();

  if (role === 'FAMILY') {
    const linkedStudent = user.linkedStudentId ? findUserById(user.linkedStudentId) : null;
    const centerId = linkedStudent ? findPrimaryCenterIdForUser(linkedStudent.id) || linkedStudent.schoolId : null;
    const groupId = linkedStudent ? findPrimaryGroupIdForUser(linkedStudent.id) || linkedStudent.groupId : null;
    const teacher = groupId ? findPrimaryTeacherForGroup(groupId) : null;

    return {
      type: 'FAMILY',
      linkedStudent: buildUserSummary(linkedStudent),
      center: centerId ? findCenterById(centerId) : null,
      group: groupId ? findGroupById(groupId) : null,
      teacher: buildUserSummary(teacher),
    };
  }

  if (role === 'STUDENT') {
    const linkedFamily = findFamilyForStudent(user.id);
    const centerId = findPrimaryCenterIdForUser(user.id) || user.schoolId;
    const groupId = findPrimaryGroupIdForUser(user.id) || user.groupId;
    const teacher = groupId ? findPrimaryTeacherForGroup(groupId) : null;

    return {
      type: 'STUDENT',
      linkedFamily: buildUserSummary(linkedFamily),
      center: centerId ? findCenterById(centerId) : null,
      group: groupId ? findGroupById(groupId) : null,
      teacher: buildUserSummary(teacher),
    };
  }

  return null;
}

module.exports = {
  isAdmin,
  isSchool,
  isTeacher,
  isProfessional,
  findAcademicYearById,
  findCenterById,
  findGroupById,
  findPrimaryCenterIdForUser,
  findPrimaryGroupIdForUser,
  findPrimaryTeacherForGroup,
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
  getDashboardContextForUser,
};
