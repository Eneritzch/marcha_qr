// Dashboard Logic
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
let allAlumnos = [];
let html5QrcodeScanner = null;
let charts = {};

// Auth Check
if (!token) window.location.href = '/login';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // User Info
    document.getElementById('user-name').textContent = user.nombre || 'Líder';
    document.getElementById('user-group').textContent = `Grupo ${user.grupo || '?'}`;

    // Initial Fetch
    await refreshData();

    // Event Listeners
    document.getElementById('search-registros').addEventListener('input', (e) => filterRegistros(e.target.value));
    document.getElementById('filter-estado').addEventListener('change', () => filterRegistros(document.getElementById('search-registros').value));
    document.getElementById('filter-banco').addEventListener('change', filterBancos);
    document.getElementById('excel-form').addEventListener('submit', handleExcelUpload);
});

function logout() {
    localStorage.clear();
    window.location.href = '/login';
}

// === VIEW SWITCHING ===
window.switchView = function (viewName) {
    const views = ['overview', 'scanner', 'registros', 'bancos'];

    // Hide all views
    views.forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');

        // Reset Sidebar Styles
        const sidebarItem = document.getElementById(`sidebar-nav-${v}`);
        if (sidebarItem) {
            sidebarItem.classList.remove('sidebar-item-active');
            sidebarItem.classList.add('text-slate-300');
        }

        // Reset Mobile Nav Styles
        const mobileItem = document.getElementById(`mobile-nav-${v}`);
        if (mobileItem) {
            mobileItem.classList.remove('text-unemi-orange');
            mobileItem.classList.add('text-slate-400');
        }
    });

    // Show selected view
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    // Activate Sidebar
    const activeSidebar = document.getElementById(`sidebar-nav-${viewName}`);
    if (activeSidebar) {
        activeSidebar.classList.remove('text-slate-300');
        activeSidebar.classList.add('sidebar-item-active');
    }

    // Activate Mobile Nav
    const activeMobile = document.getElementById(`mobile-nav-${viewName}`);
    if (activeMobile) {
        activeMobile.classList.remove('text-slate-400');
        activeMobile.classList.add('text-unemi-orange');
    }

    // Header Title Update
    const titles = {
        'overview': 'Resumen General',
        'scanner': 'Escanear Asistencia',
        'registros': 'Base de Registros',
        'bancos': 'Información Bancaria'
    };
    if (document.getElementById('page-title')) {
        document.getElementById('page-title').textContent = titles[viewName];
    }

    // Specialized Logic
    if (viewName === 'scanner') startScanner();
    else stopScanner();

    if (viewName === 'overview') updateCharts();

    lucide.createIcons();
}

// === DATA FETCHING ===
window.refreshData = async function () {
    try {
        window.showLoader && window.showLoader();
        const response = await axios.get('/api/v1/alumnos/alumnos/', {
            headers: { Authorization: `Token ${token}` }
        });
        allAlumnos = response.data.results || response.data;

        updateKPIs();
        renderRegistrosTable(allAlumnos);
        renderBancosTable(allAlumnos);
        updateCharts();
        populateBankFilter();

    } catch (error) {
        console.error("Fetch error:", error);
        if (error.response?.status === 401) logout();
    } finally {
        window.hideLoader && window.hideLoader();
    }
}

function updateKPIs() {
    const total = allAlumnos.length;
    const asistencias = allAlumnos.filter(a => a.asistio).length;
    const pendientes = total - asistencias;
    const porcentaje = total > 0 ? ((asistencias / total) * 100).toFixed(1) : 0;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-asistencias').textContent = asistencias;
    document.getElementById('kpi-pendientes').textContent = pendientes;
    document.getElementById('kpi-porcentaje').textContent = `${porcentaje}%`;
}

// === TABLES ===
function filterRegistros(query) {
    const q = query.toLowerCase();
    const status = document.getElementById('filter-estado').value;

    const filtered = allAlumnos.filter(a => {
        const matchesSearch = a.nombre_completo.toLowerCase().includes(q) || a.cedula.includes(q);
        const matchesStatus = status === 'all' ||
            (status === 'present' && a.asistio) ||
            (status === 'absent' && !a.asistio);
        return matchesSearch && matchesStatus;
    });

    renderRegistrosTable(filtered);
}

function renderRegistrosTable(data) {
    const tbody = document.getElementById('tbody-registros');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No se encontraron registros.</td></tr>`;
        return;
    }

    data.slice(0, 50).forEach(a => { // Limit to 50 for DOM perf
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900">${a.nombre_completo}</td>
            <td class="px-6 py-4 font-mono text-xs">${a.cedula}</td>
            <td class="px-6 py-4 text-xs">${a.carrera || '-'}</td>
            <td class="px-6 py-4 text-center">
                 <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${a.asistio ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}">
                    ${a.asistio ? 'Presente' : 'Pendiente'}
                 </span>
            </td>
            <td class="px-6 py-4 text-center">
                 <a href="/api/v1/alumnos/descargar-qr/${a.cedula}/" target="_blank" class="text-unemi-blue hover:text-unemi-orange"><i data-lucide="qr-code" class="w-4 h-4 mx-auto"></i></a>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderBancosTable(data) {
    const tbody = document.getElementById('tbody-bancos');
    tbody.innerHTML = '';

    // Only show people with bank info
    const dataWithBank = data.filter(a => a.cuenta_bancaria && a.cuenta_bancaria.numero_cuenta);

    // Apply Filter
    const filterVal = document.getElementById('filter-banco').value;
    const filtered = filterVal === 'all' ? dataWithBank : dataWithBank.filter(a => a.cuenta_bancaria.banco === filterVal);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No hay datos bancarios registrados.</td></tr>`;
        return;
    }

    filtered.forEach(a => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-blue-50/10 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-700">${a.nombre_completo}</td>
             <td class="px-6 py-4 font-mono text-xs">${a.cedula}</td>
             <td class="px-6 py-4">${a.cuenta_bancaria.banco}</td>
             <td class="px-6 py-4 capitalize">${a.cuenta_bancaria.tipo_cuenta}</td>
             <td class="px-6 py-4 font-mono font-bold text-slate-800">${a.cuenta_bancaria.numero_cuenta}</td>
        `;
        tbody.appendChild(tr);
    });
}
function populateBankFilter() {
    const select = document.getElementById('filter-banco');
    // Keep first option
    select.innerHTML = '<option value="all">Filtrar por Banco (Todos)</option>';

    const banks = new Set(
        allAlumnos
            .filter(a => a.cuenta_bancaria && a.cuenta_bancaria.banco)
            .map(a => a.cuenta_bancaria.banco)
    );

    banks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
}
function filterBancos() {
    // Re-render handled inside logic using current filter value
    renderBancosTable(allAlumnos);
}


// === CHART.JS ===
function updateCharts() {
    const ctxAttendance = document.getElementById('chart-attendance');
    const ctxCareers = document.getElementById('chart-careers');

    if (!ctxAttendance || !ctxCareers) return;

    // DATA PREP
    const total = allAlumnos.length;
    const asistencias = allAlumnos.filter(a => a.asistio).length;
    const pendientes = total - asistencias;

    // Careers Count
    const careerCounts = {};
    allAlumnos.forEach(a => {
        const c = a.carrera || 'Sin Carrera';
        careerCounts[c] = (careerCounts[c] || 0) + 1;
    });
    // Sort and Top 5
    const sortedCareers = Object.entries(careerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Destroy existing
    if (charts.attendance) charts.attendance.destroy();
    if (charts.careers) charts.careers.destroy();

    // Chart 1: Doughnut Attendance
    charts.attendance = new Chart(ctxAttendance, {
        type: 'doughnut',
        data: {
            labels: ['Asistencias', 'Pendientes'],
            datasets: [{
                data: [asistencias, pendientes],
                backgroundColor: ['#22c55e', '#cbd5e1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Chart 2: Bar Careers
    charts.careers = new Chart(ctxCareers, {
        type: 'bar',
        data: {
            labels: sortedCareers.map(i => i[0].substring(0, 15) + '...'),
            datasets: [{
                label: 'Estudiantes',
                data: sortedCareers.map(i => i[1]),
                backgroundColor: '#0F1E4B',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } }
        }
    });
}

// === QR SCANNER (PRO API) ===
let html5QrCode = null;
let currentCameraId = null;
let cameras = [];
let isScanning = false;

async function startScanner() {
    if (isScanning) return;

    const statusEl = document.getElementById('scan-status');
    const switchBtn = document.getElementById('btn-switch-camera');
    statusEl.textContent = "Solicitando permisos...";

    try {
        // 1. Get Cameras
        cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            statusEl.textContent = "No se detectaron cámaras.";
            return;
        }

        // 2. Select initial camera (Prefer Back/Environment)
        // Usually the last camera is the back one on mobile, or check label
        // Simple heuristic: Try the last one first (often back), or 0 if only one.
        // Better: look for 'back' or 'environment' in label if available, else last.
        let selectedCamera = cameras[cameras.length - 1];

        // Use current if already set (for toggling)
        if (currentCameraId) {
            const found = cameras.find(c => c.id === currentCameraId);
            if (found) selectedCamera = found;
        } else {
            currentCameraId = selectedCamera.id;
        }

        // Show switch button if multiple cameras
        if (cameras.length > 1) {
            switchBtn.classList.remove('hidden');
            // Icon: Refresh-cw or similar? Camera-off is placeholder, using switch icon
            switchBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-6 h-6"></i>';
        } else {
            switchBtn.classList.add('hidden');
        }

        // 3. Start Scanning
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("qr-reader");
        }

        statusEl.textContent = "Iniciando cámara...";

        await html5QrCode.start(
            currentCameraId,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            onScanSuccess,
            (errorMessage) => {
                // verbose false, ignore frame errors 
            }
        );

        isScanning = true;
        statusEl.textContent = "Escaneando...";
        lucide.createIcons();

    } catch (err) {
        console.error("Error starting scanner:", err);
        statusEl.textContent = "Error: Acceso a cámara denegado o no disponible.";
    }
}

async function stopScanner() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            isScanning = false;
            document.getElementById('scan-status').textContent = "Cámara detenida";
        } catch (err) {
            console.error("Failed to stop scanner", err);
        }
    }
}

async function toggleCamera() {
    if (!cameras || cameras.length < 2) return;

    await stopScanner();

    // Find current index
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= cameras.length) nextIndex = 0;

    currentCameraId = cameras[nextIndex].id;
    startScanner();
}

async function onScanSuccess(decodedText, decodedResult) {
    if (document.getElementById('scan-result').classList.contains('processing')) return;

    console.log(`Scan matched: ${decodedText}`);
    const feedbackBox = document.getElementById('scan-result');
    const statusEl = document.getElementById('scan-status');

    statusEl.textContent = "¡Procesando!";
    feedbackBox.classList.remove('hidden');
    feedbackBox.classList.add('processing');

    try {
        // API Call
        const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
            { cedula: decodedText },
            { headers: { Authorization: `Token ${token}` } }
        );
        const alumno = response.data.alumno;

        // Success UI
        feedbackBox.className = "mt-4 p-4 bg-green-100 text-green-800 rounded-xl font-bold block border border-green-200 shadow-sm animate-in fade-in slide-in-from-bottom-4";
        feedbackBox.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-green-500 text-white rounded-full p-2"><i data-lucide="check" class="w-5 h-5"></i></div>
                <div>
                    <p class="text-xs uppercase text-green-600 font-bold">Asistencia Marcada</p>
                    <p class="text-lg leading-tight">${alumno.nombre}</p>
                </div>
            </div>
        `;

        // Update Local State
        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
        if (idx !== -1) {
            allAlumnos[idx].asistio = true;
            updateKPIs(); // Refresh counters/charts
        }

    } catch (err) {
        console.error(err);
        feedbackBox.className = "mt-4 p-4 bg-red-50 text-red-600 rounded-xl font-bold block border border-red-100 animate-in fade-in slide-in-from-bottom-4";
        const errorMsg = err.response?.data?.error || "Código no reconocido";

        feedbackBox.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-red-500 text-white rounded-full p-2"><i data-lucide="x" class="w-5 h-5"></i></div>
                <div>
                    <p class="text-xs uppercase text-red-400 font-bold">Error</p>
                    <p class="text-sm">${errorMsg}</p>
                    <p class="text-xs font-mono opacity-50">${decodedText}</p>
                </div>
            </div>
         `;
    } finally {
        lucide.createIcons();
        // Pause briefly before next scan
        if (html5QrCode) await html5QrCode.pause();

        setTimeout(async () => {
            feedbackBox.classList.add('hidden');
            feedbackBox.classList.remove('processing');
            statusEl.textContent = "Escaneando...";
            if (html5QrCode) await html5QrCode.resume();
        }, 2500);
    }
}

// === EXCEL UPLOAD ===
async function handleExcelUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('excel-file');
    const statusDiv = document.getElementById('upload-status');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    statusDiv.classList.remove('hidden');

    try {
        await axios.post('/api/v1/alumnos/upload-excel/', formData, {
            headers: { Authorization: `Token ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        statusDiv.textContent = "Carga Exitosa!";
        statusDiv.className = "text-green-500 font-bold text-center";
        setTimeout(() => {
            document.getElementById('excel-upload-modal').classList.add('hidden');
            refreshData();
        }, 1000);
    } catch (err) {
        statusDiv.textContent = "Error al cargar archivo.";
        statusDiv.className = "text-red-500 font-bold text-center";
    }
}

