const bcrypt = require('bcryptjs');

const demoPassword = 'Demo1234!';

function createDemoUsers() {
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(demoPassword, 10);

  return [
    {
      id: '1',
      name: 'Admin Unicornio',
      email: 'admin@unicornio.local',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '2',
      name: 'Profesional Unicornio',
      email: 'profesional@unicornio.local',
      passwordHash,
      role: 'PROFESSIONAL',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '3',
      name: 'Alumno Unicornio',
      email: 'alumno@unicornio.local',
      passwordHash,
      role: 'STUDENT',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoUsers, demoPassword };

