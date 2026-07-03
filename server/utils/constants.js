const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  SCHOOL: 'SCHOOL',
  PROFESSIONAL: 'PROFESSIONAL',
  STUDENT: 'STUDENT',
  FAMILY: 'FAMILY',
});

const PUBLIC_USER_FIELDS = [
  'id',
  'name',
  'email',
  'role',
  'isActive',
  'schoolId',
  'groupId',
  'ageRange',
  'createdAt',
  'updatedAt',
];

module.exports = { ROLES, PUBLIC_USER_FIELDS };

