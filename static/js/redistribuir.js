/**
 * Funcionalidad para redistribución equitativa de alumnos por grupo
 */

// Variable de estado para rastrear si estamos listos para aplicar cambios
let redistribuirListoParaAplicar = false;

function initRedistribuirEvents() {
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancel = document.getElementById('btn-cancelar-modal');
    const btnExecute = document.getElementById('btn-redistribuir-ejecutar');
    const modal = document.getElementById('redistribuir-modal');
    
    // Limpiar listeners anteriores (evita duplicados)
    if (btnClose) {
        const newBtnClose = btnClose.cloneNode(true);
        btnClose.parentNode.replaceChild(newBtnClose, btnClose);
        newBtnClose.addEventListener('click', closeRedistribuirModal);
    }
    
    if (btnCancel) {
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        newBtnCancel.addEventListener('click', closeRedistribuirModal);
    }
    
    if (btnExecute) {
        const newBtnExecute = btnExecute.cloneNode(true);
        btnExecute.parentNode.replaceChild(newBtnExecute, btnExecute);
        newBtnExecute.addEventListener('click', ejecutarRedistribución);
    }
    
    // Cerrar modal al hacer clic fuera
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeRedistribuirModal();
            }
        }, { once: true });
    }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    initRedistribuirEvents();
});

function openRedistribuirModal() {
    const modal = document.getElementById('redistribuir-modal');
    const grupo = document.getElementById('redistribuir-grupo');
    const dryRun = document.getElementById('redistribuir-dry-run');
    const btnTexto = document.getElementById('btn-redistribuir-texto');
    
    // Reset de estado
    redistribuirListoParaAplicar = false;
    
    // Reset a valores por defecto
    if (grupo) grupo.value = '';
    if (dryRun) dryRun.checked = true;
    if (btnTexto) btnTexto.textContent = 'Simular';
    
    // Ocultar resultados y loading
    const resultados = document.getElementById('redistribuir-resultados');
    const loading = document.getElementById('redistribuir-loading');
    if (resultados) resultados.classList.add('hidden');
    if (loading) loading.classList.add('hidden');
    
    // Habilitar todos los controles
    const btnExecute = document.getElementById('btn-redistribuir-ejecutar');
    if (grupo) grupo.disabled = false;
    if (dryRun) dryRun.disabled = false;
    if (btnExecute) btnExecute.disabled = false;
    
    // Mostrar modal
    modal.classList.remove('hidden');
    
    // Reinicializar event listeners
    initRedistribuirEvents();
    
    // Recrear íconos de Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Foco en el select
    if (grupo) setTimeout(() => grupo.focus(), 100);
}

function closeRedistribuirModal() {
    const modal = document.getElementById('redistribuir-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Reset completo de estado
    redistribuirListoParaAplicar = false;
    
    // Reset de valores
    const grupo = document.getElementById('redistribuir-grupo');
    const dryRun = document.getElementById('redistribuir-dry-run');
    const btnExecute = document.getElementById('btn-redistribuir-ejecutar');
    
    if (grupo) {
        grupo.value = '';
        grupo.disabled = false;
    }
    if (dryRun) {
        dryRun.checked = true;
        dryRun.disabled = false;
    }
    if (btnExecute) {
        btnExecute.disabled = false;
    }
}

async function ejecutarRedistribución() {
    const grupoSeleccionado = document.getElementById('redistribuir-grupo').value;
    
    // Si está listo para aplicar, usar false; si no, usar true (simular)
    const dryRun = !redistribuirListoParaAplicar;
    
    const btnEjecutar = document.getElementById('btn-redistribuir-ejecutar');
    const btnTexto = document.getElementById('btn-redistribuir-texto');
    const loadingDiv = document.getElementById('redistribuir-loading');
    const resultadosDiv = document.getElementById('redistribuir-resultados');
    const contenidoResultados = document.getElementById('redistribuir-contenido-resultados');

    try {
        // Mostrar loading
        btnEjecutar.disabled = true;
        loadingDiv.classList.remove('hidden');
        resultadosDiv.classList.add('hidden');

        const authToken = localStorage.getItem('token');
        const payload = {
            grupo: grupoSeleccionado ? parseInt(grupoSeleccionado) : null,
            dry_run: dryRun
        };

        const response = await axios.post(
            '/api/v1/lideres/redistribuir/',
            payload,
            {
                headers: {
                    'Authorization': `Token ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = response.data;

        // Generar HTML de resultados
        let htmlResultados = '';

        // Resumen general
        htmlResultados += `
            <div class="bg-gradient-to-r from-unemi-blue/10 to-unemi-orange/10 border border-unemi-blue/20 rounded-xl p-4">
                <p class="text-xs font-bold text-unemi-blue uppercase mb-1">Modo</p>
                <p class="text-xl font-black text-unemi-blue">
                    ${dryRun ? '📊 Simulación' : '✓ Ejecución Real'}
                </p>
                <p class="text-xs text-unemi-blue mt-2">
                    ${data.total_cambios} cambios ${dryRun ? 'que se realizarían' : 'realizados'}
                </p>
            </div>
        `;

        // Resultados por grupo
        data.resultados_por_grupo.forEach((grupo, idx) => {
            htmlResultados += `
                <div class="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="font-bold text-slate-800 flex items-center gap-2">
                            <span class="bg-unemi-blue text-white px-2 py-1 rounded text-xs font-black">Grupo ${grupo.grupo}</span>
                            <span class="text-xs text-slate-500">${grupo.estado === 'completado' ? '✓ ' : ''}${grupo.cambios} cambios</span>
                        </h4>
                        <i data-lucide="${grupo.cambios > 0 ? 'check-circle' : 'alert-circle'}" class="w-4 h-4 ${grupo.cambios > 0 ? 'text-green-500' : 'text-amber-500'}"></i>
                    </div>
            `;

            if (grupo.razon) {
                htmlResultados += `<p class="text-xs text-slate-500 font-medium">${grupo.razon}</p>`;
            }

            // Mostrar distribución
            if (Object.keys(grupo.distribucion_anterior).length > 0) {
                htmlResultados += `
                    <div class="grid grid-cols-2 gap-2">
                        <div class="text-xs">
                            <p class="font-bold text-slate-600 uppercase text-[10px] mb-2">Antes</p>
                            <div class="space-y-1">
                `;
                
                Object.entries(grupo.distribucion_anterior).forEach(([liderId, lider]) => {
                    htmlResultados += `
                        <div class="bg-slate-50 p-2 rounded flex justify-between">
                            <span class="font-mono text-[9px]">${lider.nombre.split(' ')[0]}</span>
                            <span class="font-bold text-slate-600 text-[9px]">${lider.cantidad}</span>
                        </div>
                    `;
                });

                htmlResultados += `
                            </div>
                        </div>
                        <div class="text-xs">
                            <p class="font-bold text-slate-600 uppercase text-[10px] mb-2">Después</p>
                            <div class="space-y-1">
                `;

                Object.entries(grupo.distribucion_nueva).forEach(([liderId, lider]) => {
                    htmlResultados += `
                        <div class="bg-unemi-orange/10 p-2 rounded flex justify-between border border-unemi-orange/30">
                            <span class="font-mono text-[9px]">${lider.nombre.split(' ')[0]}</span>
                            <span class="font-bold text-unemi-orange text-[9px]">${lider.cantidad}</span>
                        </div>
                    `;
                });

                htmlResultados += `
                            </div>
                        </div>
                    </div>
                `;
            }

            // Mostrar cambios específicos si hay
            if (grupo.detalles_cambios && grupo.detalles_cambios.length > 0) {
                htmlResultados += `
                    <details class="text-xs">
                        <summary class="font-bold text-slate-600 cursor-pointer hover:text-slate-800 py-1">
                            Ver detalles de cambios (${grupo.detalles_cambios.length})
                        </summary>
                        <div class="mt-2 space-y-1 bg-slate-50 p-2 rounded">
                `;
                
                grupo.detalles_cambios.forEach((cambio) => {
                    htmlResultados += `
                        <div class="text-[9px] text-slate-600 flex items-start gap-2">
                            <i data-lucide="arrow-right" class="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0"></i>
                            <div>
                                <span class="font-mono">${cambio.alumno_nombre}</span>
                                <br>
                                <span class="text-slate-500">${cambio.lider_anterior} → ${cambio.lider_nuevo}</span>
                            </div>
                        </div>
                    `;
                });

                htmlResultados += `
                        </div>
                    </details>
                `;
            }

            htmlResultados += `</div>`;
        });

        contenidoResultados.innerHTML = htmlResultados;
        
        // Ocultar loading y mostrar resultados
        loadingDiv.classList.add('hidden');
        resultadosDiv.classList.remove('hidden');

        // Cambiar botón según dry-run
        if (dryRun && data.total_cambios > 0) {
            // Simulación exitosa, listo para aplicar cambios
            btnTexto.textContent = 'Aplicar Cambios';
            btnEjecutar.disabled = false;  // ← IMPORTANTE: Habilitar el botón
            redistribuirListoParaAplicar = true;
            document.getElementById('redistribuir-dry-run').disabled = true;
            document.getElementById('redistribuir-grupo').disabled = true;
        } else if (!dryRun && redistribuirListoParaAplicar) {
            // Cambios aplicados exitosamente
            btnTexto.textContent = 'Completado ✓';
            btnEjecutar.disabled = true;
            redistribuirListoParaAplicar = false;
            
            // Mostrar notificación de éxito
            if (window.Swal) {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({
                    icon: 'success',
                    title: 'Redistribución completada',
                    text: `Se realizaron ${data.total_cambios} cambios exitosamente`
                });
            }
            
            // Recargar datos después de 2 segundos
            setTimeout(() => {
                if (window.refreshData) refreshData();
                closeRedistribuirModal();
            }, 2000);
        }

        // Recrear íconos de Lucide
        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error('Error en redistribución:', error);
        
        let mensajeError = 'Ocurrió un error al procesar la redistribución';
        
        if (error.response?.status === 404) {
            mensajeError = 'Endpoint no encontrado. Verifica la configuración.';
        } else if (error.response?.status === 403) {
            mensajeError = 'No tienes permisos para realizar esta acción.';
        } else if (error.response?.data?.error) {
            mensajeError = error.response.data.error;
        } else if (error.message) {
            mensajeError = error.message;
        }

        // Mostrar error con SweetAlert o alert
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error en Redistribución',
                text: mensajeError,
                confirmButtonColor: '#7c3aed'
            });
        } else {
            alert(`Error: ${mensajeError}`);
        }

        loadingDiv.classList.add('hidden');
        resultadosDiv.classList.add('hidden');
        btnEjecutar.disabled = false;

    } finally {
        // Asegurar que el botón nunca quede deshabilitado permanentemente
        if (btnEjecutar) {
            btnEjecutar.disabled = false;
        }
    }
}
