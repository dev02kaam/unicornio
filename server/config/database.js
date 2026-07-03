const { createDemoUsers } = require('../data/demoUsers');

const state = {
  users: createDemoUsers(),
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
  nextUserId() {
    return String(state.users.reduce((max, user) => Math.max(max, Number(user.id)), 0) + 1);
  },
};

module.exports = { database };

