function normalizeAnswers(definition, answers) {
  const values = new Map();
  (answers || []).forEach((answer) => {
    values.set(Number(answer.questionNumber), String(answer.value || '').toUpperCase());
  });

  const reverseQuestionNumbers = new Set(
    definition.scoringRules?.reverseQuestionNumbers || [],
  );

  return definition.questions.map((question) => {
    const value = values.get(question.number);
    const option = definition.responseScale.find((item) => item.value === value);
    if (!option) {
      throw new Error(`Falta una respuesta válida para la pregunta ${question.number}.`);
    }
    const rawPoints = Number(option.points);
    return {
      questionNumber: question.number,
      value: option.value,
      label: option.label,
      rawPoints,
      points: reverseQuestionNumbers.has(question.number) ? 3 - rawPoints : rawPoints,
    };
  });
}

function getBand(scoringRules, totalScore) {
  return scoringRules.bands.find((band) => totalScore >= band.min && totalScore <= band.max) || null;
}

function matchesSentinelRule(rule, points) {
  if (Number.isFinite(rule.minimumPoints) && points < rule.minimumPoints) {
    return false;
  }
  if (Number.isFinite(rule.maximumPoints) && points > rule.maximumPoints) {
    return false;
  }
  return Number.isFinite(rule.minimumPoints) || Number.isFinite(rule.maximumPoints);
}

function calculateSubscales(scoringRules, answers) {
  return (scoringRules.subscales || []).map((subscale) => ({
    key: subscale.key,
    label: subscale.label,
    score: answers
      .filter((answer) => subscale.questionNumbers.includes(answer.questionNumber))
      .reduce((sum, answer) => sum + answer.points, 0),
  }));
}

function evaluateQuestionnaire(definition, answers) {
  const normalizedAnswers = normalizeAnswers(definition, answers);
  const totalScore = normalizedAnswers.reduce((sum, answer) => sum + answer.points, 0);
  const subscales = calculateSubscales(definition.scoringRules, normalizedAnswers);
  const riskSubscales = subscales.filter(
    (subscale) => subscale.key !== 'PROTECTIVE_VULNERABILITY',
  );
  const bandScore = definition.scoringRules.bandScoreSource === 'MAX_RISK_SUBSCALE'
    ? Math.max(0, ...riskSubscales.map((subscale) => subscale.score))
    : totalScore;
  const band = getBand(definition.scoringRules, bandScore);
  if (!band) {
    throw new Error('La puntuación no corresponde a ninguna banda configurada.');
  }

  const triggeredRules = [];
  const severityRank = { YELLOW: 1, ORANGE: 2, RED: 3 };

  if (
    Number.isFinite(definition.scoringRules.totalAlertThreshold)
    && totalScore >= definition.scoringRules.totalAlertThreshold
  ) {
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
      if (answer && matchesSentinelRule(rule, answer.rawPoints)) {
        triggeredRules.push({
          type: 'SENTINEL_ITEM',
          severity: rule.severity,
          questionNumber,
          points: answer.rawPoints,
          minimumPoints: rule.minimumPoints,
          maximumPoints: rule.maximumPoints,
        });
      }
    });
  });

  const alertSeverity = triggeredRules
    .map((rule) => rule.severity)
    .sort((a, b) => (severityRank[b] || 0) - (severityRank[a] || 0))[0] || null;

  return {
    totalScore,
    bandScore,
    band,
    subscales,
    answers: normalizedAnswers,
    triggeredRules,
    alertSeverity,
    pendingClinicalRules: definition.scoringRules.pendingClinicalRules || [],
  };
}

module.exports = {
  normalizeAnswers,
  getBand,
  matchesSentinelRule,
  evaluateQuestionnaire,
};
