const express = require('express');
const router = express.Router();
const {
    importDataset,
    getRegions,
    getAll,
    getByRegion,
    getOne,
    createOne,
    updateOne,
    deleteOne,
} = require('../controllers/electricityController');

// POST /api/electricity/import — bulk import CSV
router.post('/import', importDataset);

// GET /api/electricity/regions — list all distinct regions
router.get('/regions', getRegions);

// GET /api/electricity — list all data points, with optional filter query params
router.get('/', getAll);

// POST /api/electricity — create a single data point
router.post('/', createOne);

// GET /api/electricity/:region — all years for a region
router.get('/:region', getByRegion);

// GET /api/electricity/:region/:year — single data point
router.get('/:region/:year', getOne);

// PUT /api/electricity/:region/:year — update
router.put('/:region/:year', updateOne);

// DELETE /api/electricity/:region/:year — delete
router.delete('/:region/:year', deleteOne);

module.exports = router;