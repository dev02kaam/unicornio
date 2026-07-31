const test = require('node:test');
const assert = require('node:assert/strict');
const { assignUserToGroup } = require('../server/services/organization.service');
const { findUserById } = require('../server/services/users.service');

test('ADMIN y SCHOOL pueden vincular profesionales a grupos de su ámbito', () => {
  const admin = findUserById('1');
  const school = findUserById('9');

  const adminAssignment = assignUserToGroup(
    'group-2',
    '6',
    { role: 'PROFESSIONAL', isPrimary: true },
    admin,
  );
  assert.equal(adminAssignment.assignment.role, 'PROFESSIONAL');

  const schoolAssignment = assignUserToGroup(
    'group-4',
    '11',
    { role: 'PROFESSIONAL', isPrimary: true },
    school,
  );
  assert.equal(schoolAssignment.assignment.role, 'PROFESSIONAL');
});

test('TEACHER y PROFESSIONAL no pueden gestionar vinculaciones', () => {
  const teacher = findUserById('10');
  const professional = findUserById('11');

  assert.throws(
    () => assignUserToGroup('group-4', '11', { role: 'PROFESSIONAL' }, teacher),
    (error) => error.statusCode === 403,
  );
  assert.throws(
    () => assignUserToGroup('group-4', '11', { role: 'PROFESSIONAL' }, professional),
    (error) => error.statusCode === 403,
  );
});

test('una cuenta SCHOOL no se puede vincular a un grupo como miembro', () => {
  const school = findUserById('4');
  const admin = findUserById('1');

  assert.throws(
    () => assignUserToGroup('group-1', school.id, {}, school),
    (error) => error.statusCode === 400
      && error.message === 'Solo se pueden vincular alumnos, profesores o profesionales a un grupo.',
  );
  assert.throws(
    () => assignUserToGroup('group-1', school.id, {}, admin),
    (error) => error.statusCode === 400,
  );
});
