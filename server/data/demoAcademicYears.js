function createDemoAcademicYears() {
  const now = new Date().toISOString();

  return [
    {
      id: 'academic-year-1',
      label: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
      stage: 'PRIMARY_SECONDARY',
      isCurrent: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoAcademicYears };
