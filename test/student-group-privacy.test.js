const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getGroupDetails,
  listGroupsForCenter,
  listGroupsForUser,
} = require('../server/services/organization.service');
const { findUserById } = require('../server/services/users.service');

test('el alumno solo recibe su grupo principal y sin metadatos administrativos', () => {
  const student = findUserById('3');
  const groups = listGroupsForCenter(student.schoolId, student);
  const directGroups = listGroupsForUser(student);

  assert.equal(groups.length, 1);
  assert.equal(directGroups.length, 1);
  assert.equal(groups[0].id, student.groupId);
  assert.deepEqual(Object.keys(groups[0]).sort(), ['id', 'name']);
  assert.deepEqual(directGroups, groups);
});

test('el alumno no puede abrir otro grupo de su mismo centro', () => {
  const student = findUserById('3');
  assert.throws(
    () => getGroupDetails('group-2', student),
    (error) => error.statusCode === 403,
  );
});
