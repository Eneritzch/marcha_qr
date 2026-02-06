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

    facingMode: "environment", // Default for mobile (back camera)

    start: async function (dataProcessor) {
        if (this.isScanning) return;
        this.dataProcessor = dataProcessor;

        const statusEl = document.getElementById('scan-status');
        const switchBtn = document.getElementById('btn-switch-camera');

        try {
            if (typeof Html5Qrcode === 'undefined') {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-500 font-bold block bg-white px-2 rounded">Error: Librería de escaneo no cargada. Recarga con internet.</span>`;
                console.error("Html5Qrcode is not defined. Possible caching failure.");
                return;
            }

            if (!window.isSecureContext) {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-500 font-bold block bg-white px-2 rounded">Error: Se requiere HTTPS.</span>`;
                return;
            }

            if (statusEl) statusEl.textContent = "Iniciando cámara...";

            // 1. Get List to show switch button
            try {
                this.cameras = await Html5Qrcode.getCameras();
                if (switchBtn && this.cameras && this.cameras.length > 1) {
                    switchBtn.classList.remove('hidden');
                }
            } catch (e) {
                console.warn("Could not list cameras, using facingMode only");
            }

            // 2. Setup Scanner
            if (!this.html5QrCode) {
                this.html5QrCode = new Html5Qrcode("qr-reader");
            }

            // 3. Selection Function with Fallback (e.g. Laptops usually don't have back camera)
            const tryStart = async (mode) => {
                const cameraConfig = this.currentCameraId ? this.currentCameraId : { facingMode: mode };
                const qrBoxSize = (w, h) => {
                    const size = Math.min(w, h) * 0.75;
                    return { width: size, height: size };
                };

                return this.html5QrCode.start(
                    cameraConfig,
                    {
                        fps: 20,
                        qrbox: qrBoxSize,
                        aspectRatio: 1.0,
                        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                    },
                    (decodedText) => this.onScanSuccess(decodedText),
                    (errorMessage) => { /* ignore */ }
                );
            };

            try {
                // Try starting with preferred facingMode
                await tryStart(this.facingMode);
            } catch (err) {
                // FALLBACK: If environment/back failed, try user/front (common on laptops)
                if (this.facingMode === "environment") {
                    console.info("Back camera not available, falling back to front camera...");
                    if (statusEl) statusEl.textContent = "Buscando cámara frontal...";
                    this.facingMode = "user";
                    this.currentCameraId = null;
                    await tryStart("user");
                } else {
                    throw err;
                }
            }

            this.isScanning = true;
            if (statusEl) {
                statusEl.textContent = this.facingMode === "environment" ? "Escaneando (Cámara Trasera)" : "Escaneando (Cámara Frontal)";
                statusEl.classList.remove('text-red-400', 'text-unemi-orange');
            }

            // CHECK TORCH
            setTimeout(() => {
                try {
                    const track = this.html5QrCode.getRunningTrackCameraCapabilities();
                    const torchBtn = document.getElementById('btn-torch');
                    if (track && track.torchFeature() && torchBtn) {
                        torchBtn.classList.remove('hidden');
                    } else if (torchBtn) {
                        torchBtn.classList.add('hidden');
                    }
                } catch (e) { }
            }, 800);

            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            console.error("Scanner start error:", err);
            if (statusEl) {
                statusEl.textContent = "Error: Acceso a cámara denegado.";
                statusEl.classList.add('text-red-400');
            }
            this.isScanning = false;
        }
    },

    stop: async function () {
        if (this.html5QrCode && this.isScanning) {
            try {
                await this.html5QrCode.stop();
                this.isScanning = false;
            } catch (err) {
                console.error("Scanner stop error", err);
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
        const statusEl = document.getElementById('scan-status');
        if (statusEl) statusEl.textContent = "Cambiando cámara...";

        await this.stop();

        // Wait for system release
        await new Promise(r => setTimeout(r, 600));

        // Logic for toggling
        if (this.cameras && this.cameras.length > 2) {
            // Mobile devices often have 3+ cameras (Wide, Ultra, Front)
            const currentIndex = this.cameras.findIndex(c => c.id === this.currentCameraId);
            let nextIndex = currentIndex + 1;
            if (nextIndex >= this.cameras.length) nextIndex = 0;
            this.currentCameraId = this.cameras[nextIndex].id;
        } else {
            // Standard toggle (Front/Back)
            this.facingMode = (this.facingMode === "environment") ? "user" : "environment";
            this.currentCameraId = null;
        }

        this.start(this.dataProcessor);
    },

    onScanSuccess: async function (decodedText, isImage = false) {
        if (document.getElementById('scan-result').classList.contains('processing') && !isImage) return;

        console.log(`Scan matched: ${decodedText} (isImage: ${isImage})`);
        const feedbackBox = document.getElementById('scan-result');
        const statusEl = document.getElementById('scan-status');

        // UI Feedback
        statusEl.textContent = "¡Procesando!";
        statusEl.classList.add('text-unemi-orange');
        feedbackBox.classList.add('processing');

        try {
            if (!this.dataProcessor) throw new Error("No data processor definido");

            const result = await this.dataProcessor(decodedText);

            if (result.offline) {
                if (result.already_marked) {
                    this.showSuccessUI(result.nombre, "Ya Registrado", "amber");
                } else {
                    this.showSuccessUI(result.nombre, "Guardado Localmente", "orange");
                }
            } else {
                let color = "green";
                let msg = result.message || "Asistencia Ok";

                // If the message contains "ya registrado", use amber color for warning
                if (msg.toLowerCase().includes("ya registrado")) {
                    color = "amber";
                }

                this.showSuccessUI(result.nombre, msg, color);
            }

        } catch (err) {
            console.error("Scanner Processing Error:", err);
            let errorMsg = "Error desconocido";
            if (err.response && err.response.data) {
                errorMsg = err.response.data.error || err.response.data.detail || JSON.stringify(err.response.data);
            } else {
                errorMsg = err.message || "Código no compatible";
            }
            this.showErrorUI(errorMsg);
        } finally {
            if (window.lucide) window.lucide.createIcons();

            // When from camera, we pause. When from image, it's already stopped.
            if (this.html5QrCode && this.isScanning) {
                try { await this.html5QrCode.pause(); } catch (e) { }
            }

            // Duration for result display
            const displayTime = isImage ? 4000 : 2000;

            setTimeout(async () => {
                feedbackBox.classList.add('hidden');
                feedbackBox.classList.remove('processing');
                statusEl.classList.remove('text-unemi-orange');

                if (isImage) {
                    // Return to selection UI as requested
                    if (window.stopCameraAndReturn) window.stopCameraAndReturn();
                } else if (this.isScanning && this.html5QrCode) {
                    statusEl.textContent = "Escaneando...";
                    try { await this.html5QrCode.resume(); } catch (e) { }
                } else {
                    statusEl.textContent = "Esperando cámara...";
                }
            }, displayTime);
        }
    },

    showSuccessUI: function (nombre, customMsg = "Asistencia Ok", color = "green") {
        const feedbackBox = document.getElementById('scan-result');

        // Map colors to tailwind classes
        const colorClasses = {
            green: "bg-green-500/90 text-white",
            orange: "bg-orange-500/90 text-white",
            amber: "bg-amber-500/90 text-white"
        };

        const iconClasses = {
            green: "text-green-500",
            orange: "text-orange-500",
            amber: "text-amber-500"
        };

        const bgClass = colorClasses[color] || colorClasses.green;
        const iconClass = iconClasses[color] || iconClasses.green;
        const iconName = color === 'amber' ? 'alert-circle' : 'check';

        feedbackBox.className = `absolute bottom-16 left-4 right-4 p-4 ${bgClass} backdrop-blur-md rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-30 border border-white/20`;
        feedbackBox.classList.remove('hidden');
        feedbackBox.innerHTML = `
            <div class="bg-white ${iconClass} rounded-full p-2 shadow-sm"><i data-lucide="${iconName}" class="w-6 h-6"></i></div>
            <div class="flex-1">
                <p class="text-xs font-bold uppercase opacity-80">${customMsg}</p>
                <p class="text-lg font-bold leading-tight">${nombre}</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    },

    showErrorUI: function (message) {
        const feedbackBox = document.getElementById('scan-result');
        feedbackBox.className = "absolute bottom-16 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md text-white rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-30 border border-white/20";
        feedbackBox.classList.remove('hidden');

        let displayMsg = message;
        if (displayMsg.length > 100) displayMsg = displayMsg.substring(0, 100) + "...";

        feedbackBox.innerHTML = `
            <div class="bg-white text-red-500 rounded-full p-2 shadow-sm"><i data-lucide="x" class="w-6 h-6"></i></div>
            <div class="flex-1">
                <p class="text-xs font-bold uppercase opacity-80">Error</p>
                <p class="text-sm font-medium leading-tight">${displayMsg}</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    },

    scanImage: async function (file) {
        if (!file) return;

        const feedbackBox = document.getElementById('scan-result');
        const statusEl = document.getElementById('scan-status');

        if (feedbackBox.classList.contains('processing')) return;

        console.log("Iniciando análisis de imagen:", file.name);

        // 1. Force stop camera to avoid conflicts
        let wasScanning = this.isScanning;
        if (wasScanning) {
            console.log("Deteniendo cámara para analizar imagen...");
            await this.stop();
        }

        statusEl.textContent = "Analizando imagen de galería...";
        feedbackBox.classList.add('processing');

        // 1. Check if library is available
        if (typeof Html5Qrcode === 'undefined') {
            statusEl.textContent = "Error: Librería no disponible offline.";
            this.showErrorUI("La librería de escaneo no se cargó. Por favor, recarga la aplicación con internet para activarla.");
            return;
        }

        // 2. Ensure we have a scanner instance
        if (!this.html5QrCode) {
            this.html5QrCode = new Html5Qrcode("qr-reader");
        }

        try {
            const decodedText = await this.html5QrCode.scanFile(file, true);
            console.log("QR decodificado de imagen:", decodedText);

            // 3. Process the decoded text
            await this.onScanSuccess(decodedText, true);

        } catch (err) {
            console.error("Error al escanear imagen:", err);
            const errorMsg = (typeof err === 'string' && err.includes("No QR code found"))
                ? "No se encontró un código QR en la imagen seleccionada."
                : "No se pudo leer el código QR. Intenta con otra foto.";

            this.showErrorUI(errorMsg);

            setTimeout(() => {
                feedbackBox.classList.add('hidden');
                feedbackBox.classList.remove('processing');
                statusEl.textContent = "Esperando cámara...";
            }, 3000);
        } finally {
            // we don't auto-resume here because onScanSuccess has its own timer
            // and we might want to stay stopped on the result view.
        }
    }
};
