const test = require('node:test');
const assert = require('node:assert/strict');

const { validateAlertTransferTarget } = require('../server/services/questionnaires.service');

test('la transferencia exige otro profesional asignado activamente al mismo grupo', () => {
  const actor = { id: 'professional-1', role: 'PROFESSIONAL', isActive: true };
  const target = { id: 'professional-2', role: 'PROFESSIONAL', isActive: true };
  const assignments = [{ userId: target.id, groupId: 'group-1', isActive: true }];

  assert.equal(validateAlertTransferTarget(actor, target, 'group-1', assignments), true);
  assert.throws(
    () => validateAlertTransferTarget(actor, target, 'group-2', assignments),
    (error) => error.statusCode === 404,
  );
  assert.throws(
    () => validateAlertTransferTarget(actor, actor, 'group-1', assignments),
    (error) => error.statusCode === 400,
  );
});
