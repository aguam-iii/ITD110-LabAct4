const API_URL = 'http://localhost:3000/api/electricity';

const csvFileInput = document.getElementById('csv-file');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');
const dataForm = document.getElementById('data-form');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const regionInput = document.getElementById('region');
const yearInput = document.getElementById('year');
const percentageInput = document.getElementById('percentage');
const editOriginalRegion = document.getElementById('edit-original-region');
const editOriginalYear = document.getElementById('edit-original-year');
const regionSelect = document.getElementById('region-select');
const dataTbody = document.getElementById('data-tbody');
const noData = document.getElementById('no-data');

let isEditing = false;

// ---- Import ----
importBtn.addEventListener('click', async () => {
    const file = csvFileInput.files[0];
    if (!file) {
        showImportStatus('Please select a CSV file.', true);
        return;
    }

    const text = await file.text();
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    try {
        const res = await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showImportStatus(data.message, false);
        loadRegions();
        loadData();
    } catch (err) {
        showImportStatus(err.message, true);
    } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Import CSV';
    }
});

function showImportStatus(msg, isError) {
    importStatus.textContent = msg;
    importStatus.className = isError ? 'status error' : 'status success';
    importStatus.classList.remove('hidden');
}

// ---- Region dropdown ----
async function loadRegions() {
    try {
        const res = await fetch(`${API_URL}/regions`);
        const regions = await res.json();
        regionSelect.innerHTML = '<option value="">-- All Regions --</option>';
        regions.forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            regionSelect.appendChild(opt);
        });
    } catch {
        // ignore
    }
}

regionSelect.addEventListener('change', loadData);

// ---- Load table data ----
async function loadData() {
    const selected = regionSelect.value;
    try {
        let rows;
        if (selected) {
            const res = await fetch(`${API_URL}/${encodeURIComponent(selected)}`);
            rows = await res.json();
        } else {
            // Load all regions' data
            const regRes = await fetch(`${API_URL}/regions`);
            const regions = await regRes.json();
            rows = [];
            for (const r of regions) {
                const res = await fetch(`${API_URL}/${encodeURIComponent(r)}`);
                const data = await res.json();
                rows.push(...data);
            }
        }

        renderTable(rows);
    } catch {
        renderTable([]);
    }
}

function renderTable(rows) {
    dataTbody.innerHTML = '';

    if (rows.length === 0) {
        noData.classList.remove('hidden');
        return;
    }

    noData.classList.add('hidden');

    // Sort: region asc, year desc
    rows.sort((a, b) => a.region.localeCompare(b.region) || b.year - a.year);

    rows.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(r.region)}</td>
            <td>${r.year}</td>
            <td>${r.percentage.toFixed(1)}</td>
            <td>
                <button class="btn-edit" onclick="editRow('${escapeAttr(r.region)}', ${r.year}, ${r.percentage})">Edit</button>
                <button class="btn-delete" onclick="deleteRow('${escapeAttr(r.region)}', ${r.year})">Delete</button>
            </td>
        `;
        dataTbody.appendChild(tr);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ---- CRUD Form ----
dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const region = regionInput.value.trim();
    const year = parseInt(yearInput.value);
    const percentage = parseFloat(percentageInput.value);

    try {
        if (isEditing) {
            const origRegion = editOriginalRegion.value;
            const origYear = parseInt(editOriginalYear.value);

            // If region or year changed, delete old + create new (primary key changed)
            if (origRegion !== region || origYear !== year) {
                await fetch(`${API_URL}/${encodeURIComponent(origRegion)}/${origYear}`, { method: 'DELETE' });
                await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ region, year, percentage }),
                });
            } else {
                await fetch(`${API_URL}/${encodeURIComponent(region)}/${year}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ percentage }),
                });
            }
        } else {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ region, year, percentage }),
            });
        }

        resetForm();
        loadRegions();
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

function editRow(region, year, percentage) {
    isEditing = true;
    formTitle.textContent = 'Edit Data Point';
    submitBtn.textContent = 'Update';
    cancelBtn.classList.remove('hidden');

    editOriginalRegion.value = region;
    editOriginalYear.value = year;
    regionInput.value = region;
    yearInput.value = year;
    percentageInput.value = percentage;
    regionInput.focus();
}

async function deleteRow(region, year) {
    if (!confirm(`Delete ${region} (${year})?`)) return;

    try {
        await fetch(`${API_URL}/${encodeURIComponent(region)}/${year}`, { method: 'DELETE' });
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    dataForm.reset();
    editOriginalRegion.value = '';
    editOriginalYear.value = '';
    isEditing = false;
    formTitle.textContent = 'Add Data Point';
    submitBtn.textContent = 'Add';
    cancelBtn.classList.add('hidden');
}

// ---- Init ----
loadRegions();
loadData();