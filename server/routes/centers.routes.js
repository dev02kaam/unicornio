const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  validateCenterCreate,
  validateCenterUpdate,
  validateGroupCreate,
} = require('../middlewares/validation.middleware');
const {
  listAcademicYearsController,
  listCentersController,
  createCenterController,
  getCenterController,
  updateCenterController,
  deleteCenterController,
  listCenterGroupsController,
  listCenterUsersController,
  createGroupController,
} = require('../controllers/organization.controller');

const centersRouter = express.Router();

centersRouter.use(authMiddleware);

centersRouter.get('/academic-years', listAcademicYearsController);
centersRouter.get('/', listCentersController);
centersRouter.post('/', validateCenterCreate, createCenterController);
centersRouter.get('/:centerId', getCenterController);
centersRouter.patch('/:centerId', validateCenterUpdate, updateCenterController);
centersRouter.delete('/:centerId', deleteCenterController);
centersRouter.get('/:centerId/groups', listCenterGroupsController);
centersRouter.post('/:centerId/groups', validateGroupCreate, createGroupController);
centersRouter.get('/:centerId/users', listCenterUsersController);

module.exports = { centersRouter };
