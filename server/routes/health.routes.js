const express = require('express');

const healthRouter = express.Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Proyecto Unicornio operativo.',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = { healthRouter };

