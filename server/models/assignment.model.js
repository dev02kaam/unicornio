function createCenterAssignmentModel(input) {
  return {
    id: input.id,
    userId: input.userId,
    centerId: input.centerId,
    role: input.role,
    isPrimary: input.isPrimary ?? false,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function createGroupAssignmentModel(input) {
  return {
    id: input.id,
    userId: input.userId,
    groupId: input.groupId,
    role: input.role,
    isPrimary: input.isPrimary ?? false,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = {
  createCenterAssignmentModel,
  createGroupAssignmentModel,
};
