function createDemoCenters() {
  const now = new Date().toISOString();

  return [
    {
      id: 'center-1',
      name: 'Colegio Unicornio Centro',
      code: 'CUC',
      type: 'PRIMARY_SECONDARY',
      academicYearId: 'academic-year-1',
      city: 'Madrid',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'center-2',
      name: 'IES Unicornio Norte',
      code: 'IUN',
      type: 'SECONDARY',
      academicYearId: 'academic-year-1',
      city: 'Madrid',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoCenters };
