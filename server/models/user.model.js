function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function createUserModel(input) {
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role,
    isActive: input.isActive ?? true,
    schoolId: input.schoolId ?? null,
    groupId: input.groupId ?? null,
    ageRange: input.ageRange ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = { sanitizeUser, createUserModel };

