const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

module.exports = { hashPassword, comparePassword };
