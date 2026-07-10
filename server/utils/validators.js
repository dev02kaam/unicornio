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

function isRole(value) {
  return Object.values(ROLES).includes(value);
}

function isOneOf(value, allowedValues) {
  return allowedValues.includes(value);
}

function isISODateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeDateOnly(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (isISODateOnly(trimmedValue)) {
    return trimmedValue;
  }

  const spanishDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!spanishDateMatch) {
    return null;
  }

  const [, day, month, year] = spanishDateMatch;
  const isoDate = `${year}-${month}-${day}`;
  return isISODateOnly(isoDate) ? isoDate : null;
}

function isPastOrTodayDate(value) {
  const normalizedDate = normalizeDateOnly(value);
  if (!normalizedDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${normalizedDate}T00:00:00.000Z`);
  return date.getTime() <= today.getTime();
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
  isRole,
  isOneOf,
  isISODateOnly,
  normalizeDateOnly,
  isPastOrTodayDate,
  pickDefined,
};
