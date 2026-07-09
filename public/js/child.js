const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const childRoleBadge = document.getElementById('child-role-badge');
const childTitle = document.getElementById('child-title');
const childHeroCopy = document.getElementById('child-hero-copy');
const childSummaryName = document.getElementById('child-summary-name');
const childSummaryNote = document.getElementById('child-summary-note');
const childStatusBanner = document.getElementById('child-status-banner');
const childProfileNote = document.getElementById('child-profile-note');
const childName = document.getElementById('child-name');
const childEmail = document.getElementById('child-email');
const childStatus = document.getElementById('child-status');
const childRole = document.getElementById('child-role');
const childAgeRange = document.getElementById('child-age-range');
const childFamilyLabel = document.getElementById('child-family-label');
const childFamilyName = document.getElementById('child-family-name');
const childId = document.getElementById('child-id');
const childCreatedAt = document.getElementById('child-created-at');
const childUpdatedAt = document.getElementById('child-updated-at');
const childContextNote = document.getElementById('child-context-note');
const childCenterName = document.getElementById('child-center-name');
const childCenterLine = document.getElementById('child-center-line');
const childCenterPill = document.getElementById('child-center-pill');
const childCenterCity = document.getElementById('child-center-city');
const childCenterCode = document.getElementById('child-center-code');
const childCenterYear = document.getElementById('child-center-year');
const childGroupName = document.getElementById('child-group-name');
const childGroupLine = document.getElementById('child-group-line');
const childGroupPill = document.getElementById('child-group-pill');
const childGroupUsers = document.getElementById('child-group-users');
const childGroupStage = document.getElementById('child-group-stage');
const childGroupShift = document.getElementById('child-group-shift');
const childTeacherName = document.getElementById('child-teacher-name');
const childTeacherLine = document.getElementById('child-teacher-line');
const childTeacherPill = document.getElementById('child-teacher-pill');
const childTeacherEmail = document.getElementById('child-teacher-email');
const childTeacherStatus = document.getElementById('child-teacher-status');
const childCentersCount = document.getElementById('child-centers-count');
const childGroupsCount = document.getElementById('child-groups-count');
const childCentersList = document.getElementById('child-centers-list');
const childGroupsList = document.getElementById('child-groups-list');
const childConsentsCount = document.getElementById('child-consents-count');
const childConsentsPending = document.getElementById('child-consents-pending');
const childConsentsAccepted = document.getElementById('child-consents-accepted');
const childConsentsOther = document.getElementById('child-consents-other');

const consentStatusLabels = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  REVOKED: 'Revocado',
  EXPIRED: 'Caducado',
};

const consentStatusClass = {
  PENDING: 'table-badge',
  ACCEPTED: 'table-badge consent-badge--success',
  REJECTED: 'table-badge consent-badge--danger',
  REVOKED: 'table-badge consent-badge--danger',
  EXPIRED: 'table-badge consent-badge--muted',
};

function setMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function setPanelVisible(panel, visible, displayValue = 'block') {
  if (!panel) {
    return;
  }

  panel.hidden = !visible;
  panel.style.display = visible ? displayValue : 'none';
}

function formatDate(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getRoleLabel(role) {
  const labels = {
    FAMILY: 'Familia',
    STUDENT: 'Alumno',
  };

  return labels[String(role || '').toUpperCase()] || 'Usuario';
}

function buildConsentSummary(consents, studentId) {
  const relevant = (consents || []).filter((consent) => String(consent.studentId || '') === String(studentId || ''));

  return {
    total: relevant.length,
    pending: relevant.filter((consent) => consent.status === 'PENDING').length,
    accepted: relevant.filter((consent) => consent.status === 'ACCEPTED').length,
    rejected: relevant.filter((consent) => consent.status === 'REJECTED').length,
    revoked: relevant.filter((consent) => consent.status === 'REVOKED').length,
    expired: relevant.filter((consent) => consent.status === 'EXPIRED').length,
    list: relevant,
  };
}

function renderConsents(consentSummary) {
  if (childConsentsCount) {
    childConsentsCount.textContent = `${consentSummary.total} ${consentSummary.total === 1 ? 'consentimiento' : 'consentimientos'}`;
  }
  if (childConsentsPending) childConsentsPending.textContent = String(consentSummary.pending);
  if (childConsentsAccepted) childConsentsAccepted.textContent = String(consentSummary.accepted);
  if (childConsentsOther) childConsentsOther.textContent = String(consentSummary.rejected + consentSummary.revoked + consentSummary.expired);
}

function renderTeacher(teacher, group) {
  if (childTeacherName) childTeacherName.textContent = teacher?.name || 'Sin profesor asignado';
  if (childTeacherLine) childTeacherLine.textContent = teacher ? `Profesor/a de ${group?.name || 'este grupo'}` : 'El grupo no tiene profesor visible.';
  if (childTeacherPill) childTeacherPill.textContent = teacher ? 'Asignado' : 'Pendiente';
  if (childTeacherEmail) childTeacherEmail.textContent = teacher?.email || 'Email no disponible';
  if (childTeacherStatus) childTeacherStatus.textContent = teacher?.isActive ? 'Activo' : 'Sin asignación';
}

function renderAssignments(assignments, context) {
  const centerAssignments = (assignments?.centers || []).filter((item) => item.center);
  const groupAssignments = (assignments?.groups || []).filter((item) => item.group);
  const primaryCenter = centerAssignments.find((item) => item.isPrimary) || centerAssignments[0] || null;
  const primaryGroup = groupAssignments.find((item) => item.isPrimary) || groupAssignments[0] || null;

  if (childCenterName) childCenterName.textContent = primaryCenter?.center?.name || 'Sin centro';
  if (childCenterLine) childCenterLine.textContent = primaryCenter ? `${primaryCenter.center?.code || '-'} · ${primaryCenter.center?.city || 'Sin ciudad'}` : 'Sin centro vinculado';
  if (childCenterPill) childCenterPill.textContent = primaryCenter?.isPrimary ? 'Principal' : 'Vinculado';
  if (childCenterCity) childCenterCity.textContent = `Ciudad: ${primaryCenter?.center?.city || '-'}`;
  if (childCenterCode) childCenterCode.textContent = `Código: ${primaryCenter?.center?.code || '-'}`;
  if (childCenterYear) childCenterYear.textContent = `Curso: ${primaryCenter?.center?.academicYear?.label || '-'}`;

  if (childGroupName) childGroupName.textContent = primaryGroup?.group?.name || 'Sin grupo';
  if (childGroupLine) childGroupLine.textContent = primaryGroup
    ? `${primaryGroup.group?.code || '-'} · ${primaryGroup.group?.stage || '-'} · ${primaryGroup.group?.course || '-'}`
    : 'Sin grupo vinculado';
  if (childGroupPill) childGroupPill.textContent = primaryGroup?.isPrimary ? 'Principal' : 'Vinculado';
  if (childGroupUsers) childGroupUsers.textContent = `Usuarios: ${primaryGroup?.group?.usersCount || 0}`;
  if (childGroupStage) childGroupStage.textContent = `Etapa: ${primaryGroup?.group?.stage || '-'}`;
  if (childGroupShift) childGroupShift.textContent = `Turno: ${primaryGroup?.group?.shift || '-'}`;
  renderTeacher(context?.teacher || null, primaryGroup?.group || context?.group || null);

  if (childCentersCount) childCentersCount.textContent = String(centerAssignments.length);
  if (childGroupsCount) childGroupsCount.textContent = String(groupAssignments.length);

  if (childCentersList) {
    if (!centerAssignments.length) {
      childCentersList.innerHTML = `
        <article class="empty-state">
          <strong>Sin centros asociados</strong>
          <span>No hay centros vinculados a este alumno.</span>
        </article>
      `;
    } else {
      childCentersList.innerHTML = centerAssignments.map((assignment) => `
        <article class="toggle-row">
          <span>
            <strong>${assignment.center?.name || 'Centro sin nombre'}</strong>
            <small>${assignment.center?.code || '-'} · ${assignment.center?.city || '-'}</small>
          </span>
          <span class="table-badge">${assignment.isPrimary ? 'Principal' : 'Vinculado'}</span>
        </article>
      `).join('');
    }
  }

  if (childGroupsList) {
    if (!groupAssignments.length) {
      childGroupsList.innerHTML = `
        <article class="empty-state">
          <strong>Sin grupos asociados</strong>
          <span>No hay grupos vinculados a este alumno.</span>
        </article>
      `;
    } else {
      childGroupsList.innerHTML = groupAssignments.map((assignment) => `
        <article class="toggle-row">
          <span>
            <strong>${assignment.group?.name || 'Grupo sin nombre'}</strong>
            <small>${assignment.group?.code || '-'} · ${assignment.group?.stage || '-'} · ${assignment.group?.shift || '-'}</small>
          </span>
          <span class="table-badge">${assignment.isPrimary ? 'Principal' : 'Vinculado'}</span>
        </article>
      `).join('');
    }
  }

  if (centerAssignments.length || groupAssignments.length) {
    childContextNote.textContent = `${centerAssignments.length} centro(s) y ${groupAssignments.length} grupo(s) asociados.`;
  } else {
    childContextNote.textContent = 'No hay centros ni grupos asociados en este momento.';
  }
}

async function doLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Demo logout local.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  const currentUser = response.data.user;
  const role = String(currentUser.role || '').toUpperCase();

  if (!['FAMILY', 'STUDENT'].includes(role)) {
    window.location.replace('/dashboard.html');
    return null;
  }

  const context = currentUser.context || {};
  const targetStudent = role === 'FAMILY' ? context.linkedStudent : currentUser;

  if (childRoleBadge) {
    childRoleBadge.textContent = getRoleLabel(role);
  }
  if (childTitle) {
    childTitle.textContent = role === 'FAMILY' ? 'Mi hijo/a' : 'Mi perfil';
  }
  if (childHeroCopy) {
    childHeroCopy.textContent = role === 'FAMILY'
      ? 'Consulta el perfil completo de tu hijo/a, su centro, su grupo y los consentimientos relacionados.'
      : 'Consulta tu perfil completo, tu centro, tu grupo y los consentimientos relacionados.';
  }

  if (profileNameElement) profileNameElement.textContent = currentUser.name || '-';
  if (profileEmailElement) profileEmailElement.textContent = currentUser.email || '-';

  if (childSummaryName) {
    childSummaryName.textContent = targetStudent?.name || 'Sin alumno';
  }
  if (childSummaryNote) {
    childSummaryNote.textContent = role === 'FAMILY'
      ? 'Resumen detallado del alumno vinculado a tu cuenta.'
      : 'Resumen detallado de tu cuenta de alumno.';
  }
  if (childProfileNote) {
    childProfileNote.textContent = role === 'FAMILY'
      ? 'Todos los datos visibles aquí pertenecen al alumno vinculado.'
      : 'Aquí ves tu información y tu contexto académico.';
  }

  if (childName) childName.textContent = targetStudent?.name || '-';
  if (childEmail) childEmail.textContent = targetStudent?.email || '-';
  if (childStatus) childStatus.textContent = targetStudent?.isActive ? 'Activo' : 'Inactivo';
  if (childRole) childRole.textContent = getRoleLabel(targetStudent?.role);
  if (childAgeRange) childAgeRange.textContent = targetStudent?.ageRange || 'Sin rango';
  if (childFamilyLabel) childFamilyLabel.textContent = role === 'FAMILY' ? 'Cuenta familiar' : 'Familia vinculada';
  if (childFamilyName) childFamilyName.textContent = role === 'FAMILY'
    ? currentUser.name || '-'
    : context.linkedFamily?.name || 'Sin familia vinculada';
  if (childId) childId.textContent = targetStudent?.id || '-';
  if (childCreatedAt) childCreatedAt.textContent = formatDate(targetStudent?.createdAt);
  if (childUpdatedAt) childUpdatedAt.textContent = formatDate(targetStudent?.updatedAt);

  const [assignmentsResponse, consentsResponse] = await Promise.all([
    apiRequest(`/users/${targetStudent.id}/assignments`),
    apiRequest('/consents'),
  ]);

  const consentSummary = buildConsentSummary(consentsResponse.data.consents || [], targetStudent.id);
  renderAssignments(assignmentsResponse.data, context);
  renderConsents(consentSummary);

  if (childSummaryNote) {
    const pendingLabel = consentSummary.pending === 1 ? '1 consentimiento pendiente' : `${consentSummary.pending} consentimientos pendientes`;
    const acceptedLabel = consentSummary.accepted === 1 ? '1 aceptado' : `${consentSummary.accepted} aceptados`;
    childSummaryNote.textContent = `${pendingLabel} y ${acceptedLabel}.`;
  }

  return { currentUser, targetStudent };
}

async function init() {
  if (!getToken()) {
    window.location.replace('/login.html');
    return;
  }

  try {
    await loadProfile();
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
  }
});

init();
