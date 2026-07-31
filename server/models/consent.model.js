function createConsentModel(input) {
  return {
    id: input.id,
    studentId: input.studentId,
    familyUserId: input.familyUserId,
    centerId: input.centerId,
    legalTextVersionId: input.legalTextVersionId,
    campaignId: input.campaignId ?? null,
    status: input.status,
    requestedByUserId: input.requestedByUserId,
    acceptedAt: input.acceptedAt ?? null,
    rejectedAt: input.rejectedAt ?? null,
    revokedAt: input.revokedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    revocationReason: input.revocationReason ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function createLegalTextVersionModel(input) {
  return {
    id: input.id,
    version: input.version,
    title: input.title,
    content: input.content,
    isActive: input.isActive ?? false,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function createConsentAuditLogModel(input) {
  return {
    id: input.id,
    consentId: input.consentId ?? null,
    action: input.action,
    performedByUserId: input.performedByUserId ?? null,
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt,
  };
}

module.exports = {
  createConsentModel,
  createLegalTextVersionModel,
  createConsentAuditLogModel,
};
