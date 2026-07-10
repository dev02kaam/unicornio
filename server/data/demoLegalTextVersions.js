function createDemoLegalTextVersions() {
  const now = new Date().toISOString();

  return [
    {
      id: 'legal-text-1',
      version: '1.0',
      title: 'Consentimiento familiar',
      content: 'La persona responsable puede consultar y gestionar aquí las autorizaciones de participación del alumnado.',
      isActive: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'legal-text-2',
      version: '0.9',
      title: 'Consentimiento familiar (versión anterior)',
      content: 'Versión anterior del texto de autorización familiar.',
      isActive: false,
      effectiveFrom: '2025-09-01',
      effectiveTo: '2025-12-31',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = { createDemoLegalTextVersions };
