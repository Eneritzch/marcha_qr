// Dashboard Logic
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
let allAlumnos = [];
let allLideres = [];
let html5QrcodeScanner = null;
let apexChart = null; // ApexCharts instance (Legacy holder if needed, but using chartsInstances now)

// Auth Check
if (!token) window.location.href = '/login';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // User Info
    document.getElementById('user-name').textContent = user.nombre || 'Líder';
    document.getElementById('user-group').textContent = `Grupo ${user.grupo || '?'}`;

    // Initial Fetch
    // Restore View IMMEDIATELY (Before Fetch)
    const lastView = localStorage.getItem('lastView') || 'overview';
    console.log("Restoring view:", lastView);
    switchView(lastView);

    // Event Listeners
    document.getElementById('search-registros').addEventListener('input', (e) => filterRegistros(e.target.value));
    document.getElementById('filter-estado').addEventListener('change', () => filterRegistros(document.getElementById('search-registros').value));
    document.getElementById('filter-banco').addEventListener('change', filterBancos);
    document.getElementById('excel-form').addEventListener('submit', handleExcelUpload);

    // Leaders Events
    document.getElementById('search-lideres').addEventListener('input', (e) => filterLideres(e.target.value));
    document.getElementById('filter-lider-grupo').addEventListener('change', () => filterLideres(document.getElementById('search-lideres').value));
    document.getElementById('lider-form').addEventListener('submit', saveLider);

    // Chart Controls (Scattter Filter)
    if (document.getElementById('chart-main-filter')) {
        document.getElementById('chart-main-filter').addEventListener('change', renderDashboardCharts);
    }
});

function logout() {
    localStorage.clear();
    window.location.href = '/login';
}

// === VIEW SWITCHING ===
window.switchView = function (viewName) {
    const views = ['overview', 'scanner', 'registros', 'bancos', 'lideres'];

    // Save state
    localStorage.setItem('lastView', viewName);

    // Hide all views
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        if (viewEl) viewEl.classList.add('hidden');

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
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

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
        'bancos': 'Información Bancaria',
        'lideres': 'Gestión de Líderes'
    };
    if (document.getElementById('page-title')) {
        document.getElementById('page-title').textContent = titles[viewName];
    }

    // Specialized Logic
    if (viewName === 'scanner') startScanner();
    else stopScanner();

    if (viewName === 'overview') renderDashboardCharts();

    // Auto-Reload Logic
    if (viewName === 'lideres') {
        fetchLideres();
    } else if (viewName === 'registros' || viewName === 'overview' || viewName === 'bancos') {
        refreshData();
    }

    lucide.createIcons();
}

// === DATA FETCHING ===


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
                 <div class="flex items-center justify-center gap-2">
                     <a href="/api/v1/alumnos/descargar-qr/${a.cedula}/" target="_blank" class="flex items-center gap-1 px-2 py-1 bg-blue-50 text-unemi-blue rounded hover:bg-unemi-blue hover:text-white transition-colors text-xs font-bold border border-blue-100">
                        <i data-lucide="qr-code" class="w-3 h-3"></i> QR
                     </a>
                     <a href="/api/v1/alumnos/descargar-credencial/${a.cedula}/" target="_blank" class="flex items-center gap-1 px-2 py-1 bg-orange-50 text-unemi-orange rounded hover:bg-unemi-orange hover:text-white transition-colors text-xs font-bold border border-orange-100">
                        <i data-lucide="file-text" class="w-3 h-3"></i> PDF
                     </a>
                 </div>
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



// === APEXCHARTS (PREMIUM VISUALS) ===
let chartsInstances = {
    scatter: null,
    radial: null,
    bar: null
};

function renderDashboardCharts() {
    if (!allAlumnos || allAlumnos.length === 0) return;

    // 1. DATA PREPARATION

    // --- A. Leaders Bubble Data (Colorful & Sized) ---
    // Filter by Group
    const groupFilter = document.getElementById('chart-main-filter') ? document.getElementById('chart-main-filter').value : 'all';
    let leadersData = allLideres;
    if (groupFilter !== 'all') {
        leadersData = allLideres.filter(l => l.grupo.toString() === groupFilter);
    }

    // --- CHART 1: GROUPS PERFORMANCE (Column Chart) ---
    // Prepare Data: Aggregate by Group
    const groupsStats = {};

    // Process all leaders (or filtered ones) to sum stats by Group
    leadersData.forEach(l => {
        const gName = `Grupo ${l.grupo}`;
        if (!groupsStats[gName]) {
            groupsStats[gName] = { invited: 0, attended: 0, groupNum: l.grupo };
        }
        groupsStats[gName].invited += (l.total_invitados || 0);
        groupsStats[gName].attended += (l.total_asistencias || 0);
    });

    // Sort by Group Number
    const sortedGroupKeys = Object.keys(groupsStats).sort((a, b) => groupsStats[a].groupNum - groupsStats[b].groupNum);

    const leadersList = sortedGroupKeys;
    const invitedData = sortedGroupKeys.map(k => groupsStats[k].invited);
    const attendedData = sortedGroupKeys.map(k => groupsStats[k].attended);

    const leadersBarOptions = {
        series: [{
            name: 'Invitados',
            data: invitedData
        }, {
            name: 'Asistieron',
            data: attendedData
        }],
        chart: {
            type: 'bar', // Stable Column Chart
            height: 380,
            toolbar: { show: false }, // Cleaner look
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 5, // Rounded bars for premium look
                endingShape: 'rounded'
            },
        },
        dataLabels: { enabled: false },
        stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
        },
        xaxis: {
            categories: leadersList,
            labels: {
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            title: { text: 'Estudiantes', style: { color: '#64748b' } },
            labels: { style: { colors: '#64748b' } }
        },
        fill: {
            opacity: 1,
            colors: ['#3B82F6', '#EF7D00'] // Blue, Orange
        },
        colors: ['#3B82F6', '#EF7D00'], // Consistent with fill
        tooltip: {
            theme: 'light',
            y: { formatter: (val) => val + " estudiantes" }
        },
        grid: {
            borderColor: '#f1f5f9',
            padding: { top: 0, right: 0, bottom: 0, left: 10 }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right'
        }
    };

    if (document.getElementById('chart-leaders-scatter')) {
        // Safe destroy/create logic
        if (chartsInstances.scatter) {
            chartsInstances.scatter.destroy(); // Destroy previous instance completely
            chartsInstances.scatter = null;
        }
        try {
            chartsInstances.scatter = new ApexCharts(document.querySelector("#chart-leaders-scatter"), leadersBarOptions);
            chartsInstances.scatter.render();
        } catch (e) { console.error("Chart render error:", e); }
    }

    // --- DATA PREPARATION (Attendance & Careers) ---
    const total = allAlumnos.length;
    const asistencias = allAlumnos.filter(a => a.asistio).length;
    const pendientes = total - asistencias;

    const attendanceRate = total > 0 ? ((asistencias / total) * 100).toFixed(1) : 0;
    const pendingRate = total > 0 ? ((pendientes / total) * 100).toFixed(1) : 0;

    const validAttendance = parseFloat(attendanceRate) || 0;
    const validPending = parseFloat(pendingRate) || 0;

    if (document.getElementById('radial-total-label')) {
        document.getElementById('radial-total-label').textContent = total;
    }

    // Careers Data
    const careerStats = {};
    allAlumnos.forEach(a => {
        const c = a.carrera || 'Sin Carrera';
        if (!careerStats[c]) careerStats[c] = { invited: 0, attended: 0 };
        careerStats[c].invited++;
        if (a.asistio) careerStats[c].attended++;
    });

    const sortedCareers = Object.entries(careerStats)
        .sort((a, b) => b[1].invited - a[1].invited)
        .slice(0, 5);

    const careerCategories = sortedCareers.map(c => c[0].length > 15 ? c[0].substring(0, 15) + '...' : c[0]);

    const careerSeries = [
        {
            name: 'Total Invitados',
            data: sortedCareers.map(c => -c[1].invited)
        },
        {
            name: 'Asistieron',
            data: sortedCareers.map(c => c[1].attended)
        }
    ];

    // --- CHART 2: MULTI-RADIAL (Attendance) ---
    const radialOptions = {
        series: [validAttendance, validPending],
        chart: {
            height: 350,
            type: 'radialBar',
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            radialBar: {
                dataLabels: {
                    name: { fontSize: '22px' },
                    value: { fontSize: '16px', color: '#64748b' },
                    total: {
                        show: true,
                        label: 'Total',
                        color: '#64748b',
                        formatter: function (w) {
                            return total;
                        }
                    }
                },
                hollow: {
                    margin: 5,
                    size: '50%',
                    background: 'transparent',
                },
                track: {
                    show: true,
                    background: '#f1f5f9',
                    strokeWidth: '100%',
                    opacity: 1,
                    margin: 5
                },
            }
        },
        labels: ['Asistieron', 'Pendientes'],
        colors: ['#22C55E', '#F97316'], // Green, Orange
        fill: {
            type: 'solid',
            colors: ['#22C55E', '#F97316'],
            opacity: 1
        },
        stroke: { lineCap: 'round' },
        legend: {
            show: true,
            position: 'bottom',
            fontSize: '12px',
            markers: { radius: 12 },
            itemMargin: { horizontal: 10 }
        }
    };

    if (document.getElementById('chart-attendance-radial')) {
        if (chartsInstances.radial) {
            chartsInstances.radial.updateSeries([validAttendance, validPending]);
            chartsInstances.radial.updateOptions(radialOptions);
        } else {
            chartsInstances.radial = new ApexCharts(document.querySelector("#chart-attendance-radial"), radialOptions);
            chartsInstances.radial.render();
        }
    }

    // --- CHART 3: DIVERGING BAR (Careers) ---
    const barOptions = {
        series: careerSeries,
        chart: {
            type: 'bar',
            height: 280,
            stacked: true,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        colors: ['#3B82F6', '#22C55E'],
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '60%',
                borderRadius: 4
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: { width: 1, colors: ["#fff"] },
        xaxis: {
            labels: {
                formatter: function (val) {
                    return Math.abs(Math.round(val))
                },
                style: { colors: '#64748b' }
            },
            title: {
                text: 'Invitados (Izq) vs Asistieron (Der)',
                style: { fontSize: '10px' }
            }
        },
        yaxis: {
            labels: { style: { colors: '#64748b', fontSize: '11px' } }
        },
        tooltip: {
            shared: false,
            x: { formatter: function (val) { return val } },
            y: {
                formatter: function (val) {
                    return Math.abs(val)
                }
            }
        },
        grid: { xaxis: { lines: { show: true } } }
    };

    if (document.getElementById('chart-careers-bar')) {
        if (chartsInstances.bar) {
            chartsInstances.bar.updateOptions({
                series: careerSeries,
                xaxis: { categories: careerCategories }
            });
        } else {
            barOptions.xaxis.categories = careerCategories;
            chartsInstances.bar = new ApexCharts(document.querySelector("#chart-careers-bar"), barOptions);
            chartsInstances.bar.render();
        }
    }
    // --- TOP 10 LEADERS TABLE ---
    const topLeaders = leadersData.map(l => {
        const invited = l.total_invitados || 0;
        const attended = l.total_asistencias || 0;
        const efficiency = invited > 0 ? (attended / invited) * 100 : 0;
        return { ...l, efficiency, invited, attended };
    })
        .sort((a, b) => b.efficiency - a.efficiency || b.attended - a.attended) // Sort by Efficiency then Attendance
        .slice(0, 10);

    const tbodyTop = document.getElementById('tbody-top-leaders');
    if (tbodyTop) {
        tbodyTop.innerHTML = '';
        if (topLeaders.length === 0) {
            tbodyTop.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Sin datos aún.</td></tr>`;
        } else {
            topLeaders.forEach((l, i) => {
                const colorClass = l.efficiency >= 80 ? 'text-green-600 bg-green-50' : (l.efficiency >= 50 ? 'text-orange-600 bg-orange-50' : 'text-slate-600 bg-slate-50');

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                row.innerHTML = `
                    <td class="px-4 py-3 font-bold text-slate-400 text-xs text-center">${i + 1}</td>
                    <td class="px-4 py-3 font-bold text-slate-800 line-clamp-1">${l.nombre_completo}</td>
                    <td class="px-4 py-3 font-mono text-xs"><span class="bg-slate-100 px-2 py-1 rounded">G${l.grupo}</span></td>
                    <td class="px-4 py-3 text-center font-mono text-xs text-slate-500">${l.invited}</td>
                    <td class="px-4 py-3 text-center font-mono text-xs font-bold text-slate-700">${l.attended}</td>
                    <td class="px-4 py-3 text-right">
                        <span class="px-2 py-1 rounded-lg text-xs font-bold ${colorClass}">${l.efficiency.toFixed(1)}%</span>
                    </td>
                `;
                tbodyTop.appendChild(row);
            });
        }
    }
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
        // Check for Secure Context (HTTPS) - Required by Browser API
        if (!window.isSecureContext) {
            statusEl.innerHTML = `<span class="text-red-500 font-bold block bg-white px-2 rounded">Error: Se requiere HTTPS o Localhost para usar la cámara.</span>`;
            return;
        }

        cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            statusEl.textContent = "No se detectaron cámaras.";
            return;
        }

        // 2. Select initial camera (Prefer Back/Environment)
        // Only select if we don't have one, OR if the current one is invalid
        if (!currentCameraId || !cameras.find(c => c.id === currentCameraId)) {
            // Prefer back camera
            const backCam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera')) || cameras[cameras.length - 1];
            currentCameraId = backCam.id;
        }

        // Show switch button if multiple cameras
        if (switchBtn) {
            if (cameras.length > 1) {
                switchBtn.classList.remove('hidden');
            } else {
                switchBtn.classList.add('hidden');
            }
        }

        // 3. Start Scanning
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("qr-reader");
        }

        statusEl.textContent = "Iniciando cámara...";

        // Ensure DOM is ready (increased delay for stability)
        await new Promise(r => setTimeout(r, 500));

        // Responsive Config - Larger Scan Area
        const qrBoxSize = Math.min(window.innerWidth * 0.90, 600); // 90% width or max 600px

        await html5QrCode.start(
            currentCameraId,
            {
                fps: 20, // Balanced for performance/stability
                qrbox: { width: qrBoxSize, height: qrBoxSize },
                aspectRatio: 1.0,
                disableFlip: true, // Always true for rear cameras usually
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            },
            onScanSuccess,
            (errorMessage) => {
                // Ignore frame parse errors
            }
        ).catch(err => {
            console.error("Start failed", err);
            statusEl.textContent = "Error al iniciar cámara. Intente refrescar.";
            isScanning = false;
        });

        isScanning = true;
        statusEl.textContent = "Escaneando... (Apunta al QR)";
        lucide.createIcons();

    } catch (err) {
        console.error("Error starting scanner:", err);
        statusEl.innerHTML = `<span class="text-red-400">Error: ${err.name || 'Desconocido'} - ${err.message || 'Sin detalles'}</span>`;
    }
}

// === DATA FETCHING ===
window.refreshData = async function () {
    try {
        window.showLoader && window.showLoader();
        const response = await axios.get('/api/v1/alumnos/alumnos/', {
            headers: { Authorization: `Token ${token}` }
        });
        allAlumnos = response.data.results || response.data;

        // Initial Render
        updateKPIs();
        renderRegistrosTable(allAlumnos);
        renderBancosTable(allAlumnos);
        populateBankFilter();

        // Also fetch leaders for the chart if not already
        if (allLideres.length === 0) {
            await fetchLideres();
        } else {
            renderDashboardCharts();
        }

        // View restoration is now handled in DOMContentLoaded

    } catch (err) {
        console.error("Fetch error:", err);
        if (err.response && err.response.status === 401) {
            logout();
        }
    } finally {
        window.hideLoader && window.hideLoader();
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

    // UI Feedback (Quick Overlay)
    statusEl.textContent = "¡Procesando!";
    statusEl.classList.add('text-unemi-orange');
    feedbackBox.classList.add('processing'); // Lock scanning

    try {
        const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
            { cedula: decodedText },
            { headers: { Authorization: `Token ${token}` } }
        );
        const alumno = response.data.alumno;

        // Success Pop-up (Non-blocking visual)
        feedbackBox.className = "absolute bottom-16 left-4 right-4 p-4 bg-green-500/90 backdrop-blur-md text-white rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-30 border border-white/20";
        feedbackBox.classList.remove('hidden');
        feedbackBox.innerHTML = `
            <div class="bg-white text-green-500 rounded-full p-2 shadow-sm"><i data-lucide="check" class="w-6 h-6"></i></div>
            <div>
                <p class="text-xs font-bold uppercase opacity-80">Asistencia Ok</p>
                <p class="text-lg font-bold">${alumno.nombre}</p>
            </div>
        `;

        // Update Local State
        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
        if (idx !== -1) {
            allAlumnos[idx].asistio = true;
            updateKPIs();
        }

    } catch (err) {
        // Error Pop-up
        feedbackBox.className = "absolute bottom-16 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md text-white rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-30 border border-white/20";
        feedbackBox.classList.remove('hidden');
        const errorMsg = err.response?.data?.error || "Código no compatible";
        feedbackBox.innerHTML = `
            <div class="bg-white text-red-500 rounded-full p-2 shadow-sm"><i data-lucide="x" class="w-6 h-6"></i></div>
            <div>
                <p class="text-xs font-bold uppercase opacity-80">Error</p>
                <p class="text-sm font-medium">${errorMsg}</p>
            </div>
        `;
    } finally {
        lucide.createIcons();

        // Pause briefly (1.5s) then clear for next scan
        if (html5QrCode) await html5QrCode.pause();

        setTimeout(async () => {
            feedbackBox.classList.add('hidden');
            feedbackBox.classList.remove('processing');
            statusEl.textContent = "Escaneando...";
            statusEl.classList.remove('text-unemi-orange');
            if (html5QrCode) await html5QrCode.resume();
        }, 1500); // Faster cycle
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


// === LIDERES LOGIC ===
async function fetchLideres() {
    try {
        window.showLoader && window.showLoader();
        const response = await axios.get('/api/v1/lideres/lideres/', {
            headers: { Authorization: `Token ${token}` }
        });
        allLideres = response.data.results || response.data;
        renderLideresTable(allLideres);
        renderDashboardCharts(); // Also Update Charts when leaders are fetched
    } catch (err) {
        console.error("Error fetching leaders", err);
    } finally {
        window.hideLoader && window.hideLoader();
    }
}

function renderLideresTable(data) {
    const tbody = document.getElementById('tbody-lideres');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay líderes registrados.</td></tr>`;
        return;
    }

    data.forEach((l, index) => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-orange-50/10 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-500 text-xs text-center">${index + 1}</td>
            <td class="px-6 py-4 font-bold text-slate-700">${l.nombre_completo}</td>
             <td class="px-6 py-4 font-mono text-xs">${l.cedula}</td>
             <td class="px-6 py-4"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold text-xs">G${l.grupo}</span></td>
             <td class="px-6 py-4 text-xs text-slate-500">
                <div>Inv: ${l.total_invitados || 0}</div>
                <div>Asist: ${l.total_asistencias || 0}</div>
             </td>
             <td class="px-6 py-4 text-center">
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${l.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${l.activo ? 'Activo' : 'Inactivo'}
                </span>
             </td>
             <td class="px-6 py-4 text-center">
                 <button onclick='openLiderModal(${JSON.stringify(l)})' class="text-unemi-blue hover:text-unemi-orange transition-colors">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                 </button>
             </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function filterLideres(query) {
    const q = query.toLowerCase();
    const group = document.getElementById('filter-lider-grupo').value;

    const filtered = allLideres.filter(l => {
        const matchesSearch = l.nombre_completo.toLowerCase().includes(q) || l.cedula.includes(q);
        const matchesGroup = group === 'all' || l.grupo.toString() === group;
        return matchesSearch && matchesGroup;
    });
    renderLideresTable(filtered);
}

function openLiderModal(lider = null) {
    const modal = document.getElementById('lider-modal');
    modal.classList.remove('hidden');

    const title = document.getElementById('modal-lider-title');
    const form = document.getElementById('lider-form');

    if (lider) {
        title.textContent = "Editar Líder";
        document.getElementById('lider-id').value = lider.id;
        document.getElementById('lider-nombre').value = lider.nombre_completo;
        document.getElementById('lider-cedula').value = lider.cedula;
        document.getElementById('lider-grupo').value = lider.grupo;
        document.getElementById('lider-telefono').value = lider.telefono || '';
        document.getElementById('lider-email').value = lider.email || '';
        document.getElementById('lider-activo').checked = lider.activo;
        document.getElementById('lider-visible').checked = lider.visible_en_registro;
    } else {
        title.textContent = "Registrar Nuevo Líder";
        form.reset();
        document.getElementById('lider-id').value = '';
        document.getElementById('lider-activo').checked = true;
        document.getElementById('lider-visible').checked = true;
    }
}

async function saveLider(e) {
    e.preventDefault();
    const id = document.getElementById('lider-id').value;
    const data = {
        nombre_completo: document.getElementById('lider-nombre').value,
        cedula: document.getElementById('lider-cedula').value,
        grupo: parseInt(document.getElementById('lider-grupo').value),
        telefono: document.getElementById('lider-telefono').value,
        email: document.getElementById('lider-email').value,
        activo: document.getElementById('lider-activo').checked,
        visible_en_registro: document.getElementById('lider-visible').checked
    };

    try {
        if (id) {
            await axios.patch(`/api/v1/lideres/lideres/${id}/`, data, {
                headers: { Authorization: `Token ${token}` }
            });
        } else {
            await axios.post('/api/v1/lideres/lideres/', data, {
                headers: { Authorization: `Token ${token}` }
            });
        }
        document.getElementById('lider-modal').classList.add('hidden');
        fetchLideres(); // Refresh list
    } catch (err) {
        console.error("Error saving leader", err);
        alert("Error al guardar líder. Verifique los datos.");
    }
}