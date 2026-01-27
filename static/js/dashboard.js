// Dashboard Logic
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
let allAlumnos = [];
let allLideres = [];

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

    // DEBUG CHECKS
    console.log("DashboardCharts available:", !!window.DashboardCharts);
    console.log("DashboardScanner available:", !!window.DashboardScanner);

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
        document.getElementById('chart-main-filter').addEventListener('change', () => {
            if (window.DashboardCharts) {
                DashboardCharts.render(allAlumnos, allLideres);
            }
        });
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
    if (viewName === 'scanner') {
        if (window.DashboardScanner) {
            window.DashboardScanner.start(async (cedula) => {
                // Helper to get CSRF token
                function getCookie(name) {
                    let cookieValue = null;
                    if (document.cookie && document.cookie !== '') {
                        const cookies = document.cookie.split(';');
                        for (let i = 0; i < cookies.length; i++) {
                            const cookie = cookies[i].trim();
                            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                                break;
                            }
                        }
                    }
                    return cookieValue;
                }
                const csrftoken = getCookie('csrftoken');

                // 1. Send Request
                // Include token AND CSRF to handle mixed Session/Token auth scenarios
                const headers = {
                    Authorization: `Token ${token}`
                };
                if (csrftoken) {
                    headers['X-CSRFToken'] = csrftoken;
                }

                const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
                    { cedula: cedula },
                    { headers: headers }
                );

                const alumno = response.data.alumno;

                // 2. Update Local State (Fresh Reference)
                const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
                if (idx !== -1) {
                    allAlumnos[idx].asistio = true;
                    updateKPIs();
                }

                return alumno; // Return to Scanner for UI display
            });
        } else {
            console.error("Scanner module not loaded");
        }
    } else {
        if (window.DashboardScanner) {
            DashboardScanner.stop();
        }
    }

    if (viewName === 'overview') {
        if (window.DashboardCharts) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
    }

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
            if (window.DashboardCharts) {
                DashboardCharts.render(allAlumnos, allLideres);
            }
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

        if (window.DashboardCharts) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
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

    // Add missing toggleCamera function wrapper for button that calls it
    window.toggleCamera = function () {
        if (window.DashboardScanner) {
            DashboardScanner.toggleCamera();
        }
    };
}

// Global expose wrapper for inline cancels
window.toggleCamera = function () {
    if (window.DashboardScanner) {
        DashboardScanner.toggleCamera();
    }
};

window.toggleTorch = function () {
    if (window.DashboardScanner) {
        DashboardScanner.toggleTorch();
    }
};
