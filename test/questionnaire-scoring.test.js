const test = require('node:test');
const assert = require('node:assert/strict');
const { depressiveMoodVersions } = require('../server/data/questionnaires/depressiveMood');
const {
  evaluateQuestionnaire,
  getBand,
} = require('../server/services/questionnaire-scoring.service');

function answersForTotal(definition, total) {
  let remaining = total;
  return definition.questions.map((question) => {
    const points = Math.min(3, remaining);
    remaining -= points;
    const option = definition.responseScale.find((item) => item.points === points);
    return { questionNumber: question.number, value: option.value };
  });
}

test('cada versión cubre todas las puntuaciones entre 0 y 60 sin huecos', () => {
  depressiveMoodVersions.forEach((definition) => {
    assert.equal(definition.questions.length, 20);
    assert.equal(definition.scoringRules.minimum, 0);
    assert.equal(definition.scoringRules.maximum, 60);

    for (let total = 0; total <= 60; total += 1) {
      const band = getBand(definition.scoringRules, total);
      assert.ok(band, `${definition.id} no tiene banda para ${total}`);
      const evaluation = evaluateQuestionnaire(definition, answersForTotal(definition, total));
      assert.equal(evaluation.totalScore, total);
      assert.equal(evaluation.band.key, band.key);
    }
  });
});

test('no permite evaluar si falta una respuesta', () => {
  const definition = depressiveMoodVersions[0];
  const incomplete = answersForTotal(definition, 12).slice(0, 19);
  assert.throws(
    () => evaluateQuestionnaire(definition, incomplete),
    /pregunta 20/,
  );
});

test('activa los centinelas infantiles solo desde A menudo', () => {
  const definition = depressiveMoodVersions[0];
  const answers = answersForTotal(definition, 0);
  answers[0].value = 'OFTEN';
  const evaluation = evaluateQuestionnaire(definition, answers);
  assert.equal(evaluation.alertSeverity, 'ORANGE');
  assert.deepEqual(
    evaluation.triggeredRules.filter((rule) => rule.type === 'SENTINEL_ITEM')
      .map((rule) => rule.questionNumber),
    [1],
  );
});

test('el ítem 18 adolescente en Siempre tiene prioridad roja', () => {
  const definition = depressiveMoodVersions[1];
  const answers = answersForTotal(definition, 0);
  answers[17].value = 'ALWAYS';
  const evaluation = evaluateQuestionnaire(definition, answers);
  assert.equal(evaluation.alertSeverity, 'RED');
  assert.ok(evaluation.triggeredRules.some(
    (rule) => rule.questionNumber === 18 && rule.severity === 'RED',
  ));
  assert.equal(evaluation.pendingClinicalRules.length, 1);
});

