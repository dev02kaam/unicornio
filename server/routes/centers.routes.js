const express = require('express');
const { validateRequest } = require('../middlewares/schema.middleware');
const { paramsSchema, emptyBodySchema } = require('../schemas/common.schemas');
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
centersRouter.get('/:centerId', validateRequest({ params: paramsSchema('centerId') }), getCenterController);
centersRouter.patch('/:centerId', validateRequest({ params: paramsSchema('centerId') }), validateCenterUpdate, updateCenterController);
centersRouter.delete('/:centerId', validateRequest({ params: paramsSchema('centerId'), body: emptyBodySchema }), deleteCenterController);
centersRouter.get('/:centerId/groups', validateRequest({ params: paramsSchema('centerId') }), listCenterGroupsController);
centersRouter.post('/:centerId/groups', validateRequest({ params: paramsSchema('centerId') }), validateGroupCreate, createGroupController);
centersRouter.get('/:centerId/users', validateRequest({ params: paramsSchema('centerId') }), listCenterUsersController);

module.exports = { centersRouter };
