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
      schoolId: null,
      groupId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '2',
      name: 'Profesor Unicornio',
      email: 'profesor@unicornio.local',
      passwordHash,
      role: 'TEACHER',
      isActive: true,
      schoolId: 'center-1',
      groupId: 'group-1',
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
      schoolId: 'center-1',
      groupId: 'group-1',
      ageRange: '12-14',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '4',
      name: 'Equipo Escolar Unicornio',
      email: 'school@unicornio.local',
      passwordHash,
      role: 'SCHOOL',
      isActive: true,
      schoolId: 'center-1',
      groupId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '5',
      name: 'Familia Unicornio',
      email: 'familia@unicornio.local',
      passwordHash,
      role: 'FAMILY',
      isActive: true,
      schoolId: null,
      groupId: null,
      linkedStudentId: '3',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '6',
      name: 'Profesional Autorizado Unicornio',
      email: 'profesional@unicornio.local',
      passwordHash,
      role: 'PROFESSIONAL',
      isActive: true,
      schoolId: 'center-1',
      groupId: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoUsers, demoPassword };
