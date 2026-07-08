const { createDemoUsers } = require('../data/demoUsers');
const { createDemoAcademicYears } = require('../data/demoAcademicYears');
const { createDemoCenters } = require('../data/demoCenters');
const { createDemoGroups } = require('../data/demoGroups');
const { createDemoLegalTextVersions } = require('../data/demoLegalTextVersions');
const { createDemoConsents, createDemoConsentAuditLogs } = require('../data/demoConsents');
const {
  createDemoUserCenterAssignments,
  createDemoUserGroupAssignments,
} = require('../data/demoAssignments');

const state = {
  users: createDemoUsers(),
  academicYears: createDemoAcademicYears(),
  centers: createDemoCenters(),
  groups: createDemoGroups(),
  legalTextVersions: createDemoLegalTextVersions(),
  consents: createDemoConsents(),
  consentAuditLogs: createDemoConsentAuditLogs(),
  userCenterAssignments: createDemoUserCenterAssignments(),
  userGroupAssignments: createDemoUserGroupAssignments(),
};

const sequences = {
  users: 15,
  academicYears: 1,
  centers: 2,
  groups: 4,
  legalTextVersions: 2,
  consents: 5,
  consentAuditLogs: 11,
  userCenterAssignments: 10,
  userGroupAssignments: 6,
};

const database = {
  state,
  getUsers() {
    return state.users;
  },
  setUsers(users) {
    state.users = users;
    return state.users;
  },
  getCollection(name) {
    return state[name];
  },
  setCollection(name, items) {
    state[name] = items;
    return state[name];
  },
  nextUserId() {
    sequences.users += 1;
    return String(sequences.users);
  },
  nextId(name, prefix) {
    if (!Object.prototype.hasOwnProperty.call(sequences, name)) {
      sequences[name] = 0;
    }

    sequences[name] += 1;
    return `${prefix}-${sequences[name]}`;
  },
};

module.exports = { database };
