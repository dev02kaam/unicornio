function normalizeAnswers(definition, answers) {
  const values = new Map();
  (answers || []).forEach((answer) => {
    values.set(Number(answer.questionNumber), String(answer.value || '').toUpperCase());
  });

  return definition.questions.map((question) => {
    const value = values.get(question.number);
    const option = definition.responseScale.find((item) => item.value === value);
    if (!option) {
      throw new Error(`Falta una respuesta válida para la pregunta ${question.number}.`);
    }
    return {
      questionNumber: question.number,
      value: option.value,
      label: option.label,
      points: option.points,
    };
  });
}

function getBand(scoringRules, totalScore) {
  return scoringRules.bands.find((band) => totalScore >= band.min && totalScore <= band.max) || null;
}

function evaluateQuestionnaire(definition, answers) {
  const normalizedAnswers = normalizeAnswers(definition, answers);
  const totalScore = normalizedAnswers.reduce((sum, answer) => sum + answer.points, 0);
  const band = getBand(definition.scoringRules, totalScore);
  if (!band) {
    throw new Error('La puntuación no corresponde a ninguna banda configurada.');
  }

  const triggeredRules = [];
  const severityRank = { YELLOW: 1, ORANGE: 2, RED: 3 };

  if (totalScore >= definition.scoringRules.totalAlertThreshold) {
    triggeredRules.push({
      type: 'TOTAL_THRESHOLD',
      severity: 'ORANGE',
      totalScore,
      threshold: definition.scoringRules.totalAlertThreshold,
    });
  }

  definition.scoringRules.sentinelRules.forEach((rule) => {
    rule.questionNumbers.forEach((questionNumber) => {
      const answer = normalizedAnswers.find((item) => item.questionNumber === questionNumber);
      if (answer && answer.points >= rule.minimumPoints) {
        triggeredRules.push({
          type: 'SENTINEL_ITEM',
          severity: rule.severity,
          questionNumber,
          points: answer.points,
          minimumPoints: rule.minimumPoints,
        });
      }
    });
  });

  const alertSeverity = triggeredRules
    .map((rule) => rule.severity)
    .sort((a, b) => (severityRank[b] || 0) - (severityRank[a] || 0))[0] || null;

  return {
    totalScore,
    band,
    answers: normalizedAnswers,
    triggeredRules,
    alertSeverity,
    pendingClinicalRules: definition.scoringRules.pendingClinicalRules || [],
  };
}

module.exports = {
  normalizeAnswers,
  getBand,
  evaluateQuestionnaire,
};
