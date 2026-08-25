const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('el destinatario conserva acceso y puede confirmar la alerta transferida', () => {
  const service = fs.readFileSync(
    path.resolve(__dirname, '../server/services/questionnaires.service.js'),
    'utf8',
  );
  assert.match(
    service,
    /or exists \([\s\S]*?a\.owner_professional_legacy_id = \$1[\s\S]*?order by c\.created_at desc/,
  );
  assert.match(
    service,
    /async function assertScopedCampaignAccess[\s\S]*?a\.owner_professional_legacy_id = \$2/,
  );
  assert.match(
    service,
    /a\.status in \('OPEN', 'TRANSFERRED'\) then 'ACKNOWLEDGED'/,
  );
  assert.match(service, /'ALERT_TRANSFER_ASSIGNED'/);
});
