const { ROLES } = require('./constants');

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

function normalizeRole(value) {
  return Object.values(ROLES).includes(value) ? value : ROLES.STUDENT;
}

function isOneOf(value, allowedValues) {
  return allowedValues.includes(value);
}

function pickDefined(input, keys) {
  return keys.reduce((result, key) => {
    if (input[key] !== undefined) {
      result[key] = input[key];
    }
    return result;
  }, {});
}

module.exports = {
  isEmail,
  isNonEmptyString,
  validatePassword,
  normalizeRole,
  isOneOf,
  pickDefined,
};
