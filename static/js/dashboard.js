// Dashboard Logic
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Persistencia Híbrida: Cargar desde local si existe
let allAlumnos = JSON.parse(localStorage.getItem('allAlumnos') || '[]');
let allLideres = JSON.parse(localStorage.getItem('allLideres') || '[]');
let offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');

// Auth Check
// Auth Check
const offlineMode = localStorage.getItem('offline_mode');
if (!token && !offlineMode) {
    console.log("No token or offline mode - Redirecting to login");
    window.location.href = '/login/';
}

// Initialize
// Safe Event Binding Helper
function safeBind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

document.addEventListener('DOMContentLoaded', async () => {
    // User Info
    const userNameEl = document.getElementById('user-name');
    const userGroupEl = document.getElementById('user-group');
    if (userNameEl) {
        if (offlineMode) {
            userNameEl.innerHTML = `<span class="flex items-center gap-1">📡 Sin Conexión</span>`;
        } else {
            userNameEl.textContent = user.nombre || 'Líder';
            if (user.is_superuser) {
                userNameEl.innerHTML = `<span class="flex items-center gap-1">👑 ${user.nombre || 'Admin'} <span class="bg-orange-500 text-[8px] px-1 rounded text-white">ADMIN</span></span>`;
            }
        }
    }
    if (userGroupEl) {
        if (offlineMode) {
            userGroupEl.textContent = "Consulta Local";
        } else {
            userGroupEl.textContent = user.is_superuser ? 'Superusuario' : `Grupo ${user.grupo || '?'}`;
        }
    }

    // Initial Fetch & View Restore
    const lastView = localStorage.getItem('lastView') || 'overview';
    switchView(lastView);

    // Initial UI Update for Offline Mode
    updateOfflineUI();
    // Second check after a short delay for browser consistency
    setTimeout(updateOfflineUI, 1000);

    // Check for online/offline status to update UI and auto-sync
    window.addEventListener('online', () => {
        console.log("Sistema detectó conexión recuperada.");
        updateOfflineUI();
        // Delay sync to ensure network is actually usable (avoid flaky Wi-Fi issues)
        setTimeout(() => {
            if (navigator.onLine) {
                updateOfflineUI();
                syncOfflineScans();
            }
        }, 3000);
    });

    window.addEventListener('offline', () => {
        console.log("Sistema detectó conexión perdida.");
        updateOfflineUI();
    });

    // Safe Event Listeners for other modules
    safeBind('search-registros', 'input', (e) => filterRegistros(e.target.value));
    safeBind('filter-estado', 'change', () => {
        const el = document.getElementById('search-registros');
        filterRegistros(el ? el.value : '');
    });
    safeBind('filter-vinculo', 'change', () => {
        const el = document.getElementById('search-registros');
        filterRegistros(el ? el.value : '');
    });
    safeBind('excel-form', 'submit', handleExcelUpload);

    // Leaders Events (Safe Binding)
    safeBind('search-lideres', 'input', (e) => filterLideres(e.target.value));
    safeBind('filter-lider-grupo', 'change', () => {
        const inputBox = document.getElementById('search-lideres');
        filterLideres(inputBox ? inputBox.value : '');
    });
    safeBind('lider-form', 'submit', saveLider);

    // Chart Controls
    safeBind('chart-main-filter', 'change', () => {
        if (window.DashboardCharts) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
    });

    // Cleanup: Remove any old comments or duplicate definitions if present
});

// ... inside filterLideres ...
function filterLideres(query) {
    const normalize = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const q = normalize(query);
    const groupElement = document.getElementById('filter-lider-grupo');
    const group = groupElement ? groupElement.value : 'all';

    if (!allLideres) return;

    const filtered = allLideres.filter(l => {
        const nameNorm = normalize(l.nombre_completo);
        const emailNorm = normalize(l.email);
        const grupoStr = String(l.grupo || '');

        const matchesSearch = nameNorm.includes(q) || emailNorm.includes(q);
        const matchesGroup = group === 'all' || grupoStr === group;

        return matchesSearch && matchesGroup;
    });
    renderLideresTable(filtered);
}

function logout() {
    // Clear session but NOT the data cache (to allow offline login later)
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('offline_mode');
    localStorage.removeItem('lastView');

    // We keep allAlumnos, allLideres, offlineQueue for hybrid support
    window.location.href = '/login/';
}

// === VIEW SWITCHING ===
window.switchView = function (viewName) {
    const views = ['overview', 'scanner', 'registros', 'lideres', 'importar-exportar'];

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

    // Activate Mobile Nav (Dynamic Floating Button)
    document.querySelectorAll('.nav-item-wrapper').forEach(wrapper => {
        const btn = wrapper.querySelector('button');
        const target = wrapper.dataset.target;
        const label = btn.querySelector('span');

        if (target === viewName) {
            // Active State: Floating Orange Circle
            wrapper.classList.add('-top-5');

            // Transform button to floating circle
            btn.classList.remove('text-slate-400');
            btn.classList.add(
                'bg-unemi-orange',
                'text-white',
                'w-14',
                'h-14',
                'shadow-lg',
                'shadow-orange-500/30',
                'border-4',
                'border-white', // Matches bg-white of nav
                'justify-center'
            );

            // Hide label for clean look on active item
            if (label) label.classList.add('hidden');

        } else {
            // Inactive State: Normal Icon
            wrapper.classList.remove('-top-5');

            // Reset button styles
            btn.classList.add('text-slate-400');
            btn.classList.remove(
                'bg-unemi-orange',
                'text-white',
                'w-14',
                'h-14',
                'shadow-lg',
                'shadow-orange-500/30',
                'border-4',
                'border-white',
                'justify-center'
            );

            // Show label
            if (label) label.classList.remove('hidden');
        }
    });

    // Header Title Update
    const titles = {
        'overview': 'Resumen General',
        'scanner': 'Escanear Asistencia',
        'registros': 'Base de Registros',
        'lideres': 'Gestión de Líderes',
        'importar-exportar': 'Importar/Exportar Datos'
    };
    if (document.getElementById('page-title')) {
        document.getElementById('page-title').textContent = titles[viewName];
    }

    // Specialized Logic
    if (viewName === 'scanner') {
        // RESET SCANNER UI TO SELECTION
        document.getElementById('scanner-selection-ui').classList.remove('hidden');
        document.getElementById('scanner-camera-ui').classList.add('hidden');
        document.getElementById('scan-result').classList.add('hidden');
        // Manual start handled by buttons
    } else {
        // Stop camera if navigating away
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
    } else if (viewName === 'registros' || viewName === 'overview') {
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

    // New Counts
    const externos = allAlumnos.filter(a => a.es_externo).length;
    const unemi = total - externos;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-asistencias').textContent = asistencias;
    document.getElementById('kpi-pendientes').textContent = pendientes;
    document.getElementById('kpi-porcentaje').textContent = `${porcentaje}%`;

    // Update New Cards
    const elUnemi = document.getElementById('kpi-unemi');
    const elExternos = document.getElementById('kpi-externos');
    if (elUnemi) elUnemi.textContent = unemi;
    if (elExternos) elExternos.textContent = externos;
}

// === DATA TABLES STATE ===
let currentRegistrosPage = 1;
const registrosPageSize = 50;

// === TABLES ===
function filterRegistros(query) {
    console.log("filterRegistros called", { query });
    const q = (query || '').toLowerCase();
    const statusEl = document.getElementById('filter-estado');
    const vinculoEl = document.getElementById('filter-vinculo');

    if (!statusEl || !vinculoEl) {
        console.error("Filtros no encontrados!", { statusEl, vinculoEl });
        return;
    }
    const status = statusEl.value;
    const vinculo = vinculoEl.value;

    const filtered = allAlumnos.filter(a => {
        if (!a) return false;
        const nombre = (a.nombre_completo || '').toLowerCase();
        const cedula = (a.cedula || '');

        const matchesSearch = nombre.includes(q) || cedula.includes(q);
        const matchesStatus = status === 'all' ||
            (status === 'present' && a.asistio) ||
            (status === 'absent' && !a.asistio);

        const matchesVinculo = vinculo === 'all' ||
            (vinculo === 'unemi' && !a.es_externo) ||
            (vinculo === 'externo' && a.es_externo);

        return matchesSearch && matchesStatus && matchesVinculo;
    });

    currentRegistrosPage = 1; // Reset to page 1 on filter
    renderRegistrosTable(filtered);
}

function renderRegistrosTable(data) {
    console.log("renderRegistrosTable called", { items: data ? data.length : 0 });
    const tbody = document.getElementById('tbody-registros');
    const pagination = document.getElementById('pagination-registros');

    if (!tbody) {
        console.error("tbody-registros no encontrado!");
        return;
    }

    tbody.innerHTML = '';
    if (pagination) pagination.innerHTML = '';

    // Update column header based on user role
    const col4Header = document.getElementById('registros-col-4-header');
    if (col4Header) {
        col4Header.textContent = (user.is_superuser || user.is_staff) ? 'Líder / Grupo' : 'Carrera';
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No se encontraron registros.</td></tr>`;
        return;
    }

    // Pagination Logic
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / registrosPageSize);

    // Clamp current page
    if (currentRegistrosPage > totalPages) currentRegistrosPage = totalPages;
    if (currentRegistrosPage < 1) currentRegistrosPage = 1;

    const startIdx = (currentRegistrosPage - 1) * registrosPageSize;
    const endIdx = Math.min(startIdx + registrosPageSize, totalItems);
    const pageData = data.slice(startIdx, endIdx);

    pageData.forEach((a, index) => {
        if (!a) return;
        const globalIndex = startIdx + index + 1;
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="px-4 py-4 text-center font-bold text-slate-400 text-xs">${globalIndex}</td>
            <td class="px-6 py-4 font-medium text-slate-900">
                <div class="flex flex-col">
                    <span>${a.nombre_completo}</span>
                    <div class="flex gap-1">
                        ${a.es_externo ? '<span class="text-[9px] font-black text-orange-500 uppercase tracking-tighter">● Externo</span>' : ''}
                        ${a.grupo === 0 ? '<span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">● Sin Grupo</span>' : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 font-mono text-xs">${a.cedula}</td>
            <td class="px-6 py-4">
                ${(user.is_superuser || user.is_staff) ? `
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-bold text-unemi-blue">${a.lider_nombre || 'Sin líder'}</span>
                    <select onchange="changeStudentGroup('${a.cedula}', this.value)" class="appearance-none bg-orange-50 border border-orange-200 text-unemi-orange text-[10px] font-black px-2 py-1 rounded-lg focus:ring-2 focus:ring-unemi-orange focus:border-unemi-orange cursor-pointer transition-all hover:border-unemi-orange hover:shadow-sm bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23EF7D00%22%20stroke-width%3D%222.5%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.8rem_0.8rem] bg-[right_0.3rem_center] bg-no-repeat pr-5 uppercase tracking-tighter">
                        <option value="0" ${a.grupo == 0 ? 'selected' : ''} class="text-slate-700 bg-white">SIN GRUPO</option>
                        ${Array.from({ length: 15 }, (_, i) => i + 1).map(g => `<option value="${g}" ${a.grupo == g ? 'selected' : ''} class="text-slate-700 bg-white">Grupo ${g}</option>`).join('')}
                    </select>
                </div>
                ` : `
                <span class="text-xs">${a.carrera || (a.es_externo ? '<span class="text-slate-400 italic">No aplica</span>' : '-')}</span>
                `}
            </td>
            <td class="px-6 py-4 text-center">
                 <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${a.asistio ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}">
                    ${a.asistio ? 'Presente' : 'Pendiente'}
                 </span>
            </td>
             <td class="px-6 py-4 text-center">
                 <div class="flex items-center justify-center gap-2">
                     <button onclick="downloadFile('/api/v1/alumnos/descargar-qr/${a.cedula}/', 'qr_${a.cedula}.png', 'qr', {cedula: '${a.cedula}', nombre_completo: '${a.nombre_completo}'})" class="flex items-center gap-1 px-2 py-1 bg-blue-50 text-unemi-blue rounded hover:bg-unemi-blue hover:text-white transition-colors text-xs font-bold border border-blue-100">
                        <i data-lucide="qr-code" class="w-3 h-3"></i> QR
                     </button>
                     <button onclick='downloadFile("/api/v1/alumnos/descargar-credencial/${a.cedula}/", "credencial_${a.cedula}.pdf", "pdf", ${JSON.stringify(a).replace(/'/g, "&#39;")})' class="flex items-center gap-1 px-2 py-1 bg-orange-50 text-unemi-orange rounded hover:bg-unemi-orange hover:text-white transition-colors text-xs font-bold border border-orange-100">
                        <i data-lucide="file-text" class="w-3 h-3"></i> PDF
                     </button>
                     <button onclick='openStudentEdit(${JSON.stringify(a).replace(/'/g, "&#39;")})' class="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors text-xs font-bold border border-emerald-100">
                        <i data-lucide="edit-2" class="w-3 h-3"></i>
                     </button>
                     ${user.is_superuser ? `
                     <button onclick="eliminarEntidad('alumno', '${a.cedula}', '${a.nombre_completo}')" class="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-colors text-xs font-bold border border-red-100">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Render Pagination Controls
    if (totalPages > 1) {
        const createPageBtn = (label, page, isActive = false, isDisabled = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className = `px-3 py-1 text-xs font-bold rounded-lg transition-all ${isActive ? 'bg-unemi-blue text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`;
            if (isDisabled) {
                btn.disabled = true;
                btn.className += ' opacity-50 cursor-not-allowed';
            } else {
                btn.onclick = () => {
                    currentRegistrosPage = page;
                    renderRegistrosTable(data);
                    document.getElementById('view-registros').scrollIntoView({ behavior: 'smooth' });
                };
            }
            return btn;
        };

        // Previous
        pagination.appendChild(createPageBtn('←', currentRegistrosPage - 1, false, currentRegistrosPage === 1));

        // Info
        const info = document.createElement('span');
        info.className = 'text-xs text-slate-500 flex items-center px-2';
        info.textContent = `Pág ${currentRegistrosPage} de ${totalPages}`;
        pagination.appendChild(info);

        // Next
        pagination.appendChild(createPageBtn('→', currentRegistrosPage + 1, false, currentRegistrosPage === totalPages));
    }

    lucide.createIcons();
}



// === DATA FETCHING ===
window.refreshData = async function () {
    // Renderización inmediata desde caché para UX instantánea y modo offline
    if (allAlumnos && allAlumnos.length > 0) {
        updateKPIs();
        renderRegistrosTable(allAlumnos);
        renderRegistrosTable(allAlumnos);
        // Render charts from cache
        if (window.DashboardCharts && allLideres.length > 0) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
    }

    // Si entramos por bypass offline y no hay token, no intentamos fetch
    if (offlineMode && !token) {
        console.log("Modo Offline Detectado: Usando únicamente base local.");
        if (window.DashboardCharts && allAlumnos.length > 0 && allLideres.length > 0) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
        window.hideLoader && window.hideLoader(); // Asegurar que el loader se oculte
        return;
    }

    try {
        window.showLoader && window.showLoader();
        // Use nopaginate=true to get ALL students for offline storage
        const response = await axios.get('/api/v1/alumnos/alumnos/?nopaginate=true', {
            headers: { Authorization: `Token ${token}` }
        });
        allAlumnos = response.data.results || response.data;

        // Persistir en local para modo offline
        localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));

        // Initial Render
        updateKPIs();
        renderRegistrosTable(allAlumnos);
        renderRegistrosTable(allAlumnos);


        // Also fetch leaders for the chart if not already
        if (allLideres.length === 0) {
            await fetchLideres();
        } else {
            if (window.DashboardCharts) {
                DashboardCharts.render(allAlumnos, allLideres);
            }
        }

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
    // Render immediately from cache for instant UI
    if (allLideres && allLideres.length > 0) {
        renderLideresTable(allLideres);
        if (window.DashboardCharts && allAlumnos.length > 0) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
    }

    // Skip network if offline bypass is active and no token
    if (offlineMode && !token) {
        console.log("Offline Mode: Using cached leaders.");
        if (window.DashboardCharts && allAlumnos.length > 0 && allLideres.length > 0) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
        window.hideLoader && window.hideLoader();
        return;
    }

    try {
        window.showLoader && window.showLoader();
        const response = await axios.get('/api/v1/lideres/lideres/?nopaginate=true', {
            headers: { Authorization: `Token ${token}` }
        });
        allLideres = response.data.results || response.data;

        // Persist leaders
        localStorage.setItem('allLideres', JSON.stringify(allLideres));
        renderLideresTable(allLideres);

        if (window.DashboardCharts) {
            DashboardCharts.render(allAlumnos, allLideres);
        }
    } catch (err) {
        console.error("Error fetching leaders", err);
        // If 401, they need to re-auth
        if (err.response && err.response.status === 401) {
            logout();
        }
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
             <td class="px-6 py-4 font-mono text-xs">${l.email || 'N/A'}</td>
            <td class="px-6 py-4">
                 <select onchange="updateLeaderGroup('${l.id}', this.value)" class="appearance-none bg-white border border-slate-200 text-unemi-blue text-[10px] font-black px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-unemi-orange focus:border-unemi-orange cursor-pointer transition-all hover:border-unemi-orange hover:shadow-sm bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23EF7D00%22%20stroke-width%3D%222.5%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.8rem_0.8rem] bg-[right_0.4rem_center] bg-no-repeat pr-6 shadow-sm uppercase tracking-tighter">
                     <option value="0" ${l.grupo == 0 ? 'selected' : ''}>SIN GRUPO</option>
                     ${Array.from({ length: 15 }, (_, i) => i + 1).map(g => `<option value="${g}" ${l.grupo == g ? 'selected' : ''}>Grupo ${g}</option>`).join('')}
                 </select>
             </td>
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
                 <div class="flex items-center justify-center gap-2">
                     <button onclick='openLiderModal(${JSON.stringify(l)})' class="p-2 text-unemi-blue hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                     </button>
                     ${user.is_superuser ? `
                     <button onclick="eliminarEntidad('lider', '${l.id}', '${l.nombre_completo}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                     </button>` : ''}
                 </div>
             </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

window.updateLeaderGroup = async function (id, newGroup) {
    const numGroup = parseInt(newGroup);

    // Optimistic local update
    const idx = allLideres.findIndex(l => l.id == id);
    if (idx !== -1) {
        allLideres[idx].grupo = numGroup;
        localStorage.setItem('allLideres', JSON.stringify(allLideres));
        renderLideresTable(allLideres);
    }

    if (offlineMode && !token) {
        showOfflineToast("Cambio guardado localmente. Se sincronizará al recuperar conexión.");
        return;
    }

    try {
        await axios.patch(`/api/v1/lideres/lideres/${id}/`, { grupo: numGroup }, {
            headers: { Authorization: `Token ${token}` }
        });
        showSuccessToast('Grupo actualizado');
    } catch (e) {
        console.error("Error updating leader group", e);
        if (!navigator.onLine) {
            showOfflineToast("Sin conexión. El cambio se mantiene localmente.");
        } else {
            showErrorAlert('No se pudo guardar el cambio del grupo.');
        }
    }
}

// === QUICK GROUP CHANGE FOR STUDENTS ===
window.changeStudentGroup = async function (cedula, newGroup) {
    const numGroup = parseInt(newGroup);

    // Find the student in local cache
    const studentIdx = allAlumnos.findIndex(a => a.cedula === cedula);
    if (studentIdx === -1) {
        showErrorAlert('Estudiante no encontrado');
        return;
    }

    // Find a leader from the selected group
    let newLeaderId = null;
    let newLeaderName = 'Sin líder';

    if (numGroup > 0) {
        const leadersInGroup = allLideres.filter(l => l.grupo === numGroup && l.activo);
        if (leadersInGroup.length > 0) {
            // Pick the first active leader from that group
            const selectedLeader = leadersInGroup[0];
            newLeaderId = selectedLeader.id;
            newLeaderName = selectedLeader.nombre_completo;
        } else {
            showErrorAlert(`No hay líderes activos en el Grupo ${numGroup}`);
            // Refresh table to reset dropdown
            renderRegistrosTable(allAlumnos);
            return;
        }
    }

    // Optimistic local update
    allAlumnos[studentIdx].grupo = numGroup;
    allAlumnos[studentIdx].lider_invitador = newLeaderId;
    allAlumnos[studentIdx].lider_nombre = newLeaderName;
    localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));

    // Don't re-render immediately to avoid flickering, wait for server response

    if (offlineMode && !token) {
        showOfflineToast("Cambio guardado localmente. Se sincronizará al recuperar conexión.");
        renderRegistrosTable(allAlumnos);
        return;
    }

    try {
        window.showLoader && window.showLoader();

        await axios.patch(`/api/v1/alumnos/alumnos/${cedula}/`, {
            lider_invitador: newLeaderId
        }, {
            headers: { Authorization: `Token ${token}` }
        });

        showSuccessToast(`Estudiante movido a Grupo ${numGroup}`);

        // Refresh to get updated whatsapp_link
        await refreshData();

    } catch (e) {
        console.error("Error updating student group", e);
        if (!navigator.onLine) {
            showOfflineToast("Sin conexión. El cambio se mantiene localmente.");
        } else {
            showErrorAlert('No se pudo cambiar el grupo. ' + (e.response?.data?.detail || ''));
            // Revert local change
            await refreshData();
        }
    } finally {
        window.hideLoader && window.hideLoader();
    }
}

function filterLideres(query) {
    // Helper for accent-insensitive comparison
    const normalize = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const q = normalize(query);
    const groupElement = document.getElementById('filter-lider-grupo');
    const group = groupElement ? groupElement.value : 'all';

    const filtered = allLideres.filter(l => {
        const nameNorm = normalize(l.nombre_completo);
        const emailNorm = normalize(l.email);

        const matchesSearch = nameNorm.includes(q) || emailNorm.includes(q);
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
        cedula: document.getElementById('lider-cedula').value || null,
        grupo: parseInt(document.getElementById('lider-grupo').value),
        telefono: document.getElementById('lider-telefono').value || null,
        email: document.getElementById('lider-email').value || null,
        activo: document.getElementById('lider-activo').checked,
        visible_en_registro: document.getElementById('lider-visible').checked
    };

    // Optimistic local update/create for offline
    if (id) {
        const idx = allLideres.findIndex(l => l.id == id);
        if (idx !== -1) {
            allLideres[idx] = { ...allLideres[idx], ...data };
        }
    } else {
        // Temporary ID for local-only entry
        const tempLider = { ...data, id: 'temp_' + Date.now(), total_invitados: 0, total_asistencias: 0 };
        allLideres.push(tempLider);
    }
    localStorage.setItem('allLideres', JSON.stringify(allLideres));
    renderLideresTable(allLideres);
    document.getElementById('lider-modal').classList.add('hidden');

    if (offlineMode && !token) {
        showOfflineToast("Líder guardado localmente (Modo Consulta).");
        return;
    }

    try {
        if (id && !id.startsWith('temp_')) {
            await axios.patch(`/api/v1/lideres/lideres/${id}/`, data, {
                headers: { Authorization: `Token ${token}` }
            });
        } else {
            await axios.post('/api/v1/lideres/lideres/', data, {
                headers: { Authorization: `Token ${token}` }
            });
        }
        showSuccessToast('Líder guardado correctamente');
        fetchLideres(); // Real refresh to get server IDs/stats
    } catch (err) {
        console.error("Error saving leader", err);
        if (!navigator.onLine) {
            showOfflineToast("Sin conexión. Los cambios son locales por ahora.");
        } else {
            showErrorAlert('Error al guardar. Verifique los datos.');
        }
    }
}


// === STUDENT EDIT LOGIC ===
let selectedLeaderForStudent = null;

window.openStudentEdit = function (student) {
    // Reset State
    selectedLeaderForStudent = null;
    document.getElementById('edit-student-leader-search').value = '';
    document.getElementById('edit-student-leader-id').value = '';
    document.getElementById('edit-student-leader-selected').classList.add('hidden');
    document.getElementById('edit-student-leader-results').innerHTML = '';
    document.getElementById('edit-student-leader-results').classList.add('hidden');

    // Populate Fields
    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-student-nombre').value = student.nombre_completo;
    document.getElementById('edit-student-cedula').value = student.cedula;

    // Group Display
    const groupDisplay = document.getElementById('edit-student-grupo-display');
    if (student.grupo === 0) {
        groupDisplay.textContent = "SIN GRUPO";
        groupDisplay.className = "w-full p-3 bg-red-50 border border-red-200 rounded-xl font-black text-red-500 uppercase";
    } else {
        groupDisplay.textContent = `GRUPO ${student.grupo}`;
        groupDisplay.className = "w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-unemi-blue uppercase";
    }

    // Pre-fill leader if exists
    if (student.lider_invitador) {
        // Need to find leader name. student object has 'lider_nombre' from serializer usually.
        // If not, we try to find it in allLideres
        let leaderName = student.lider_nombre || "Líder Asignado";
        if (!leaderName && allLideres) {
            const l = allLideres.find(x => x.id === student.lider_invitador);
            if (l) leaderName = l.nombre_completo;
        }

        selectLeaderForStudent({
            id: student.lider_invitador,
            nombre_completo: leaderName
        });
    }

    document.getElementById('student-modal').classList.remove('hidden');
}

// Leader Search inside Student Edit
const studentLeaderSearch = document.getElementById('edit-student-leader-search');
if (studentLeaderSearch) {
    studentLeaderSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const resultsDiv = document.getElementById('edit-student-leader-results');

        if (q.length < 2) {
            resultsDiv.classList.add('hidden');
            return;
        }

        const matches = allLideres.filter(l => l.nombre_completo.toLowerCase().includes(q));

        if (matches.length > 0) {
            resultsDiv.innerHTML = matches.map(l => `
                <div onclick='selectLeaderForStudent(${JSON.stringify(l).replace(/'/g, "&#39;")})' class="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center group">
                    <span class="font-bold text-slate-700 group-hover:text-unemi-blue">${l.nombre_completo}</span>
                    <span class="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Grupo ${l.grupo}</span>
                </div>
            `).join('');
            resultsDiv.classList.remove('hidden');
        } else {
            resultsDiv.innerHTML = `<div class="p-3 text-slate-400 text-xs text-center">No se encontraron líderes</div>`;
            resultsDiv.classList.remove('hidden');
        }
    });
}

window.selectLeaderForStudent = function (leader) {
    selectedLeaderForStudent = leader;
    document.getElementById('edit-student-leader-id').value = leader.id;

    // UI Update
    document.getElementById('selected-leader-name').textContent = leader.nombre_completo;
    document.getElementById('edit-student-leader-selected').classList.remove('hidden');
    document.getElementById('edit-student-leader-results').classList.add('hidden');
    document.getElementById('edit-student-leader-search').value = ''; // Clean search
}

window.clearSelectedLeader = function () {
    selectedLeaderForStudent = null;
    document.getElementById('edit-student-leader-id').value = '';
    document.getElementById('selected-leader-name').textContent = '';
    document.getElementById('edit-student-leader-selected').classList.add('hidden');
}

// Save Student
safeBind('student-form', 'submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-student-id').value; // Student PK or ID
    const nombre = document.getElementById('edit-student-nombre').value;
    const liderId = document.getElementById('edit-student-leader-id').value;

    const payload = {
        nombre_completo: nombre,
        lider_invitador: liderId || null
    };

    try {
        window.showLoader();
        // Since we don't have the PK in the table row (only ID/Cedula usually), we need to ensure we use the correct ID.
        // Django ModelViewSet uses lookup_field = 'cedula'. Wait, serializer uses 'id' (pk).
        // Let's check the student object passed to openStudentEdit. It has 'id' (pk) and 'cedula'.
        // Standard DRF route for update usually uses PK if not overridden, but ViewSet says lookup_field = 'cedula'.
        // Let's reuse 'cedula' which is safer for this codebase based on previous delete logic.
        const cedula = document.getElementById('edit-student-cedula').value;

        await axios.patch(`/api/v1/alumnos/alumnos/${cedula}/`, payload, {
            headers: { Authorization: `Token ${token}` }
        });

        // Update Local
        const idx = allAlumnos.findIndex(a => a.cedula == cedula);
        if (idx !== -1) {
            allAlumnos[idx].nombre_completo = nombre;
            allAlumnos[idx].lider_invitador = liderId ? parseInt(liderId) : null;
            // Update group locally if leader assigned
            if (liderId) {
                const l = allLideres.find(x => x.id == liderId);
                if (l) {
                    allAlumnos[idx].grupo = l.grupo;
                    allAlumnos[idx].lider_nombre = l.nombre_completo; // Helper for display
                }
            } else {
                allAlumnos[idx].grupo = 0;
            }
        }

        localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));
        refreshData(); // Re-render table

        document.getElementById('student-modal').classList.add('hidden');
        showSuccessToast('Estudiante actualizado correctamente');

    } catch (err) {
        console.error("Error updating student", err);
        showErrorAlert("Error al actualizar estudiante.");
    } finally {
        window.hideLoader();
    }
});


// Helpers for cleaner code

// === HYBRID DOWNLOAD LOGIC ===
window.downloadFile = async function (url, filename, type, studentData) {
    // Attempt 1: Online Download
    if (navigator.onLine) {
        try {
            const response = await axios.get(url, {
                responseType: 'blob',
                headers: { Authorization: `Token ${token}` },
                timeout: 5000 // 5s timeout to fail fast
            });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            return; // Success
        } catch (e) {
            console.warn("Online download failed, falling back to offline generation", e);
        }
    }

    // Attempt 2: Offline Generation
    try {
        window.showLoader();
        if (type === 'qr') {
            await generateAndDownloadQR(studentData.cedula, studentData.nombre_completo);
        } else if (type === 'pdf') {
            await generateAndDownloadPDF(studentData);
        }
    } catch (e) {
        console.error("Offline generation failed", e);
        showErrorAlert("No se pudo generar el archivo. Intente nuevamente.");
    } finally {
        window.hideLoader();
    }
}

async function generateAndDownloadQR(cedula, nombre) {
    // Create hidden div
    const div = document.createElement('div');
    // Ensure data is string
    const qrText = String(cedula);

    // Generate QR
    // Using qrcodejs
    // We need to wait for it to render
    return new Promise((resolve, reject) => {
        try {
            // qrcodejs renders into an element
            // We can create a temporary container
            const container = document.createElement('div');
            const qrcode = new QRCode(container, {
                text: qrText,
                width: 512,
                height: 512,
                colorDark: "#0F1E4B",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            // Wait a bit for canvas/img to be ready
            setTimeout(() => {
                const canvas = container.querySelector('canvas');
                const img = container.querySelector('img');
                const dataUrl = canvas ? canvas.toDataURL('image/png') : img.src;

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `qr_${cedula}.png`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                resolve();
            }, 100);
        } catch (e) {
            reject(e);
        }
    });
}

async function generateAndDownloadPDF(student) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a6' // 105 x 148 mm
    });

    const width = 105;
    const height = 148;
    const UNEMI_BLUE = "#0F1E4B";
    const UNEMI_ORANGE = "#EF7D00";
    const SLATE_500 = "#64748b";

    // --- Background Header ---
    doc.setFillColor(UNEMI_ORANGE);
    doc.rect(0, 0, width, 40, 'F'); // Top 40mm

    // --- Logo ---
    // We need to fetch the logo blob to use it
    try {
        const logoImg = await loadImageToBase64('/static/img/icono.webp'); // Ensure cache sw
        if (logoImg) {
            doc.addImage(logoImg, 'WEBP', (width / 2) - 15, 8, 30, 30);
        }
    } catch (e) {
        console.warn("Could not load logo for PDF", e);
    }

    // --- Title ---
    doc.setTextColor(UNEMI_BLUE);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CREDENCIAL DE ASISTENCIA", width / 2, 50, { align: "center" });

    // --- Student Info ---
    let currentY = 58;

    // Name
    doc.setFontSize(14);
    if (student.nombre_completo.length > 25) {
        const words = student.nombre_completo.split(' ');
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        doc.text(line1, width / 2, currentY, { align: "center" });
        doc.text(line2, width / 2, currentY + 6, { align: "center" });
        currentY += 12;
    } else {
        doc.text(student.nombre_completo, width / 2, currentY, { align: "center" });
        currentY += 8;
    }

    // Cedula
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE_500);
    doc.text(student.cedula, width / 2, currentY, { align: "center" });

    // Carrera
    if (student.carrera) {
        doc.setFontSize(8);
        doc.text(student.carrera.substring(0, 45), width / 2, currentY + 4, { align: "center" });
    }

    // --- Group Info ---
    if (student.grupo) {
        const groupY = currentY + 14;

        doc.setFontSize(8);
        doc.setTextColor(UNEMI_BLUE);
        doc.setFont("helvetica", "bold");
        doc.text("UBICA A TU LÍDER", width / 2, groupY - 4, { align: "center" });

        doc.setFontSize(18);
        doc.setTextColor(UNEMI_ORANGE);
        doc.text(`GRUPO ${student.grupo}`, width / 2, groupY, { align: "center" });
    }

    // --- QR Code ---
    // We generate QR data URL
    const qrDataUrl = await generateQRDataUrl(student.codigo_qr || student.cedula);
    const qrSize = 48;
    const qrY = height - qrSize - 12;
    doc.addImage(qrDataUrl, 'PNG', (width - qrSize) / 2, qrY, qrSize, qrSize);

    // --- Footer ---
    doc.setFontSize(7);
    doc.setTextColor(UNEMI_BLUE);
    doc.setFont("helvetica", "normal");
    doc.text("Presenta este código para registrar tu asistencia", width / 2, height - 6, { align: "center" });

    doc.save(`credencial_${student.cedula}.pdf`);
}

// Helper to generate QR Data URL
function generateQRDataUrl(text) {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        const qrcode = new QRCode(container, {
            text: String(text),
            width: 512,
            height: 512,
            correctLevel: QRCode.CorrectLevel.H
        });
        setTimeout(() => {
            const canvas = container.querySelector('canvas');
            const img = container.querySelector('img');
            resolve(canvas ? canvas.toDataURL('image/png') : img.src);
        }, 100);
    });
}

// Helper to load image
function loadImageToBase64(url) {
    return axios.get(url, { responseType: 'blob' })
        .then(response => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(response.data);
            });
        });
}
function showSuccessToast(title) {
    Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true
    }).fire({ icon: 'success', title: title });
}

function showOfflineToast(title) {
    Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true
    }).fire({ icon: 'info', title: title, background: '#fffbeb' });
}

function showErrorAlert(text) {
    Swal.fire({ icon: 'error', title: 'Error', text: text, confirmButtonColor: '#0F1E4B' });
}

// Deletion Logic
window.eliminarEntidad = async function (tipo, id, nombre) {
    if (!window.Swal) {
        console.error("SweetAlert2 (Swal) no está cargado.");
        if (confirm(`¿Eliminar ${nombre}?`)) {
            // Fallback to basic confirm if Swal fails
        } else return;
    }

    const title = tipo === 'alumno' ? '¿Eliminar Estudiante?' : '¿Eliminar Líder?';
    const text = tipo === 'alumno'
        ? `Se eliminará el registro de <b>${nombre}</b> y toda su información asociada (QR, Banco, etc.).`
        : `Se eliminará al líder <b>${nombre}</b> y TODOS sus estudiantes invitados. Esta acción no se puede deshacer.`;

    const result = await Swal.fire({
        title: title,
        html: text, // Use html for bold names
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF7D00', // UNEMI Orange
        cancelButtonColor: '#0F1E4B', // UNEMI Blue
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            if (!navigator.onLine) {
                showErrorAlert("Se requiere internet para eliminar registros.");
                return;
            }

            window.showLoader();
            const url = tipo === 'alumno' ? `/api/v1/alumnos/alumnos/${id}/` : `/api/v1/lideres/lideres/${id}/`;
            const response = await axios.delete(url, {
                headers: { Authorization: `Token ${token}` }
            });

            await Swal.fire({
                title: '¡Eliminado!',
                text: 'El registro ha sido removido exitosamente.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

            if (tipo === 'alumno') {
                // 1. Remove locally immediately
                allAlumnos = allAlumnos.filter(a => a.cedula != id);
                localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));

                // 2. Update UI
                updateKPIs();
                const searchVal = document.getElementById('search-registros')?.value || '';
                if (searchVal) {
                    filterRegistros(searchVal);
                } else {
                    renderRegistrosTable(allAlumnos);
                }

                // 3. Background Sync
                refreshData();
            } else {
                allLideres = allLideres.filter(l => l.id != id);
                localStorage.setItem('allLideres', JSON.stringify(allLideres));
                renderLideresTable(allLideres);

                fetchLideres();
                refreshData();
            }
        } catch (err) {
            console.error("Error al eliminar:", err);

            // Handle 404 (Ghost records) as success
            if (err.response && err.response.status === 404) {
                await Swal.fire({
                    title: 'Ya eliminado',
                    text: 'El registro ya no existía en el servidor. Se ha limpiado de su vista.',
                    icon: 'info',
                    timer: 1500,
                    showConfirmButton: false
                });

                if (tipo === 'alumno') {
                    allAlumnos = allAlumnos.filter(a => a.cedula != id);
                    localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));
                    updateKPIs();
                    const searchVal = document.getElementById('search-registros')?.value || '';
                    if (searchVal) filterRegistros(searchVal);
                    else renderRegistrosTable(allAlumnos);
                } else {
                    allLideres = allLideres.filter(l => l.id != id);
                    localStorage.setItem('allLideres', JSON.stringify(allLideres));
                    renderLideresTable(allLideres);
                }
                return;
            }

            const msg = err.response?.data?.detail || err.response?.data?.error || "No tienes permisos o ocurrió un problema en el servidor.";
            Swal.fire({
                title: 'Error al eliminar',
                text: msg,
                icon: 'error'
            });
        } finally {
            window.hideLoader();
        }
    }
};

// Global expose wrapper for camera toggles
window.toggleCamera = function () {
    if (window.DashboardScanner) {
        DashboardScanner.toggleCamera();
    }
};


// === IMPORT/EXPORT LOGIC ===
let importFile = null;
let importAnalysisData = null;
let importColumnMappings = {};

// Show Import Modal
window.showImportModal = function () {
    document.getElementById('import-modal').classList.remove('hidden');
    resetImportModal();
    lucide.createIcons();
}

// Close Import Modal
window.closeImportModal = function () {
    document.getElementById('import-modal').classList.add('hidden');
}

// Reset Import Modal
window.resetImportModal = function () {
    importFile = null;
    importAnalysisData = null;
    importColumnMappings = {};

    // Show upload section, hide others
    document.getElementById('import-upload-section').classList.remove('hidden');
    document.getElementById('import-mapping-section').classList.add('hidden');
    document.getElementById('import-results-section').classList.add('hidden');
    document.getElementById('import-loading-section').classList.add('hidden');

    // Reset file input
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-file-info').classList.add('hidden');
    document.getElementById('btn-analyze-import').disabled = true;

    // Reset steps
    updateImportStep(1);
    lucide.createIcons();
}

// Update Step Indicator
function updateImportStep(step) {
    const steps = [1, 2, 3];
    steps.forEach(s => {
        const stepEl = document.getElementById(`import-step-${s}`);
        if (s < step) {
            stepEl.className = 'flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold text-sm';
        } else if (s === step) {
            stepEl.className = 'flex items-center gap-2 bg-unemi-orange text-white px-3 py-1.5 rounded-lg font-bold text-sm';
        } else {
            stepEl.className = 'flex items-center gap-2 bg-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-sm';
        }
    });
}

// File Selection
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('import-file-input');
    const dropZone = document.getElementById('import-drop-zone');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImportFileSelect(e.target.files[0]);
            }
        });
    }

    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('border-unemi-orange', 'bg-orange-50');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('border-unemi-orange', 'bg-orange-50');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleImportFileSelect(files[0]);
            }
        }, false);
    }
});

function handleImportFileSelect(file) {
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)');
        return;
    }

    importFile = file;
    document.getElementById('import-file-name').textContent = file.name;
    document.getElementById('import-file-size').textContent = formatFileSize(file.size);
    document.getElementById('import-file-info').classList.remove('hidden');
    document.getElementById('btn-analyze-import').disabled = false;
    lucide.createIcons();
}

window.clearImportFile = function () {
    importFile = null;
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-file-info').classList.add('hidden');
    document.getElementById('btn-analyze-import').disabled = true;
}

// Analyze File
window.analyzeImportFile = async function () {
    if (!importFile) return;

    showImportLoading('Analizando archivo...');

    const formData = new FormData();
    formData.append('file', importFile);

    try {
        const response = await axios.post('/api/v1/alumnos/analizar-excel/', formData, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            importAnalysisData = response.data;
            displayImportMapping(response.data);
            updateImportStep(2);
        } else {
            alert(response.data.error || 'Error al analizar el archivo');
            hideImportLoading();
        }
    } catch (error) {
        console.error('Error analyzing file:', error);
        alert(error.response?.data?.error || 'Error al analizar el archivo');
        hideImportLoading();
    }
}

// Display Mapping Interface
function displayImportMapping(data) {
    hideImportLoading();
    document.getElementById('import-upload-section').classList.add('hidden');
    document.getElementById('import-mapping-section').classList.remove('hidden');

    // Display preview
    displayImportPreview(data);

    // Display mapping selectors
    const container = document.getElementById('import-mapping-container');
    container.innerHTML = '';

    const requiredFields = data.required_fields;
    const suggestedMappings = data.suggested_mappings || {};

    importColumnMappings = {};

    Object.keys(requiredFields).forEach(field => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 gap-3 items-center p-3 bg-slate-50 rounded-lg border border-slate-200';

        const label = document.createElement('div');
        label.innerHTML = `
            <p class="font-bold text-sm text-slate-800">${requiredFields[field]}</p>
            <p class="text-xs text-slate-500">${field.includes('Opcional') ? 'Opcional' : 'Requerido'}</p>
        `;

        const selector = document.createElement('select');
        selector.id = `import-mapping-${field}`;
        selector.className = 'w-full p-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-unemi-blue focus:outline-none';

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Seleccionar --';
        selector.appendChild(emptyOption);

        data.columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;

            if (suggestedMappings[field] === col) {
                option.selected = true;
                importColumnMappings[field] = col;
            }

            selector.appendChild(option);
        });

        selector.addEventListener('change', (e) => {
            importColumnMappings[field] = e.target.value;
        });

        row.appendChild(label);
        row.appendChild(selector);
        container.appendChild(row);
    });

    lucide.createIcons();
}

// Display Preview
function displayImportPreview(data) {
    const headerRow = document.getElementById('import-preview-header');
    const bodyTable = document.getElementById('import-preview-body');

    headerRow.innerHTML = '';
    bodyTable.innerHTML = '';

    data.columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-3 py-2 text-left font-bold text-xs';
        th.textContent = col;
        headerRow.appendChild(th);
    });

    data.preview.slice(0, 3).forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';

        row.forEach(cell => {
            const td = document.createElement('td');
            td.className = 'px-3 py-2 text-slate-700 text-xs';
            td.textContent = cell || '-';
            tr.appendChild(td);
        });

        bodyTable.appendChild(tr);
    });

    document.getElementById('import-file-stats').textContent =
        `Total: ${data.total_rows} filas | ${data.columns.length} columnas | ${data.has_header ? 'Con encabezados' : 'Sin encabezados'}`;
}

// Back to Upload
window.backToUpload = function () {
    document.getElementById('import-mapping-section').classList.add('hidden');
    document.getElementById('import-upload-section').classList.remove('hidden');
    updateImportStep(1);
}

// Process Import
window.processImportData = async function () {
    if (!importFile || !importAnalysisData) return;

    const requiredFields = ['nombre_completo', 'cedula', 'email', 'telefono'];
    const missingFields = requiredFields.filter(field => !importColumnMappings[field]);

    if (missingFields.length > 0) {
        alert('Por favor mapea todos los campos requeridos: ' + missingFields.join(', '));
        return;
    }

    showImportLoading('Importando registros...');
    updateImportStep(3);

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('mappings', JSON.stringify(importColumnMappings));
    formData.append('has_header', importAnalysisData.has_header);

    try {
        const response = await axios.post('/api/v1/alumnos/procesar-importacion/', formData, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            displayImportResults(response.data.results);
        } else {
            alert(response.data.error || 'Error al procesar la importación');
            hideImportLoading();
        }
    } catch (error) {
        console.error('Error processing import:', error);
        alert(error.response?.data?.error || 'Error al procesar la importación');
        hideImportLoading();
    }
}

// Display Results
function displayImportResults(results) {
    hideImportLoading();
    document.getElementById('import-mapping-section').classList.add('hidden');
    document.getElementById('import-results-section').classList.remove('hidden');

    document.getElementById('import-result-created').textContent = results.created;
    document.getElementById('import-result-errors').textContent = results.errors.length;
    document.getElementById('import-result-total').textContent = results.total;

    if (results.errors.length > 0) {
        document.getElementById('import-error-list').classList.remove('hidden');
        const errorDetails = document.getElementById('import-error-details');
        errorDetails.innerHTML = '';

        results.errors.forEach(error => {
            const p = document.createElement('p');
            p.className = 'mb-1';
            p.textContent = error;
            errorDetails.appendChild(p);
        });
    }

    lucide.createIcons();
}

// Loading States
function showImportLoading(text = 'Procesando...') {
    document.getElementById('import-loading-text').textContent = text;
    document.getElementById('import-upload-section').classList.add('hidden');
    document.getElementById('import-mapping-section').classList.add('hidden');
    document.getElementById('import-results-section').classList.add('hidden');
    document.getElementById('import-loading-section').classList.remove('hidden');
}

function hideImportLoading() {
    document.getElementById('import-loading-section').classList.add('hidden');
}

// Utility
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// === EXPORT PREVIEW LOGIC ===
window.showExportPreview = async function (type) {
    const modal = document.getElementById('export-preview-modal');
    const loading = document.getElementById('export-loading');
    const previewHeader = document.getElementById('export-preview-header');
    const previewBody = document.getElementById('export-preview-body');
    const downloadBtn = document.getElementById('export-download-btn');
    const modalTitle = document.getElementById('export-modal-title');

    // Show modal and loading
    modal.classList.remove('hidden');
    loading.classList.remove('hidden');
    previewHeader.innerHTML = '';
    previewBody.innerHTML = '';

    // Set title and download URL
    if (type === 'alumnos') {
        modalTitle.textContent = 'Vista Previa - Todos los Alumnos';
        currentExportUrl = '/api/v1/alumnos/export/registros/';
    } else {
        modalTitle.textContent = 'Vista Previa - Datos Bancarios';
        currentExportUrl = '/api/v1/alumnos/export/bancos/';
    }

    try {
        // Get data from current view
        let data = [];
        let columns = [];

        console.log('Export type:', type);
        console.log('All alumnos:', allAlumnos);

        if (type === 'alumnos') {
            // Use ALL alumnos data (same as Registros table)
            data = allAlumnos.slice(0, 10); // First 10 for preview
            const totalCount = allAlumnos.length;

            console.log('Alumnos data:', data);

            columns = [
                { key: 'cedula', label: 'Cédula' },
                { key: 'nombre_completo', label: 'Nombre Completo' },
                { key: 'email', label: 'Email' },
                { key: 'telefono', label: 'Teléfono' },
                { key: 'modalidad', label: 'Modalidad' },
                { key: 'facultad', label: 'Facultad' },
                { key: 'carrera', label: 'Carrera' },
                { key: 'grupo', label: 'Grupo' },
                { key: 'asistio', label: 'Asistió' }
            ];

            document.getElementById('export-total-count').textContent = totalCount;
            document.getElementById('export-columns-count').textContent = 11; // Total columns in Excel export
        } else {
            // Filter alumnos with bank accounts (same as Datos Bancarios table)
            const alumnosWithBank = allAlumnos.filter(a => a.cuenta_bancaria && a.cuenta_bancaria.numero_cuenta);
            data = alumnosWithBank.slice(0, 10);

            console.log('Bank accounts data:', data);

            columns = [
                { key: 'cedula', label: 'Cédula' },
                { key: 'nombre_completo', label: 'Nombre' },
                { key: 'cuenta_bancaria.titular_nombre', label: 'Titular' },
                { key: 'cuenta_bancaria.titular_cedula', label: 'CI Titular' },
                { key: 'cuenta_bancaria.banco', label: 'Banco' },
                { key: 'cuenta_bancaria.tipo_cuenta', label: 'Tipo' },
                { key: 'cuenta_bancaria.numero_cuenta', label: 'Número Cuenta' }
            ];

            document.getElementById('export-total-count').textContent = alumnosWithBank.length;
            document.getElementById('export-columns-count').textContent = 11; // Total columns in Excel export
        }

        // Build header
        columns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'px-2 py-2 text-left font-bold text-[10px] whitespace-nowrap';
            th.textContent = col.label;
            previewHeader.appendChild(th);
        });

        // Build rows
        if (data.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = columns.length;
            td.className = 'px-3 py-4 text-center text-slate-500 text-xs';
            td.textContent = 'No hay datos para mostrar';
            tr.appendChild(td);
            previewBody.appendChild(tr);
        } else {
            data.forEach((row, idx) => {
                const tr = document.createElement('tr');
                tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';

                columns.forEach(col => {
                    const td = document.createElement('td');
                    td.className = 'px-2 py-2 text-slate-700 text-[10px]';

                    // Get nested value
                    let value = row;
                    const keys = col.key.split('.');
                    for (const k of keys) {
                        value = value?.[k];
                    }

                    // Format value
                    if (col.key === 'asistio') {
                        value = value ? 'Sí' : 'No';
                    } else if (col.key === 'cuenta_bancaria.tipo_cuenta') {
                        value = value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '-';
                    } else if (value === null || value === undefined || value === '') {
                        value = '-';
                    }

                    td.textContent = value;
                    tr.appendChild(td);
                });

                previewBody.appendChild(tr);
            });
        }

        loading.classList.add('hidden');
        lucide.createIcons();

    } catch (error) {
        console.error('Error loading export preview:', error);
        loading.classList.add('hidden');
        previewBody.innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-red-500 text-xs">Error al cargar vista previa: ' + error.message + '</td></tr>';
    }
}

window.closeExportPreview = function () {
    document.getElementById('export-preview-modal').classList.add('hidden');
}

// Global variable to store export URL
let currentExportUrl = '';

window.downloadExport = async function () {
    console.log('downloadExport called');
    console.log('currentExportUrl:', currentExportUrl);

    if (!currentExportUrl) {
        alert('No se ha configurado la URL de exportación');
        return;
    }

    try {
        // Show loading state
        const btn = document.getElementById('export-download-btn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Descargando...';
        lucide.createIcons();

        console.log('Fetching from:', currentExportUrl);

        // Fetch the file
        const response = await fetch(currentExportUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        // Get the blob
        const blob = await response.blob();
        console.log('Blob received:', blob.size, 'bytes, type:', blob.type);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        console.log('Content-Disposition:', contentDisposition);

        let filename = 'export.xlsx';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
            if (filenameMatch) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }

        console.log('Downloading as:', filename);

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Restore button
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        lucide.createIcons();

        console.log('Download completed successfully');

        // Close modal after successful download
        setTimeout(() => {
            closeExportPreview();
        }, 500);

    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Error al descargar el archivo:\n\n' + error.message);

        // Restore button
        const btn = document.getElementById('export-download-btn');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i> Exportar a Excel';
        lucide.createIcons();
    }
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

window.smartShuffleLeaders = async function () {
    if (!navigator.onLine) {
        showErrorAlert("El sorteo requiere conexión a internet para sincronizar con la base de datos global.");
        return;
    }

    const result = await Swal.fire({
        title: '¿Sorteo Inteligente?',
        text: "Esto redistribuirá a todos los líderes activos aleatoriamente en los 15 grupos.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#EF7D00',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, ¡redistribuir!',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        window.showLoader && window.showLoader();

        if (allLideres.length === 0) await fetchLideres();
        const activeLideres = allLideres.filter(l => l.activo);

        const shuffled = [...activeLideres];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        let count = 0;
        const promises = shuffled.map(l => {
            const newGroup = (count % 15) + 1;
            count++;
            return axios.patch(`/api/v1/lideres/lideres/${l.id}/`, { grupo: newGroup }, {
                headers: { Authorization: `Token ${token}` }
            });
        });

        await Promise.all(promises);

        showSuccessToast('Sorteo Completado');
        fetchLideres();

    } catch (err) {
        console.error("Error in smart shuffle:", err);
        showErrorAlert('Ocurrió un error al redistribuir líderes.');
    } finally {
        window.hideLoader && window.hideLoader();
    }
};

window.openLeaderImportModal = function () {
    document.getElementById('leader-import-modal').classList.remove('hidden');
    document.getElementById('leader-upload-status').classList.add('hidden');
    document.getElementById('leader-file-info').innerHTML = `
        <i data-lucide="upload-cloud" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i>
        <p class="text-sm text-slate-500 font-bold">Arrastra o selecciona tu archivo Excel</p>
        <p class="text-xs text-slate-400 mt-1">Formato: Nombres (Col 1), Correo (Col 2)</p>
    `;
    lucide.createIcons();
};

window.closeLeaderImportModal = function () {
    document.getElementById('leader-import-modal').classList.add('hidden');
};

window.updateLeaderFileName = function (input) {
    if (input.files && input.files[0]) {
        const fileName = input.files[0].name;
        document.getElementById('leader-file-info').innerHTML = `
            <i data-lucide="file-check" class="w-12 h-12 text-emerald-500 mx-auto mb-4"></i>
            <p class="text-sm text-slate-700 font-black">${fileName}</p>
            <p class="text-xs text-emerald-500 mt-1">Archivo listo para procesar</p>
        `;
        lucide.createIcons();
    }
};

window.handleLeaderExcelUpload = async function (e) {
    e.preventDefault();
    const fileInput = document.getElementById('leader-excel-file');
    const statusDiv = document.getElementById('leader-upload-status');

    if (!fileInput.files || !fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    statusDiv.classList.remove('hidden');
    statusDiv.textContent = "Procesando...";
    statusDiv.className = "text-unemi-blue font-bold text-center animate-pulse";

    try {
        window.showLoader && window.showLoader();
        const response = await axios.post('/api/v1/lideres/upload-excel/', formData, {
            headers: {
                Authorization: `Token ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        statusDiv.textContent = response.data.message || "¡Carga Exitosa!";
        statusDiv.className = "text-emerald-500 font-black text-center p-3 bg-emerald-50 rounded-xl";

        Swal.fire({
            icon: 'success',
            title: '¡Importación Exitosa!',
            text: response.data.message,
            confirmButtonColor: '#0F1E4B'
        });

        setTimeout(() => {
            window.closeLeaderImportModal();
            fetchLideres(); // Refresh the list
        }, 2000);

    } catch (err) {
        console.error("Error al cargar líderes:", err);
        const errorMsg = err.response?.data?.error || "Error al procesar el archivo.";
        statusDiv.textContent = errorMsg;
        statusDiv.className = "text-red-500 font-bold text-center p-3 bg-red-50 rounded-xl";

        Swal.fire({
            icon: 'error',
            title: 'Error de Importación',
            text: errorMsg,
            confirmButtonColor: '#0F1E4B'
        });
    } finally {
        window.hideLoader && window.hideLoader();
    }
};
// === MANUAL SCANNER CONTROLS ===
window.startCameraManual = function () {
    const selectionUI = document.getElementById('scanner-selection-ui');
    const cameraUI = document.getElementById('scanner-camera-ui');

    if (!window.DashboardScanner) {
        console.error("Scanner module not found");
        return;
    }

    selectionUI.classList.add('hidden');
    cameraUI.classList.remove('hidden');

    window.DashboardScanner.start(async (cedula) => {
        // --- LOGICA HIBRIDA OFFLINE ---
        // Forced fallback if already known offline or no network detector
        if (!navigator.onLine) {
            return await handleOfflineScan(cedula);
        }

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

        const headers = { Authorization: `Token ${token}` };
        if (csrftoken) headers['X-CSRFToken'] = csrftoken;

        const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
            { cedula: cedula },
            { headers: headers }
        );

        const alumno = response.data.alumno;
        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
        if (idx !== -1) {
            allAlumnos[idx].asistio = true;
            localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos)); // Mantener local sincronizado
            updateKPIs();
        }

        return alumno;
    });
};

window.stopCameraAndReturn = function () {
    if (window.DashboardScanner) {
        window.DashboardScanner.stop();
    }
    document.getElementById('scanner-selection-ui').classList.remove('hidden');
    document.getElementById('scanner-camera-ui').classList.add('hidden');
    document.getElementById('scan-result').classList.add('hidden');
};

// Global handle for QR Image Upload
window.handleQRFileSelect = function (input) {
    if (input.files && input.files.length > 0) {
        if (window.DashboardScanner) {
            // Ensure dataProcessor is defined if it wasn't started by camera
            if (!DashboardScanner.dataProcessor) {
                DashboardScanner.dataProcessor = async (cedula) => {
                    if (!navigator.onLine) {
                        return await handleOfflineScan(cedula);
                    }

                    try {
                        const headers = { Authorization: `Token ${token}` };
                        const response = await axios.post('/api/v1/alumnos/marcar-asistencia/',
                            { cedula: cedula },
                            { headers: headers }
                        );

                        const alumno = response.data.alumno;
                        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
                        if (idx !== -1) {
                            allAlumnos[idx].asistio = true;
                            localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));
                            updateKPIs();
                        }
                        return alumno;
                    } catch (e) {
                        console.warn("Online scan failed, falling back to offline logic:", e);
                        // FALLBACK TO OFFLINE SCAN
                        return await handleOfflineScan(cedula);
                    }
                };
            }
            window.DashboardScanner.scanImage(input.files[0]);
            input.value = '';
        } else {
            console.error("Scanner module not found");
        }
    }
};

// === OFFLINE HYBRID LOGIC ===
window.handleOfflineScan = async function (cedula) {
    console.log("Procesando escaneo offline para:", cedula);

    // 1. Buscar en JSON local (caché)
    const alumnoLocal = allAlumnos.find(a => a.cedula === cedula || a.codigo_qr === cedula);

    if (!alumnoLocal) {
        throw new Error("Estudiante no encontrado en la base local. Se requiere internet para validar registros nuevos.");
    }

    // 2. Verificar si ya asistió (en el JSON local)
    if (alumnoLocal.asistio) {
        return {
            nombre: alumnoLocal.nombre_completo,
            already_marked: true,
            offline: true
        };
    }

    // 3. Añadir a la cola offline si no está ya
    if (!offlineQueue.includes(cedula)) {
        offlineQueue.push(cedula);
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    }

    // 4. Marcar como asistido localmente para feedback inmediato
    const idx = allAlumnos.findIndex(a => a.cedula === alumnoLocal.cedula);
    if (idx !== -1) {
        allAlumnos[idx].asistio = true;
        localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));

        // --- ACTUALIZAR LÍDER LOCALMENTE ---
        const liderId = alumnoLocal.lider_invitador;
        if (liderId) {
            const lIdx = allLideres.findIndex(l => l.id == liderId);
            if (lIdx !== -1) {
                allLideres[lIdx].total_asistencias = (allLideres[lIdx].total_asistencias || 0) + 1;
                localStorage.setItem('allLideres', JSON.stringify(allLideres));
            }
        }

        // --- ACTUALIZAR TODA LA UI ---
        // --- ACTUALIZAR UI AL INSTANTE (PARIDAD CON ONLINE) ---
        updateKPIs();
        updateOfflineUI();
        if (window.DashboardCharts) {
            DashboardCharts.render(allAlumnos, allLideres);
        }

        renderRegistrosTable(allAlumnos);
        renderLideresTable(allLideres);
    }

    return {
        nombre: alumnoLocal.nombre_completo,
        offline: true
    };
};

window.syncOfflineScans = async function () {
    if (offlineQueue.length === 0) {
        console.log("No hay registros pendientes para sincronizar.");
        return;
    }

    if (!navigator.onLine) {
        console.warn("Intento de sincronización sin internet abortado.");
        return;
    }

    const btn = document.getElementById('btn-sync-manual');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="animate-spin" data-lucide="refresh-cw"></i> Sincronizando...';
    lucide.createIcons();

    let successCount = 0;
    const itemsToSync = [...offlineQueue];

    try {
        for (const cedula of itemsToSync) {
            try {
                await axios.post('/api/v1/alumnos/marcar-asistencia/',
                    { cedula: cedula },
                    { headers: { Authorization: `Token ${token}` } }
                );
                successCount++;
                // Eliminar de la cola local tras éxito
                offlineQueue = offlineQueue.filter(item => item !== cedula);
            } catch (e) {
                console.error(`Error sincronizando ${cedula}:`, e);
            }
        }

        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
        updateOfflineUI();

        if (successCount > 0) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            Toast.fire({
                icon: 'success',
                title: `Sincronizados ${successCount} registros con el servidor.`
            });
            // Refrescar datos finales desde el servidor
            refreshData();
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
};

// --- HELPER: Descarga Segura para PWA (Blob + Web Share) ---
// Moved to base.html for global access

window.updateOfflineUI = function () {
    const container = document.getElementById('offline-sync-container');
    const countEl = document.getElementById('offline-count');
    const btnSync = document.getElementById('btn-sync-manual');
    const statusLabel = document.getElementById('offline-status-label');

    if (!container || !countEl || !btnSync) return;

    const isOffline = !navigator.onLine;
    const hasPending = offlineQueue.length > 0;
    const syncBox = container.querySelector('div.p-4');

    if (isOffline || hasPending) {
        container.classList.remove('hidden');
        countEl.textContent = offlineQueue.length;

        if (isOffline) {
            // Priority 1: OFFLINE (Orange)
            if (syncBox) syncBox.className = "bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between gap-4";
            if (statusLabel) {
                statusLabel.textContent = 'MODO OFFLINE ACTIVADO';
                statusLabel.className = "text-[10px] font-black text-unemi-orange uppercase tracking-widest";
            }
            btnSync.classList.add('hidden');
        } else {
            // Priority 2: PENDING SYNC (Green)
            if (syncBox) syncBox.className = "bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4";
            if (statusLabel) {
                statusLabel.textContent = 'SINCRONIZACIÓN PENDIENTE';
                statusLabel.className = "text-[10px] font-black text-emerald-500 uppercase tracking-widest";
            }
            btnSync.classList.remove('hidden');

            if (offlineMode && !token) {
                btnSync.innerHTML = '<i data-lucide="log-in" class="w-3 h-3"></i> Login para Sinc';
                btnSync.className = "flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm";
                btnSync.onclick = () => {
                    localStorage.removeItem('offline_mode');
                    window.location.href = '/login/';
                };
            } else {
                btnSync.innerHTML = '<i data-lucide="refresh-ccw" class="w-3 h-3"></i> Sincronizar';
                btnSync.className = "flex items-center gap-1.5 px-3 py-1.5 bg-unemi-orange text-white rounded-lg text-xs font-bold hover:bg-unemi-orange/90 transition-colors shadow-sm";
                btnSync.onclick = () => syncOfflineScans();
            }
        }
        if (window.lucide) lucide.createIcons();
    } else {
        container.classList.add('hidden');
    }
};
