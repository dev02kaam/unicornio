function createDemoGroups() {
  const now = new Date().toISOString();

  return [
    {
      id: 'group-1',
      centerId: 'center-1',
      academicYearId: 'academic-year-1',
      name: '1º A',
      code: '1A',
      stage: 'PRIMARIA',
      course: '1',
      shift: 'Mañana',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'group-2',
      centerId: 'center-1',
      academicYearId: 'academic-year-1',
      name: '2º B',
      code: '2B',
      stage: 'PRIMARIA',
      course: '2',
      shift: 'Mañana',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'group-3',
      centerId: 'center-2',
      academicYearId: 'academic-year-1',
      name: '3º ESO A',
      code: '3ESOA',
      stage: 'SECUNDARIA',
      course: '3',
      shift: 'Mañana',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'group-4',
      centerId: 'center-2',
      academicYearId: 'academic-year-1',
      name: '4º ESO B',
      code: '4ESOB',
      stage: 'SECUNDARIA',
      course: '4',
      shift: 'Mañana',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoGroups };
