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
const childProfileTitle = document.getElementById('child-profile-title');
const childContextTitle = document.getElementById('child-context-title');
const childConsentsTitle = document.getElementById('child-consents-title');
const childName = document.getElementById('child-name');
const childEmail = document.getElementById('child-email');
const childStatus = document.getElementById('child-status');
const childRole = document.getElementById('child-role');
const childBirthDate = document.getElementById('child-birth-date');
const childAge = document.getElementById('child-age');
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
const childLinksPanel = document.getElementById('child-links-panel');
const childCentersCount = document.getElementById('child-centers-count');
const childGroupsCount = document.getElementById('child-groups-count');
const childCentersList = document.getElementById('child-centers-list');
const childGroupsList = document.getElementById('child-groups-list');
const childConsentsCount = document.getElementById('child-consents-count');
const childConsentsPending = document.getElementById('child-consents-pending');
const childConsentsAccepted = document.getElementById('child-consents-accepted');
const childConsentsOther = document.getElementById('child-consents-other');
const escapeDynamicHtml = window.escapeHtml;

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

function formatDateOnly(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function calculateAge(value) {
  if (!value) {
    return null;
  }

  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const hasBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= birthDate.getDate());
  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
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

function renderConsents(consentSummary, role) {
  const isStudent = String(role || '').toUpperCase() === 'STUDENT';
  if (childConsentsCount) {
    const label = isStudent
      ? (consentSummary.total === 1 ? 'permiso' : 'permisos')
      : (consentSummary.total === 1 ? 'consentimiento' : 'consentimientos');
    childConsentsCount.textContent = `${consentSummary.total} ${label}`;
  }
  if (childConsentsPending) childConsentsPending.textContent = String(consentSummary.pending);
  if (childConsentsAccepted) childConsentsAccepted.textContent = String(consentSummary.accepted);
  if (childConsentsOther) childConsentsOther.textContent = String(consentSummary.rejected + consentSummary.revoked + consentSummary.expired);

  if (isStudent) {
    const cards = document.querySelectorAll('.child-consent-summary .dashboard-quickcard');
    const copy = [
      ['Esperando respuesta', 'Tu familia todavía tiene que revisar estas solicitudes.'],
      ['Todo listo', 'Permisos que ya están preparados.'],
      ['Otros', 'Permisos que cambiaron o ya no están activos.'],
    ];
    cards.forEach((card, index) => {
      if (!copy[index]) return;
      const label = card.querySelector('.quickcard-label');
      const description = card.querySelector('.quickcard-email');
      if (label) label.textContent = copy[index][0];
      if (description) description.textContent = copy[index][1];
    });
  }
}

function renderTeacher(teacher, group) {
  if (childTeacherName) childTeacherName.textContent = teacher?.name || 'Sin profesor asignado';
  if (childTeacherLine) childTeacherLine.textContent = teacher ? `Profesor/a de ${group?.name || 'este grupo'}` : 'El grupo no tiene profesor visible.';
  if (childTeacherPill) childTeacherPill.textContent = teacher ? 'Asignado' : 'Pendiente';
  if (childTeacherEmail) childTeacherEmail.textContent = teacher?.email || 'Email no disponible';
  if (childTeacherStatus) childTeacherStatus.textContent = teacher?.isActive ? 'Activo' : 'Sin asignación';
}

function renderAssignments(assignments, context, role) {
  const centerAssignments = (assignments?.centers || []).filter((item) => item.center);
  const groupAssignments = (assignments?.groups || []).filter((item) => item.group);
  const primaryCenter = centerAssignments.find((item) => item.isPrimary) || centerAssignments[0] || null;
  const primaryGroup = groupAssignments.find((item) => item.isPrimary) || groupAssignments[0] || null;
  const shouldShowLinksPanel = String(role || '').toUpperCase() !== 'FAMILY' && (centerAssignments.length > 1 || groupAssignments.length > 1);

  setPanelVisible(childLinksPanel, shouldShowLinksPanel);

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
            <strong>${escapeDynamicHtml(assignment.center?.name || 'Centro sin nombre')}</strong>
            <small>${escapeDynamicHtml(assignment.center?.code || '-')} · ${escapeDynamicHtml(assignment.center?.city || '-')}</small>
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
            <strong>${escapeDynamicHtml(assignment.group?.name || 'Grupo sin nombre')}</strong>
            <small>${escapeDynamicHtml(assignment.group?.code || '-')} · ${escapeDynamicHtml(assignment.group?.stage || '-')} · ${escapeDynamicHtml(assignment.group?.shift || '-')}</small>
          </span>
          <span class="table-badge">${assignment.isPrimary ? 'Principal' : 'Vinculado'}</span>
        </article>
      `).join('');
    }
  }

  if (centerAssignments.length || groupAssignments.length) {
    childContextNote.textContent = String(role || '').toUpperCase() === 'STUDENT'
      ? 'Este es tu cole y tu clase ahora mismo.'
      : `${centerAssignments.length} centro(s) y ${groupAssignments.length} grupo(s) asociados.`;
  } else {
    childContextNote.textContent = String(role || '').toUpperCase() === 'STUDENT'
      ? 'Todavía no aparece tu cole o tu clase. Una persona adulta del centro puede ayudarte.'
      : 'No hay centros ni grupos asociados en este momento.';
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

  if (!targetStudent) {
    setMessage(childStatusBanner, 'Todavía no hay un alumno vinculado a esta cuenta. Pide ayuda al centro para completar el vínculo.', true);
    if (childSummaryName) childSummaryName.textContent = 'Vínculo pendiente';
    if (childSummaryNote) childSummaryNote.textContent = 'El centro debe vincular un alumno antes de mostrar este espacio.';
    window.UnicornioCompanion?.setState('reassuring', {
      message: 'Aún falta un vínculo. Un adulto del centro puede ayudarte.',
      announce: true,
      ttl: 5000,
    });
    return { currentUser, targetStudent: null };
  }

  window.UnicornioCompanion?.setAgeContext(targetStudent);

  if (childRoleBadge) {
    childRoleBadge.textContent = role === 'STUDENT' ? 'Tu espacio' : getRoleLabel(role);
  }
  if (childTitle) {
    childTitle.textContent = role === 'FAMILY' ? 'Mi hijo/a' : 'Sobre mí';
  }
  document.title = `${role === 'FAMILY' ? 'Mi hijo/a' : 'Sobre mí'} | Proyecto Unicornio`;
  if (childHeroCopy) {
    childHeroCopy.textContent = role === 'FAMILY'
      ? 'Consulta el perfil completo de tu hijo/a, su centro, su grupo y los consentimientos relacionados.'
      : 'Tu cole, tu clase y tus permisos reunidos. Fácil de encontrar cuando lo necesites.';
  }

  if (role === 'STUDENT') {
    if (childProfileTitle) childProfileTitle.textContent = 'Mis datos';
    if (childContextTitle) childContextTitle.textContent = 'Mi cole y mi clase';
    if (childConsentsTitle) childConsentsTitle.textContent = 'Mis permisos';
    const summaryLabel = childSummaryName?.previousElementSibling;
    if (summaryLabel) summaryLabel.textContent = 'Tu resumen';
    if (childName?.previousElementSibling) childName.previousElementSibling.textContent = 'Mi nombre';
    if (childEmail?.previousElementSibling) childEmail.previousElementSibling.textContent = 'Mi email';
    if (childStatus?.previousElementSibling) childStatus.previousElementSibling.textContent = 'Mi cuenta';
    if (childRole?.previousElementSibling) childRole.previousElementSibling.textContent = 'Soy';
    if (childBirthDate?.previousElementSibling) childBirthDate.previousElementSibling.textContent = 'Mi cumpleaños';
    if (childAge?.previousElementSibling) childAge.previousElementSibling.textContent = 'Mi edad';
    if (childAgeRange?.previousElementSibling) childAgeRange.previousElementSibling.textContent = 'Mi etapa';
    const sectionBadges = document.querySelectorAll('.org-panel > .section-header .badge');
    if (sectionBadges[0]) sectionBadges[0].textContent = 'Sobre ti';
    if (sectionBadges[1]) sectionBadges[1].textContent = 'Tu día a día';
    const consentBadge = childConsentsTitle?.previousElementSibling;
    if (consentBadge) consentBadge.textContent = 'Lo importante';

    const consentAction = document.querySelector('.child-consent-summary + .action-row .button');
    if (consentAction) consentAction.textContent = 'Ver mis permisos';
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
      : 'Estos son tus datos. Si algo no encaja, cuéntaselo a una persona adulta de confianza.';
  }

  if (childName) childName.textContent = targetStudent?.name || '-';
  if (childEmail) childEmail.textContent = targetStudent?.email || '-';
  if (childStatus) childStatus.textContent = targetStudent?.isActive ? 'Activo' : 'Inactivo';
  if (childRole) childRole.textContent = getRoleLabel(targetStudent?.role);
  if (childBirthDate) childBirthDate.textContent = formatDateOnly(targetStudent?.birthDate);
  if (childAge) {
    const calculatedAge = calculateAge(targetStudent?.birthDate);
    childAge.textContent = calculatedAge === null ? 'Sin fecha' : `${calculatedAge} años`;
  }
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
  renderAssignments(assignmentsResponse.data, context, role);
  renderConsents(consentSummary, role);

  if (childSummaryNote) {
    if (role === 'STUDENT') {
      childSummaryNote.textContent = consentSummary.pending > 0
        ? `${consentSummary.pending === 1 ? 'Hay un permiso' : `Hay ${consentSummary.pending} permisos`} esperando respuesta de tu familia.`
        : `Todo tranquilo: ${consentSummary.accepted === 1 ? 'tienes un permiso listo' : `tienes ${consentSummary.accepted} permisos listos`}.`;
    } else {
      const pendingLabel = consentSummary.pending === 1 ? '1 consentimiento pendiente' : `${consentSummary.pending} consentimientos pendientes`;
      const acceptedLabel = consentSummary.accepted === 1 ? '1 aceptado' : `${consentSummary.accepted} aceptados`;
      childSummaryNote.textContent = `${pendingLabel} y ${acceptedLabel}.`;
    }
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
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      return;
    }
    setMessage(childStatusBanner, 'No hemos podido cargar la información. Comprueba tu conexión e inténtalo de nuevo.', true);
    window.UnicornioCompanion?.setState('reassuring', { announce: true, ttl: 5000 });
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
