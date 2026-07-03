function createDemoUserCenterAssignments() {
  const now = new Date().toISOString();

  return [
    {
      id: 'uca-1',
      userId: '2',
      centerId: 'center-1',
      role: 'PROFESSIONAL',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'uca-2',
      userId: '4',
      centerId: 'center-1',
      role: 'SCHOOL_MANAGER',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'uca-3',
      userId: '3',
      centerId: 'center-1',
      role: 'STUDENT',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'uca-4',
      userId: '5',
      centerId: 'center-1',
      role: 'FAMILY',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createDemoUserGroupAssignments() {
  const now = new Date().toISOString();

  return [
    {
      id: 'uga-1',
      userId: '2',
      groupId: 'group-1',
      role: 'PROFESSIONAL',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'uga-2',
      userId: '3',
      groupId: 'group-1',
      role: 'STUDENT',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'uga-3',
      userId: '5',
      groupId: 'group-1',
      role: 'FAMILY',
      isPrimary: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

module.exports = {
  createDemoUserCenterAssignments,
  createDemoUserGroupAssignments,
};
