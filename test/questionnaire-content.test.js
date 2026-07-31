const test = require('node:test');
const assert = require('node:assert/strict');
const { depressiveMoodVersions, RESPONSE_SCALE } = require('../server/data/questionnaires/depressiveMood');
const {
  calculateAge,
  calculateDefinitionHash,
  getQuestionnairePreview,
} = require('../server/services/questionnaires.service');
const { env } = require('../server/config/env');

const REVIEWED_HASHES = {
  'depressive-mood-9-12-v1': '92a0b6426c5f8c08c351fcffcf9af82a7e935e85ba49973b1cf5837b1340be66',
  'depressive-mood-13-16-v1': 'a5ce4326795698688dbf90cbd95c9d5f0ec2152315ae4eacc130608e0d08ff0b',
};

test('la transcripción revisada permanece fijada por hash', () => {
  depressiveMoodVersions.forEach((definition) => {
    assert.equal(calculateDefinitionHash(definition), REVIEWED_HASHES[definition.id]);
    assert.equal(definition.sourceDocument, 'CUESTIONARIOS UNICORNIO.docx');
    assert.equal(definition.status, 'EXPERIMENTAL');
  });
});

test('las dos versiones tienen 20 ítems requeridos y escala 0–3', () => {
  assert.deepEqual(RESPONSE_SCALE.map((option) => option.points), [0, 1, 2, 3]);
  depressiveMoodVersions.forEach((definition) => {
    assert.equal(definition.questions.length, 20);
    assert.deepEqual(
      definition.questions.map((question) => question.number),
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    assert.ok(definition.questions.every((question) => question.required));
  });
});

test('los límites de edad seleccionan 9–12 y 13–16 sin adaptar fuera de rango', () => {
  const sessionDate = new Date('2026-07-31T10:00:00.000Z');
  const ages = [
    ['2018-07-31', 8, null],
    ['2017-07-31', 9, 'depressive-mood-9-12-v1'],
    ['2014-07-31', 12, 'depressive-mood-9-12-v1'],
    ['2013-07-31', 13, 'depressive-mood-13-16-v1'],
    ['2010-07-31', 16, 'depressive-mood-13-16-v1'],
    ['2009-07-31', 17, null],
  ];

  ages.forEach(([birthDate, expectedAge, expectedDefinition]) => {
    const age = calculateAge(birthDate, sessionDate);
    assert.equal(age, expectedAge);
    const selected = depressiveMoodVersions.find(
      (definition) => age >= definition.ageMin && age <= definition.ageMax,
    );
    assert.equal(selected?.id || null, expectedDefinition);
  });
});

test('la prueba funcional expone preguntas sin puntuación ni reglas clínicas', () => {
  const previousValue = env.questionnairePreviewEnabled;
  env.questionnairePreviewEnabled = true;
  try {
    const preview = getQuestionnairePreview('9-12');
    assert.equal(preview.status, 'FUNCTIONAL_PREVIEW');
    assert.equal(preview.questions.length, 20);
    assert.deepEqual(
      Object.keys(preview.responseScale[0]).sort(),
      ['label', 'value'],
    );
    assert.equal('scoringRules' in preview, false);
    assert.equal('sourceDocument' in preview, false);
  } finally {
    env.questionnairePreviewEnabled = previousValue;
  }
});
