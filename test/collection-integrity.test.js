const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getMaximumPrefixedSequence,
  repairLegalTextVersions,
} = require('../server/utils/collection-integrity');

test('repara ids y versiones legales duplicadas conservando la entrada mas reciente', () => {
  const repair = repairLegalTextVersions([
    { id: 'legal-text-1', version: '1.0', title: 'Primera copia' },
    { id: 'legal-text-2', version: '2.0', title: 'Version sustituida' },
    { id: 'legal-text-1', version: '1.1', title: 'Copia mas reciente' },
    { id: 'legal-text-3', version: '2.0', title: 'Version mas reciente' },
  ]);

  assert.deepEqual(
    repair.items.map((item) => [item.id, item.version]),
    [
      ['legal-text-1', '1.1'],
      ['legal-text-3', '2.0'],
    ],
  );
  assert.equal(repair.removed.length, 2);
  assert.equal(repair.idReplacements.get('legal-text-2'), 'legal-text-3');
});

test('reconcilia la secuencia con el mayor id legal persistido', () => {
  const maximum = getMaximumPrefixedSequence([
    { id: 'legal-text-2' },
    { id: 'legal-text-personalizado' },
    { id: 'legal-text-9' },
  ], 'legal-text');

  assert.equal(maximum, 9);
});
