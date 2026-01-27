// Import/Export Module JavaScript
// Marcha UNEMI - Excel Import/Export Functionality

let currentFile = null;
let analysisData = null;
let columnMappings = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFileInput();
});

// Drag and Drop Setup
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
}

// File Input Setup
function setupFileInput() {
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleFileSelect(file) {
    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showNotification('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
        return;
    }

    currentFile = file;

    // Show file info
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatFileSize(file.size);
    document.getElementById('file-info').classList.remove('hidden');
    document.getElementById('btn-analyze').disabled = false;

    // Update step
    updateStep(1);
}

function clearFile() {
    currentFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('btn-analyze').disabled = true;
    resetSections();
}

// Analyze File
async function analyzeFile() {
    if (!currentFile) return;

    showLoading('Analizando archivo...');

    const formData = new FormData();
    formData.append('file', currentFile);

    try {
        const token = localStorage.getItem('token');
        const response = await axios.post('/api/v1/alumnos/analizar-excel/', formData, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            analysisData = response.data;
            displayAnalysis(response.data);
            updateStep(2);
        } else {
            showNotification(response.data.error || 'Error al analizar el archivo', 'error');
        }
    } catch (error) {
        console.error('Error analyzing file:', error);
        showNotification(error.response?.data?.error || 'Error al analizar el archivo', 'error');
    } finally {
        hideLoading();
    }
}

// Display Analysis Results
function displayAnalysis(data) {
    // Show preview
    displayPreview(data);

    // Show mapping interface
    displayMapping(data);

    // Show sections
    document.getElementById('preview-section').classList.remove('hidden');
    document.getElementById('mapping-section').classList.remove('hidden');
}

function displayPreview(data) {
    const headerRow = document.getElementById('preview-header');
    const bodyTable = document.getElementById('preview-body');

    // Clear previous content
    headerRow.innerHTML = '';
    bodyTable.innerHTML = '';

    // Add headers
    data.columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-4 py-3 text-left';
        th.textContent = col;
        headerRow.appendChild(th);
    });

    // Add preview rows
    data.preview.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';

        row.forEach(cell => {
            const td = document.createElement('td');
            td.className = 'px-4 py-3 text-slate-700';
            td.textContent = cell || '-';
            tr.appendChild(td);
        });

        bodyTable.appendChild(tr);
    });

    // Update stats
    document.getElementById('file-stats').textContent =
        `Total de filas: ${data.total_rows} | Columnas detectadas: ${data.columns.length} | ${data.has_header ? 'Con encabezados' : 'Sin encabezados'}`;
}

function displayMapping(data) {
    const container = document.getElementById('mapping-container');
    container.innerHTML = '';

    const requiredFields = data.required_fields;
    const suggestedMappings = data.suggested_mappings || {};

    // Initialize mappings
    columnMappings = {};

    Object.keys(requiredFields).forEach(field => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 gap-4 items-center p-4 bg-slate-50 rounded-lg border border-slate-200';

        // Field label
        const label = document.createElement('div');
        label.innerHTML = `
            <p class="font-bold text-sm text-slate-800">${requiredFields[field]}</p>
            <p class="text-xs text-slate-500">${field.includes('Opcional') ? 'Opcional' : 'Requerido'}</p>
        `;

        // Column selector
        const selector = document.createElement('select');
        selector.id = `mapping-${field}`;
        selector.className = 'w-full p-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-unemi-blue focus:outline-none';

        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Seleccionar columna --';
        selector.appendChild(emptyOption);

        // Add column options
        data.columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;

            // Pre-select if suggested
            if (suggestedMappings[field] === col) {
                option.selected = true;
                columnMappings[field] = col;
            }

            selector.appendChild(option);
        });

        // Update mapping on change
        selector.addEventListener('change', (e) => {
            columnMappings[field] = e.target.value;
        });

        row.appendChild(label);
        row.appendChild(selector);
        container.appendChild(row);
    });
}

// Process Import
async function processImport() {
    if (!currentFile || !analysisData) return;

    // Validate mappings
    const requiredFields = ['nombre_completo', 'cedula', 'email', 'telefono'];
    const missingFields = requiredFields.filter(field => !columnMappings[field]);

    if (missingFields.length > 0) {
        showNotification('Por favor mapea todos los campos requeridos', 'error');
        return;
    }

    showLoading('Importando registros...');
    updateStep(3);

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('mappings', JSON.stringify(columnMappings));
    formData.append('has_header', analysisData.has_header);

    try {
        const token = localStorage.getItem('token');
        const response = await axios.post('/api/v1/alumnos/procesar-importacion/', formData, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            displayResults(response.data.results);
        } else {
            showNotification(response.data.error || 'Error al procesar la importación', 'error');
        }
    } catch (error) {
        console.error('Error processing import:', error);
        showNotification(error.response?.data?.error || 'Error al procesar la importación', 'error');
    } finally {
        hideLoading();
    }
}

// Display Results
function displayResults(results) {
    // Hide other sections
    document.getElementById('mapping-section').classList.add('hidden');
    document.getElementById('preview-section').classList.add('hidden');

    // Show results
    document.getElementById('results-section').classList.remove('hidden');

    // Update stats
    document.getElementById('result-created').textContent = results.created;
    document.getElementById('result-errors').textContent = results.errors.length;
    document.getElementById('result-total').textContent = results.total;

    // Show errors if any
    if (results.errors.length > 0) {
        document.getElementById('error-list').classList.remove('hidden');
        const errorDetails = document.getElementById('error-details');
        errorDetails.innerHTML = '';

        results.errors.forEach(error => {
            const p = document.createElement('p');
            p.className = 'text-sm text-red-700 mb-1';
            p.textContent = error;
            errorDetails.appendChild(p);
        });
    }

    // Show success notification
    if (results.created > 0) {
        showNotification(`Se importaron ${results.created} registros exitosamente`, 'success');
    }
}

// Cancel Import
function cancelImport() {
    if (confirm('¿Estás seguro de cancelar la importación?')) {
        resetSections();
        updateStep(1);
    }
}

// Reset Import
function resetImport() {
    clearFile();
    resetSections();
    updateStep(1);
}

function resetSections() {
    document.getElementById('mapping-section').classList.add('hidden');
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    analysisData = null;
    columnMappings = {};
}

// Update Step Indicator
function updateStep(step) {
    // Reset all steps
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        stepEl.classList.remove('step-active', 'step-completed', 'step-inactive');

        if (i < step) {
            stepEl.classList.add('step-completed');
        } else if (i === step) {
            stepEl.classList.add('step-active');
        } else {
            stepEl.classList.add('step-inactive');
        }
    }
}

// Loading State
function showLoading(text = 'Procesando...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-section').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-section').classList.add('hidden');
}

// Notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md transform transition-all duration-300 ${type === 'success' ? 'bg-green-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' :
                'bg-blue-600 text-white'
        }`;

    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5"></i>
            <p class="font-bold text-sm">${message}</p>
        </div>
    `;

    document.body.appendChild(notification);
    lucide.createIcons();

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
