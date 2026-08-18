const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESPONSE_SCALE,
  questionnaireFamilies,
  questionnaireVersions,
} = require('../server/data/questionnaires/catalog');
const {
  calculateAge,
  calculateDefinitionHash,
} = require('../server/services/questionnaires.service');

const REVIEWED_DEPRESSION_HASHES = {
  'depressive-mood-9-12-v1': '92a0b6426c5f8c08c351fcffcf9af82a7e935e85ba49973b1cf5837b1340be66',
  'depressive-mood-13-16-v1': 'a5ce4326795698688dbf90cbd95c9d5f0ec2152315ae4eacc130608e0d08ff0b',
};

test('el catálogo contiene las siete áreas y sus catorce versiones activas', () => {
  assert.equal(questionnaireFamilies.length, 7);
  assert.equal(questionnaireVersions.length, 14);
  assert.equal(
    questionnaireVersions.reduce((total, definition) => total + definition.questions.length, 0),
    320,
  );
  questionnaireFamilies.forEach((family) => {
    assert.equal(
      questionnaireVersions.filter((definition) => definition.familyKey === family.key).length,
      2,
      `${family.key} debe tener dos versiones por edad`,
    );
  });
});

test('todas las versiones conservan preguntas secuenciales, escala 0–3 y trazabilidad', () => {
  assert.deepEqual(RESPONSE_SCALE.map((option) => option.points), [0, 1, 2, 3]);
  questionnaireVersions.forEach((definition) => {
    assert.ok([20, 40].includes(definition.questions.length), definition.id);
    assert.deepEqual(
      definition.questions.map((question) => question.number),
      Array.from({ length: definition.questions.length }, (_, index) => index + 1),
    );
    assert.ok(definition.questions.every((question) => question.required));
    assert.equal(definition.sourceDocument, 'CUESTIONARIOS UNICORNIO.docx');
    assert.equal(definition.status, 'EXPERIMENTAL');
    assert.equal(calculateDefinitionHash(definition).length, 64);
  });
});

test('la transcripción de depresión revisada permanece fijada por hash', () => {
  questionnaireVersions
    .filter((definition) => definition.familyKey === 'depressive-mood')
    .forEach((definition) => {
      assert.equal(calculateDefinitionHash(definition), REVIEWED_DEPRESSION_HASHES[definition.id]);
    });
});

test('los límites de edad se calculan en la fecha prevista de la campaña', () => {
  const sessionDate = new Date('2026-07-31T10:00:00.000Z');
  assert.equal(calculateAge('2017-07-31', sessionDate), 9);
  assert.equal(calculateAge('2014-07-31', sessionDate), 12);
  assert.equal(calculateAge('2013-07-31', sessionDate), 13);
  assert.equal(calculateAge('2008-07-31', sessionDate), 18);
});
