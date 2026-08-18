const { csrfSync } = require('csrf-sync');

const {
  generateToken,
  revokeToken,
  csrfSynchronisedProtection,
} = csrfSync({
  getTokenFromRequest: (req) => req.get('x-csrf-token'),
  skipCsrfProtection: (req) => req.originalUrl.split('?')[0] === '/api/auth/oidc/callback',
});

module.exports = {
  generateCsrfToken: generateToken,
  revokeCsrfToken: revokeToken,
  csrfSynchronisedProtection,
};
