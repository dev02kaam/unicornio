const RESPONSE_SCALE = Object.freeze([
  { value: 'NEVER', label: 'Nunca', points: 0 },
  { value: 'SOMETIMES', label: 'A veces', points: 1 },
  { value: 'OFTEN', label: 'A menudo', points: 2 },
  { value: 'ALWAYS', label: 'Siempre', points: 3 },
]);

const childQuestions = [
  'Me siento triste aunque no haya pasado nada malo.',
  'Hay días en los que no tengo ganas de hacer nada.',
  'Me cuesta divertirme incluso cuando hago cosas que antes me gustaban.',
  'Pienso que los demás son mejores que yo.',
  'Me siento cansado/a aunque haya descansado.',
  'A veces me siento solo/a aunque esté con otras personas.',
  'Siento que las cosas no van a mejorar.',
  'Me siento mal conmigo mismo/a.',
  'Tengo ganas de llorar con facilidad.',
  'Me cuesta concentrarme en clase o cuando hago tareas.',
  'Pienso que no valgo tanto como otros niños/as.',
  'Me cuesta tener energía para hacer cosas.',
  'Me pongo nervioso/a cuando tengo que decidir algo.',
  'Me siento decepcionado/a conmigo mismo/a.',
  'Muy pocas cosas consiguen animarme.',
  'Me cuesta empezar el día o levantarme.',
  'Me siento menos importante que otras personas.',
  'Me cuesta ilusionarme con cosas nuevas.',
  'A veces siento que nada merece mucho la pena.',
  'Últimamente siento menos ganas de estar con los demás.',
];

const adolescentQuestions = [
  'Me siento triste gran parte del tiempo.',
  'Me cuesta disfrutar de las cosas que antes me gustaban.',
  'Siento que cada vez tengo menos ganas de hacer cosas.',
  'Pienso que no soy suficiente.',
  'Me siento agotado/a emocionalmente.',
  'Me siento solo/a incluso rodeado/a de gente.',
  'Siento que las cosas no van a cambiar para mejor.',
  'Me culpo demasiado por las cosas que hago mal.',
  'Tengo ganas de llorar o desaparecer.',
  'Me cuesta concentrarme incluso en cosas importantes.',
  'Me siento inferior a otras personas.',
  'Siento que ya nada me motiva realmente.',
  'Me cuesta tomar decisiones simples.',
  'Me decepciono mucho conmigo mismo/a.',
  'Me siento vacío/a o apagado/a emocionalmente.',
  'Me cuesta levantarme y afrontar el día.',
  'Pienso demasiado en todo lo malo.',
  'Siento que los demás están mejor sin mí.',
  'Me siento desconectado/a de las personas.',
  'Últimamente siento que estoy perdiendo la ilusión por casi todo.',
];

function numberedQuestions(items) {
  return items.map((text, index) => ({
    number: index + 1,
    type: 'LIKERT_SINGLE',
    text,
    required: true,
  }));
}

const depressiveMoodVersions = [
  {
    id: 'depressive-mood-9-12-v1',
    familyKey: 'depressive-mood',
    version: '1.0',
    title: 'Cuestionario de estado de ánimo y sintomatología depresiva',
    shortTitle: 'Estado de ánimo',
    ageMin: 9,
    ageMax: 12,
    instructions: 'Lee cada frase y marca la opción que mejor explique cómo te has sentido durante el último mes. No hay respuestas buenas ni malas.',
    responseScale: RESPONSE_SCALE,
    questions: numberedQuestions(childQuestions),
    scoringRules: {
      minimum: 0,
      maximum: 60,
      bands: [
        { key: 'EXPECTED_RANGE', min: 0, max: 13, label: 'Estado emocional dentro del rango esperado' },
        { key: 'MILD_DISTRESS', min: 14, max: 18, label: 'Malestar emocional leve' },
        { key: 'SIGNIFICANT_RISK', min: 19, max: 23, label: 'Riesgo emocional significativo' },
        { key: 'ELEVATED_RISK', min: 24, max: 29, label: 'Riesgo elevado' },
        { key: 'VERY_ELEVATED_RISK', min: 30, max: 34, label: 'Riesgo muy elevado' },
        { key: 'CLINICALLY_SIGNIFICANT', min: 35, max: 60, label: 'Nivel clínicamente significativo' },
      ],
      totalAlertThreshold: 24,
      sentinelRules: [
        { questionNumbers: [1, 7, 15, 19, 20], minimumPoints: 2, severity: 'ORANGE' },
      ],
      pendingClinicalRules: [],
    },
    sourceDocument: 'CUESTIONARIOS UNICORNIO.docx',
    status: 'EXPERIMENTAL',
  },
  {
    id: 'depressive-mood-13-16-v1',
    familyKey: 'depressive-mood',
    version: '1.0',
    title: 'Cuestionario de estado de ánimo y sintomatología depresiva',
    shortTitle: 'Estado de ánimo',
    ageMin: 13,
    ageMax: 16,
    instructions: 'Lee cada frase y responde cómo te has sentido durante el último mes. Marca la opción que mejor te represente. No hay respuestas buenas ni malas.',
    responseScale: RESPONSE_SCALE,
    questions: numberedQuestions(adolescentQuestions),
    scoringRules: {
      minimum: 0,
      maximum: 60,
      bands: [
        { key: 'EXPECTED_RANGE', min: 0, max: 13, label: 'Estado emocional dentro del rango esperado' },
        { key: 'MILD_RISK', min: 14, max: 18, label: 'Riesgo leve' },
        { key: 'RELEVANT_RISK', min: 19, max: 23, label: 'Riesgo emocional relevante' },
        { key: 'ELEVATED_RISK', min: 24, max: 29, label: 'Riesgo elevado' },
        { key: 'CLINICAL_RISK', min: 30, max: 34, label: 'Riesgo clínico' },
        { key: 'SEVERE_CLINICAL_RISK', min: 35, max: 60, label: 'Riesgo clínico severo' },
      ],
      totalAlertThreshold: 24,
      sentinelRules: [
        { questionNumbers: [7, 9, 15, 18, 20], minimumPoints: 2, severity: 'ORANGE' },
        { questionNumbers: [18], minimumPoints: 3, severity: 'RED' },
      ],
      pendingClinicalRules: [
        'Coexistencia de desesperanza, aislamiento y pérdida intensa de motivación: pendiente de umbrales clínicos explícitos.',
      ],
    },
    sourceDocument: 'CUESTIONARIOS UNICORNIO.docx',
    status: 'EXPERIMENTAL',
  },
];

module.exports = {
  RESPONSE_SCALE,
  depressiveMoodVersions,
};
