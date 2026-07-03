function createGroupModel(input) {
  return {
    id: input.id,
    centerId: input.centerId,
    academicYearId: input.academicYearId || null,
    name: input.name,
    code: input.code || null,
    stage: input.stage || null,
    course: input.course || null,
    shift: input.shift || null,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = { createGroupModel };
