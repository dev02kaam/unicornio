function createDemoLegalTextVersions() {
  const now = new Date().toISOString();

  return [
    {
      id: 'legal-text-1',
      version: '1.0',
      title: 'Consentimiento familiar provisional',
      content: 'Texto legal pendiente de validación por especialistas en protección de datos y derecho digital. Este contenido es demostrativo y no constituye texto legal definitivo.',
      isActive: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'legal-text-2',
      version: '0.9',
      title: 'Borrador previo de consentimiento',
      content: 'Texto legal pendiente de validación por especialistas en protección de datos y derecho digital. Borrador histórico de demostración.',
      isActive: false,
      effectiveFrom: '2025-09-01',
      effectiveTo: '2025-12-31',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoLegalTextVersions };
