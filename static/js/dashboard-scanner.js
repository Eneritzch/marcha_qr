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
            }, 1500);
        }
    }
};
