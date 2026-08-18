const { AppError } = require('../utils/errors');

function formatIssues(issues) {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'request';
    return `${path}: ${issue.message}`;
  });
}

function validateRequest(schemas) {
  return (req, _res, next) => {
    for (const [location, schema] of Object.entries(schemas)) {
      const input = location === 'body' && req[location] === undefined ? {} : req[location];
      const result = schema.safeParse(input);
      if (!result.success) {
        return next(new AppError(
          'Validacion fallida.',
          400,
          formatIssues(result.error.issues),
          'BAD_REQUEST',
        ));
      }
      req[location] = result.data;
    }

    return next();
  };
}

module.exports = { validateRequest, formatIssues };
