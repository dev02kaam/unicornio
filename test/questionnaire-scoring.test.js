const test = require('node:test');
const assert = require('node:assert/strict');
const { questionnaireVersions } = require('../server/data/questionnaires/catalog');
const {
  evaluateQuestionnaire,
  evaluateQuestionnaireSubmission,
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
  questionnaireVersions
    .filter((definition) => definition.questions.length === 20 && !definition.scoringRules.reverseQuestionNumbers)
    .forEach((definition) => {
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
  const definition = questionnaireVersions.find((item) => item.id === 'depressive-mood-9-12-v1');
  const incomplete = answersForTotal(definition, 12).slice(0, 19);
  assert.throws(
    () => evaluateQuestionnaire(definition, incomplete),
    /pregunta 20/,
  );
});

test('un envío parcial conserva el avance sin calcular puntuación ni banda', () => {
  const definition = questionnaireVersions.find((item) => item.id === 'depressive-mood-9-12-v1');
  const partial = evaluateQuestionnaireSubmission(
    definition,
    answersForTotal(definition, 12).slice(0, 7),
  );
  assert.deepEqual(partial.completion, {
    status: 'PARTIAL',
    answeredCount: 7,
    totalQuestions: 20,
  });
  assert.equal(partial.totalScore, null);
  assert.equal(partial.band, null);
  assert.equal(partial.alertSeverity, null);
});

test('un envío completo mantiene la evaluación habitual', () => {
  const definition = questionnaireVersions.find((item) => item.id === 'depressive-mood-9-12-v1');
  const complete = evaluateQuestionnaireSubmission(definition, answersForTotal(definition, 12));
  assert.deepEqual(complete.completion, {
    status: 'COMPLETE',
    answeredCount: 20,
    totalQuestions: 20,
  });
  assert.equal(complete.totalScore, 12);
  assert.ok(complete.band);
});

test('activa los centinelas infantiles solo desde A menudo', () => {
  const definition = questionnaireVersions.find((item) => item.id === 'depressive-mood-9-12-v1');
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
  const definition = questionnaireVersions.find((item) => item.id === 'depressive-mood-13-16-v1');
  const answers = answersForTotal(definition, 0);
  answers[17].value = 'ALWAYS';
  const evaluation = evaluateQuestionnaire(definition, answers);
  assert.equal(evaluation.alertSeverity, 'RED');
  assert.ok(evaluation.triggeredRules.some(
    (rule) => rule.questionNumber === 18 && rule.severity === 'RED',
  ));
  assert.equal(evaluation.pendingClinicalRules.length, 1);
});

test('invierte los ítems protectores del autoconcepto sin alterar el valor original', () => {
  const definition = questionnaireVersions.find((item) => item.id === 'self-concept-9-12-v1');
  const answers = definition.questions.map((question) => ({
    questionNumber: question.number,
    value: 'ALWAYS',
  }));
  const evaluation = evaluateQuestionnaire(definition, answers);
  const reversed = evaluation.answers.filter((answer) => (
    definition.scoringRules.reverseQuestionNumbers.includes(answer.questionNumber)
  ));
  assert.ok(reversed.length > 0);
  assert.ok(reversed.every((answer) => answer.rawPoints === 3 && answer.points === 0));
});

test('el acoso usa la subescala de riesgo más alta para la banda orientativa', () => {
  const definition = questionnaireVersions.find((item) => item.id === 'bullying-cyberbullying-9-12-v1');
  const answers = definition.questions.map((question) => ({
    questionNumber: question.number,
    value: question.number <= 8 || question.number >= 38 ? 'ALWAYS' : 'NEVER',
  }));
  const evaluation = evaluateQuestionnaire(definition, answers);
  assert.equal(evaluation.totalScore, 24);
  assert.equal(evaluation.bandScore, 24);
  assert.equal(evaluation.subscales.find((item) => item.key === 'PRESENT_VICTIMIZATION').score, 24);
  assert.ok(evaluation.band);
});
