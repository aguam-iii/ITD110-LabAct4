const { client } = require('../config/db');

// Parse the semicolon-delimited CSV and bulk-insert into Cassandra
const importDataset = async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv) {
            return res.status(400).json({ message: 'CSV data is required' });
        }

        const lines = csv.split('\n').filter((l) => l.trim());

        // First line is the title, second line is headers
        if (lines.length < 3) {
            return res.status(400).json({ message: 'CSV must have a header row and at least one data row' });
        }

        // Parse header to get years
        const headerCols = lines[1].split(';').map((c) => c.replace(/"/g, '').trim());
        // headerCols: [Sub-indicator, Geolocation, 2000, 2001, ..., 2025]
        const years = headerCols.slice(2).map(Number);

        let inserted = 0;
        const queries = [];

        for (let i = 2; i < lines.length; i++) {
            const cols = lines[i].split(';').map((c) => c.replace(/"/g, '').trim());
            const region = cols[1].replace(/^\.\./, '').trim(); // remove leading dots

            for (let j = 0; j < years.length; j++) {
                const val = cols[j + 2];
                // Skip missing data markers: "..", "...", empty
                if (!val || val === '..' || val === '...') continue;

                const percentage = parseFloat(val);
                if (isNaN(percentage)) continue;

                queries.push({
                    query: `INSERT INTO electricity_by_region (region, year, percentage) VALUES (?, ?, ?)`,
                    params: [region, years[j], percentage],
                });
                inserted++;
            }
        }

        // Execute in batches of 30 (Cassandra batch size limit)
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
        const result = await client.execute('SELECT DISTINCT region FROM electricity_by_region');
        const regions = result.rows.map((r) => r.region).sort();
        res.json(regions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all data points for a region (newest year first)
const getByRegion = async (req, res) => {
    try {
        const region = req.params.region.trim();
        const result = await client.execute(
            'SELECT * FROM electricity_by_region WHERE region = ?',
            [region],
            { prepare: true }
        );
        const data = result.rows.map((r) => ({
            region: r.region,
            year: r.year,
            percentage: r.percentage,
        }));
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single data point
const getOne = async (req, res) => {
    try {
        const { region, year } = req.params;
        const result = await client.execute(
            'SELECT * FROM electricity_by_region WHERE region = ? AND year = ?',
            [region.trim(), parseInt(year)],
            { prepare: true }
        );
        if (result.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }
        const r = result.rows[0];
        res.json({ region: r.region, year: r.year, percentage: r.percentage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new data point
const createOne = async (req, res) => {
    try {
        const { region, year, percentage } = req.body;
        if (!region || year == null || percentage == null) {
            return res.status(400).json({ message: 'Region, year, and percentage are required' });
        }

        await client.execute(
            'INSERT INTO electricity_by_region (region, year, percentage) VALUES (?, ?, ?)',
            [region.trim(), parseInt(year), parseFloat(percentage)],
            { prepare: true }
        );

        res.status(201).json({ region: region.trim(), year: parseInt(year), percentage: parseFloat(percentage) });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update an existing data point
const updateOne = async (req, res) => {
    try {
        const { region, year } = req.params;
        const { percentage } = req.body;

        if (percentage == null) {
            return res.status(400).json({ message: 'Percentage is required' });
        }

        const existing = await client.execute(
            'SELECT * FROM electricity_by_region WHERE region = ? AND year = ?',
            [region.trim(), parseInt(year)],
            { prepare: true }
        );
        if (existing.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }

        await client.execute(
            'UPDATE electricity_by_region SET percentage = ? WHERE region = ? AND year = ?',
            [parseFloat(percentage), region.trim(), parseInt(year)],
            { prepare: true }
        );

        res.json({ region: region.trim(), year: parseInt(year), percentage: parseFloat(percentage) });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a data point
const deleteOne = async (req, res) => {
    try {
        const { region, year } = req.params;

        const existing = await client.execute(
            'SELECT * FROM electricity_by_region WHERE region = ? AND year = ?',
            [region.trim(), parseInt(year)],
            { prepare: true }
        );
        if (existing.rowLength === 0) {
            return res.status(404).json({ message: 'Data point not found' });
        }

        await client.execute(
            'DELETE FROM electricity_by_region WHERE region = ? AND year = ?',
            [region.trim(), parseInt(year)],
            { prepare: true }
        );

        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { importDataset, getRegions, getByRegion, getOne, createOne, updateOne, deleteOne };