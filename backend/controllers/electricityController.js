const { client } = require('../config/db');
const TABLE_NAME = 'completion_by_region';

const normalizeValue = (value) =>
    value && value.toString().replace(/"/g, '').trim();

const parseCsvRow = (line) => line.split(',').map((c) => normalizeValue(c));

const sanitizeCategory = (value, fallback) => {
    const normalized = normalizeValue(value);
    return normalized ? normalized : fallback;
};

const isYearCell = (value) => /^\d{4}$/.test(value);

// Parse the CSV and bulk-insert into Cassandra
const importDataset = async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv) {
            return res.status(400).json({ message: 'CSV data is required' });
        }

        const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length < 4) {
            return res.status(400).json({ message: 'CSV must include a year header line and at least one data row.' });
        }

        const yearRow = parseCsvRow(lines[2]);
        const yearIndexes = yearRow
            .map((col, index) => (isYearCell(col) ? index : -1))
            .filter((index) => index >= 0);

        if (yearIndexes.length === 0) {
            return res.status(400).json({ message: 'CSV must include year columns in the third row.' });
        }

        const years = yearIndexes.map((index) => Number(yearRow[index]));

        let currentRegion = '';
        let currentEducation = '';
        let currentGender = 'All sexes';
        let inserted = 0;
        const queries = [];

        for (let i = 3; i < lines.length; i++) {
            const cols = parseCsvRow(lines[i]);
            if (cols.length < 4) continue;

            const indicator = normalizeValue(cols[0]);
            const regionCell = normalizeValue(cols[1]);
            const educationCell = normalizeValue(cols[2]);
            const genderCell = normalizeValue(cols[3]);

            if (regionCell) {
                currentRegion = regionCell.replace(/^\.\./, '').trim();
            }

            if (educationCell) {
                currentEducation = educationCell.trim();
            }

            if (genderCell) {
                currentGender = genderCell.trim();
            }

            // Stop parsing when we reach footer metadata
            if (indicator?.toLowerCase().startsWith('indicator:') || indicator?.toLowerCase().startsWith('latest update:') || indicator?.toLowerCase().startsWith('source:')) {
                break;
            }

            if (!currentRegion || !currentEducation || !currentGender) {
                continue;
            }

            for (let j = 0; j < years.length; j++) {
                const val = cols[yearIndexes[j]];
                if (!val || val === '..' || val === '...') continue;

                const percentage = parseFloat(val);
                if (Number.isNaN(percentage)) continue;

                queries.push({
                    query: `INSERT INTO ${TABLE_NAME} (region, gender, education_level, year, percentage) VALUES (?, ?, ?, ?, ?)`,
                    params: [
                        currentRegion,
                        sanitizeCategory(currentGender, 'All sexes'),
                        sanitizeCategory(currentEducation, 'All levels'),
                        years[j],
                        percentage,
                    ],
                });
                inserted++;
            }
        }

        const BATCH_SIZE = 30;
        for (let i = 0; i < queries.length; i += BATCH_SIZE) {
            const batch = queries.slice(i, i + BATCH_SIZE);
            await client.batch(batch, { prepare: true });
        }

        res.json({ message: `Imported ${inserted} data points` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all regions (distinct partition keys)
const getRegions = async (req, res) => {
    try {
        const result = await client.execute(`SELECT DISTINCT region FROM ${TABLE_NAME}`);
        const regions = result.rows.map((r) => r.region).sort();
        res.json(regions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const mapRows = (rows) => rows.map((r) => ({
    region: r.region,
    gender: r.gender || 'All sexes',
    education_level: r.education_level || 'All levels',
    year: r.year,
    percentage: r.percentage,
}));

// Get all data points with optional filters
const getAll = async (req, res) => {
    try {
        const {
            region,
            gender,
            education_level,
            year,
            min_percentage,
            max_percentage,
        } = req.query;

        const queryParts = [];
        const params = [];

        if (region && region.trim()) {
            queryParts.push('region = ?');
            params.push(region.trim());
        }
        if (gender && gender.trim()) {
            queryParts.push('gender = ?');
            params.push(gender.trim());
        }
        if (education_level && education_level.trim()) {
            queryParts.push('education_level = ?');
            params.push(education_level.trim());
        }
        if (year && !Number.isNaN(parseInt(year, 10))) {
            queryParts.push('year = ?');
            params.push(parseInt(year, 10));
        }

        let cql = `SELECT * FROM ${TABLE_NAME}`;
        if (queryParts.length > 0) {
            cql += ` WHERE ${queryParts.join(' AND ')}`;
            if (!region || !region.trim() || queryParts.length > 1) {
                cql += ' ALLOW FILTERING';
            }
        }

        const result = await client.execute(cql, params, { prepare: true });
        let rows = mapRows(result.rows);

        const minValue = parseFloat(min_percentage);
        const maxValue = parseFloat(max_percentage);
        if (!Number.isNaN(minValue)) {
            rows = rows.filter((row) => row.percentage >= minValue);
        }
        if (!Number.isNaN(maxValue)) {
            rows = rows.filter((row) => row.percentage <= maxValue);
        }

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all data points for a region (newest year first)
const getByRegion = async (req, res) => {
    try {
        const region = req.params.region.trim();
        const result = await client.execute(
            `SELECT * FROM ${TABLE_NAME} WHERE region = ?`,
            [region],
            { prepare: true }
        );
        const data = mapRows(result.rows);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single data point or all matching rows for a given region/year
const getOne = async (req, res) => {
    try {
        const { region, year } = req.params;
        const result = await client.execute(
            `SELECT * FROM ${TABLE_NAME} WHERE region = ? AND year = ? ALLOW FILTERING`,
            [region.trim(), parseInt(year, 10)],
            { prepare: true }
        );
        if (result.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }
        const data = result.rows.map((r) => ({
            region: r.region,
            gender: r.gender || 'All sexes',
            education_level: r.education_level || 'All levels',
            year: r.year,
            percentage: r.percentage,
        }));
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new data point
const createOne = async (req, res) => {
    try {
        const { region, year, percentage, gender, education_level } = req.body;
        if (!region || year == null || percentage == null) {
            return res.status(400).json({ message: 'Region, year, and percentage are required' });
        }

        await client.execute(
            `INSERT INTO ${TABLE_NAME} (region, gender, education_level, year, percentage) VALUES (?, ?, ?, ?, ?)`,
            [
                region.trim(),
                sanitizeCategory(gender, 'All sexes'),
                sanitizeCategory(education_level, 'All levels'),
                parseInt(year, 10),
                parseFloat(percentage),
            ],
            { prepare: true }
        );

        res.status(201).json({
            region: region.trim(),
            gender: sanitizeCategory(gender, 'All sexes'),
            education_level: sanitizeCategory(education_level, 'All levels'),
            year: parseInt(year, 10),
            percentage: parseFloat(percentage),
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update an existing data point
const updateOne = async (req, res) => {
    try {
        const { region, year } = req.params;
        const { percentage, gender, education_level } = req.body;

        if (percentage == null || !gender || !education_level) {
            return res.status(400).json({ message: 'Gender, education_level, and percentage are required for updates' });
        }

        const existing = await client.execute(
            `SELECT * FROM ${TABLE_NAME} WHERE region = ? AND gender = ? AND education_level = ? AND year = ?`,
            [region.trim(), gender, education_level, parseInt(year, 10)],
            { prepare: true }
        );
        if (existing.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }

        await client.execute(
            `UPDATE ${TABLE_NAME} SET percentage = ? WHERE region = ? AND gender = ? AND education_level = ? AND year = ?`,
            [parseFloat(percentage), region.trim(), gender, education_level, parseInt(year, 10)],
            { prepare: true }
        );

        res.json({
            region: region.trim(),
            gender,
            education_level,
            year: parseInt(year, 10),
            percentage: parseFloat(percentage),
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a data point
const deleteOne = async (req, res) => {
    try {
        const { region, year } = req.params;
        const { gender, education_level } = req.query;

        if (!gender || !education_level) {
            return res.status(400).json({ message: 'Gender and education_level are required to delete a specific row' });
        }

        const existing = await client.execute(
            `SELECT * FROM ${TABLE_NAME} WHERE region = ? AND gender = ? AND education_level = ? AND year = ?`,
            [region.trim(), gender, education_level, parseInt(year, 10)],
            { prepare: true }
        );
        if (existing.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }

        await client.execute(
            `DELETE FROM ${TABLE_NAME} WHERE region = ? AND gender = ? AND education_level = ? AND year = ?`,
            [region.trim(), gender, education_level, parseInt(year, 10)],
            { prepare: true }
        );

        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { importDataset, getRegions, getAll, getByRegion, getOne, createOne, updateOne, deleteOne };