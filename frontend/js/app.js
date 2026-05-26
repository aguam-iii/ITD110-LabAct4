const API_URL = 'http://localhost:3000/api/electricity';

const csvFileInput = document.getElementById('csv-file');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');
const dataForm = document.getElementById('data-form');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const regionInput = document.getElementById('region');
const genderInput = document.getElementById('gender');
const educationLevelInput = document.getElementById('education-level');
const yearInput = document.getElementById('year');
const percentageInput = document.getElementById('percentage');
const editOriginalRegion = document.getElementById('edit-original-region');
const editOriginalYear = document.getElementById('edit-original-year');
const editOriginalGender = document.getElementById('edit-original-gender');
const editOriginalEducationLevel = document.getElementById('edit-original-education-level');
const regionSelect = document.getElementById('region-select');
const genderFilter = document.getElementById('gender-filter');
const educationLevelFilter = document.getElementById('education-level-filter');
const yearFilter = document.getElementById('year-filter');
const minRateFilter = document.getElementById('min-rate-filter');
const maxRateFilter = document.getElementById('max-rate-filter');
const sortColumnSelect = document.getElementById('sort-column-select');
const sortOrderSelect = document.getElementById('sort-order-select');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const dataTbody = document.getElementById('data-tbody');
const philippinesTbody = document.getElementById('philippines-tbody');
const noData = document.getElementById('no-data');
const philippinesNoData = document.getElementById('philippines-no-data');
const mainTableScrollbar = document.getElementById('main-table-scrollbar');
const mainTableWrapper = document.getElementById('main-table-wrapper');
const philippinesScrollbar = document.getElementById('philippines-scrollbar');
const philippinesTableWrapper = document.getElementById('philippines-table-wrapper');

let isEditing = false;
let allRows = [];

const filterElements = [regionSelect, genderFilter, educationLevelFilter, yearFilter, minRateFilter, maxRateFilter, sortColumnSelect, sortOrderSelect];
filterElements.forEach((element) => {
    element.addEventListener('change', renderFilteredRows);
});

minRateFilter.addEventListener('input', renderFilteredRows);
maxRateFilter.addEventListener('input', renderFilteredRows);
clearFiltersBtn.addEventListener('click', () => {
    regionSelect.value = '';
    genderFilter.value = '';
    educationLevelFilter.value = '';
    yearFilter.value = '';
    minRateFilter.value = '';
    maxRateFilter.value = '';
    renderFilteredRows();
});

// Year filter input
if (yearFilter) {
    yearFilter.addEventListener('input', renderFilteredRows);
}

if (mainTableScrollbar && mainTableWrapper) {
    mainTableScrollbar.addEventListener('scroll', () => {
        mainTableWrapper.scrollLeft = mainTableScrollbar.scrollLeft;
    });
    mainTableWrapper.addEventListener('scroll', () => {
        mainTableScrollbar.scrollLeft = mainTableWrapper.scrollLeft;
    });
}

if (philippinesScrollbar && philippinesTableWrapper) {
    philippinesScrollbar.addEventListener('scroll', () => {
        philippinesTableWrapper.scrollLeft = philippinesScrollbar.scrollLeft;
    });
    philippinesTableWrapper.addEventListener('scroll', () => {
        philippinesScrollbar.scrollLeft = philippinesTableWrapper.scrollLeft;
    });
}

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
        const filteredRegions = regions
            .filter((r) => r && r.toString().trim().toLowerCase() !== 'philippines')
            .sort((a, b) => a.toString().localeCompare(b.toString()));
        
        // Populate filter dropdown
        regionSelect.innerHTML = '<option value="">-- All Regions --</option>';
        filteredRegions.forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            regionSelect.appendChild(opt);
        });
        
        // Populate form dropdown with exact same regions
        regionInput.innerHTML = '<option value="">-- Select a Region --</option>';
        filteredRegions.forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            regionInput.appendChild(opt);
        });
    } catch {
        // ignore
    }
}

regionSelect.addEventListener('change', renderFilteredRows);

// ---- Load table data ----
async function loadData() {
    try {
        const res = await fetch(API_URL);
        allRows = await res.json();
        renderFilteredRows();
    } catch {
        renderTable([]);
    }
}

function renderFilteredRows() {
    const mainRows = applyFilters(allRows, { excludePhilippines: true });
    const philippinesRows = applyFilters(allRows, { onlyPhilippines: true });
    renderTable(mainRows, dataTbody, noData, true);
    renderTable(philippinesRows, philippinesTbody, philippinesNoData, false, true);
    updateMainTableScrollbar();
    updatePhilippinesScrollbar();
}

function updateMainTableScrollbar() {
    if (!mainTableScrollbar || !mainTableWrapper) return;
    const table = mainTableWrapper.querySelector('table');
    const spacer = mainTableScrollbar.querySelector('.scroll-spacer');
    if (!spacer || !table) return;
    spacer.style.width = `${Math.max(table.scrollWidth, mainTableWrapper.clientWidth)}px`;
}

function updatePhilippinesScrollbar() {
    if (!philippinesScrollbar || !philippinesTableWrapper) return;
    const table = philippinesTableWrapper.querySelector('table');
    const spacer = philippinesScrollbar.querySelector('.scroll-spacer');
    if (!spacer || !table) return;
    spacer.style.width = `${Math.max(table.scrollWidth, philippinesTableWrapper.clientWidth)}px`;
}

function applyFilters(rows, { excludePhilippines = false, onlyPhilippines = false } = {}) {
    return rows.filter((row) => {
        const selectedRegion = regionSelect.value;
        const selectedGender = genderFilter.value;
        const selectedEducation = educationLevelFilter.value;
        const selectedYear = yearFilter.value;
        const minRate = parseFloat(minRateFilter.value);
        const maxRate = parseFloat(maxRateFilter.value);
        const normalizedRegion = row.region ? row.region.toString().trim().toLowerCase() : '';

        if (excludePhilippines && normalizedRegion === 'philippines') return false;
        if (onlyPhilippines && normalizedRegion !== 'philippines') return false;
        if (!onlyPhilippines && selectedRegion && row.region !== selectedRegion) return false;
        if (selectedGender) {
            const norm = (s) => (s == null ? '' : s.toString().trim().toLowerCase());
            if (norm(row.gender) !== norm(selectedGender)) return false;
        }
        if (selectedEducation) {
            const canonical = (v) => {
                if (!v) return '';
                const s = v.toString().trim().toLowerCase();
                if (s.includes('junior')) return 'junior high school';
                if (s.includes('senior')) return 'senior high school';
                if (s.includes('elementary')) return 'elementary';
                if (s.includes('all')) return 'all levels';
                return s.replace(/[^a-z0-9 ]+/g, '').trim();
            };
            if (canonical(row.education_level) !== canonical(selectedEducation)) return false;
        }
        if (selectedYear && row.year !== parseInt(selectedYear, 10)) return false;
        if (!Number.isNaN(minRate) && row.percentage < minRate) return false;
        if (!Number.isNaN(maxRate) && row.percentage > maxRate) return false;

        return true;
    });
}

function renderTable(rows, tbody, noDataEl, showRegion = false, isPhilippines = false) {
    tbody.innerHTML = '';

    if (rows.length === 0) {
        noDataEl.classList.remove('hidden');
        return;
    }

    noDataEl.classList.add('hidden');

    const sortBy = sortColumnSelect ? sortColumnSelect.value : 'year';
    const direction = sortOrderSelect && sortOrderSelect.value === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        if (sortBy === 'year' || sortBy === 'percentage') {
            return direction * ((aValue || 0) - (bValue || 0));
        }
        const left = String(aValue || '').localeCompare(String(bValue || ''));
        return direction * left;
    });

    rows.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            ${showRegion ? `<td>${escapeHtml(r.region)}</td>` : ''}
            <td>${escapeHtml(r.gender)}</td>
            <td>${escapeHtml(r.education_level)}</td>
            <td>${r.year}</td>
            <td>${r.percentage.toFixed(1)}</td>
            <td>
                <button class="btn-edit" onclick="editRow('${escapeAttr(r.region)}', ${r.year}, '${escapeAttr(r.gender)}', '${escapeAttr(r.education_level)}', ${r.percentage})">Edit</button>
                <button class="btn-delete" onclick="deleteRow('${escapeAttr(r.region)}', ${r.year}, '${escapeAttr(r.gender)}', '${escapeAttr(r.education_level)}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
}

function escapeAttr(text) {
    const safeText = text == null ? '' : text;
    return safeText.replace(/'/g, "\\'").replace(/"/g, '\\"');
}


// ---- CRUD Form ----
dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const region = regionInput.value.trim();
    const gender = genderInput.value;
    const education_level = educationLevelInput.value;
    const year = parseInt(yearInput.value, 10);
    const percentage = parseFloat(percentageInput.value);

    try {
        if (isEditing) {
            const origRegion = editOriginalRegion.value;
            const origYear = parseInt(editOriginalYear.value, 10);
            const origGender = editOriginalGender.value;
            const origEducationLevel = editOriginalEducationLevel.value;

            if (origRegion !== region || origYear !== year || origGender !== gender || origEducationLevel !== education_level) {
                await fetch(
                    `${API_URL}/${encodeURIComponent(origRegion)}/${origYear}?gender=${encodeURIComponent(origGender)}&education_level=${encodeURIComponent(origEducationLevel)}`,
                    { method: 'DELETE' }
                );
                await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ region, gender, education_level, year, percentage }),
                });
            } else {
                await fetch(`${API_URL}/${encodeURIComponent(region)}/${year}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gender, education_level, percentage }),
                });
            }
        } else {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ region, gender, education_level, year, percentage }),
            });
        }

        resetForm();
        loadRegions();
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

function editRow(region, year, gender, educationLevel, percentage) {
    isEditing = true;
    formTitle.textContent = 'Edit Data Point';
    submitBtn.textContent = 'Update';
    cancelBtn.classList.remove('hidden');

    editOriginalRegion.value = region;
    editOriginalYear.value = year;
    editOriginalGender.value = gender;
    editOriginalEducationLevel.value = educationLevel;
    regionInput.value = region;
    genderInput.value = gender;
    educationLevelInput.value = educationLevel;
    yearInput.value = year;
    percentageInput.value = percentage;
    regionInput.focus();
}

async function deleteRow(region, year, gender, educationLevel) {
    if (!confirm(`Delete ${region} (${year}) ${gender} / ${educationLevel}?`)) return;

    try {
        await fetch(
            `${API_URL}/${encodeURIComponent(region)}/${year}?gender=${encodeURIComponent(gender)}&education_level=${encodeURIComponent(educationLevel)}`,
            { method: 'DELETE' }
        );
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    dataForm.reset();
    regionInput.value = '';
    editOriginalRegion.value = '';
    editOriginalYear.value = '';
    editOriginalGender.value = '';
    editOriginalEducationLevel.value = '';
    isEditing = false;
    formTitle.textContent = 'Add Data Point';
    submitBtn.textContent = 'Add';
    cancelBtn.classList.add('hidden');
}

// ---- Init ----
loadRegions();
loadData();