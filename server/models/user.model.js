function sanitizeUser(user, { includePreferences = false } = {}) {
  if (!user) {
    return null;
  }

  const { passwordHash, unicornGender, ...publicUser } = user;
  return includePreferences
    ? { ...publicUser, unicornGender: unicornGender ?? null }
    : publicUser;
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
    linkedStudentId: input.linkedStudentId ?? null,
    birthDate: input.birthDate ?? null,
    ageRange: input.ageRange ?? null,
    unicornGender: input.unicornGender ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = { sanitizeUser, createUserModel };
