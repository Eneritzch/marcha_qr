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
    setTimeout(initAcademicFilters, 100);

    // === LOAD LEADERS ===
    try {
        const res = await axios.get('/api/v1/lideres/activos/');
        const data = res.data;
        const select = document.getElementById('lider-select');
        select.innerHTML = '<option value="">Seleccione a su Líder...</option>';

        // Save for later group lookup
        Object.values(data).flat().forEach(l => {
            leadersData[l.id] = l;
        });

        Object.entries(data).forEach(([grupo, lideres]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `GRUPO ${grupo}`;
            lideres.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.nombre_completo;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });
    } catch (e) {
        console.error("Error loading leaders", e);
    }

    // Leader Change - Update Preview
    document.getElementById('lider-select').addEventListener('change', (e) => {
        const leader = leadersData[e.target.value];
        const preview = document.getElementById('grupo-preview');
        if (leader) {
            preview.textContent = `GRUPO ${leader.grupo}`;
            preview.className = 'text-3xl font-black text-unemi-orange animate-pulse';
        } else {
            preview.textContent = '--';
            preview.className = 'text-3xl font-black text-slate-300';
        }
    });

    // === STEPPER LOGIC ===
    btnNext.addEventListener('click', () => {
        if (!validateStep(currentStep)) return;
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
            alert("Por favor complete todos los campos obligatorios.");
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
            selFacultad.innerHTML = '<option value="">Seleccione Facultad...</option>';
            selCarrera.innerHTML = '<option value="">Primero seleccione Facultad...</option>';
            selFacultad.disabled = true;
            selCarrera.disabled = true;

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
            modalidad: raw.modalidad,
            facultad: raw.facultad,
            carrera: raw.carrera,
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
            const res = await axios.post('/api/v1/alumnos/alumnos/', payload);

            // Success State
            form.classList.add('hidden');
            document.getElementById('success-view').classList.remove('hidden');

            // Populate Success View
            document.getElementById('success-name').textContent = res.data.nombre_completo;
            document.getElementById('success-cedula').textContent = res.data.cedula;
            // Assuming backend generates QR returns URL or valid data
            // Since we need to Download, we use the download link
            // For Image preview, we can use the same generic download link or a dedicated one
            // If backend does NOT return image data directly, we can just use the link
            document.getElementById('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${res.data.codigo_qr}`; // Fallback or use real endpoint
            document.getElementById('download-btn').href = `/api/v1/alumnos/descargar-qr/${res.data.cedula}/`;

        } catch (error) {
            console.error(error);
            const feedback = document.getElementById('form-feedback');
            feedback.classList.remove('hidden');
            let msg = 'Error en el registro. Verifique sus datos.';
            if (error.response?.data?.cedula) msg = `Error: ${error.response.data.cedula[0]}`;
            if (error.response?.data?.email) msg = `Error: ${error.response.data.email[0]}`;
            feedback.textContent = msg;

            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Reintentar</span>`;
        }
    });

    lucide.createIcons();
});
