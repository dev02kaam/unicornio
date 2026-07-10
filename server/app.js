const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { env } = require('./config/env');
const { database } = require('./config/database');
const { healthRouter } = require('./routes/health.routes');
const { authRouter } = require('./routes/auth.routes');
const { usersRouter } = require('./routes/users.routes');
const { centersRouter } = require('./routes/centers.routes');
const { groupsRouter } = require('./routes/groups.routes');
const { assignmentsRouter } = require('./routes/assignments.routes');
const { consentsRouter } = require('./routes/consents.routes');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/centers', centersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', assignmentsRouter);
app.use('/api', consentsRouter);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function startServer() {
  try {
    await database.initialize();
    app.listen(env.port, () => {
      console.log(`Proyecto Unicornio escuchando en http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar Proyecto Unicornio:', error.message);
    process.exit(1);
  }
}

startServer();
