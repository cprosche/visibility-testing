// Configuration
const CHART_COLORS = {
    blue: 'rgb(88, 166, 255)',
    green: 'rgb(63, 185, 80)',
    orange: 'rgb(210, 153, 34)',
    red: 'rgb(248, 81, 73)',
    purple: 'rgb(188, 140, 255)',
    yellow: 'rgb(255, 223, 0)',
    cyan: 'rgb(0, 186, 255)',
};

const LANGUAGE_COLORS = {
    'python': '#3776ab',
    'javascript': '#f7df1e',
    'rust': '#ff6b4a',
    'csharp': '#a179dc',
    'cpp': '#00a4ef',
};

// Global state
let allResults = [];
let referenceResults = [];

// Main initialization
async function init() {
    try {
        // Load results manifest
        const manifest = await loadJSON('results-manifest.json');

        // Load all result files
        const loadPromises = manifest.results.map(file => loadJSON(`results/${file}`));
        allResults = await Promise.all(loadPromises);

        // Filter out python-skyfield (too slow, skews visualizations)
        allResults = allResults.filter(r => r.implementation !== 'python-skyfield');

        // Load reference results for comparison
        const refManifest = await loadJSON('reference-manifest.json');
        const refPromises = refManifest.results.map(file => loadJSON(`reference/${file}`));
        referenceResults = await Promise.all(refPromises);

        // Process and display data
        updateStatistics();
        renderPerformanceTable();
        renderPerformanceChart();
        renderTestCaseChart();
        renderAccuracyRankings();
        renderAccuracyByImplementation();
        renderImplementationDetails();

        // Update last modified timestamp
        document.getElementById('lastUpdated').textContent = new Date(manifest.timestamp).toLocaleString();

    } catch (error) {
        console.error('Failed to load results:', error);
        showError('Failed to load test results. Please ensure the data files are available.');
    }
}

async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    return response.json();
}

function showError(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'background: #f85149; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
}

// Statistics calculation
function updateStatistics() {
    // Group results by implementation
    const byImpl = groupByImplementation(allResults);
    const implementations = Object.keys(byImpl);

    // Count unique test cases
    const testCases = new Set(allResults.map(r => r.testCase));

    // Calculate pass rate
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.visibilityWindows !== undefined).length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    // Find fastest implementation
    const avgTimes = implementations.map(impl => ({
        name: impl,
        avgTime: calculateAvgTime(byImpl[impl])
    })).sort((a, b) => a.avgTime - b.avgTime);

    const fastest = avgTimes.length > 0 ? avgTimes[0].name : 'N/A';

    // Update DOM
    document.getElementById('totalImplementations').textContent = implementations.length;
    document.getElementById('totalTests').textContent = testCases.size;
    document.getElementById('passRate').textContent = `${passRate}%`;
    document.getElementById('fastestImpl').textContent = formatImplName(fastest);
}

function groupByImplementation(results) {
    return results.reduce((acc, result) => {
        const impl = result.implementation || 'unknown';
        if (!acc[impl]) acc[impl] = [];
        acc[impl].push(result);
        return acc;
    }, {});
}

function calculateAvgTime(results) {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + (r.executionTime || 0), 0);
    return sum / results.length;
}

function formatImplName(impl) {
    const nameMap = {
        'cpp-sgp4': 'C++ (SGP4)',
        'csharp-sgp.net': 'C# (SGP.NET)',
        'javascript-satellite.js': 'JavaScript (satellite.js)',
        'python-sgp4': 'Python (sgp4)',
        'python-skyfield': 'Python (Skyfield)',
        'rust-sgp4': 'Rust (sgp4)'
    };
    return nameMap[impl] || impl.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getImplRepoLink(impl) {
    // Map implementations to their library source repositories
    const libraryLinks = {
        'python-skyfield': 'https://github.com/skyfielders/python-skyfield',
        'python-sgp4': 'https://github.com/brandon-rhodes/python-sgp4',
        'javascript-satellite.js': 'https://github.com/shashwatak/satellite-js',
        'rust-sgp4': 'https://github.com/neuromorphicsystems/sgp4',
        'cpp-sgp4': 'https://celestrak.com/software/vallado-sw.php',
        'csharp-sgp.net': 'https://github.com/parzivail/SGP.NET'
    };
    
    return libraryLinks[impl] || `https://github.com/caderosche/visibility-testing/tree/main/implementations/${impl}`;
}

function getLanguageFromImpl(impl) {
    if (impl.startsWith('python')) return 'python';
    if (impl.startsWith('javascript')) return 'javascript';
    if (impl.startsWith('rust')) return 'rust';
    if (impl.startsWith('csharp')) return 'csharp';
    if (impl.startsWith('cpp')) return 'cpp';
    return 'unknown';
}

// Performance table
function renderPerformanceTable() {
    const byImpl = groupByImplementation(allResults);
    const implementations = Object.keys(byImpl);

    const perfData = implementations.map(impl => {
        const results = byImpl[impl];
        const avgTime = calculateAvgTime(results);
        const successRate = (results.filter(r => r.visibilityWindows).length / results.length) * 100;

        return {
            name: impl,
            language: getLanguageFromImpl(impl),
            avgTime,
            successRate
        };
    }).sort((a, b) => a.avgTime - b.avgTime);

    const fastestTime = perfData[0]?.avgTime || 1;

    const tbody = document.getElementById('performanceTableBody');
    tbody.innerHTML = '';

    perfData.forEach((data, index) => {
        const row = document.createElement('tr');
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other';

        row.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${index + 1}</span></td>
            <td>
                <a href="${getImplRepoLink(data.name)}" target="_blank" class="impl-link" title="View library repository">
                    <strong>${formatImplName(data.name)}</strong>
                </a>
            </td>
            <td><span class="lang-badge lang-${data.language}">${data.language}</span></td>
            <td>${data.avgTime.toFixed(3)}s</td>
            <td>
                <div class="speed-bar">
                    <div class="speed-fill" style="width: ${(fastestTime / data.avgTime) * 100}%">
                        ${(data.avgTime / fastestTime).toFixed(2)}x
                    </div>
                </div>
            </td>
            <td><span class="success-rate ${data.successRate === 100 ? 'success-100' : 'success-partial'}">${data.successRate.toFixed(0)}%</span></td>
        `;

        tbody.appendChild(row);
    });
}

// Performance chart
function renderPerformanceChart() {
    const byImpl = groupByImplementation(allResults);
    const implementations = Object.keys(byImpl).sort();

    const avgTimes = implementations.map(impl => calculateAvgTime(byImpl[impl]));
    const colors = implementations.map(impl => LANGUAGE_COLORS[getLanguageFromImpl(impl)] || CHART_COLORS.blue);

    const ctx = document.getElementById('performanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: implementations.map(formatImplName),
            datasets: [{
                label: 'Average Execution Time (seconds)',
                data: avgTimes,
                backgroundColor: colors.map(c => c + '99'),
                borderColor: colors,
                borderWidth: 2
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
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    titleColor: '#c9d1d9',
                    bodyColor: '#c9d1d9',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(3)}s`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#30363d'
                    },
                    ticks: {
                        color: '#8b949e',
                        callback: function(value) {
                            return value + 's';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                }
            }
        }
    });
}

// Test case breakdown chart
function renderTestCaseChart() {
    const byTestCase = allResults.reduce((acc, result) => {
        const testCase = result.testCase || 'unknown';
        if (!acc[testCase]) acc[testCase] = [];
        acc[testCase].push(result);
        return acc;
    }, {});

    const testCases = Object.keys(byTestCase).sort();
    const implementations = [...new Set(allResults.map(r => r.implementation))].sort();

    const datasets = implementations.map((impl, idx) => {
        const colors = Object.values(CHART_COLORS);
        const color = LANGUAGE_COLORS[getLanguageFromImpl(impl)] || colors[idx % colors.length];

        return {
            label: formatImplName(impl),
            data: testCases.map(tc => {
                const result = byTestCase[tc].find(r => r.implementation === impl);
                return result ? result.executionTime : 0;
            }),
            backgroundColor: color + '99',
            borderColor: color,
            borderWidth: 2
        };
    });

    const ctx = document.getElementById('testCaseChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: testCases.map(tc => tc.replace(/_/g, ' ').substring(0, 20)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#8b949e',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    titleColor: '#c9d1d9',
                    bodyColor: '#c9d1d9',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#30363d'
                    },
                    ticks: {
                        color: '#8b949e',
                        callback: function(value) {
                            return value + 's';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b949e',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Accuracy rankings table
function renderAccuracyRankings() {
    if (referenceResults.length === 0) {
        console.warn('No reference results available for accuracy comparison');
        document.getElementById('accuracyTableBody').innerHTML =
            '<tr><td colspan="8" class="loading">No reference results available for accuracy comparison.</td></tr>';
        return;
    }

    // Calculate deltas grouped by implementation
    const deltasByImpl = calculateAccuracyDeltasByImplementation();

    // Create ranking data
    const rankings = Object.keys(deltasByImpl).map(impl => {
        const data = deltasByImpl[impl];

        // Calculate overall pass rate (average of three metrics)
        const overallPassRate = (data.azimuth.withinTolerance + data.elevation.withinTolerance + data.range.withinTolerance) / 3;

        // Calculate overall grade
        const grade = overallPassRate >= 95 ? 'excellent' :
                     overallPassRate >= 85 ? 'good' :
                     overallPassRate >= 70 ? 'fair' : 'poor';
        const gradeText = overallPassRate >= 95 ? 'Excellent' :
                         overallPassRate >= 85 ? 'Good' :
                         overallPassRate >= 70 ? 'Fair' : 'Poor';

        // Calculate average error across all metrics (normalized)
        const avgError = (data.azimuth.avg / 0.1 + data.elevation.avg / 0.1 + data.range.avg / 1.0) / 3;

        return {
            impl,
            language: getLanguageFromImpl(impl),
            grade,
            gradeText,
            overallPassRate,
            avgError,
            azimuthAvg: data.azimuth.avg,
            azimuthPass: data.azimuth.withinTolerance,
            elevationAvg: data.elevation.avg,
            elevationPass: data.elevation.withinTolerance,
            rangeAvg: data.range.avg,
            rangePass: data.range.withinTolerance
        };
    });

    // Sort by overall pass rate (descending), then by average error (ascending)
    rankings.sort((a, b) => {
        if (Math.abs(a.overallPassRate - b.overallPassRate) > 0.1) {
            return b.overallPassRate - a.overallPassRate;
        }
        return a.avgError - b.avgError;
    });

    const tbody = document.getElementById('accuracyTableBody');
    tbody.innerHTML = '';

    rankings.forEach((data, index) => {
        const row = document.createElement('tr');
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other';

        row.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${index + 1}</span></td>
            <td>
                <a href="${getImplRepoLink(data.impl)}" target="_blank" class="impl-link" title="View library repository">
                    <strong>${formatImplName(data.impl)}</strong>
                </a>
            </td>
            <td><span class="lang-badge lang-${data.language}">${data.language}</span></td>
            <td><span class="accuracy-grade grade-${data.grade}">${data.gradeText}</span></td>
            <td>
                <div class="accuracy-cell">
                    <div class="accuracy-cell-value" style="color: ${data.azimuthAvg <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                        ${data.azimuthAvg.toFixed(4)}°
                    </div>
                    <div class="accuracy-cell-pass" style="color: ${data.azimuthPass >= 95 ? 'var(--accent-green)' : data.azimuthPass >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                        ${data.azimuthPass.toFixed(0)}% pass
                    </div>
                </div>
            </td>
            <td>
                <div class="accuracy-cell">
                    <div class="accuracy-cell-value" style="color: ${data.elevationAvg <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                        ${data.elevationAvg.toFixed(4)}°
                    </div>
                    <div class="accuracy-cell-pass" style="color: ${data.elevationPass >= 95 ? 'var(--accent-green)' : data.elevationPass >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                        ${data.elevationPass.toFixed(0)}% pass
                    </div>
                </div>
            </td>
            <td>
                <div class="accuracy-cell">
                    <div class="accuracy-cell-value" style="color: ${data.rangeAvg <= 1.0 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                        ${data.rangeAvg.toFixed(4)} km
                    </div>
                    <div class="accuracy-cell-pass" style="color: ${data.rangePass >= 95 ? 'var(--accent-green)' : data.rangePass >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                        ${data.rangePass.toFixed(0)}% pass
                    </div>
                </div>
            </td>
            <td>
                <div class="overall-pass-rate">
                    <div class="pass-rate-value" style="color: ${data.overallPassRate >= 95 ? 'var(--accent-green)' : data.overallPassRate >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                        ${data.overallPassRate.toFixed(1)}%
                    </div>
                    <div class="pass-rate-bar">
                        <div class="pass-rate-fill" style="width: ${data.overallPassRate}%; background: ${data.overallPassRate >= 95 ? 'var(--accent-green)' : data.overallPassRate >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}"></div>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Accuracy by implementation
function renderAccuracyByImplementation() {
    if (referenceResults.length === 0) {
        console.warn('No reference results available for accuracy comparison');
        document.getElementById('accuracyByImplementation').innerHTML =
            '<p class="loading">No reference results available for accuracy comparison.</p>';
        return;
    }

    // Calculate deltas grouped by implementation
    const deltasByImpl = calculateAccuracyDeltasByImplementation();

    const container = document.getElementById('accuracyByImplementation');
    container.innerHTML = '';

    // Get implementations sorted by average overall accuracy
    const implementations = Object.keys(deltasByImpl).sort((a, b) => {
        const aAvg = (deltasByImpl[a].azimuth.avg + deltasByImpl[a].elevation.avg + deltasByImpl[a].range.avg) / 3;
        const bAvg = (deltasByImpl[b].azimuth.avg + deltasByImpl[b].elevation.avg + deltasByImpl[b].range.avg) / 3;
        return aAvg - bAvg;
    });

    implementations.forEach(impl => {
        const data = deltasByImpl[impl];
        const card = document.createElement('div');
        card.className = 'accuracy-impl-card';

        // Calculate overall grade
        const overallPct = (data.azimuth.withinTolerance + data.elevation.withinTolerance + data.range.withinTolerance) / 3;
        const grade = overallPct >= 95 ? 'excellent' : overallPct >= 85 ? 'good' : overallPct >= 70 ? 'fair' : 'poor';
        const gradeText = overallPct >= 95 ? 'Excellent' : overallPct >= 85 ? 'Good' : overallPct >= 70 ? 'Fair' : 'Poor';

        card.innerHTML = `
            <div class="accuracy-impl-header">
                <div>
                    <a href="${getImplRepoLink(impl)}" target="_blank" class="impl-link impl-link-large" title="View library repository">
                        <div class="accuracy-impl-name">${formatImplName(impl)}</div>
                    </a>
                    <span class="lang-badge lang-${getLanguageFromImpl(impl)}">${getLanguageFromImpl(impl)}</span>
                </div>
                <span class="accuracy-grade grade-${grade}">${gradeText}</span>
            </div>

            <div class="accuracy-metric-row">
                <div class="accuracy-metric-header">
                    <span class="accuracy-metric-name">Azimuth Error</span>
                    <span class="accuracy-metric-tolerance">±0.1°</span>
                </div>
                <div class="accuracy-metric-stats">
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Avg</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.azimuth.avg <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.azimuth.avg.toFixed(4)}°
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Max</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.azimuth.max <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.azimuth.max.toFixed(4)}°
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Pass</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.azimuth.withinTolerance >= 95 ? 'var(--accent-green)' : data.azimuth.withinTolerance >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                            ${data.azimuth.withinTolerance.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            <div class="accuracy-metric-row">
                <div class="accuracy-metric-header">
                    <span class="accuracy-metric-name">Elevation Error</span>
                    <span class="accuracy-metric-tolerance">±0.1°</span>
                </div>
                <div class="accuracy-metric-stats">
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Avg</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.elevation.avg <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.elevation.avg.toFixed(4)}°
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Max</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.elevation.max <= 0.1 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.elevation.max.toFixed(4)}°
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Pass</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.elevation.withinTolerance >= 95 ? 'var(--accent-green)' : data.elevation.withinTolerance >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                            ${data.elevation.withinTolerance.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            <div class="accuracy-metric-row">
                <div class="accuracy-metric-header">
                    <span class="accuracy-metric-name">Range Error</span>
                    <span class="accuracy-metric-tolerance">±1.0 km</span>
                </div>
                <div class="accuracy-metric-stats">
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Avg</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.range.avg <= 1.0 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.range.avg.toFixed(4)} km
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Max</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.range.max <= 1.0 ? 'var(--accent-green)' : 'var(--accent-orange)'}">
                            ${data.range.max.toFixed(4)} km
                        </span>
                    </div>
                    <div class="accuracy-metric-stat">
                        <span class="accuracy-metric-stat-label">Pass</span>
                        <span class="accuracy-metric-stat-value" style="color: ${data.range.withinTolerance >= 95 ? 'var(--accent-green)' : data.range.withinTolerance >= 80 ? 'var(--accent-orange)' : 'var(--accent-red)'}">
                            ${data.range.withinTolerance.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function calculateAccuracyDeltasByImplementation() {
    const deltasByImpl = {};

    allResults.forEach(result => {
        const impl = result.implementation;
        if (!deltasByImpl[impl]) {
            deltasByImpl[impl] = {
                azimuth: [],
                elevation: [],
                range: []
            };
        }

        // Find matching reference result
        const refResult = referenceResults.find(ref =>
            ref.testCase === result.testCase
        );

        if (!refResult || !result.visibilityWindows || !refResult.visibilityWindows) {
            return;
        }

        // Compare visibility windows
        result.visibilityWindows.forEach((window, idx) => {
            const refWindow = refResult.visibilityWindows[idx];
            if (!refWindow || !window.points || !refWindow.points) return;

            // Compare points
            window.points.forEach((point, pidx) => {
                const refPoint = refWindow.points[pidx];
                if (!refPoint) return;

                if (point.azimuth !== undefined && refPoint.azimuth !== undefined) {
                    deltasByImpl[impl].azimuth.push(Math.abs(point.azimuth - refPoint.azimuth));
                }
                if (point.elevation !== undefined && refPoint.elevation !== undefined) {
                    deltasByImpl[impl].elevation.push(Math.abs(point.elevation - refPoint.elevation));
                }
                if (point.range !== undefined && refPoint.range !== undefined) {
                    deltasByImpl[impl].range.push(Math.abs(point.range - refPoint.range));
                }
            });
        });
    });

    // Calculate statistics for each implementation
    Object.keys(deltasByImpl).forEach(impl => {
        ['azimuth', 'elevation', 'range'].forEach(metric => {
            const data = deltasByImpl[impl][metric];
            const tolerance = metric === 'range' ? 1.0 : 0.1;

            if (data.length > 0) {
                const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
                const max = Math.max(...data);
                const withinTolerance = (data.filter(val => val <= tolerance).length / data.length) * 100;

                deltasByImpl[impl][metric] = {
                    avg,
                    max,
                    withinTolerance,
                    count: data.length
                };
            } else {
                deltasByImpl[impl][metric] = {
                    avg: 0,
                    max: 0,
                    withinTolerance: 0,
                    count: 0
                };
            }
        });
    });

    return deltasByImpl;
}

// Implementation details
function renderImplementationDetails() {
    const byImpl = groupByImplementation(allResults);
    const implementations = Object.keys(byImpl).sort();

    const container = document.getElementById('implementationDetails');
    container.innerHTML = '';

    implementations.forEach(impl => {
        const results = byImpl[impl];
        const avgTime = calculateAvgTime(results);
        const successCount = results.filter(r => r.visibilityWindows).length;
        const totalCount = results.length;

        const card = document.createElement('div');
        card.className = 'impl-card';

        card.innerHTML = `
            <div class="impl-header">
                <a href="${getImplRepoLink(impl)}" target="_blank" class="impl-link impl-link-large" title="View library repository">
                    <div class="impl-name">${formatImplName(impl)}</div>
                </a>
                <span class="lang-badge lang-${getLanguageFromImpl(impl)}">${getLanguageFromImpl(impl)}</span>
            </div>
            <div class="impl-stats">
                <div class="impl-stat">
                    <div class="impl-stat-label">Avg Time</div>
                    <div class="impl-stat-value">${avgTime.toFixed(3)}s</div>
                </div>
                <div class="impl-stat">
                    <div class="impl-stat-label">Success Rate</div>
                    <div class="impl-stat-value">${((successCount/totalCount)*100).toFixed(0)}%</div>
                </div>
                <div class="impl-stat">
                    <div class="impl-stat-label">Tests Passed</div>
                    <div class="impl-stat-value">${successCount}/${totalCount}</div>
                </div>
                <div class="impl-stat">
                    <div class="impl-stat-label">Total Windows</div>
                    <div class="impl-stat-value">${countTotalWindows(results)}</div>
                </div>
            </div>
            <div class="test-results">
                ${renderTestResults(results)}
            </div>
        `;

        container.appendChild(card);
    });
}

function countTotalWindows(results) {
    return results.reduce((sum, r) => {
        return sum + (r.visibilityWindows ? r.visibilityWindows.length : 0);
    }, 0);
}

function renderTestResults(results) {
    return results.map(result => {
        const status = result.visibilityWindows !== undefined ? 'pass' : 'fail';
        const statusText = status === 'pass' ? '✓ Pass' : '✗ Fail';

        return `
            <div class="test-result-item">
                <span class="test-name">${result.testCase}</span>
                <span class="test-status status-${status}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
