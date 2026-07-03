const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  validateCenterCreate,
  validateCenterUpdate,
  validateGroupCreate,
} = require('../middlewares/validation.middleware');
const {
  listCentersController,
  createCenterController,
  getCenterController,
  updateCenterController,
  deactivateCenterController,
  listCenterGroupsController,
  listCenterUsersController,
  createGroupController,
} = require('../controllers/organization.controller');

const centersRouter = express.Router();

centersRouter.use(authMiddleware);

centersRouter.get('/', listCentersController);
centersRouter.post('/', validateCenterCreate, createCenterController);
centersRouter.get('/:centerId', getCenterController);
centersRouter.patch('/:centerId', validateCenterUpdate, updateCenterController);
centersRouter.delete('/:centerId', deactivateCenterController);
centersRouter.get('/:centerId/groups', listCenterGroupsController);
centersRouter.post('/:centerId/groups', validateGroupCreate, createGroupController);
centersRouter.get('/:centerId/users', listCenterUsersController);

module.exports = { centersRouter };
