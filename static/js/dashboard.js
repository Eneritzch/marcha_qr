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
    // Hide all views
    ['overview', 'scanner', 'registros', 'bancos'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
        document.getElementById(`nav-${v}`).classList.remove('sidebar-item-active', 'text-white', 'bg-white/10');
        document.getElementById(`nav-${v}`).classList.add('text-slate-300');
    });

    // Show selected
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    // Style active nav
    const activeNav = document.getElementById(`nav-${viewName}`);
    activeNav.classList.remove('text-slate-300');
    activeNav.classList.add('sidebar-item-active', 'text-white');

    // Header Title Update
    const titles = {
        'overview': 'Resumen General',
        'scanner': 'Escanear Asistencia',
        'registros': 'Base de Registros',
        'bancos': 'Información Bancaria'
    };
    document.getElementById('page-title').textContent = titles[viewName];

    // Specialized Logic
    if (viewName === 'scanner') startScanner();
    else stopScanner(); // Stop camera when leaving tab to save battery/privacy

    if (viewName === 'overview') updateCharts();
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

// === QR SCANNER ===
function startScanner() {
    if (!document.getElementById('qr-reader')) return;

    if (html5QrcodeScanner) {
        // Already running
        return;
    }

    const onScanSuccess = async (decodedText, decodedResult) => {
        // Prevent double scan
        if (document.getElementById('scan-result').classList.contains('processing')) return;

        console.log(`Code matched = ${decodedText}`, decodedResult);
        document.getElementById('scan-status').textContent = "¡QR Detectado! Procesando...";
        document.getElementById('scan-result').classList.add('processing');

        try {
            // Call Backend API
            const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
                { cedula: decodedText },
                { headers: { Authorization: `Token ${token}` } }
            );

            const alumno = response.data.alumno;

            // Success Feedback
            document.getElementById('scan-result').className = "mt-4 p-4 bg-green-100 text-green-800 rounded-xl font-bold block border border-green-200 shadow-sm";
            document.getElementById('scan-result').innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="bg-green-500 text-white rounded-full p-1"><i data-lucide="check" class="w-4 h-4"></i></div>
                    <div>
                        <p class="text-xs uppercase text-green-600">Asistencia Registrada</p>
                        <p class="text-lg">${alumno.nombre}</p>
                    </div>
                </div>
            `;

            // Update Local Data
            const localIndex = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
            if (localIndex !== -1) {
                allAlumnos[localIndex].asistio = true;
                updateKPIs();
            }

            lucide.createIcons();

        } catch (err) {
            console.error(err);
            document.getElementById('scan-result').className = "mt-4 p-4 bg-red-50 text-red-600 rounded-xl font-bold block border border-red-100";
            const errorMsg = err.response?.data?.error || "Error al procesar QR";
            document.getElementById('scan-result').innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="bg-red-500 text-white rounded-full p-1"><i data-lucide="x" class="w-4 h-4"></i></div>
                    <div>
                        <p class="text-xs uppercase text-red-400">Error</p>
                        <p>${errorMsg} (${decodedText})</p>
                    </div>
                </div>
             `;
            lucide.createIcons();
        } finally {
            // Resume scanning after 3 seconds
            setTimeout(() => {
                document.getElementById('scan-result').classList.add('hidden');
                document.getElementById('scan-status').textContent = "Escaneando...";
                document.getElementById('scan-result').classList.remove('processing');
            }, 3000);
        }
    };

    html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, (err) => { /* ignore errors */ });
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => console.error("Failed to clear html5QrcodeScanner. ", error));
        html5QrcodeScanner = null;
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

