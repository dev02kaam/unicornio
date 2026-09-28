const { database } = require('../config/database');
const { env } = require('../config/env');
const { loadQuestionnaireContext, mapReferences } = require('../repositories/questionnaire-context.repository');

async function questionnaireContextMiddleware(req, res, next) {
  if (env.appProfile !== 'production') return next();
  try {
    const context = await database.transaction((client) => loadQuestionnaireContext(req.user, client));
    req.questionnaireContext = context;
    const id = context.toStorage.get(req.user.id) || req.user.id;
    req.user = { ...req.user, ...context.collections.users.find((user) => user.id === id), id };
    req.body = mapReferences(req.body, context.toStorage);
    const sendJson = res.json.bind(res);
    res.json = (body) => sendJson(mapReferences(body, context.toPublic));
    // Keep legacy IDs used by existing encrypted answers and RLS, while the
    // browser continues to use public UUIDs for profiles and organization.
    return database.runAsUser(req.auth.sub, () => database.runWithReadCollections(context.collections, next), {
      legacyUserId: id,
    });
  } catch (error) {
    return next(error);
  }
}

function questionnaireParamsMiddleware(req, _res, next) {
  if (req.questionnaireContext) {
    req.params = mapReferences(req.params, req.questionnaireContext.toStorage);
  }
  next();
}

module.exports = { questionnaireContextMiddleware, questionnaireParamsMiddleware };
