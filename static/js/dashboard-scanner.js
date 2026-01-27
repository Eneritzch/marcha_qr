/**
 * Dashboard Scanner Logic
 * Handles QR scanning using Html5Qrcode.
 * Designed to separate camera logic from main dashboard flow.
 */

window.DashboardScanner = {
    html5QrCode: null,
    currentCameraId: null,
    cameras: [],
    isScanning: false,
    isTorchOn: false,

    start: async function (dataProcessor) {
        if (this.isScanning) return;

        // Save callback
        this.dataProcessor = dataProcessor;

        const statusEl = document.getElementById('scan-status');
        const switchBtn = document.getElementById('btn-switch-camera');

        if (statusEl) statusEl.textContent = "Solicitando permisos...";

        try {
            // 1. Get Cameras
            // Check for Secure Context (HTTPS) - Required by Browser API
            if (!window.isSecureContext) {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-500 font-bold block bg-white px-2 rounded">Error: Se requiere HTTPS o Localhost para usar la cámara.</span>`;
                return;
            }

            this.cameras = await Html5Qrcode.getCameras();
            if (!this.cameras || this.cameras.length === 0) {
                if (statusEl) statusEl.textContent = "No se detectaron cámaras.";
                return;
            }

            // 2. Select initial camera (Prefer Back/Environment)
            // Only select if we don't have one, OR if the current one is invalid
            if (!this.currentCameraId || !this.cameras.find(c => c.id === this.currentCameraId)) {
                // Prefer back camera
                const backCam = this.cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera')) || this.cameras[this.cameras.length - 1];
                this.currentCameraId = backCam.id;
            }

            // Show switch button if multiple cameras
            if (switchBtn) {
                if (this.cameras.length > 1) {
                    switchBtn.classList.remove('hidden');
                } else {
                    switchBtn.classList.add('hidden');
                }
            }

            // 3. Start Scanning
            if (!this.html5QrCode) {
                this.html5QrCode = new Html5Qrcode("qr-reader");
            }

            if (statusEl) statusEl.textContent = "Iniciando cámara...";

            // Ensure DOM is ready (increased delay for stability)
            await new Promise(r => setTimeout(r, 500));

            // Responsive Config - Larger Scan Area (Restoring from example.js)
            const qrBoxSize = Math.min(window.innerWidth * 0.90, 600); // 90% width or max 600px

            await this.html5QrCode.start(
                this.currentCameraId,
                {
                    fps: 20, // Faster scanning
                    qrbox: { width: qrBoxSize, height: qrBoxSize },
                    aspectRatio: 1.0,
                    disableFlip: true,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true // Native barcode detector is much faster
                    },
                    videoConstraints: {
                        advanced: [{ focusMode: "continuous" }, { exposureMode: "continuous" }]
                    }
                },
                (decodedText) => this.onScanSuccess(decodedText),
                (errorMessage) => {
                    // Ignore frame parse errors
                }
            ).catch(err => {
                console.error("Start failed", err);
                if (statusEl) statusEl.textContent = "Error al iniciar cámara. Intente refrescar.";
                this.isScanning = false;
            });

            this.isScanning = true;
            if (statusEl) statusEl.textContent = "Escaneando... (Apunta al QR)";

            // CHECK TORCH CAPABILITY
            try {
                const track = this.html5QrCode.getRunningTrackCameraCapabilities();
                const torchBtn = document.getElementById('btn-torch');
                if (track && track.torchFeature() && torchBtn) {
                    torchBtn.classList.remove('hidden');
                } else if (torchBtn) {
                    torchBtn.classList.add('hidden');
                }
            } catch (e) { /* Capabilities might not be accessible immediately */ }

            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            console.error("Error starting scanner:", err);
            if (statusEl) statusEl.innerHTML = `<span class="text-red-400">Error: ${err.name || 'Desconocido'} - ${err.message || 'Sin detalles'}</span>`;
        }
    },

    stop: async function () {
        if (this.html5QrCode && this.isScanning) {
            try {
                await this.html5QrCode.stop();
                this.isScanning = false;
                const statusEl = document.getElementById('scan-status');
                if (statusEl) statusEl.textContent = "Cámara detenida";
            } catch (err) {
                console.error("Failed to stop scanner", err);
            }
        }
    },

    toggleTorch: async function () {
        if (!this.html5QrCode || !this.isScanning) return;

        try {
            this.isTorchOn = !this.isTorchOn;
            await this.html5QrCode.applyVideoConstraints({
                advanced: [{ torch: this.isTorchOn }]
            });

            const btn = document.getElementById('btn-torch');
            if (btn) {
                if (this.isTorchOn) {
                    btn.classList.add('bg-yellow-400', 'text-slate-900');
                    btn.classList.remove('bg-white/10', 'text-white');
                    btn.innerHTML = '<i data-lucide="zap-off" class="w-5 h-5"></i>';
                } else {
                    btn.classList.remove('bg-yellow-400', 'text-slate-900');
                    btn.classList.add('bg-white/10', 'text-white');
                    btn.innerHTML = '<i data-lucide="zap" class="w-5 h-5"></i>';
                }
                if (window.lucide) window.lucide.createIcons();
            }

        } catch (err) {
            console.error("Torch toggle failed", err);
            this.isTorchOn = false; // reset state
        }
    },

    toggleCamera: async function () {
        if (!this.cameras || this.cameras.length < 2) return;

        await this.stop();

        // Find current index
        const currentIndex = this.cameras.findIndex(c => c.id === this.currentCameraId);
        let nextIndex = currentIndex + 1;
        if (nextIndex >= this.cameras.length) nextIndex = 0;

        this.currentCameraId = this.cameras[nextIndex].id;
        this.start(this.dataProcessor); // Reuse saved callback
    },

    onScanSuccess: async function (decodedText) {
        if (document.getElementById('scan-result').classList.contains('processing')) return;

        console.log(`Scan matched: ${decodedText}`);
        const feedbackBox = document.getElementById('scan-result');
        const statusEl = document.getElementById('scan-status');

        // UI Feedback (Quick Overlay)
        statusEl.textContent = "¡Procesando!";
        statusEl.classList.add('text-unemi-orange');
        feedbackBox.classList.add('processing'); // Lock scanning

        try {
            // DELEGATE TO CALLBACK
            if (!this.dataProcessor) throw new Error("No data processor defined");

            const alumno = await this.dataProcessor(decodedText);

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

        } catch (err) {
            console.error("Scanner Processing Error:", err);
            // Error Pop-up
            feedbackBox.className = "absolute bottom-16 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md text-white rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-30 border border-white/20";
            feedbackBox.classList.remove('hidden');

            let errorMsg = "Error desconocido";
            if (err.response && err.response.data) {
                errorMsg = err.response.data.error || err.response.data.detail || JSON.stringify(err.response.data);
            } else {
                errorMsg = err.message || "Código no compatible";
            }
            // Clean up error message
            if (errorMsg.length > 80) errorMsg = errorMsg.substring(0, 80) + "...";

            feedbackBox.innerHTML = `
                <div class="bg-white text-red-500 rounded-full p-2 shadow-sm"><i data-lucide="x" class="w-6 h-6"></i></div>
                <div>
                    <p class="text-xs font-bold uppercase opacity-80">Error</p>
                    <p class="text-sm font-medium leading-tight">${errorMsg}</p>
                </div>
            `;
        } finally {
            if (window.lucide) window.lucide.createIcons();

            // Pause briefly (1.5s) then clear for next scan
            if (this.html5QrCode) await this.html5QrCode.pause();

            setTimeout(async () => {
                feedbackBox.classList.add('hidden');
                feedbackBox.classList.remove('processing');
                statusEl.textContent = "Escaneando...";
                statusEl.classList.remove('text-unemi-orange');
                if (this.html5QrCode) await this.html5QrCode.resume();
            }, 1500); // Faster cycle
        }
    }
};
