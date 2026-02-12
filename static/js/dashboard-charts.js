/**
 * Dashboard Charts Logic
 * Handles rendering of ApexCharts for the dashboard.
 * Designed to fail gracefully without crashing other modules.
 */

window.DashboardCharts = (function () {
    let chartInstance = null;

    function render(alumnos, lideres) {
        const ctx = document.getElementById('certificadosChart');
        if (!ctx) return;

        // Process Data: Group by Date
        const deliveryDates = {};

        alumnos.forEach(a => {
            if (a.certificado_entregado && a.fecha_entrega_certificado) {
                // Formatting date to YYYY-MM-DD
                const dateObj = new Date(a.fecha_entrega_certificado);
                if (!isNaN(dateObj)) {
                    const dateStr = dateObj.toISOString().split('T')[0];
                    deliveryDates[dateStr] = (deliveryDates[dateStr] || 0) + 1;
                }
            }
        });

        // Filter by period if needed (Element id: 'chart-period')
        const periodEl = document.getElementById('chart-period');
        const periodDays = periodEl ? parseInt(periodEl.value) : 7;

        // Generate last N dates to ensure continuity
        const today = new Date();
        const labels = [];
        const dataPoints = [];

        for (let i = periodDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            labels.push(dateKey);
            dataPoints.push(deliveryDates[dateKey] || 0);
        }

        // SMART TRIM & PADDING:
        // "unos dos o un dia antes nomas y uno depues y que se vaya formando de forma inteligente"
        // Logic: Find first non-zero day, then include up to 2 days before it for context.
        const firstDataIndex = dataPoints.findIndex(val => val > 0);

        if (firstDataIndex !== -1) {
            // Start 2 days before the first data point (or index 0 if not enough history)
            const padding = 2;
            const sliceIndex = Math.max(0, firstDataIndex - padding);

            if (sliceIndex > 0) {
                labels.splice(0, sliceIndex);
                dataPoints.splice(0, sliceIndex);
            }
        }

        // Destroy previous chart
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Create Gradient
        const context = ctx.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(239, 125, 0, 0.5)'); // UNEMI Orange
        gradient.addColorStop(1, 'rgba(239, 125, 0, 0.0)');

        // Render Chart
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => {
                    const parts = l.split('-');
                    return `${parts[2]}/${parts[1]}`;
                }),
                datasets: [{
                    label: 'Certificados Entregados',
                    data: dataPoints,
                    borderColor: '#EF7D00',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#EF7D00',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#0F1E4B',
                        bodyColor: '#334155',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 10,
                                family: "'Inter', sans-serif"
                            },
                            color: '#64748b'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            borderDash: [5, 5],
                            color: '#f1f5f9'
                        },
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 10
                            },
                            color: '#64748b'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }

    return {
        render: render
    };
})();
