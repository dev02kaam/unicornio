const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const userDetailModal = document.getElementById('user-detail-modal');
const userDetailModalTitle = document.getElementById('user-detail-modal-title');
const userDetailNameElement = document.getElementById('user-detail-name');
const userDetailEmailElement = document.getElementById('user-detail-email');
const userDetailRoleElement = document.getElementById('user-detail-role');
const userDetailSchoolElement = document.getElementById('user-detail-school');
const userDetailLinkedStudentElement = document.getElementById('user-detail-linked-student');
const userDetailAssignmentsElement = document.getElementById('user-detail-assignments');
const userDetailEditForm = document.getElementById('user-detail-edit-form');
const userEditTitleElement = document.getElementById('user-edit-title');
const userEditHintElement = document.getElementById('user-edit-hint');
const userEditErrorElement = document.getElementById('user-edit-error');
const userEditSuccessElement = document.getElementById('user-edit-success');
const dashboardLinks = document.getElementById('dashboard-links');
const adminPanel = document.getElementById('admin-panel');
const createUserForm = document.getElementById('create-user-form');
const createUserError = document.getElementById('create-user-error');
const createUserSuccess = document.getElementById('create-user-success');
const refreshUsersButton = document.getElementById('refresh-users-button');
const createUserRoleSelect = document.getElementById('create-user-role');
const createUserCenterField = document.getElementById('create-user-center-field');
const createUserStudentField = document.getElementById('create-user-student-field');
const createUserBirthDateField = document.getElementById('create-user-birth-date-field');
const adminBirthDate = document.getElementById('admin-birth-date');
const adminSchoolSelect = document.getElementById('admin-school-select');
const adminStudentSelect = document.getElementById('admin-student-select');
const createUserHint = document.getElementById('create-user-hint');
const adminUsersHead = document.getElementById('admin-users-head');
const adminUsersBody = document.getElementById('admin-users-body');
const schoolPanel = document.getElementById('school-panel');
const schoolPanelNote = document.getElementById('school-panel-note');
const schoolCenterCity = document.getElementById('school-center-city');
const schoolCenterName = document.getElementById('school-center-name');
const schoolCenterLine = document.getElementById('school-center-line');
const schoolCenterGroups = document.getElementById('school-center-groups');
const schoolCenterUsers = document.getElementById('school-center-users');
const schoolCenterStatus = document.getElementById('school-center-status');
const schoolGroupsLink = document.getElementById('school-groups-link');
const schoolGroupsCount = document.getElementById('school-groups-count');
const professionalPanel = document.getElementById('professional-panel');
const professionalPanelNote = document.getElementById('professional-panel-note');
const professionalCenterCity = document.getElementById('professional-center-city');
const professionalCenterName = document.getElementById('professional-center-name');
const professionalCenterLine = document.getElementById('professional-center-line');
const professionalConsentsCount = document.getElementById('professional-consents-count');
const professionalCenterStatus = document.getElementById('professional-center-status');
const professionalCenterSummary = document.getElementById('professional-center-summary');
const professionalValidCount = document.getElementById('professional-valid-count');
const professionalPendingCount = document.getElementById('professional-pending-count');
const professionalOtherCount = document.getElementById('professional-other-count');
const professionalLegalLink = document.getElementById('professional-legal-link');
const relationshipPanel = document.getElementById('relationship-panel');
const relationshipPanelBadge = document.getElementById('relationship-panel-badge');
const relationshipPanelTitle = document.getElementById('relationship-panel-title');
const relationshipPanelBody = document.getElementById('relationship-panel-body');
const dashboardWelcome = document.getElementById('dashboard-welcome');
const dashboardRoleLabel = document.getElementById('dashboard-role-label');
const dashboardSubtitle = document.getElementById('dashboard-subtitle');

let currentUser = null;
let currentEditingUserId = null;
let availableCenters = [];
let availableGroups = [];
let availableCenterStudents = [];
let adminUsers = [];

function escapeDashboardMarkup(value) {
  return window.escapeHtml(value);
}

const getDashboardUserWarning = window.getDataQualityWarning;
const showDestructiveActionConfirm = window.confirmDestructiveAction;

const centerTypeLabels = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PRIMARIA_SECUNDARIA: 'Primaria y secundaria',
  OTRO: 'Otro',
};

const roleLabels = {
  ADMIN: 'Administrador',
  SCHOOL: 'Centro',
  TEACHER: 'Profesor',
  PROFESSIONAL: 'Profesional autorizado',
  STUDENT: 'Alumno',
  FAMILY: 'Familia',
};

const adminUserColumns = setupColumnManager({
  modalId: 'admin-users-columns-modal',
  listId: 'admin-users-columns-list',
  triggerSelector: '[data-open-modal="admin-users-columns-modal"]',
  storageKey: 'unicornio-admin-users-columns',
  defaultColumns: [
    { id: 'name', label: 'Nombre', visible: true },
    { id: 'email', label: 'Email', visible: true },
    { id: 'role', label: 'Rol', visible: true },
    { id: 'school', label: 'Centro', visible: true },
    { id: 'linkedStudent', label: 'Estudiante vinculado', visible: true },
    { id: 'status', label: 'Estado', visible: true },
    { id: 'actions', label: 'Acciones', visible: true },
  ],
  onChange: () => renderAdminUsersTable(),
});

function setPanelVisible(panel, visible, displayValue = 'block') {
  if (!panel) {
    return;
  }

  panel.hidden = !visible;
  panel.style.display = visible ? displayValue : 'none';
}

function setMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function resetTransientUiState() {
  closeModalById('profile-modal');
  closeModalById('user-detail-modal');
  closeModalById('create-user-modal');
  closeModalById('admin-users-columns-modal');
  document.body.classList.remove('modal-open');
}

function formatCenterLine(center) {
  const parts = [];
  if (center.code) {
    parts.push(center.code);
  }
  if (center.type) {
    parts.push(centerTypeLabels[center.type] || center.type);
  }
  if (center.academicYear?.label) {
    parts.push(center.academicYear.label);
  }
  return parts.join(' · ') || 'Centro vinculado';
}

function getCenterLabel(centerId) {
  const center = availableCenters.find((item) => item.id === centerId);
  return center ? center.name : 'Sin vincular';
}

function getUserLabel(userId) {
  const user = adminUsers.find((item) => item.id === userId) || availableCenterStudents.find((item) => item.id === userId);
  return user ? user.name : 'Sin vincular';
}

function getActiveStudents() {
  return adminUsers.filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
}

function isRoleRequiringCenter(role) {
  return ['TEACHER', 'PROFESSIONAL', 'STUDENT'].includes(String(role || '').toUpperCase());
}

function isStudentRole(role) {
  return String(role || '').toUpperCase() === 'STUDENT';
}

function isFamilyRole(role) {
  return String(role || '').toUpperCase() === 'FAMILY';
}

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

function renderDashboardQuickActions(role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (!dashboardLinks) {
    return;
  }

  const actions = [];

  if (normalizedRole === 'ADMIN') {
    actions.push(
      { label: 'Usuarios', href: '/users.html', icon: 'users' },
      { label: 'Centros', href: '/centers.html', icon: 'school' },
      { label: 'Grupos', href: '/groups.html', icon: 'groups' },
      { label: 'Consentimientos', href: '/consents.html', icon: 'consent' },
      { label: 'Texto legal', href: '/legal.html', icon: 'legal' },
    );
  } else if (normalizedRole === 'SCHOOL' || normalizedRole === 'TEACHER') {
    actions.push(
      { label: 'Mi centro', href: '/centers.html', icon: 'school' },
      { label: 'Grupos', href: '/groups.html', icon: 'groups' },
      { label: 'Consentimientos', href: '/consents.html', icon: 'consent' },
    );
  } else if (normalizedRole === 'PROFESSIONAL') {
    actions.push({ label: 'Consentimientos', href: '/consents.html', icon: 'consent' });
  } else if (normalizedRole === 'FAMILY') {
    actions.push(
      { label: 'Mi hijo/a', href: '/child.html', icon: 'child' },
      { label: 'Consentimientos', href: '/consents.html', icon: 'consent' },
    );
  } else if (normalizedRole === 'STUDENT') {
    actions.push(
      { label: 'Mi perfil', href: '/child.html', icon: 'profile' },
      { label: 'Consentimientos', href: '/consents.html', icon: 'consent' },
    );
  }

  dashboardLinks.innerHTML = actions
    .map((action) => `<a class="button secondary" href="${escapeDashboardMarkup(action.href)}" aria-label="${escapeDashboardMarkup(action.label)}" data-tooltip="${escapeDashboardMarkup(action.label)}">${getAppIcon(action.icon)}<span class="button-label">${escapeDashboardMarkup(action.label)}</span></a>`)
    .join('');
}

function getCreateUserFieldMode(role) {
  const normalizedRole = String(role || '').toUpperCase();

  if (normalizedRole === 'FAMILY') {
    return 'student';
  }

  if (['STUDENT', 'TEACHER', 'PROFESSIONAL'].includes(normalizedRole)) {
    return 'center';
  }

  return 'none';
}

function updateCreateUserHint() {
  if (!createUserHint || !createUserRoleSelect) {
    return;
  }

  const role = createUserRoleSelect.value;
  const fieldMode = getCreateUserFieldMode(role);

  if (fieldMode === 'student') {
    createUserHint.textContent = 'Las familias solo necesitan un estudiante vinculado.';
    return;
  }

  if (fieldMode === 'center') {
    createUserHint.textContent = role === 'TEACHER'
      ? 'El profesor se asigna a un centro y a sus grupos.'
      : 'Este tipo de usuario necesita un centro asignado.';
    return;
  }

  if (role === 'ADMIN') {
    createUserHint.textContent = 'Las cuentas de administración no necesitan centro ni estudiante vinculado.';
    return;
  }

  createUserHint.textContent = 'El tipo de cuenta determina qué relaciones se deben completar.';
}

function updateCreateUserFieldVisibility() {
  if (!createUserRoleSelect) {
    return;
  }

  const role = createUserRoleSelect.value;
  const fieldMode = getCreateUserFieldMode(role);
  const needsBirthDate = isStudentRole(role);

  if (createUserCenterField) {
    createUserCenterField.hidden = fieldMode !== 'center';
    createUserCenterField.style.display = fieldMode === 'center' ? '' : 'none';
  }

  if (createUserStudentField) {
    createUserStudentField.hidden = fieldMode !== 'student';
    createUserStudentField.style.display = fieldMode === 'student' ? '' : 'none';
  }

  if (createUserBirthDateField) {
    createUserBirthDateField.hidden = !needsBirthDate;
    createUserBirthDateField.style.display = needsBirthDate ? '' : 'none';
  }

  if (adminBirthDate) {
    adminBirthDate.required = needsBirthDate;
    if (!needsBirthDate) adminBirthDate.value = '';
  }

  if (fieldMode === 'student') {
    renderFamilyStudentOptions(adminStudentSelect?.value || '');
  }

  updateCreateUserHint();
}

function renderStudentOptions(students, selectedId = '') {
  if (!adminStudentSelect) {
    return;
  }

  availableCenterStudents = students;

  if (!students.length) {
    adminStudentSelect.innerHTML = '<option value="">No hay estudiantes en este centro</option>';
    adminStudentSelect.disabled = true;
    return;
  }

  adminStudentSelect.disabled = false;
  adminStudentSelect.innerHTML = `
    <option value="">Selecciona un estudiante</option>
    ${students.map((student) => `<option value="${escapeDashboardMarkup(student.id)}" ${String(student.id) === String(selectedId) ? 'selected' : ''}>${escapeDashboardMarkup(student.name)} (${escapeDashboardMarkup(student.email)})</option>`).join('')}
  `;
}

function renderFamilyStudentOptions(selectedId = '') {
  const students = adminUsers.filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
  renderStudentOptions(students, selectedId);
}

async function loadStudentsForCenter(centerId) {
  if (!adminStudentSelect) {
    return;
  }

  if (!centerId) {
    adminStudentSelect.innerHTML = '<option value="">Selecciona un centro primero</option>';
    adminStudentSelect.disabled = true;
    availableCenterStudents = [];
    return;
  }

  const response = await apiRequest(`/centers/${centerId}/users`);
  const students = (response.data.users || []).filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
  renderStudentOptions(students);
}

function renderAdminUsersTable() {
  if (!adminUsersHead || !adminUsersBody) {
    return;
  }

  const columns = adminUserColumns
    .getColumns()
    .filter((column) => column.visible !== false)
    .sort((a, b) => a.order - b.order);

  adminUsersHead.innerHTML = `
    <tr>
      ${columns.map((column) => `<th scope="col">${escapeDashboardMarkup(column.label)}</th>`).join('')}
    </tr>
  `;

  adminUsersBody.innerHTML = adminUsers
    .map((user, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${getDashboardUserWarning('user', user, user.name || 'Este usuario', { users: adminUsers, centers: availableCenters, groups: availableGroups })}${escapeDashboardMarkup(user.name)}</strong>
                <span>${escapeDashboardMarkup(user.id)}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'email') {
          return `<td>${escapeDashboardMarkup(user.email)}</td>`;
        }

        if (column.id === 'role') {
          return `<td><span class="table-badge">${escapeDashboardMarkup(roleLabels[user.role] || user.role)}</span></td>`;
        }

        if (column.id === 'school') {
          return `<td>${escapeDashboardMarkup(getCenterLabel(user.schoolId))}</td>`;
        }

        if (column.id === 'linkedStudent') {
          return `<td>${escapeDashboardMarkup(user.linkedStudentId ? getUserLabel(user.linkedStudentId) : 'Sin vincular')}</td>`;
        }

        if (column.id === 'status') {
          return `<td>${user.isActive ? 'Activo' : 'Inactivo'}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <button class="button ghost table-row-action" type="button" data-row-user="${escapeDashboardMarkup(user.id)}">Editar</button>
              <button class="button ghost table-row-action" type="button" data-dashboard-delete-user="${escapeDashboardMarkup(user.id)}">Eliminar</button>
            </td>
          `;
        }

        return `<td>-</td>`;
      });

      return `<tr style="animation-delay: ${index * 60}ms">${cells.join('')}</tr>`;
    })
    .join('');
}

adminUsersBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-row-user]');
  if (button) {
    openUserDetail(button.getAttribute('data-row-user'));
    return;
  }

  const deleteButton = event.target.closest('[data-dashboard-delete-user]');
  if (deleteButton) deleteDashboardUser(deleteButton.getAttribute('data-dashboard-delete-user'));
});

function renderAdminUsers(users) {
  adminUsers = users;
  renderAdminUsersTable();
}

function renderUserAssignments(assignments) {
  if (!userDetailAssignmentsElement) {
    return;
  }

  const centerAssignments = assignments?.centers || [];
  const groupAssignments = assignments?.groups || [];
  const items = [];

  items.push(`<div class="toggle-row"><span>Centros: ${centerAssignments.length}</span></div>`);
  centerAssignments.forEach((assignment) => {
    items.push(`<div class="toggle-row"><span>${escapeDashboardMarkup(assignment.center?.name || 'Centro sin nombre')}</span></div>`);
  });

  items.push(`<div class="toggle-row"><span>Grupos: ${groupAssignments.length}</span></div>`);
  groupAssignments.forEach((assignment) => {
    items.push(`<div class="toggle-row"><span>${escapeDashboardMarkup(assignment.group?.name || 'Grupo sin nombre')}</span></div>`);
  });

  userDetailAssignmentsElement.innerHTML = items.join('');
}

function buildConsentSummary(consents, studentId) {
  const studentConsents = (consents || []).filter((consent) => String(consent.studentId || '') === String(studentId || ''));

  return summarizeConsentList(studentConsents);
}

function summarizeConsentList(consents) {
  return {
    total: consents.length,
    pending: consents.filter((consent) => consent.status === 'PENDING').length,
    accepted: consents.filter((consent) => consent.status === 'ACCEPTED').length,
    rejected: consents.filter((consent) => consent.status === 'REJECTED').length,
    revoked: consents.filter((consent) => consent.status === 'REVOKED').length,
    expired: consents.filter((consent) => consent.status === 'EXPIRED').length,
  };
}

function getConsentCoverage(summary) {
  const total = Number(summary?.total || 0);
  if (!total) return 0;
  return Math.round((Number(summary?.accepted || 0) / total) * 100);
}

function getDashboardConsentBreakdown(summary) {
  const total = Number(summary?.total || 0);
  const accepted = Number(summary?.accepted || 0);
  const pending = Number(summary?.pending || 0);
  const other = Math.max(0, total - accepted - pending);

  return [
    { label: 'Aceptados', value: accepted, tone: 'accepted' },
    { label: 'Pendientes', value: pending, tone: 'pending' },
    { label: 'Otros estados', value: other, tone: 'other' },
  ];
}

function renderDashboardWorkspace({ badge, title, intro, metrics, priority, actions, consentSummary }) {
  if (!relationshipPanel || !relationshipPanelBody) return;

  const coverage = getConsentCoverage(consentSummary);
  const breakdown = getDashboardConsentBreakdown(consentSummary);
  const total = Number(consentSummary?.total || 0);
  const chartMaximum = Math.max(...breakdown.map((item) => item.value), 1);
  const pending = Number(consentSummary?.pending || 0);
  const meterLabel = total
    ? `${coverage}% con consentimiento aceptado`
    : 'Sin consentimientos pendientes de seguimiento';
  const priorityTone = pending > 0 ? 'is-actionable' : 'is-clear';

  if (relationshipPanelBadge) relationshipPanelBadge.textContent = badge;
  if (relationshipPanelTitle) relationshipPanelTitle.textContent = title;

  relationshipPanelBody.innerHTML = `
    <div class="dashboard-workspace">
      <section class="dashboard-command" aria-labelledby="dashboard-command-title">
        <div class="dashboard-command__copy">
          <p class="dashboard-command__eyebrow">Pulso de consentimientos</p>
          <h3 id="dashboard-command-title">${escapeDashboardMarkup(intro)}</h3>
          <p>Información disponible en tu ámbito de acceso. Revisa primero lo que necesita una decisión.</p>
        </div>
        <div class="consent-meter" role="img" aria-label="${escapeDashboardMarkup(meterLabel)}" style="--consent-progress: ${coverage}%">
          <div class="consent-meter__content">
            <span class="consent-meter__value">${coverage}%</span>
            <span class="consent-meter__label">aceptados</span>
          </div>
        </div>
      </section>

      <div class="dashboard-metric-rail" aria-label="Indicadores principales">
        ${metrics.map((metric) => `
          <div class="dashboard-metric">
            <span>${escapeDashboardMarkup(metric.label)}</span>
            <strong>${escapeDashboardMarkup(String(metric.value))}</strong>
          </div>
        `).join('')}
      </div>

      <div class="dashboard-reading-grid">
        <section class="dashboard-chart" aria-labelledby="dashboard-chart-title">
          <div class="dashboard-section-heading">
            <div>
              <span>Distribución actual</span>
              <h3 id="dashboard-chart-title">Estado de consentimientos</h3>
            </div>
            <strong>${total}</strong>
          </div>
          <div class="dashboard-bars" role="list">
            ${breakdown.map((item) => `
              <div class="dashboard-bar dashboard-bar--${item.tone}" role="listitem">
                <div class="dashboard-bar__label"><span>${escapeDashboardMarkup(item.label)}</span><strong>${item.value}</strong></div>
                <span class="dashboard-bar__track" aria-hidden="true"><span style="--bar-size: ${Math.round((item.value / chartMaximum) * 100)}%"></span></span>
              </div>
            `).join('')}
          </div>
        </section>

        <aside class="dashboard-priority ${priorityTone}" aria-labelledby="dashboard-priority-title">
          <span class="dashboard-priority__signal" aria-hidden="true"></span>
          <div>
            <span class="dashboard-priority__label">${pending > 0 ? 'Prioridad de hoy' : 'Todo al día'}</span>
            <h3 id="dashboard-priority-title">${escapeDashboardMarkup(priority.title)}</h3>
            <p>${escapeDashboardMarkup(priority.description)}</p>
            <a class="button ${pending > 0 ? 'primary' : 'secondary'}" href="${escapeDashboardMarkup(priority.href)}">${escapeDashboardMarkup(priority.action)}</a>
          </div>
        </aside>
      </div>

      <nav class="dashboard-routes" aria-label="Accesos del área">
        ${actions.map((action) => `
          <a href="${escapeDashboardMarkup(action.href)}">
            ${getAppIcon(action.icon, 'dashboard-routes__icon')}
            <span><strong>${escapeDashboardMarkup(action.label)}</strong><small>${escapeDashboardMarkup(action.description)}</small></span>
            <b aria-hidden="true">→</b>
          </a>
        `).join('')}
      </nav>
    </div>
  `;

  refreshAppIcons(relationshipPanelBody);
  setPanelVisible(relationshipPanel, true, 'block');
}

function getDashboardRelationshipContext(role, context, consentSummary = null) {
  const normalizedRole = String(role || '').toUpperCase();

  if (normalizedRole === 'FAMILY') {
    return {
      badge: 'Familia',
      title: 'Resumen familiar',
      subject: context?.linkedStudent || null,
      summaryTag: 'Resumen breve',
      note: 'Consulta el perfil vinculado y el estado de sus autorizaciones.',
      highlights: [
        { label: 'Hijo/a', value: context?.linkedStudent?.name || 'Sin alumno' },
        { label: 'Pendientes', value: consentSummary ? String(consentSummary.pending) : '0' },
      ],
      primaryActionLabel: 'Abrir perfil',
      primaryActionHref: '/child.html',
      secondaryActionLabel: 'Ver consentimientos',
      secondaryActionHref: '/consents.html',
    };
  }

  if (normalizedRole === 'STUDENT') {
    return {
      badge: 'Alumno',
      title: 'Mi familia',
      subject: context?.linkedFamily || null,
      summaryTag: 'Resumen breve',
      note: 'Consulta la información familiar vinculada a tu cuenta.',
      highlights: [
        { label: 'Familia', value: context?.linkedFamily?.name || 'Sin familia' },
        { label: 'Centro', value: context?.center?.name || 'Sin centro' },
        { label: 'Grupo', value: context?.group?.name || 'Sin grupo' },
      ],
      primaryActionLabel: 'Ver consentimientos',
      primaryActionHref: '/consents.html',
      secondaryActionLabel: 'Ir a grupos',
      secondaryActionHref: '/groups.html',
    };
  }

  return null;
}

function renderModuleSummary({ badge, title, cards }) {
  if (!relationshipPanel || !relationshipPanelBody) {
    return;
  }

  if (relationshipPanelBadge) relationshipPanelBadge.textContent = badge;
  if (relationshipPanelTitle) relationshipPanelTitle.textContent = title;

  relationshipPanelBody.innerHTML = `
    <div class="family-dashboard-grid">
      ${cards.map((card) => `
        <article class="dashboard-quickcard family-module-card ${card.highlight ? 'family-module-card--pending' : ''}">
          <div class="module-card__header">
            ${getAppIcon(card.icon || getAppIconName(card.label), 'module-card-icon')}
            <span class="quickcard-label">${escapeDashboardMarkup(card.label)}</span>
          </div>
          <strong>${escapeDashboardMarkup(card.value)}</strong>
          <p class="quickcard-email">${escapeDashboardMarkup(card.description)}</p>
          <a class="button secondary" href="${escapeDashboardMarkup(card.href)}">${escapeDashboardMarkup(card.action)}</a>
        </article>
      `).join('')}
    </div>
  `;

  refreshAppIcons(relationshipPanelBody);
  setPanelVisible(relationshipPanel, true, 'block');
}

function renderDashboardRelationshipPanel(role, context, consentSummary = null) {
  if (!relationshipPanel || !relationshipPanelBody) {
    return;
  }

  const config = getDashboardRelationshipContext(role, context, consentSummary);
  if (!config) {
    setPanelVisible(relationshipPanel, false);
    return;
  }

  if (relationshipPanelBadge) {
    relationshipPanelBadge.textContent = config.badge;
  }
  if (relationshipPanelTitle) {
    relationshipPanelTitle.textContent = config.title;
  }
  if (String(role || '').toUpperCase() === 'FAMILY') {
    const pending = consentSummary?.pending || 0;
    const pendingText = pending === 1 ? '1 pendiente' : `${pending} pendientes`;
    relationshipPanelBody.innerHTML = `
      <div class="family-dashboard-grid">
        <article class="dashboard-quickcard family-module-card">
          <div class="module-card__header">
            ${getAppIcon('child', 'module-card-icon')}
            <span class="quickcard-label">Mi hijo/a</span>
          </div>
          <strong>${escapeDashboardMarkup(context?.linkedStudent?.name || 'Sin alumno vinculado')}</strong>
          <p class="quickcard-email">Ficha del alumno, centro, grupo y profesor asociado.</p>
          <a class="button secondary" href="/child.html">Ver detalle</a>
        </article>

        <article class="dashboard-quickcard family-module-card ${pending > 0 ? 'family-module-card--pending' : ''}">
          <div class="module-card__header">
            ${getAppIcon('consent', 'module-card-icon')}
            <span class="quickcard-label">Consentimientos</span>
          </div>
          <strong>${escapeDashboardMarkup(pendingText)}</strong>
          <p class="quickcard-email">Solicitudes familiares que necesitan revisión.</p>
          <a class="button secondary" href="/consents.html">Revisar</a>
        </article>
      </div>
    `;
    refreshAppIcons(relationshipPanelBody);
    setPanelVisible(relationshipPanel, true, 'block');
    return;
  }

  relationshipPanelBody.innerHTML = `
    <div class="consent-version-card consent-notice-card dashboard-summary-card">
      <div class="consent-version-card__head">
        <span class="badge">${escapeDashboardMarkup(config.badge)}</span>
        <span class="table-badge consent-badge--muted">${escapeDashboardMarkup(config.summaryTag)}</span>
      </div>
      <strong class="consent-version-card__title">${escapeDashboardMarkup(config.title)}</strong>
      <p>${escapeDashboardMarkup(config.note || '')}</p>

      <div class="consent-meta-grid">
        ${config.highlights.map((item) => `
          <div class="profile-chip">
            <span>${escapeDashboardMarkup(item.label)}</span>
            <strong>${escapeDashboardMarkup(item.value)}</strong>
          </div>
        `).join('')}
      </div>

      <div class="action-row">
        <a class="button secondary" href="${escapeDashboardMarkup(config.primaryActionHref)}">${escapeDashboardMarkup(config.primaryActionLabel)}</a>
        <a class="button secondary" href="${escapeDashboardMarkup(config.secondaryActionHref)}">${escapeDashboardMarkup(config.secondaryActionLabel)}</a>
      </div>
    </div>
  `;

  refreshAppIcons(relationshipPanelBody);
  setPanelVisible(relationshipPanel, true, 'block');
}

function renderRoleDashboardSummary(role, context, assignments, options = {}) {
  const normalizedRole = String(role || '').toUpperCase();
  const centers = assignments?.centers || [];
  const groups = assignments?.groups || [];
  const center = options.center || centers[0]?.center || context?.center || null;
  const group = groups[0]?.group || context?.group || null;
  const consentSummary = options.consentSummary || summarizeConsentList([]);
  const usersCount = options.usersCount ?? 0;
  const centersCount = options.centersCount ?? centers.length;
  const groupsCount = options.groupsCount ?? groups.length;
  const pending = Number(consentSummary.pending || 0);
  const defaultPriority = pending
    ? {
      title: `${pending} ${pending === 1 ? 'solicitud necesita' : 'solicitudes necesitan'} revisión`,
      description: 'Hay autorizaciones esperando una respuesta o una comprobación.',
      href: '/consents.html',
      action: 'Revisar ahora',
    }
    : {
      title: 'No hay acciones pendientes',
      description: 'El estado de los consentimientos visibles está al día.',
      href: '/consents.html',
      action: 'Ver consentimientos',
    };

  const viewByRole = {
    ADMIN: {
      badge: 'Administración',
      title: 'Visión general',
      intro: 'La organización está bajo control.',
      metrics: [
        { label: 'Usuarios activos', value: usersCount },
        { label: 'Centros', value: centersCount },
        { label: 'Grupos activos', value: groupsCount },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Usuarios', description: 'Altas y accesos', href: '/users.html', icon: 'users' },
        { label: 'Centros', description: 'Estructura escolar', href: '/centers.html', icon: 'school' },
        { label: 'Texto legal', description: 'Versiones vigentes', href: '/legal.html', icon: 'legal' },
      ],
    },
    SCHOOL: {
      badge: 'Centro',
      title: 'Pulso del centro',
      intro: center ? `Todo lo relevante de ${center.name}.` : 'Conecta un centro para activar este espacio.',
      metrics: [
        { label: 'Centro vinculado', value: center ? 'Sí' : 'No' },
        { label: 'Grupos', value: groupsCount },
        { label: 'Por revisar', value: pending },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Mi centro', description: 'Datos y equipos', href: '/centers.html', icon: 'school' },
        { label: 'Grupos', description: 'Organización diaria', href: '/groups.html', icon: 'groups' },
        { label: 'Consentimientos', description: 'Solicitudes familiares', href: '/consents.html', icon: 'consent' },
      ],
    },
    TEACHER: {
      badge: 'Profesorado',
      title: 'Panorama docente',
      intro: group ? `Tu foco hoy: ${group.name}.` : 'Tu espacio docente está preparado para consultar.',
      metrics: [
        { label: 'Centro', value: center?.code || '—' },
        { label: 'Grupo principal', value: group?.name || '—' },
        { label: 'Por revisar', value: pending },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Mis grupos', description: 'Alumnado visible', href: '/groups.html', icon: 'groups' },
        { label: 'Centro', description: 'Información general', href: '/centers.html', icon: 'school' },
        { label: 'Consentimientos', description: 'Consulta autorizaciones', href: '/consents.html', icon: 'consent' },
      ],
    },
    PROFESSIONAL: {
      badge: 'Consulta profesional',
      title: 'Estado de autorizaciones',
      intro: center ? `Consulta autorizada para ${center.name}.` : 'Consulta solo la información autorizada.',
      metrics: [
        { label: 'Centro asignado', value: center ? 'Sí' : 'No' },
        { label: 'Válidos', value: consentSummary.accepted || 0 },
        { label: 'Por revisar', value: pending },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Consentimientos', description: 'Estado y detalle', href: '/consents.html', icon: 'consent' },
        { label: 'Centro', description: 'Datos del centro', href: '/centers.html', icon: 'school' },
      ],
    },
    FAMILY: {
      badge: 'Familia',
      title: 'Acompañamiento familiar',
      intro: context?.linkedStudent ? `El seguimiento de ${context.linkedStudent.name}, en un vistazo.` : 'Vincula un alumno para ver su seguimiento.',
      metrics: [
        { label: 'Alumno vinculado', value: context?.linkedStudent ? 'Sí' : 'No' },
        { label: 'Aceptados', value: consentSummary.accepted || 0 },
        { label: 'Pendientes', value: pending },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Mi hijo/a', description: 'Ficha y contexto', href: '/child.html', icon: 'child' },
        { label: 'Consentimientos', description: 'Responder solicitudes', href: '/consents.html', icon: 'consent' },
      ],
    },
    STUDENT: {
      badge: 'Alumno',
      title: 'Mi espacio',
      intro: group ? `Tu contexto actual: ${group.name}.` : 'Tu información está reunida aquí.',
      metrics: [
        { label: 'Centro', value: center?.code || '—' },
        { label: 'Grupo', value: group?.name || '—' },
        { label: 'Activos', value: consentSummary.accepted || 0 },
      ],
      priority: defaultPriority,
      actions: [
        { label: 'Mi perfil', description: 'Datos y vínculos', href: '/child.html', icon: 'profile' },
        { label: 'Consentimientos', description: 'Mi estado actual', href: '/consents.html', icon: 'consent' },
        { label: 'Grupos', description: 'Mi grupo escolar', href: '/groups.html', icon: 'groups' },
      ],
    },
  };

  const view = viewByRole[normalizedRole];
  if (view) {
    renderDashboardWorkspace({ ...view, consentSummary });
    return;
  }

  renderDashboardRelationshipPanel(role, context, consentSummary);
}

async function openUserDetail(userId) {
  try {
    const [userResponse, assignmentsResponse] = await Promise.all([
      apiRequest(`/users/${userId}`),
      apiRequest(`/users/${userId}/assignments`),
    ]);

    const user = userResponse.data.user;
    const assignments = assignmentsResponse.data;

    if (userDetailNameElement) {
      userDetailNameElement.textContent = user.name || '-';
    }
    if (userDetailEmailElement) {
      userDetailEmailElement.textContent = user.email || '-';
    }
    if (userDetailRoleElement) {
      userDetailRoleElement.textContent = roleLabels[user.role] || user.role || '-';
    }
    if (userDetailSchoolElement) {
      userDetailSchoolElement.textContent = getCenterLabel(user.schoolId);
    }
    if (userDetailLinkedStudentElement) {
      userDetailLinkedStudentElement.textContent = user.linkedStudentId ? getUserLabel(user.linkedStudentId) : 'Sin vincular';
    }

    currentEditingUserId = user.id;
    if (userDetailModalTitle) {
      userDetailModalTitle.textContent = String(currentUser?.role || '').toUpperCase() === 'ADMIN'
        ? 'Editar usuario'
        : 'Detalle de usuario';
    }
    if (userDetailEditForm) {
      userDetailEditForm.hidden = String(currentUser?.role || '').toUpperCase() !== 'ADMIN';
      if (userDetailEditForm.hidden) {
        setMessage(userEditErrorElement, '', true);
        setMessage(userEditSuccessElement, '', false);
      } else {
        const nameInput = userDetailEditForm.querySelector('[name="name"]');
        const emailInput = userDetailEditForm.querySelector('[name="email"]');
        const passwordInput = userDetailEditForm.querySelector('[name="password"]');
        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (passwordInput) passwordInput.value = '';
        if (userEditTitleElement) {
          userEditTitleElement.textContent = `Editar ${user.name || 'usuario'}`;
        }
        if (userEditHintElement) {
          userEditHintElement.textContent = 'Puedes corregir nombre, email y regenerar la contraseña si hace falta.';
        }
      }
    }

    renderUserAssignments(assignments);
    openModalById('user-detail-modal');
  } catch (error) {
    if (userEditErrorElement) {
      setMessage(userEditErrorElement, error.message, true);
    } else {
      setMessage(createUserError, error.message, true);
    }
  }
}

async function loadAdminUsers() {
  const response = await apiRequest('/users');
  renderAdminUsers(response.data.users || []);
  if (isFamilyRole(createUserRoleSelect?.value)) {
    renderFamilyStudentOptions(adminStudentSelect?.value || '');
  }
}

async function loadCentersForAdmin() {
  if (!adminSchoolSelect) {
    return;
  }

  const [centersResponse, groupsResponse] = await Promise.all([
    apiRequest('/centers'),
    apiRequest('/groups'),
  ]);
  availableCenters = centersResponse.data.centers || [];
  availableGroups = groupsResponse.data.groups || [];

  adminSchoolSelect.innerHTML = `
    <option value="">Sin vincular</option>
    ${availableCenters
      .map((center) => `<option value="${escapeDashboardMarkup(center.id)}">${escapeDashboardMarkup(center.name)}</option>`)
      .join('')}
  `;

  renderAdminUsersTable();
  updateCreateUserFieldVisibility();
  if (isFamilyRole(createUserRoleSelect?.value)) {
    renderFamilyStudentOptions();
  } else if (isRoleRequiringCenter(createUserRoleSelect?.value) && adminSchoolSelect.value) {
    await loadStudentsForCenter(adminSchoolSelect.value);
  }
}

function renderSchoolPanel(assignments) {
  if (!schoolPanel) {
    return;
  }

  const centers = assignments?.centers || [];
  const groups = assignments?.groups || [];
  const center = centers[0]?.center || null;
  const centerAssignments = centers[0] || null;
  const groupCount = groups.filter((item) => item.isActive).length;

  if (!center) {
    setPanelVisible(schoolPanel, true, 'grid');
    schoolPanelNote.textContent = 'Todavía no hay un centro enlazado a esta cuenta.';
    schoolCenterCity.textContent = '-';
    schoolCenterName.textContent = 'Sin centro';
    schoolCenterLine.textContent = 'Vincula la cuenta a un centro para ver aquí su espacio.';
    schoolCenterGroups.textContent = '0 grupos';
    schoolCenterUsers.textContent = 'Usuarios: 0';
    schoolCenterStatus.textContent = 'Activo: -';
    schoolGroupsCount.textContent = '0';
    if (schoolGroupsLink) {
      schoolGroupsLink.href = '/groups.html';
    }
    return;
  }

  setPanelVisible(schoolPanel, true, 'grid');
  schoolPanelNote.textContent = 'Esta cuenta ya está enlazada con su centro principal.';
  schoolCenterCity.textContent = center.city || 'Sin ciudad';
  schoolCenterName.textContent = center.name;
  schoolCenterLine.textContent = formatCenterLine(center);
  schoolCenterGroups.textContent = `${center.groupsCount || groupCount} grupos`;
  schoolCenterUsers.textContent = `Usuarios: ${center.usersCount || 0}`;
  schoolCenterStatus.textContent = `Activo: ${center.isActive ? 'Sí' : 'No'}`;
  schoolGroupsCount.textContent = String(groupCount);
  if (schoolGroupsLink) {
    schoolGroupsLink.href = `/groups.html?centerId=${encodeURIComponent(center.id)}`;
  }

  if (centerAssignments?.role) {
    schoolPanelNote.textContent = `Rol vinculado: ${centerAssignments.role}`;
  }
}

async function renderProfessionalPanel(assignments) {
  if (!professionalPanel) {
    return;
  }

  const centers = assignments?.centers || [];
  const center = centers[0]?.center || null;

  setPanelVisible(professionalPanel, true, 'grid');

  if (!center) {
    if (professionalPanelNote) {
      professionalPanelNote.textContent = 'Todavía no hay un centro enlazado a esta cuenta.';
    }
    if (professionalCenterCity) professionalCenterCity.textContent = '-';
    if (professionalCenterName) professionalCenterName.textContent = 'Sin centro';
    if (professionalCenterLine) professionalCenterLine.textContent = 'Vincula la cuenta a un centro para revisar consentimientos.';
    if (professionalConsentsCount) professionalConsentsCount.textContent = '0 consentimientos';
    if (professionalCenterStatus) professionalCenterStatus.textContent = 'Consentimientos: -';
    if (professionalCenterSummary) professionalCenterSummary.textContent = 'Vista de consulta';
    if (professionalValidCount) professionalValidCount.textContent = '0';
    if (professionalPendingCount) professionalPendingCount.textContent = '0';
    if (professionalOtherCount) professionalOtherCount.textContent = '0';
    if (professionalLegalLink) professionalLegalLink.hidden = true;
    return;
  }

  const [consentsResponse] = await Promise.allSettled([
    apiRequest(`/consents?centerId=${encodeURIComponent(center.id)}`),
  ]);

  const consents = consentsResponse.status === 'fulfilled' ? (consentsResponse.value.data.consents || []) : [];
  const pending = consents.filter((consent) => consent.status === 'PENDING').length;
  const accepted = consents.filter((consent) => consent.status === 'ACCEPTED').length;
  const other = consents.length - pending - accepted;

  if (professionalPanelNote) {
    professionalPanelNote.textContent = 'Esta vista es de consulta: estado de consentimientos del centro.';
  }
  if (professionalCenterCity) professionalCenterCity.textContent = center.city || 'Sin ciudad';
  if (professionalCenterName) professionalCenterName.textContent = center.name;
  if (professionalCenterLine) professionalCenterLine.textContent = formatCenterLine(center);
  if (professionalConsentsCount) professionalConsentsCount.textContent = `${consents.length} consentimientos`;
  if (professionalCenterStatus) {
    professionalCenterStatus.textContent = 'Consentimientos revisables';
  }
  if (professionalCenterSummary) {
    professionalCenterSummary.textContent = 'Vista en modo lectura';
  }
  if (professionalValidCount) professionalValidCount.textContent = String(accepted);
  if (professionalPendingCount) professionalPendingCount.textContent = String(pending);
  if (professionalOtherCount) professionalOtherCount.textContent = String(other);
  if (professionalLegalLink) professionalLegalLink.hidden = true;
}

async function deleteDashboardUser(userId) {
  const user = adminUsers.find((item) => item.id === userId);
  if (!user) return;

  try {
    const response = await apiRequest(`/deletion-impact/users/${encodeURIComponent(userId)}`);
    const confirmed = await showDestructiveActionConfirm({
      title: `Eliminar a ${user.name}`,
      description: 'Esta cuenta se eliminará definitivamente. Los registros vinculados que permanezcan mostrarán un aviso de referencia eliminada.',
      effects: response.data.impact.effects || [],
      confirmLabel: 'Sí, eliminar usuario',
    });
    if (!confirmed) return;

    await apiRequest(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    await loadAdminUsers();
  } catch (error) {
    setMessage(createUserError, error.message || 'No se pudo eliminar el usuario.', true);
  }
}

async function doLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Logout demo: limpiar la sesion local aunque el token sea stateless.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
}

async function loadProfile() {
  if (!getToken()) {
    window.location.replace('/login.html');
    return;
  }

  try {
    resetTransientUiState();
    const response = await apiRequest('/auth/me');
    currentUser = response.data.user;
    document.body.classList.remove('auth-pending');
    if (profileNameElement) {
      profileNameElement.textContent = currentUser.name;
    }
    if (profileEmailElement) {
      profileEmailElement.textContent = currentUser.email;
    }
    const context = currentUser.context || null;
    const role = String(currentUser.role || '').toUpperCase();
    const assignmentsResponse = await apiRequest(`/users/${currentUser.id}/assignments`);
    const assignments = assignmentsResponse.data;
    let consentSummary = null;
    let summaryOptions = {};

    if ((role === 'FAMILY' && context?.linkedStudent?.id) || role === 'STUDENT') {
      const consentsResponse = await apiRequest('/consents');
      const relevantStudentId = role === 'FAMILY' ? context.linkedStudent.id : currentUser.id;
      consentSummary = buildConsentSummary(consentsResponse.data.consents || [], relevantStudentId);
    } else if (['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL'].includes(role)) {
      const consentsResponse = await apiRequest('/consents');
      consentSummary = summarizeConsentList(consentsResponse.data.consents || []);
    }

    summaryOptions.consentSummary = consentSummary;
    if (['SCHOOL', 'TEACHER', 'PROFESSIONAL'].includes(role)) {
      const centersResponse = await apiRequest('/centers');
      const visibleCenters = centersResponse.data.centers || [];
      summaryOptions = {
        ...summaryOptions,
        center: visibleCenters[0] || null,
        centersCount: visibleCenters.length,
        groupsCount: visibleCenters.reduce((count, center) => count + Number(center.groupsCount || 0), 0),
      };
    }

    renderDashboardQuickActions(role);
    const heroCenter = summaryOptions.center || assignments?.centers?.[0]?.center || context?.center || null;
    if (dashboardWelcome) {
      dashboardWelcome.textContent = `Hola, ${String(currentUser.name || '').split(' ')[0] || 'de nuevo'}`;
    }
    if (dashboardRoleLabel) {
      dashboardRoleLabel.textContent = roleLabels[role] || 'Área privada';
    }
    if (dashboardSubtitle) {
      dashboardSubtitle.textContent = heroCenter
        ? `${heroCenter.name} · consulta el estado y gestiona tus tareas desde aquí.`
        : 'Consulta tu información y gestiona tus tareas desde aquí.';
    }

    if (role === 'ADMIN') {
      setPanelVisible(adminPanel, false);
      setPanelVisible(schoolPanel, false);
      setPanelVisible(professionalPanel, false);
      await loadCentersForAdmin();
      await loadAdminUsers();
      summaryOptions = {
        ...summaryOptions,
        usersCount: adminUsers.filter((user) => user.isActive).length,
        centersCount: availableCenters.length,
        groupsCount: availableCenters.reduce((count, center) => count + Number(center.groupsCount || 0), 0),
      };
      renderRoleDashboardSummary(role, context, assignments, summaryOptions);
      return;
    }

    setPanelVisible(adminPanel, false);

    if (role === 'SCHOOL' || role === 'TEACHER') {
      setPanelVisible(schoolPanel, false);
      setPanelVisible(professionalPanel, false);
      renderRoleDashboardSummary(role, context, assignments, summaryOptions);
      return;
    }

    if (role === 'PROFESSIONAL') {
      setPanelVisible(schoolPanel, false);
      setPanelVisible(professionalPanel, false);
      renderRoleDashboardSummary(role, context, assignments, summaryOptions);
      return;
    }

    setPanelVisible(schoolPanel, false);
    setPanelVisible(professionalPanel, false);
    renderRoleDashboardSummary(role, context, assignments, summaryOptions);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearToken();
      window.location.replace('/login.html');
      return;
    }

    document.body.classList.remove('auth-pending');
  }
}

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);
userDetailModal?.querySelector('[data-close-modal="user-detail-modal"]')?.addEventListener('click', () => closeModalById('user-detail-modal'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (userDetailModal && !userDetailModal.hidden) {
      closeModalById('user-detail-modal');
      return;
    }

    if (profileModal && !profileModal.hidden) {
      closeModalById('profile-modal');
    }
  }
});

function resetUserEditMessages() {
  setMessage(userEditErrorElement, '', true);
  setMessage(userEditSuccessElement, '', false);
}

if (userDetailEditForm) {
  userDetailEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetUserEditMessages();

    if (!currentEditingUserId) {
      setMessage(userEditErrorElement, 'No se ha podido identificar el usuario a editar.', true);
      return;
    }

    const formData = new FormData(userDetailEditForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
    };

    const password = String(formData.get('password') || '').trim();
    if (password) {
      payload.password = password;
    }

    try {
      await apiRequest(`/users/${currentEditingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      await loadAdminUsers();
      setMessage(userEditSuccessElement, 'Usuario actualizado correctamente.');
      setMessage(createUserSuccess, '', false);
      if (currentEditingUserId) {
        await openUserDetail(currentEditingUserId);
      }
    } catch (error) {
      setMessage(userEditErrorElement, getApiErrorMessage(error), true);
    }
  });
}

if (createUserForm) {
  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(createUserError, '', true);
    setMessage(createUserSuccess, '', false);

    const formData = new FormData(createUserForm);
    const role = formData.get('role');
    const fieldMode = getCreateUserFieldMode(role);
    const studentRole = isStudentRole(role);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role,
      schoolId: fieldMode === 'center' ? (formData.get('schoolId') || null) : null,
      linkedStudentId: fieldMode === 'student' ? (formData.get('linkedStudentId') || null) : null,
    };

    if (studentRole) {
      payload.birthDate = formData.get('birthDate') || null;
    }

    if (fieldMode === 'center' && !payload.schoolId) {
      setMessage(createUserError, 'Selecciona un centro para este usuario.', true);
      return;
    }

    if (studentRole && !payload.birthDate) {
      setMessage(createUserError, 'Indica la fecha de nacimiento del alumno.', true);
      return;
    }

    if (fieldMode === 'student' && !payload.linkedStudentId) {
      setMessage(createUserError, 'Selecciona un estudiante vinculado para la familia.', true);
      return;
    }

    if (fieldMode === 'student' && payload.linkedStudentId && adminStudentSelect && !availableCenterStudents.some((student) => student.id === payload.linkedStudentId)) {
      setMessage(createUserError, 'El estudiante vinculado no existe o no está disponible.', true);
      return;
    }

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(createUserSuccess, 'Usuario creado correctamente.');
      createUserForm.reset();
      await loadCentersForAdmin();
      await loadAdminUsers();
      updateCreateUserFieldVisibility();
    } catch (error) {
      const wait = error.payload?.data?.retryAfterMinutes;
      const extra = wait ? ` Prueba de nuevo en ${wait} min.` : '';
      setMessage(createUserError, `${getApiErrorMessage(error)}${extra}`, true);
    }
  });
}

if (refreshUsersButton) {
  refreshUsersButton.addEventListener('click', async () => {
    try {
      await loadAdminUsers();
    } catch (error) {
      setMessage(createUserError, error.message, true);
    }
  });
}

createUserRoleSelect?.addEventListener('change', async () => {
  updateCreateUserFieldVisibility();
  const fieldMode = getCreateUserFieldMode(createUserRoleSelect.value);

  if (fieldMode !== 'student') {
    if (fieldMode === 'center' && adminSchoolSelect?.value) {
      try {
        await loadStudentsForCenter(adminSchoolSelect.value);
      } catch (error) {
        setMessage(createUserError, error.message, true);
      }
    }
    return;
  }

  renderFamilyStudentOptions(adminStudentSelect?.value || '');
});

adminSchoolSelect?.addEventListener('change', async () => {
  const role = createUserRoleSelect?.value || 'STUDENT';
  const fieldMode = getCreateUserFieldMode(role);

  if (fieldMode !== 'center') {
    return;
  }

  try {
    await loadStudentsForCenter(adminSchoolSelect.value);
  } catch (error) {
    setMessage(createUserError, error.message, true);
  }
});

window.addEventListener('pageshow', () => {
  if (!getToken()) {
    document.body.classList.add('auth-pending');
    window.location.replace('/login.html');
    return;
  }

  resetTransientUiState();
});

resetTransientUiState();
updateCreateUserFieldVisibility();

loadProfile();
