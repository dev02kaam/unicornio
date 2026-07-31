function createCenterModel(input) {
  return {
    id: input.id,
    name: input.name,
    code: input.code || null,
    type: input.type || null,
    academicYearId: input.academicYearId || null,
    city: input.city || null,
    questionnaireSupportContact: input.questionnaireSupportContact || null,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = { createCenterModel };
