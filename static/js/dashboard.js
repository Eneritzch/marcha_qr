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

    // SYNC USER: If window.user is present (from fallback), update localStorage
    // This fixes the issue where localStorage has stale data lacking lider_profile
    if (window.user && window.user.id) {

        // Merge seamlessly
        const merged = { ...user, ...window.user };
        localStorage.setItem('user', JSON.stringify(merged));
        // Update current reference if needed
        Object.assign(user, merged);
    }

    // Show "Config. Certificados" and "Mi Certificado" based on Token Permissions
    // Show "Config. Certificados" and "Mi Certificado" based on Token Permissions


    // Helper to show element
    const showEl = (id, displayType = 'flex') => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = displayType;
            el.classList.remove('hidden'); // Just in case
        }
    };

    if (user.is_superuser || user.is_staff) {
        // Show Config Certs
        showEl('sidebar-nav-certificados');
        const mobCert = document.getElementById('mobile-nav-certificados');
        if (mobCert) {
            const wrapper = mobCert.closest('.nav-item-wrapper');
            if (wrapper) {
                wrapper.style.display = 'flex';
                wrapper.classList.remove('hidden');
            }
        }
    }

    if (user.is_superuser || user.is_staff || user.lider_profile) {
        // Show Mi Certificado
        showEl('sidebar-nav-mi-certificado');
        const mobMiCert = document.getElementById('mobile-nav-mi-certificado');
        if (mobMiCert) {
            const wrapper = mobMiCert.closest('.nav-item-wrapper');
            if (wrapper) {
                wrapper.style.display = 'flex';
                wrapper.classList.remove('hidden');
            }
        }
    }

    // Hide "Registrar Manual" if not admin
    if (!user.is_superuser) {
        // Hide in sidebar
        const sidebarBtn = document.getElementById('sidebar-nav-registrar-manual');
        if (sidebarBtn) sidebarBtn.style.display = 'none';

        // Hide in mobile nav
        const mobileNav = document.getElementById('mobile-nav-registrar-manual');
        if (mobileNav) {
            const wrapper = mobileNav.closest('.nav-item-wrapper');
            if (wrapper) wrapper.style.display = 'none';
        }

        // Hide Control de Escaneo in sidebar
        const controlBtn = document.getElementById('sidebar-nav-control-escaneo');
        if (controlBtn) controlBtn.style.display = 'none';

        // Hide Control de Escaneo in mobile nav
        const mobileControlNav = document.getElementById('mobile-nav-control-escaneo');
        if (mobileControlNav) {
            const wrapperControl = mobileControlNav.closest('.nav-item-wrapper');
            if (wrapperControl) wrapperControl.style.display = 'none';
        }


    }

    // Initial Fetch & View Restore
    let lastView = localStorage.getItem('lastView');

    // REDIRECT STRATEGY:
    // If user is a LEADER (and not superuser/staff) and no specific view is saved, OR if they are at overview,
    // force them to 'mi-certificado'.
    if (!user.is_superuser && !user.is_staff && user.lider_profile) {
        if (!lastView || lastView === 'overview') {
            lastView = 'mi-certificado';
        }
    }

    // Fallback to overview if nothing else
    if (!lastView) lastView = 'overview';

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

// === SECURITY UTILS ===
const escapeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

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
    const views = ['overview', 'scanner', 'registrar-manual', 'registros', 'lideres', 'importar-exportar', 'control-escaneo', 'sorteos', 'certificados', 'mi-certificado'];

    // Prevent non-admin users from accessing restricted views


    // Save state
    localStorage.setItem('lastView', viewName);

    // Hide all views and reset styles globally for better reliability
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        if (viewEl) viewEl.classList.add('hidden');
    });

    // Aggressive Reset: Remove 'sidebar-item-active' from ANY element that has it
    Array.from(document.getElementsByClassName('sidebar-item-active')).forEach(el => {
        el.classList.remove('sidebar-item-active');
        el.classList.add('text-slate-300');
    });

    // Reset Mobile Nav Styles (Global clearing)
    document.querySelectorAll('.nav-item-wrapper').forEach(wrapper => {
        wrapper.classList.remove('-top-5');
        const btn = wrapper.querySelector('button');
        if (btn) {
            btn.classList.add('text-slate-400');
            btn.classList.remove(
                'bg-unemi-orange', 'text-white', 'w-14', 'h-14',
                'shadow-lg', 'shadow-orange-500/30', 'border-4', 'border-white', 'justify-center'
            );
            const label = btn.querySelector('span');
            if (label) label.classList.remove('hidden');
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
    const activeMobileWrapper = document.querySelector(`.nav-item-wrapper[data-target="${viewName}"]`);
    if (activeMobileWrapper) {
        const btn = activeMobileWrapper.querySelector('button');
        const label = btn ? btn.querySelector('span') : null;

        activeMobileWrapper.classList.add('-top-5');
        if (btn) {
            btn.classList.remove('text-slate-400');
            btn.classList.add(
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
        }
        if (label) label.classList.add('hidden');

        // Scroll active item into view for mobile nav
        activeMobileWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Header Title Update
    const titles = {
        'overview': 'Resumen General',
        'scanner': 'Escanear Asistencia',
        'registros': 'Base de Registros',
        'lideres': 'Gestión de Líderes',
        'importar-exportar': 'Importar/Exportar Datos',
        'control-escaneo': 'Control de Escaneo',
        'certificados': 'Configuración de Certificados'
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
    } else if (viewName === 'control-escaneo') {
        fetchScanConfig();
    } else if (viewName === 'scanner') {
        checkScannerPhase();

    } else if (viewName === 'certificados') {
        fetchCertificateConfig();
    } else if (viewName === 'mi-certificado') {
        loadLeaderCertificateView();
    }

    lucide.createIcons();
}

// === DATA FETCHING ===


function updateKPIs() {
    if (!allAlumnos) return;
    const total = allAlumnos.length;
    // Use the flag we set in backend
    const certificados = allAlumnos.filter(a => a.certificado_entregado).length;

    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    safeSet('kpi-total', total);
    safeSet('kpi-certificados', certificados);
}

// === DATA TABLES STATE ===
let currentRegistrosPage = 1;
const registrosPageSize = 50;

// === TABLES ===




// === DATA FETCHING ===
window.refreshData = async function () {
    // Renderización inmediata desde caché para UX instantánea y modo offline
    if (allAlumnos && allAlumnos.length > 0) {
        updateKPIs();

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
                     <button onclick="openLiderModal('${l.id}')" class="p-2 text-unemi-blue hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
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

// === REGISTROS TABLE LOGIC ===
let currentRegistrosSearch = '';
let currentRegistrosGroupFilter = 'all';

// Bind Events for Registros
document.addEventListener('DOMContentLoaded', () => {
    safeBind('search-registros', 'input', (e) => filterRegistros(e.target.value));
    safeBind('filter-registros-grupo', 'change', (e) => {
        currentRegistrosGroupFilter = e.target.value;
        filterRegistros(document.getElementById('search-registros').value);
    });

    // Pagination
    safeBind('btn-prev-page', 'click', () => {
        if (currentRegistrosPage > 1) {
            currentRegistrosPage--;
            renderRegistrosTable(allAlumnos, true); // true = use current filters
        }
    });

    safeBind('btn-next-page', 'click', () => {
        const totalPages = Math.ceil(getFilteredRegistros().length / registrosPageSize);
        if (currentRegistrosPage < totalPages) {
            currentRegistrosPage++;
            renderRegistrosTable(allAlumnos, true);
        }
    });
});

function getFilteredRegistros() {
    if (!allAlumnos) return [];

    const q = currentRegistrosSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const group = currentRegistrosGroupFilter;

    return allAlumnos.filter(a => {
        const nameNorm = (a.nombre_completo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cedula = (a.cedula || '').toString();

        const matchesSearch = nameNorm.includes(q) || cedula.includes(q);
        const matchesGroup = group === 'all' || (a.grupo || 0).toString() === group;

        return matchesSearch && matchesGroup;
    });
}

// === MODAL LOGIC: ESTUDIANTES ===
window.openStudentModal = function (student) {

    if (student) {
        // EDIT MODE
        document.getElementById('edit-student-cedula').value = student.cedula;
        document.getElementById('edit-student-cedula').disabled = true;
        document.getElementById('edit-student-nombre').value = student.nombre_completo;
        document.getElementById('edit-student-grupo').value = student.grupo || 0;
        document.getElementById('edit-student-email').value = student.email || '';
        document.getElementById('edit-student-telefono').value = student.telefono || '';
    } else {
        // CREATE MODE
        document.getElementById('edit-student-cedula').value = '';
        document.getElementById('edit-student-cedula').disabled = false;
        document.getElementById('edit-student-nombre').value = '';
        document.getElementById('edit-student-grupo').value = '0';
        document.getElementById('edit-student-email').value = '';
        document.getElementById('edit-student-telefono').value = '';
    }

    const modal = document.getElementById('student-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        console.error("FATAL: #student-modal not found");
    }
}

// Alias for backward compatibility
window.openStudentEdit = window.openStudentModal;

window.closeStudentModal = function () {
    const modal = document.getElementById('student-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

window.saveStudent = async function () {
    const cedula = document.getElementById('edit-student-cedula').value;
    const nombre = document.getElementById('edit-student-nombre').value;
    const grupo = parseInt(document.getElementById('edit-student-grupo').value);
    const email = document.getElementById('edit-student-email').value;
    const telefono = document.getElementById('edit-student-telefono').value;

    // Check if we are editing (ID disabled) or creating (ID enabled)
    const isEdit = document.getElementById('edit-student-cedula').disabled;

    if (!nombre || !cedula) {
        alert("El nombre y la cédula son obligatorios");
        return;
    }

    try {
        window.showLoader();

        let response;
        if (isEdit) {
            // UDPATE
            response = await axios.patch(`/api/v1/alumnos/alumnos/${cedula}/`, {
                nombre_completo: nombre,
                grupo: grupo,
                email: email,
                telefono: telefono
            }, {
                headers: { Authorization: `Token ${token}` }
            });

            // Update local cache
            const idx = allAlumnos.findIndex(a => a.cedula === cedula);
            if (idx !== -1) {
                allAlumnos[idx].nombre_completo = response.data.nombre_completo;
                allAlumnos[idx].grupo = response.data.grupo;
                allAlumnos[idx].email = response.data.email;
                allAlumnos[idx].telefono = response.data.telefono;
            }
            showSuccessToast('Estudiante actualizado');
        } else {
            // CREATE
            try {
                response = await axios.post(`/api/v1/alumnos/alumnos/`, {
                    cedula: cedula,
                    nombre_completo: nombre,
                    grupo: grupo,
                    email: email,
                    telefono: telefono
                }, {
                    headers: { Authorization: `Token ${token}` }
                });

                allAlumnos.push(response.data);
                showSuccessToast('Estudiante registrado');
            } catch (e) {
                if (e.response && e.response.status === 400 && e.response.data.cedula) {
                    throw new Error("Ya existe un estudiante con esa cédula.");
                }
                throw e;
            }
        }

        localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));
        renderRegistrosTable(allAlumnos, true);
        closeStudentModal();

    } catch (e) {
        console.error(e);
        showErrorAlert(e.message || 'Error al guardar cambios');
    } finally {
        window.hideLoader();
    }
}

// === MODAL LOGIC: LÍDERES ===
// === MODAL LOGIC: LÍDERES ===
window.openLiderModal = function (id) {
    if (id) {
        // EDIT MODE
        const lider = allLideres.find(l => l.id == id);
        if (!lider) {
            console.error("Leader not found:", id);
            return;
        }

        document.getElementById('edit-lider-id').value = lider.id;
        document.getElementById('edit-lider-nombre').value = lider.nombre_completo;
        document.getElementById('edit-lider-grupo').value = lider.grupo;
        document.getElementById('edit-lider-email').value = lider.email || '';
        document.getElementById('edit-lider-activo').checked = lider.activo;
    } else {
        // CREATE MODE
        document.getElementById('edit-lider-id').value = '';
        document.getElementById('edit-lider-nombre').value = '';
        document.getElementById('edit-lider-grupo').value = '0';
        document.getElementById('edit-lider-email').value = '';
        document.getElementById('edit-lider-activo').checked = true;
    }

    const modal = document.getElementById('lider-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Force visibility
    }
}

window.closeLiderModal = function () {
    const modal = document.getElementById('lider-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

window.saveLider = async function () {
    const id = document.getElementById('edit-lider-id').value;
    const nombre = document.getElementById('edit-lider-nombre').value;
    const grupo = parseInt(document.getElementById('edit-lider-grupo').value);
    const email = document.getElementById('edit-lider-email').value;
    const activo = document.getElementById('edit-lider-activo').checked;

    if (!nombre) {
        alert("El nombre es obligatorio");
        return;
    }

    try {
        window.showLoader();

        let response;
        if (id) {
            // UPDATE
            response = await axios.patch(`/api/v1/lideres/lideres/${id}/`, {
                nombre_completo: nombre,
                grupo: grupo,
                email: email,
                activo: activo
            }, {
                headers: { Authorization: `Token ${token}` }
            });

            // Update local cache
            const idx = allLideres.findIndex(l => l.id == id);
            if (idx !== -1) {
                allLideres[idx] = response.data;
                allLideres[idx].grupo = grupo;
            }
            showSuccessToast('Líder actualizado');
        } else {
            // CREATE
            response = await axios.post(`/api/v1/lideres/lideres/`, {
                nombre_completo: nombre,
                grupo: grupo,
                email: email,
                activo: activo,
                visible: true
            }, {
                headers: { Authorization: `Token ${token}` }
            });
            allLideres.push(response.data);
            showSuccessToast('Líder creado');
        }

        localStorage.setItem('allLideres', JSON.stringify(allLideres));
        renderLideresTable(allLideres);
        closeLiderModal();
        updateKPIs();

    } catch (e) {
        console.error(e);
        showErrorAlert('Error al guardar cambios');
    } finally {
        window.hideLoader();
    }
}

function filterRegistros(query) {
    currentRegistrosSearch = query || '';
    currentRegistrosPage = 1; // Reset to first page
    renderRegistrosTable(allAlumnos, true);
}

window.renderRegistrosTable = function (data, useFilters = false) {
    const tbody = document.getElementById('tbody-registros');
    const countLabel = document.getElementById('registros-count');

    if (!tbody) return; // Guard clause if view isn't active/present yet
    tbody.innerHTML = '';

    let localData = useFilters ? getFilteredRegistros() : (data || []);

    const totalRecords = localData.length;
    const totalPages = Math.ceil(totalRecords / registrosPageSize);

    // Pagination Slicing
    const startIndex = (currentRegistrosPage - 1) * registrosPageSize;
    const endIndex = startIndex + registrosPageSize;
    const pageData = localData.slice(startIndex, endIndex);

    // Update Footer
    if (countLabel) {
        countLabel.textContent = `Mostrando ${Math.min(endIndex, totalRecords)} de ${totalRecords} registros (Página ${currentRegistrosPage} de ${totalPages || 1})`;
    }

    // Update Buttons
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    if (btnPrev) btnPrev.disabled = currentRegistrosPage === 1;
    if (btnNext) btnNext.disabled = currentRegistrosPage >= totalPages || totalPages === 0;

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No se encontraron registros.</td></tr>`;
        return;
    }

    pageData.forEach((a, index) => {
        const globalIndex = startIndex + index + 1;

        // Group Color Logic
        let groupBadge = '';
        if (a.grupo === 0 || !a.grupo) {
            groupBadge = `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[10px]">SIN GRUPO</span>`;
        } else {
            groupBadge = `<span class="px-2 py-0.5 rounded bg-blue-50 text-unemi-blue font-black text-[10px] border border-blue-100">GRUPO ${a.grupo}</span>`;
        }

        // Status Badge (Asistió vs Pendiente vs Offline)
        let statusBadge = '';
        if (a.asistio) {
            statusBadge = `<span class="flex items-center justify-center gap-1 text-emerald-600 font-bold"><i data-lucide="check-circle-2" class="w-3 h-3"></i> Asistió</span>`;
        } else if (a.ha_iniciado) {
            statusBadge = `<span class="flex items-center justify-center gap-1 text-orange-500 font-bold" title="Solo inicio marcado"><i data-lucide="clock" class="w-3 h-3"></i> En Marcha</span>`;
        } else {
            statusBadge = `<span class="text-slate-300 font-bold">-</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'bg-white hover:bg-slate-50 transition-colors group';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center font-bold text-slate-400">${globalIndex}</td>
            <td class="px-4 py-3 font-bold text-slate-700">
                ${a.nombre_completo}
                ${a.lider_nombre ? `<div class="text-[9px] text-slate-400 font-normal">Líder: ${a.lider_nombre}</div>` : ''}
            </td>
            <td class="px-4 py-3 font-mono text-slate-500 select-all">${a.cedula}</td>
            <td class="px-4 py-3 text-center">${groupBadge}</td>
            <td class="px-4 py-3 text-center text-[10px] uppercase tracking-wider">${statusBadge}</td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <!-- Edit -->
                    <button onclick='openStudentEdit(${JSON.stringify(a).replace(/'/g, "&#39;")})' class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <!-- WhatsApp (if phone exists) -->
                    ${a.telefono ? `
                    <a href="https://wa.me/${a.telefono}" target="_blank" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="WhatsApp">
                        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>` : ''}
                    <!-- Delete (Admin Only) -->
                     ${user.is_superuser ? `
                    <button onclick="eliminarEntidad('alumno', '${a.cedula}', '${a.nombre_completo}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Re-init icons for new elements
    if (window.lucide) lucide.createIcons();
};

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







// Leader Search inside Student Edit





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

        const resData = response.data;
        const alumno = resData.alumno;
        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
        if (idx !== -1) {
            allAlumnos[idx].asistio = true;
            localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos)); // Mantener local sincronizado
            updateKPIs();
        }

        return {
            ...alumno,
            message: resData.message
        };
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

                        const resData = response.data;
                        const alumno = resData.alumno;
                        const idx = allAlumnos.findIndex(a => a.cedula === alumno.cedula);
                        if (idx !== -1) {
                            allAlumnos[idx].asistio = true;
                            localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));
                            updateKPIs();
                        }
                        return {
                            ...alumno,
                            message: resData.message
                        };
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

    // Identificar fase actual (Prioridad: localStorage (caché) -> DOM -> Default)
    let faseActual = localStorage.getItem('lastScanPhase') || 'INICIO';
    const badgeContainer = document.getElementById('status-badge-container');
    if (badgeContainer) {
        const text = badgeContainer.textContent.toLowerCase();
        if (text.includes('fin')) faseActual = 'FIN';
    }

    // 2. Verificar duplicados locales por fase
    if (faseActual === 'INICIO' && alumnoLocal.ha_iniciado) {
        return {
            nombre: alumnoLocal.nombre_completo,
            already_marked: true,
            offline: true,
            message: "Ya fue registrado en esta etapa (Inicio). Intente nuevamente escanear."
        };
    }
    if (faseActual === 'FIN' && alumnoLocal.ha_finalizado) {
        return {
            nombre: alumnoLocal.nombre_completo,
            already_marked: true,
            offline: true,
            message: "Ya fue registrado en esta etapa (Fin). Intente nuevamente escanear."
        };
    }

    // Validación de secuencia: No puede marcar FIN si no ha INICIADO (incluso offline)
    if (faseActual === 'FIN' && !alumnoLocal.ha_iniciado) {
        throw new Error(`El estudiante ${alumnoLocal.nombre_completo} NO registró su inicio de marcha. No se puede registrar su llegada offline.`);
    }

    // 3. Añadir a la cola offline con metadatos de fase
    // Guardamos objeto en lugar de solo cédula para saber qué fase era
    const scanData = { cedula: alumnoLocal.cedula, fase: faseActual, timestamp: new Date().toISOString() };

    // Evitar duplicados exactos en la cola
    const isDuplicateInQueue = offlineQueue.some(q => q.cedula === scanData.cedula && q.fase === scanData.fase);
    if (!isDuplicateInQueue) {
        offlineQueue.push(scanData);
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    }

    // 4. Marcar visualmente en el JSON local para feedback inmediato
    const idx = allAlumnos.findIndex(a => a.cedula === alumnoLocal.cedula);
    if (idx !== -1) {
        if (faseActual === 'INICIO') {
            allAlumnos[idx].ha_iniciado = true;
        } else {
            allAlumnos[idx].ha_finalizado = true;
            allAlumnos[idx].asistio = true;
        }
        localStorage.setItem('allAlumnos', JSON.stringify(allAlumnos));

        // --- ACTUALIZAR LÍDER LOCALMENTE ---
        // (Similar logic but we only count 'asistio' if it's FIN)
        if (faseActual === 'FIN') {
            const liderId = alumnoLocal.lider_invitador;
            if (liderId) {
                const lIdx = allLideres.findIndex(l => l.id == liderId);
                if (lIdx !== -1) {
                    allLideres[lIdx].total_asistencias = (allLideres[lIdx].total_asistencias || 0) + 1;
                    localStorage.setItem('allLideres', JSON.stringify(allLideres));
                }
            }
        }

        // --- ACTUALIZAR TODA LA UI ---
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
        offline: true,
        message: faseActual === 'INICIO' ? "Inicio Guardado Localmente" : "Llegada Guardada Localmente"
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
        for (const item of itemsToSync) {
            // El item ahora es un objeto {cedula, fase}
            const scanCedula = typeof item === 'string' ? item : item.cedula;
            // Si es un string viejo, asumimos que el server lo manejará (probablemente sea INICIO por defecto)

            try {
                await axios.post('/api/v1/alumnos/marcar-asistencia/',
                    { cedula: scanCedula }, // El server ya sabe la fase actual, pero si quisiéramos forzarla, la enviaríamos aquí
                    { headers: { Authorization: `Token ${token}` } }
                );
                successCount++;
                // Eliminar de la cola local tras éxito (comparación exacta)
                offlineQueue = offlineQueue.filter(q => {
                    const qCedula = typeof q === 'string' ? q : q.cedula;
                    return qCedula !== scanCedula;
                });
            } catch (e) {
                console.error(`Error sincronizando ${scanCedula}:`, e);
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



// === CONTROL DE ESCANEO LOGIC ===

window.fetchScanConfig = async function () {
    if (!user.is_superuser) return;

    try {
        const response = await axios.get('/api/v1/lideres/config-escaneo/', {
            headers: { 'Authorization': `Token ${token}` }
        });

        const data = response.data;
        // Caché de fase para modo offline
        localStorage.setItem('lastScanPhase', data.fase);
        renderScanControlUI(data);
    } catch (error) {
        console.error("Error al obtener configuración de escaneo:", error);
        // Fallback offline: Renderizar con caché si existe
        const cachedPhase = localStorage.getItem('lastScanPhase');
        if (cachedPhase) {
            renderScanControlUI({ fase: cachedPhase, stats: { ha_iniciado: '--', ha_finalizado: '--' } });
        }
    }
}

function renderScanControlUI(data) {
    const badgeContainer = document.getElementById('status-badge-container');
    const statsInicio = document.getElementById('ctrl-stats-inicio');
    const statsFin = document.getElementById('ctrl-stats-fin');

    if (!badgeContainer) return;

    // Update Stats
    if (statsInicio) statsInicio.textContent = data.stats.ha_iniciado;
    if (statsFin) statsFin.textContent = data.stats.ha_finalizado;

    // Update Badge
    let badgeHTML = '';
    const fase = data.fase;

    if (fase === 'CERRADO') {
        badgeHTML = `
            <span class="px-4 py-2 bg-red-100 text-red-600 rounded-full font-bold text-sm flex items-center gap-2">
                <i data-lucide="lock" class="w-4 h-4"></i> Escaneo Cerrado
            </span>
        `;
    } else if (fase === 'INICIO') {
        badgeHTML = `
            <span class="px-4 py-2 bg-orange-100 text-unemi-orange rounded-full font-bold text-sm flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-unemi-orange animate-pulse"></span>
                Registro de Inicio Activo
            </span>
        `;
    } else if (fase === 'FIN') {
        badgeHTML = `
            <span class="px-4 py-2 bg-green-100 text-green-600 rounded-full font-bold text-sm flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Registro de Fin Activo
            </span>
        `;
    }

    badgeContainer.innerHTML = badgeHTML;

    // Highlight active card
    document.querySelectorAll('.phase-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-unemi-orange/20', 'border-unemi-orange/50', 'bg-white');
        card.classList.add('bg-slate-50', 'border-slate-100');

        const cardTitle = card.querySelector('h4').textContent;
        if ((fase === 'CERRADO' && cardTitle.includes('Cerrar')) ||
            (fase === 'INICIO' && cardTitle.includes('Inicio')) ||
            (fase === 'FIN' && cardTitle.includes('Fin'))) {
            card.classList.add('ring-4', 'ring-unemi-orange/20', 'border-unemi-orange/50', 'bg-white');
            card.classList.remove('bg-slate-50', 'border-slate-100');
        }
    });

    lucide.createIcons();
}

window.updateScanPhase = async function (newPhase) {
    const confirm = await Swal.fire({
        title: '¿Cambiar fase de escaneo?',
        text: `El sistema pasará a la fase de: ${newPhase === 'CERRADO' ? 'Cierre Total' : newPhase}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0F1E4B',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        showLoader();
        try {
            await axios.post('/api/v1/lideres/config-escaneo/', { fase: newPhase }, {
                headers: { 'Authorization': `Token ${token}` }
            });

            await fetchScanConfig();

            Swal.fire({
                title: '¡Fase Actualizada!',
                text: 'El estado del sistema ha sido modificado correctamente.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Error', 'No se pudo cambiar la fase del sistema.', 'error');
        } finally {
            hideLoader();
        }
    }
}

window.checkScannerPhase = async function () {
    let fase = localStorage.getItem('lastScanPhase');

    try {
        const response = await axios.get('/api/v1/lideres/config-escaneo/', {
            headers: { 'Authorization': `Token ${token}` }
        });
        fase = response.data.fase;
        localStorage.setItem('lastScanPhase', fase);
    } catch (error) {
        console.warn("Fase de escaneo leída desde caché local.");
    }

    const overlay = document.getElementById('scanner-lock-overlay');
    if (!overlay) return;

    if (fase === 'CERRADO') {
        overlay.classList.remove('hidden');
        if (window.DashboardScanner) DashboardScanner.stop();
    } else {
        overlay.classList.add('hidden');
    }
}



// === CERTIFICATE CONFIG LOGIC ===

window.fetchCertificateConfig = async function () {
    if (!user.is_superuser) return;

    try {
        window.showLoader && window.showLoader();
        const response = await axios.get('/api/v1/certificados/config/', {
            headers: { 'Authorization': `Token ${token}` }
        });

        const config = response.data;

        // Populate inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('cert-titulo', config.titulo_certificado);
        setVal('cert-subtitulo', config.subtitulo);
        setVal('cert-texto', config.texto_cuerpo);

        // Leader Messages
        setVal('cert-lider-titulo', config.mensaje_lideres_titulo);
        setVal('cert-lider-cuerpo', config.mensaje_lideres_cuerpo);
        setVal('cert-lider-texto-cert', config.texto_certificado_lideres);

        setVal('cert-firma1-nombre', config.firma_1_nombre);
        setVal('cert-firma1-cargo', config.firma_1_cargo);
        setVal('cert-firma2-nombre', config.firma_2_nombre);
        setVal('cert-firma2-cargo', config.firma_2_cargo);
        setVal('cert-firma3-nombre', config.firma_3_nombre);
        setVal('cert-firma3-cargo', config.firma_3_cargo);

        // Preview Images
        const showPreview = (id, url) => {
            const container = document.getElementById(id);
            if (!container) return;

            if (url) {
                container.classList.remove('hidden');
                container.querySelector('img').src = url;
            } else {
                container.classList.add('hidden');
            }
        };

        showPreview('cert-firma1-preview', config.firma_1_imagen);
        showPreview('cert-firma2-preview', config.firma_2_imagen);
        showPreview('cert-firma3-preview', config.firma_3_imagen);

        showPreview('cert-logo1-preview', config.logo_izquierda);
        showPreview('cert-logo2-preview', config.logo_centro);
        showPreview('cert-logo3-preview', config.logo_derecha);

    } catch (error) {
        console.error("Error fetching cert config:", error);
        // No alert here to avoid spam if it fails silently or 404 on first run
    } finally {
        window.hideLoader && window.hideLoader();
    }
}

// Bind form submission
document.addEventListener('DOMContentLoaded', () => {
    const certForm = document.getElementById('certificados-config-form');
    if (certForm) {
        certForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                window.showLoader && window.showLoader();

                const formData = new FormData(certForm);

                await axios.put('/api/v1/certificados/config/', formData, {
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                Swal.fire({
                    title: '¡Guardado!',
                    text: 'La configuración del certificado ha sido actualizada.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                // Refresh to show updated images
                fetchCertificateConfig();

            } catch (error) {
                console.error("Error saving cert config:", error);
                Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
            } finally {
                window.hideLoader && window.hideLoader();
            }
        });
    }

    // File Input Previews
    const setupFilePreview = (inputId, previewId) => {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        // Create preview container if needed (mostly for logos if we add them later)

        if (!input) return;

        input.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    if (preview) {
                        preview.classList.remove('hidden');
                        const img = preview.querySelector('img');
                        if (img) img.src = e.target.result;
                    }
                }
                reader.readAsDataURL(file);
            }
        });
    };

    setupFilePreview('cert-firma1-img', 'cert-firma1-preview');
    setupFilePreview('cert-firma2-img', 'cert-firma2-preview');
    setupFilePreview('cert-firma3-img', 'cert-firma3-preview');
    setupFilePreview('cert-logo1', 'cert-logo1-preview');
    setupFilePreview('cert-logo2', 'cert-logo2-preview');
    setupFilePreview('cert-logo3', 'cert-logo3-preview');
});


window.loadLeaderCertificateView = async function () {
    try {
        window.showLoader && window.showLoader();

        // 1. Fetch Config Message
        const response = await axios.get('/api/v1/certificados/leader-info/', {
            headers: { 'Authorization': `Token ${token}` }
        });

        const data = response.data;
        const container = document.getElementById('view-mi-certificado');
        const msgTitle = document.getElementById('lider-msg-title');
        const msgBody = document.getElementById('lider-msg-body');

        // Check if user is eligible for a certificate
        if (!data.has_cedula) {
            msgTitle.textContent = 'Certificado No Disponible';
            msgBody.textContent = 'Tu usuario no tiene un perfil de líder asociado o no es elegible para certificado en este momento.';
            // Hide download/preview elements (iframe and button)
            if (container) {
                const iframe = container.querySelector('iframe');
                const btn = container.querySelector('a');
                if (iframe) iframe.style.display = 'none';
                if (btn) btn.style.display = 'none';
            }
            return;
        }

        // Show standard message
        msgTitle.textContent = data.titulo || '¡Gracias!';
        msgBody.textContent = data.cuerpo || '';

        // 2. Set Iframe Source & Download Link
        // Using identifier (email) to allow public-style lookup and avoid session issues
        // We use the identifier if provided, fallback to 'mi-certificado' (which requires session)
        const identifier = data.identifier;
        if (!identifier) {
            console.error("No identifier for certificate");
            return;
        }

        if (container) {
            const iframe = container.querySelector('iframe');
            const btn = container.querySelector('a');

            // Ensure visible
            if (iframe) {
                iframe.style.display = 'block';
                iframe.src = `/api/v1/certificados/descargar/${identifier}/?preview=true`;
            }
            if (btn) {
                btn.style.display = 'inline-flex'; // Restore default flex
                btn.href = `/api/v1/certificados/descargar/${identifier}/`;
            }
        }

    } catch (error) {
        console.error("Error loading leader cert info:", error);
        const msgTitle = document.getElementById('lider-msg-title');
        const msgBody = document.getElementById('lider-msg-body');
        if (msgTitle) msgTitle.textContent = 'Error';
        if (msgBody) msgBody.textContent = 'No se pudo cargar la información del certificado.';
    } finally {
        window.hideLoader && window.hideLoader();
    }
}


