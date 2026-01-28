/**
 * Dashboard Charts Logic
 * Handles rendering of ApexCharts for the dashboard.
 * Designed to fail gracefully without crashing other modules.
 */

window.DashboardCharts = {
    chartsInstances: {
        scatter: null,
        radial: null,
        bar: null
    },

    render: function (allAlumnos, allLideres) {
        try {
            if (!allAlumnos || allAlumnos.length === 0) return;

            // 1. DATA PREPARATION

            // --- A. Leaders Bubble Data (Colorful & Sized) ---
            // Filter by Group
            const groupFilter = document.getElementById('chart-main-filter') ? document.getElementById('chart-main-filter').value : 'all';
            let leadersData = allLideres;
            if (groupFilter !== 'all') {
                leadersData = allLideres.filter(l => l.grupo.toString() === groupFilter);
            }

            // --- CHART 1: GROUPS PERFORMANCE (Column Chart) ---
            // Prepare Data: Aggregate by Group
            const groupsStats = {};

            // Process all leaders (or filtered ones) to sum stats by Group
            leadersData.forEach(l => {
                const gName = `Grupo ${l.grupo}`;
                if (!groupsStats[gName]) {
                    groupsStats[gName] = { invited: 0, attended: 0, groupNum: l.grupo };
                }
                groupsStats[gName].invited += (l.total_invitados || 0);
                groupsStats[gName].attended += (l.total_asistencias || 0);
            });

            // Sort by Group Number
            const sortedGroupKeys = Object.keys(groupsStats).sort((a, b) => groupsStats[a].groupNum - groupsStats[b].groupNum);

            const leadersList = sortedGroupKeys;
            const invitedData = sortedGroupKeys.map(k => groupsStats[k].invited);
            const attendedData = sortedGroupKeys.map(k => groupsStats[k].attended);

            const leadersBarOptions = {
                series: [{
                    name: 'Invitados',
                    data: invitedData
                }, {
                    name: 'Asistieron',
                    data: attendedData
                }],
                chart: {
                    type: 'bar', // Stable Column Chart
                    height: 380,
                    toolbar: { show: false }, // Cleaner look
                    fontFamily: 'Inter, sans-serif'
                },
                plotOptions: {
                    bar: {
                        horizontal: false,
                        columnWidth: '55%',
                        borderRadius: 5, // Rounded bars for premium look
                        endingShape: 'rounded'
                    },
                },
                dataLabels: { enabled: false },
                stroke: {
                    show: true,
                    width: 2,
                    colors: ['transparent']
                },
                xaxis: {
                    categories: leadersList,
                    labels: {
                        style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 }
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    title: { text: 'Estudiantes', style: { color: '#64748b' } },
                    labels: { style: { colors: '#64748b' } }
                },
                fill: {
                    opacity: 1,
                    colors: ['#3B82F6', '#EF7D00'] // Blue, Orange
                },
                colors: ['#3B82F6', '#EF7D00'], // Consistent with fill
                tooltip: {
                    theme: 'light',
                    y: { formatter: (val) => val + " estudiantes" }
                },
                grid: {
                    borderColor: '#f1f5f9',
                    padding: { top: 0, right: 0, bottom: 0, left: 10 }
                },
                legend: {
                    position: 'top',
                    horizontalAlign: 'right'
                }
            };

            if (document.getElementById('chart-leaders-scatter')) {
                // Safe destroy/create logic
                if (this.chartsInstances.scatter) {
                    this.chartsInstances.scatter.destroy(); // Destroy previous instance completely
                    this.chartsInstances.scatter = null;
                }
                try {
                    this.chartsInstances.scatter = new ApexCharts(document.querySelector("#chart-leaders-scatter"), leadersBarOptions);
                    this.chartsInstances.scatter.render();
                } catch (e) { console.error("Chart render error:", e); }
            }

            // --- DATA PREPARATION (Attendance & Careers) ---
            const total = allAlumnos.length;
            const asistencias = allAlumnos.filter(a => a.asistio).length;
            const pendientes = total - asistencias;

            const attendanceRate = total > 0 ? ((asistencias / total) * 100).toFixed(1) : 0;
            const pendingRate = total > 0 ? ((pendientes / total) * 100).toFixed(1) : 0;

            const validAttendance = parseFloat(attendanceRate) || 0;
            const validPending = parseFloat(pendingRate) || 0;

            if (document.getElementById('radial-total-label')) {
                document.getElementById('radial-total-label').textContent = total;
            }

            // Careers Data
            const careerStats = {};
            allAlumnos.forEach(a => {
                const c = a.carrera || 'Sin Carrera';
                if (!careerStats[c]) careerStats[c] = { invited: 0, attended: 0 };
                careerStats[c].invited++;
                if (a.asistio) careerStats[c].attended++;
            });

            const sortedCareers = Object.entries(careerStats)
                .sort((a, b) => b[1].invited - a[1].invited)
                .slice(0, 5);

            const careerCategories = sortedCareers.map(c => c[0].length > 15 ? c[0].substring(0, 15) + '...' : c[0]);

            const careerSeries = [
                {
                    name: 'Total Invitados',
                    data: sortedCareers.map(c => -c[1].invited)
                },
                {
                    name: 'Asistieron',
                    data: sortedCareers.map(c => c[1].attended)
                }
            ];

            // --- CHART 2: MULTI-RADIAL (Attendance) ---
            const radialOptions = {
                series: [validAttendance, validPending],
                chart: {
                    height: 350,
                    type: 'radialBar',
                    fontFamily: 'Inter, sans-serif'
                },
                plotOptions: {
                    radialBar: {
                        dataLabels: {
                            name: { fontSize: '22px' },
                            value: { fontSize: '16px', color: '#64748b' },
                            total: {
                                show: true,
                                label: '',
                                color: '#64748b',
                                formatter: function (w) {
                                    return total;
                                }
                            }
                        },
                        hollow: {
                            margin: 5,
                            size: '50%',
                            background: 'transparent',
                        },
                        track: {
                            show: true,
                            background: '#f1f5f9',
                            strokeWidth: '100%',
                            opacity: 1,
                            margin: 5
                        },
                    }
                },
                labels: [],
                colors: ['#22C55E', '#F97316'], // Green, Orange
                fill: {
                    type: 'solid',
                    colors: ['#22C55E', '#F97316'],
                    opacity: 1
                },
                stroke: { lineCap: 'round' },
                legend: {
                    show: false,
                    position: 'bottom',
                    fontSize: '12px',
                    markers: { radius: 12 },
                    itemMargin: { horizontal: 10 }
                }
            };

            if (document.getElementById('chart-attendance-radial')) {
                if (this.chartsInstances.radial) {
                    this.chartsInstances.radial.updateSeries([validAttendance, validPending]);
                    this.chartsInstances.radial.updateOptions(radialOptions);
                } else {
                    this.chartsInstances.radial = new ApexCharts(document.querySelector("#chart-attendance-radial"), radialOptions);
                    this.chartsInstances.radial.render();
                }
            }

            // --- CHART 3: DIVERGING BAR (Careers) ---
            const barOptions = {
                series: careerSeries,
                chart: {
                    type: 'bar',
                    height: 280,
                    stacked: true,
                    toolbar: { show: false },
                    fontFamily: 'Inter, sans-serif'
                },
                colors: ['#3B82F6', '#22C55E'],
                plotOptions: {
                    bar: {
                        horizontal: true,
                        barHeight: '60%',
                        borderRadius: 4
                    }
                },
                dataLabels: {
                    enabled: false
                },
                stroke: { width: 1, colors: ["#fff"] },
                xaxis: {
                    labels: {
                        formatter: function (val) {
                            return Math.abs(Math.round(val))
                        },
                        style: { colors: '#64748b' }
                    },
                    title: {
                        text: 'Invitados (Izq) vs Asistieron (Der)',
                        style: { fontSize: '10px' }
                    }
                },
                yaxis: {
                    labels: { style: { colors: '#64748b', fontSize: '11px' } }
                },
                tooltip: {
                    shared: false,
                    x: { formatter: function (val) { return val } },
                    y: {
                        formatter: function (val) {
                            return Math.abs(val)
                        }
                    }
                },
                grid: { xaxis: { lines: { show: true } } }
            };

            if (document.getElementById('chart-careers-bar')) {
                if (this.chartsInstances.bar) {
                    this.chartsInstances.bar.updateOptions({
                        series: careerSeries,
                        xaxis: { categories: careerCategories }
                    });
                } else {
                    barOptions.xaxis.categories = careerCategories;
                    this.chartsInstances.bar = new ApexCharts(document.querySelector("#chart-careers-bar"), barOptions);
                    this.chartsInstances.bar.render();
                }
            }

            // --- TOP 10 LEADERS TABLE ---
            // Note: This modifies the DOM for leaders table, maybe it fits here if we consider it "Visuals"
            const topLeaders = leadersData.map(l => {
                const invited = l.total_invitados || 0;
                const attended = l.total_asistencias || 0;
                const efficiency = invited > 0 ? Math.min((attended / invited) * 100, 100) : 0;
                return { ...l, efficiency, invited, attended };
            })
                .sort((a, b) => b.efficiency - a.efficiency || b.attended - a.attended) // Sort by Efficiency then Attendance
                .slice(0, 10);

            const tbodyTop = document.getElementById('tbody-top-leaders');
            if (tbodyTop) {
                tbodyTop.innerHTML = '';
                if (topLeaders.length === 0) {
                    tbodyTop.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Sin datos aún.</td></tr>`;
                } else {
                    topLeaders.forEach((l, i) => {
                        const colorClass = l.efficiency >= 80 ? 'text-green-600 bg-green-50' : (l.efficiency >= 50 ? 'text-orange-600 bg-orange-50' : 'text-slate-600 bg-slate-50');

                        const row = document.createElement('tr');
                        row.className = 'hover:bg-slate-50 transition-colors';
                        row.innerHTML = `
                        <td class="px-4 py-3 font-bold text-slate-400 text-xs text-center">${i + 1}</td>
                        <td class="px-4 py-3">
                            <div class="font-bold text-slate-800 leading-tight">${l.nombre_completo}</div>
                            <div class="text-[10px] text-slate-400 md:hidden">Inv: ${l.invited} | Asist: ${l.attended}</div>
                        </td>
                        <td class="px-4 py-3 font-mono text-xs hidden md:table-cell"><span class="bg-slate-100 px-2 py-1 rounded">G${l.grupo}</span></td>
                        <td class="px-4 py-3 text-center font-mono text-xs text-slate-500 hidden md:table-cell">${l.invited}</td>
                        <td class="px-4 py-3 text-center font-mono text-xs font-bold text-slate-700 hidden md:table-cell">${l.attended}</td>
                        <td class="px-4 py-3 text-right">
                            <span class="px-2 py-1 rounded-lg text-xs font-bold ${colorClass}">${l.efficiency.toFixed(1)}%</span>
                        </td>
                    `;
                        tbodyTop.appendChild(row);
                    });
                }
            }


        } catch (error) {
            console.error("CRITICAL: Error rendering charts. Dashboard functionality preserved.", error);
            // Optional: Show error input specific chart containers
        }
    }
};
