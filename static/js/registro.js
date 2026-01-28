document.addEventListener('DOMContentLoaded', async () => {
    // === STATE ===
    let currentStep = 1;
    const totalSteps = 3;
    let leadersData = {}; // Cache leaders

    // === ELEMENTS ===
    const btnNext = document.getElementById('next-btn');
    const btnPrev = document.getElementById('prev-btn');
    const btnSubmit = document.getElementById('submit-btn');
    const progressBar = document.getElementById('progress-bar');

    // === ACADEMIC DATA LOAD (Wait for module) ===
    if (window.ACADEMIC_DATA) {
        initAcademicFilters();
    } else {
        window.addEventListener('academicDataReady', initAcademicFilters);
    }

    // === REAL-TIME VALIDATION ===
    const cedulaInput = document.getElementById('input-cedula');
    cedulaInput.addEventListener('blur', async () => {
        const val = cedulaInput.value;
        if (val.length === 10) {
            try {
                // Check duplicate
                // Use a filter lookup or specific check if available. 
                // For now, we trust the submit, but we can prevent obvious formatting errors here.
                if (!/^\d+$/.test(val)) {
                    showFieldFeedback(cedulaInput, false, "Solo se permiten números");
                    return;
                }
                showFieldFeedback(cedulaInput, true); // Visual valid
            } catch (e) { }
        } else {
            if (val.length > 0) showFieldFeedback(cedulaInput, false, "Debe tener 10 dígitos");
        }
    });

    function showFieldFeedback(input, isValid, msg = "") {
        if (isValid) {
            input.classList.remove('border-red-500', 'ring-red-500');
            input.classList.add('border-green-500', 'ring-green-500');
        } else {
            input.classList.remove('border-green-500', 'ring-green-500');
            input.classList.add('border-red-500', 'ring-red-500');
            // Optional: Show msg tooltip
        }
    }

    // === LOAD LEADERS & CUSTOM SEARCH ===
    let allLeaders = []; // Flat array

    try {
        const res = await axios.get('/api/v1/lideres/activos/');
        // Structure is { "1": [leader, ...], "2": ... }
        Object.values(res.data).flat().forEach(l => {
            allLeaders.push(l);
            leadersData[l.id] = l; // Keep cache map
        });
    } catch (e) {
        console.error("Error loading leaders", e);
    }

    // Elements
    const searchInput = document.getElementById('lider-search');
    const hiddenInput = document.getElementById('lider-select'); // This is now a hidden input
    const dropdown = document.getElementById('lider-dropdown');
    const clearBtn = document.getElementById('clear-search');
    const param = document.getElementById('grupo-preview');

    // Search Event
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();

        // Show/Hide Clear Button
        clearBtn.classList.toggle('hidden', q.length === 0);

        if (q.length < 1) { // Show all if empty? Or wait? User said "Escribe". Let's show if > 0. Actually user prompt implies immediate usability. Let's show filtered.
            dropdown.classList.add('hidden');
            return;
        }

        const matches = allLeaders.filter(l => l.nombre_completo.toLowerCase().includes(q));
        renderDropdown(matches);
    });

    // Clear Event
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        hiddenInput.value = '';
        dropdown.classList.add('hidden');
        clearBtn.classList.add('hidden');
        param.textContent = '--';
        param.className = 'text-3xl font-black text-slate-300';
    });

    function renderDropdown(matches) {
        dropdown.innerHTML = '';
        if (matches.length === 0) {
            dropdown.innerHTML = `<div class="p-4 text-center text-slate-400 text-sm">No se encontraron resultados</div>`;
        } else {
            matches.forEach(l => {
                const item = document.createElement('div');
                item.className = 'p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between group';
                item.innerHTML = `
                    <span class="font-bold text-slate-700 group-hover:text-unemi-blue transition-colors">${l.nombre_completo}</span>
                    <span class="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded hidden group-hover:inline-block">Seleccionar</span>
                `;
                item.addEventListener('click', () => {
                    selectLeader(l);
                });
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.remove('hidden');
    }

    function selectLeader(leader) {
        searchInput.value = leader.nombre_completo;
        hiddenInput.value = leader.id;
        dropdown.classList.add('hidden');

        // Auto-show Group
        param.textContent = `GRUPO ${leader.grupo}`;
        param.className = 'text-3xl font-black text-unemi-orange animate-pulse';

        // Clear error style if any
        searchInput.classList.remove('border-red-500');
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Old change event (removed since we handle it in selectLeader)

    // === STEPPER LOGIC ===
    btnNext.addEventListener('click', async () => {
        if (!validateStep(currentStep)) return;

        // === BACKEND VALIDATION (STEP 1) ===
        if (currentStep === 1) {
            const cedula = document.getElementById('input-cedula').value;
            const originalContent = btnNext.innerHTML;

            try {
                btnNext.disabled = true;
                btnNext.innerHTML = `<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

                const res = await axios.post('/api/v1/alumnos/validar-cedula/', { cedula });

                if (!res.data.valid) {
                    const input = document.getElementById('input-cedula');
                    const errorMsg = res.data.error;
                    showFieldFeedback(input, false, errorMsg);

                    // Show error clearly in Toast AND Feedback box
                    showToast(errorMsg, 'error');

                    const feedback = document.getElementById('form-feedback');
                    feedback.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5 shrink-0"></i> <div>${errorMsg}</div>`;
                    feedback.classList.remove('hidden');
                    lucide.createIcons();

                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return; // STOP TRANSITION
                } else {
                    // Clear Previous Errors
                    document.getElementById('form-feedback').classList.add('hidden');
                }

            } catch (e) {
                console.error("Validation error", e);
                const errorText = e.response ? "Error del servidor. Intente más tarde." : "Error de conexión. Verifique su internet.";
                showToast(errorText, 'error');
                return;
            } finally {
                btnNext.disabled = false;
                btnNext.innerHTML = originalContent;
            }
        }

        changeStep(currentStep + 1);
    });

    btnPrev.addEventListener('click', () => {
        changeStep(currentStep - 1);
    });

    function changeStep(step) {
        // Hide details of current step
        document.getElementById(`step-${currentStep}`).classList.add('hidden');

        // Update State
        currentStep = step;

        // Show new step
        document.getElementById(`step-${currentStep}`).classList.remove('hidden');

        // Update UI Controls
        btnPrev.classList.toggle('hidden', currentStep === 1);
        btnNext.classList.toggle('hidden', currentStep === totalSteps);
        btnSubmit.classList.toggle('hidden', currentStep !== totalSteps);

        // Update Progress Bar
        const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressBar.style.width = `${percent}%`;

        // Update Circles
        document.querySelectorAll('.step-item').forEach(item => {
            const s = parseInt(item.dataset.step);
            item.classList.remove('active', 'completed');
            if (s === currentStep) item.classList.add('active');
            if (s < currentStep) item.classList.add('completed');
        });

        // Scroll top
        window.scrollTo({ top: 300, behavior: 'smooth' });
    }

    function validateStep(step) {
        const container = document.getElementById(`step-${step}`);
        const inputs = container.querySelectorAll('input, select');
        let valid = true;

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value) {
                valid = false;
                input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                // Shake effect
                input.parentElement.classList.add('animate-shake');
                setTimeout(() => input.parentElement.classList.remove('animate-shake'), 500);
            } else {
                input.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
            }
        });

        if (!valid) {
            showToast("Por favor complete todos los campos obligatorios.", 'error');
        }
        return valid;
    }

    // === ACADEMIC FILTERS ===
    function initAcademicFilters() {
        if (!window.ACADEMIC_DATA) return;

        const data = window.ACADEMIC_DATA;
        const selModalidad = document.getElementById('modalidad-select');
        const selFacultad = document.getElementById('facultad-select');
        const selCarrera = document.getElementById('carrera-select');

        // Populate Modalities
        selModalidad.innerHTML = '<option value="">Seleccione Modalidad...</option>';
        Object.keys(data).forEach(m => {
            selModalidad.add(new Option(m, m));
        });

        // Modalidad Change
        selModalidad.addEventListener('change', () => {
            const mod = selModalidad.value;
            const facContainer = document.getElementById('facultad-container');
            const carContainer = document.getElementById('carrera-container');

            selFacultad.innerHTML = '<option value="">Seleccione Facultad...</option>';
            selCarrera.innerHTML = '<option value="">Primero seleccione Facultad...</option>';
            selFacultad.disabled = true;
            selCarrera.disabled = true;

            if (mod === 'EGRESADO') {
                if (facContainer) facContainer.classList.add('hidden');
                if (carContainer) carContainer.classList.add('hidden');
                selFacultad.innerHTML = '<option value="EGRESADO">EGRESADO</option>';
                selCarrera.innerHTML = '<option value="EGRESADO">EGRESADO</option>';
                selFacultad.value = 'EGRESADO';
                selCarrera.value = 'EGRESADO';
                return;
            } else {
                if (facContainer) facContainer.classList.remove('hidden');
                if (carContainer) carContainer.classList.remove('hidden');
            }

            if (mod && data[mod]) {
                selFacultad.disabled = false;
                Object.keys(data[mod]).forEach(f => {
                    selFacultad.add(new Option(f, f));
                });
            }
        });

        // Facultad Change
        selFacultad.addEventListener('change', () => {
            const mod = selModalidad.value;
            const fac = selFacultad.value;
            selCarrera.innerHTML = '<option value="">Seleccione Carrera...</option>';
            selCarrera.disabled = true;

            if (mod && fac && data[mod][fac]) {
                selCarrera.disabled = false;
                data[mod][fac].forEach(c => {
                    selCarrera.add(new Option(c, c));
                });
            }
        });
    }

    // === EXTERNAL CHECKBOX LOGIC ===
    const checkExterno = document.getElementById('check-externo');
    const academicFields = ['modalidad-select', 'facultad-select', 'carrera-select'];
    const academicContainers = ['facultad-container', 'carrera-container'];
    const emailInput = document.querySelector('input[name="email"]');

    checkExterno.addEventListener('change', (e) => {
        const isExterno = e.target.checked;

        // Hide/Show containers
        const containers = ['modalidad-container', 'facultad-container', 'carrera-container'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', isExterno);
        });

        academicFields.forEach(id => {
            const el = document.getElementById(id);
            if (isExterno) {
                el.removeAttribute('required');
                el.value = '';
            } else {
                el.setAttribute('required', '');
            }
        });

        if (emailInput) {
            emailInput.placeholder = isExterno ? 'usuario@ejemplo.com' : 'usuario@unemi.edu.ec';
            const label = emailInput.previousElementSibling;
            if (label) label.textContent = isExterno ? 'Correo Electrónico' : 'Correo Institucional';
        }

        // Reset academic filters if disabling
        if (isExterno) {
            const selFacultad = document.getElementById('facultad-select');
            const selCarrera = document.getElementById('carrera-select');
            if (selFacultad) selFacultad.disabled = true;
            if (selCarrera) selCarrera.disabled = true;
        }
    });

    // === BANK CHECKBOX ===
    const checkPersonal = document.getElementById('check-misma-cuenta');
    checkPersonal.addEventListener('change', (e) => {
        document.getElementById('titular-fields').classList.toggle('hidden', e.target.checked);
    });

    // === SUBMIT ===
    const form = document.getElementById('registro-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // UI Loading
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<div class="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> Procesando...`;

        // Gather Data
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        // Construct Payload
        const payload = {
            nombre_completo: raw.nombre_completo.toUpperCase(),
            cedula: raw.cedula,
            email: raw.email,
            telefono: raw.telefono,
            modalidad: raw.es_externo ? null : raw.modalidad,
            facultad: raw.es_externo ? null : raw.facultad,
            carrera: raw.es_externo ? null : raw.carrera,
            es_externo: raw.es_externo === 'on',
            lider_invitador: raw.lider_invitador,
            cuenta_bancaria: {
                banco: raw.banco,
                tipo_cuenta: raw.tipo_cuenta,
                numero_cuenta: raw.numero_cuenta,
                es_propia: checkPersonal.checked,
                titular_nombre: checkPersonal.checked ? raw.nombre_completo.toUpperCase() : raw.titular_nombre.toUpperCase(),
                titular_cedula: checkPersonal.checked ? raw.cedula : raw.titular_cedula
            }
        };

        try {
            // HELPER_CSRF
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
            const headers = {};
            const csrftoken = getCookie('csrftoken');
            if (csrftoken) headers['X-CSRFToken'] = csrftoken;

            const res = await axios.post('/api/v1/alumnos/alumnos/', payload, { headers });

            // Success State
            form.classList.add('hidden');
            document.getElementById('success-view').classList.remove('hidden');

            // Populate Success View
            document.getElementById('success-name').textContent = res.data.nombre_completo;
            document.getElementById('success-cedula').textContent = res.data.cedula;
            document.getElementById('success-group').textContent = `GRUPO ${res.data.grupo}`;
            // Assuming backend generates QR returns URL or valid data
            // Since we need to Download, we use the download link
            // For Image preview, we can use the same generic download link or a dedicated one
            // If backend does NOT return image data directly, we can just use the link
            // Use backend endpoint to show the correct Dual-Tone QR (with cache busting)
            document.getElementById('qr-image').src = `/api/v1/alumnos/descargar-qr/${res.data.cedula}/?t=${new Date().getTime()}`;
            // Link Download Buttons
            document.getElementById('download-trigger-pdf').href = `/api/v1/alumnos/descargar-credencial/${res.data.cedula}/`;
            document.getElementById('download-trigger-qr').href = `/api/v1/alumnos/descargar-qr/${res.data.cedula}/`;

            // Dynamic WhatsApp Link
            const waBtn = document.getElementById('whatsapp-btn');
            if (res.data.whatsapp_link) {
                waBtn.href = res.data.whatsapp_link;
                waBtn.parentElement.classList.remove('hidden'); // Ensure the container is visible
            } else {
                waBtn.parentElement.classList.add('hidden'); // Hide if no link
            }

        } catch (error) {
            console.error(error);
            const feedback = document.getElementById('form-feedback');
            feedback.classList.remove('hidden');

            let msg = 'Error en el registro. Verifique sus datos.';

            // Parse Backend Errors
            if (error.response && error.response.data) {
                const data = error.response.data;
                const errors = [];

                // Handle Arrays or Strings
                const getErrorText = (fieldData) => Array.isArray(fieldData) ? fieldData[0] : fieldData;

                if (data.cedula) errors.push(`Cédula: ${getErrorText(data.cedula)}`);
                if (data.email) errors.push(`Email: ${getErrorText(data.email)}`);
                if (data.telefono) errors.push(`Teléfono: ${getErrorText(data.telefono)}`);
                if (data.modalidad) errors.push(`Modalidad: ${getErrorText(data.modalidad)}`);
                if (data.facultad) errors.push(`Facultad: ${getErrorText(data.facultad)}`);
                if (data.carrera) errors.push(`Carrera: ${getErrorText(data.carrera)}`);

                if (data.cuenta_bancaria) {
                    if (data.cuenta_bancaria.numero_cuenta) errors.push(`Cuenta: ${getErrorText(data.cuenta_bancaria.numero_cuenta)}`);
                }

                // Generic "detail" or "error" keys
                if (data.detail) errors.push(data.detail);
                if (data.error) errors.push(data.error);

                // Fallback loop
                if (errors.length === 0) {
                    Object.keys(data).forEach(key => {
                        let val = data[key];
                        if (Array.isArray(val)) val = val.join(', ');
                        else if (typeof val === 'object') val = JSON.stringify(val).replace(/[{}"]/g, ''); // Clean basic chars
                        errors.push(`${key}: ${val}`);
                    });
                }

                if (errors.length > 0) {
                    msg = errors.join('<br>');
                    if (data.cedula) document.querySelector('[name="cedula"]').classList.add('border-red-500');
                }
            }

            feedback.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5 shrink-0"></i> <div>${msg}</div>`;
            lucide.createIcons();

            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Reintentar</span>`;
        }
    });

    // === TOAST NOTIFICATION ===
    function showToast(message, type = 'error') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = `fixed top-4 right-4 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 translate-y-[-100%] opacity-0 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`;

        toast.innerHTML = `
            <i data-lucide="${type === 'error' ? 'alert-circle' : 'check-circle'}" class="w-6 h-6 shrink-0"></i>
            <span class="font-bold text-sm">${message}</span>
        `;

        document.body.appendChild(toast);
        lucide.createIcons();

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-100%]', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-[-100%]', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
});
