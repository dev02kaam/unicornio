function createAcademicYearModel(input) {
  return {
    id: input.id,
    label: input.label,
    startDate: input.startDate,
    endDate: input.endDate,
    stage: input.stage || null,
    isCurrent: input.isCurrent ?? false,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = { createAcademicYearModel };
