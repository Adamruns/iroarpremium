(function () {
    'use strict';

    const BASE_PATH = '/StudentRegistrationSsb/ssb';
    const PAGE_SIZE = 25;
    const DEBOUNCE_DELAY = 300;
    const AUTOCOMPLETE_MAX_RESULTS = 20;

    const FILTERS = [
        { key: 'txt_subject', label: 'Subject', endpoint: 'get_subject', type: 'autocomplete' },
        { key: 'txt_courseNumber', label: 'Course Number', type: 'text' },
        { key: 'txt_courseTitle', label: 'Title', type: 'text' },
        { key: 'txt_crn', label: 'CRN', type: 'text' },
        { key: 'txt_instructor', label: 'Instructor', endpoint: 'get_instructor', type: 'autocomplete' },
        { key: 'txt_campus', label: 'Campus', endpoint: 'get_campus', type: 'autocomplete' },
        { key: 'txt_level', label: 'Level', endpoint: 'get_level', type: 'autocomplete' },
        { key: 'txt_scheduleType', label: 'Schedule Type', endpoint: 'get_scheduleType', type: 'autocomplete' },
        { key: 'txt_attribute', label: 'Attribute', endpoint: 'get_attribute', type: 'autocomplete' },
        { key: 'txt_partOfTerm', label: 'Part of Term', endpoint: 'get_partOfTerm', type: 'autocomplete' },
        { key: 'txt_instructionalMethod', label: 'Instructional Method', endpoint: 'get_instructionalMethod', type: 'autocomplete' },
        { key: 'txt_creditHourRange', label: 'Credit Hours', type: 'range' },
    ];

    let termLabel = '';
    let currentTerm = '';
    let cartItems = [];
    let currentSearchResults = [];
    let currentPage = 0;
    let totalResults = 0;
    let sortColumn = 'subjectDescription';
    let sortDirection = 'asc';
    let activeFilters = {};
    let searchSequence = 0;
    let searchQueue = Promise.resolve();

    const insightSorts = ['rmpRating', 'rmpDifficulty', 'rmpWTA', 'grades'];
    const sortOptions = {subjectDescription:'Subject',courseNumber:'Course number',courseTitle:'Title',sequenceNumber:'Section',courseReferenceNumber:'CRN',creditHours:'Credits',rmpRating:'Rating',rmpDifficulty:'Difficulty',rmpWTA:'Would take again',grades:'Average A grade'};
    const rmpDataMap = new Map();
    const gradeDataMap = new Map();

    function escapeHTML(text) {
        if (text === null || text === undefined) return '';
        const element = document.createElement('span');
        element.textContent = String(text);
        return element.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function extractTerm() {
        termLabel = document.querySelector('label[for="txt_term"]')?.textContent.replace(/^Term\s*:\s*/i, '').trim() || '';
        const explicit = document.querySelector('#txt_term')?.value || new URLSearchParams(location.search).get('term');
        if (/^20\d{4}$/.test(explicit)) return explicit;
        const match = /^(Spring|Summer(?: I{1,2})?|Fall)\s+(20\d{2})/i.exec(termLabel);
        if (!match) return '';
        const suffix = {spring:'01', summer:'05', 'summer i':'05', 'summer ii':'06', fall:'08'};
        return match[2] + suffix[match[1].toLowerCase()];
    }

    function buildFilterGroupHTML(filter) {
        if (filter.type === 'autocomplete') {
            return `
                <fieldset class="irp-filter-group" data-filter-key="${filter.key}">
                    <label for="irp-${filter.key}">${filter.label}</label>
                    <div class="irp-autocomplete-wrapper">
                        <input type="text" id="irp-${filter.key}" autocomplete="off"
                               placeholder="Search ${filter.label.toLowerCase()}..."
                               data-endpoint="${filter.endpoint}" data-key="${filter.key}">
                        <ul class="irp-autocomplete-dropdown irp-hidden"></ul>
                    </div>
                </fieldset>`;
        }

        if (filter.type === 'range') {
            return `
                <fieldset class="irp-filter-group" data-filter-key="${filter.key}">
                    <label>${filter.label}</label>
                    <div class="irp-range-inputs">
                        <input type="number" aria-label="Minimum credits" id="irp-${filter.key}-min" placeholder="Min"
                               min="0" data-key="${filter.key}" data-range="min">
                        <input type="number" aria-label="Maximum credits" id="irp-${filter.key}-max" placeholder="Max"
                               min="0" data-key="${filter.key}" data-range="max">
                    </div>
                </fieldset>`;
        }

        return `
            <fieldset class="irp-filter-group" data-filter-key="${filter.key}">
                <label for="irp-${filter.key}">${filter.label}</label>
                <input type="text" id="irp-${filter.key}" placeholder="Enter ${filter.label.toLowerCase()}..."
                       data-key="${filter.key}">
            </fieldset>`;
    }

    function buildShell() {
        const filterGroupsHTML = FILTERS.map(buildFilterGroupHTML).join('');

        const app = document.createElement('div');
        app.className = 'irp-app';

        app.innerHTML = `
            <header class="irp-topbar">
                <div class="irp-topbar-left">
                    <button type="button" class="irp-menu-toggle" aria-expanded="false" aria-controls="irp-filters" aria-label="Toggle filters">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <a href="https://sadv.sis.clemson.edu/StudentSelfService/ssb/studentCommonDashboard" class="irp-brand">IRoar <span class="irp-brand-premium">Premium</span></a>
                </div>
                <div class="irp-topbar-center">
                    <span class="irp-term-display"></span>
                </div>
                <div class="irp-topbar-right">
                    <button type="button" class="irp-cart-toggle" aria-expanded="false" aria-controls="irp-planner">My schedule
                        <span class="irp-cart-badge irp-hidden">0</span>
                    </button>
                </div>
            </header>
            <div class="irp-body">
                <aside class="irp-sidebar" id="irp-filters">
                    <div class="irp-sidebar-header">
                        <h2>Filters</h2>
                        <button type="button" class="irp-clear-all">Clear all</button>
                    </div>
                    <div class="irp-sidebar-filters">
                        ${filterGroupsHTML}
                    </div>
                    <div class="irp-sidebar-footer">
                        <button type="button" class="irp-search-button">Search</button>
                    </div>
                </aside>
                <main class="irp-main">
                    <header class="irp-intro"><div><p>Course planning</p><h1>Browse classes</h1></div>
                        <button type="button" class="irp-native">Use Banner view</button></header>
                    <div class="irp-active-filters"></div>
                    <div class="irp-sort-controls" hidden><label>Sort sections <select class="irp-sort-by">
                        ${Object.entries(sortOptions).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')}
                        </select></label><button class="irp-sort-order" type="button">Ascending</button></div>
                    <div class="irp-results-container">
                        <div class="irp-empty-state"><strong>Find a section</strong><span>Choose filters or search to see all classes for this term.</span></div>
                    </div>
                    <nav class="irp-pagination"></nav>
                </main>
            </div>
            <aside class="irp-drawer irp-drawer-closed" id="irp-planner" aria-labelledby="irp-schedule-title" role="dialog" aria-modal="true" inert>
                <div class="irp-drawer-header"><div><p>Schedule preview</p><h2 id="irp-schedule-title">My week</h2>
                    <span class="irp-cart-count">0</span> sections · <span class="irp-cart-credits">0 credits</span></div>
                    <button type="button" class="irp-drawer-close" aria-label="Close schedule">×</button></div>
                <div class="irp-planner-body">
                    <div class="irp-drawer-conflicts irp-hidden" role="status"></div>
                    <div class="irp-drawer-schedule"></div><div class="irp-drawer-courses"></div>
                </div>
                <div class="irp-drawer-footer">This preview lasts until you leave this page. Use Banner to register.</div>
            </aside>
            <div class="irp-drawer-overlay irp-hidden"></div>
        `;

        document.body.appendChild(app);
    }

    function debounce(callback, delay) {
        let timerId;

        return function (...arguments_) {
            clearTimeout(timerId);
            timerId = setTimeout(function () {
                callback(...arguments_);
            }, delay);
        };
    }

    function fetchAutocomplete(endpoint, searchTerm) {
        const url = BASE_PATH + '/classSearch/' + endpoint
            + '?searchTerm=' + encodeURIComponent(searchTerm)
            + '&term=' + currentTerm
            + '&offset=1'
            + '&max=' + AUTOCOMPLETE_MAX_RESULTS;

        return fetch(url).then(function (response) {
            if (!response.ok) {
                throw new Error('Autocomplete fetch failed: ' + response.status);
            }

            return response.json();
        });
    }

    function renderActiveFilterChips() {
        const container = document.querySelector('.irp-active-filters');

        if (!container) {
            return;
        }

        container.innerHTML = '';
        const filterKeys = Object.keys(activeFilters);

        for (const key of filterKeys) {
            const filterValue = activeFilters[key];
            const filterConfig = FILTERS.find(function (filter) { return filter.key === key; });
            const label = filterConfig ? filterConfig.label : key;
            const displayValue = filterValue.label || filterValue;

            const chip = document.createElement('span');
            chip.className = 'irp-chip';
            chip.innerHTML = '<span class="irp-chip-label">' + escapeHTML(label) + ': ' + escapeHTML(displayValue) + '</span>'
                + '<button type="button" class="irp-chip-remove" data-key="' + escapeHTML(key) + '" aria-label="Remove ' + escapeHTML(label) + ' filter">&times;</button>';
            container.appendChild(chip);
        }
    }

    function clearFilter(key) {
        delete activeFilters[key];

        const filterConfig = FILTERS.find(function (filter) { return filter.key === key; });

        if (filterConfig && filterConfig.type === 'range') {
            const minInput = document.getElementById('irp-' + key + '-min');
            const maxInput = document.getElementById('irp-' + key + '-max');

            if (minInput) {
                minInput.value = '';
            }

            if (maxInput) {
                maxInput.value = '';
            }
        } else {
            const input = document.getElementById('irp-' + key);

            if (input) {
                input.value = '';
            }
        }

        renderActiveFilterChips();
    }

    function clearAllFilters() {
        activeFilters = {};

        for (const filter of FILTERS) {
            if (filter.type === 'range') {
                const minInput = document.getElementById('irp-' + filter.key + '-min');
                const maxInput = document.getElementById('irp-' + filter.key + '-max');

                if (minInput) {
                    minInput.value = '';
                }

                if (maxInput) {
                    maxInput.value = '';
                }
            } else {
                const input = document.getElementById('irp-' + filter.key);

                if (input) {
                    input.value = '';
                }
            }
        }

        renderActiveFilterChips();
    }

    function normalizeProfessorName(displayName) {
        if (!displayName) return '';
        if (displayName.includes(',')) {
            const parts = displayName.split(',');
            return parts[1].trim() + ' ' + parts[0].trim();
        }
        return displayName;
    }

    function formatTime(timeString) {
        if (!timeString || timeString.length < 4) return '';
        let hours = parseInt(timeString.substring(0, 2), 10);
        const minutes = timeString.substring(2, 4);
        const period = hours >= 12 ? 'pm' : 'am';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        return hours + ':' + minutes + period;
    }

    function formatDays(meetingTime) {
        let days = '';
        if (meetingTime.monday) days += 'M';
        if (meetingTime.tuesday) days += 'T';
        if (meetingTime.wednesday) days += 'W';
        if (meetingTime.thursday) days += 'R';
        if (meetingTime.friday) days += 'F';
        if (meetingTime.saturday) days += 'Sa';
        if (meetingTime.sunday) days += 'Su';
        return days || 'TBA';
    }

    function getRatingColor(rating) {
        if (rating >= 4) return 'good';
        if (rating >= 3) return 'medium';
        return 'poor';
    }

    function getDifficultyColor(difficulty) {
        if (difficulty <= 2.5) return 'good';
        if (difficulty <= 3.5) return 'medium';
        return 'poor';
    }

    function getWTAColor(percent) {
        if (percent >= 70) return 'good';
        if (percent >= 50) return 'medium';
        return 'poor';
    }

    function computeAverageA(gradeData) {
        if (!gradeData || gradeData.length === 0) return -1;
        let total = 0;
        for (let i = 0; i < gradeData.length; i++) {
            total += parseFloat(gradeData[i].data[4]) || 0;
        }
        return total / gradeData.length;
    }

    function renderStatusDot(section) {
        const enrolled = section.enrollment || 0;
        const max = section.maximumEnrollment || 0;
        const waitCount = section.waitCount || 0;
        if (enrolled >= max && waitCount > 0) return '<span class="irp-status irp-status-waitlist" title="Waitlist"></span>';
        if (enrolled >= max) return '<span class="irp-status irp-status-closed" title="Closed"></span>';
        return '<span class="irp-status irp-status-open" title="Open"></span>';
    }

    function renderProfessor(section) {
        const faculty = section.faculty && section.faculty[0];
        if (!faculty) return '<span class="irp-text-muted">TBA</span>';
        return '<span class="irp-professor" data-name="' + escapeHTML(faculty.displayName) + '">' + escapeHTML(faculty.displayName) + '</span>';
    }

    function renderSeats(section) {
        const enrolled = section.enrollment || 0;
        const max = section.maximumEnrollment || 0;
        const remaining = max - enrolled;
        const colorClass = remaining > 5 ? 'irp-good' : remaining > 0 ? 'irp-medium' : 'irp-poor';
        return '<span class="' + colorClass + '">' + enrolled + '/' + max + '</span>';
    }

    function renderAddButton(section) {
        const inCart = cartItems.some(function (item) { return item.courseReferenceNumber === section.courseReferenceNumber; });
        if (inCart) return '<button class="irp-btn-added" data-crn="' + escapeHTML(section.courseReferenceNumber) + '" disabled>Added</button>';
        return '<button class="irp-btn-add" data-crn="' + escapeHTML(section.courseReferenceNumber) + '">Add</button>';
    }

    function showLoadingState() {
        const container = document.querySelector('.irp-results-container');
        if (!container) return;

        let html = '';
        for (let i = 0; i < 8; i++) {
            html += '<div class="irp-skeleton-row"></div>';
        }
        container.innerHTML = html;
    }

    function showErrorState(message) {
        const container = document.querySelector('.irp-results-container');
        if (!container) return;

        container.innerHTML = '<div class="irp-empty-state">'
            + '<p>' + escapeHTML(message) + '</p>'
            + '<button type="button" class="irp-retry-btn">Retry</button>'
            + '</div>';

        const retryButton = container.querySelector('.irp-retry-btn');
        if (retryButton) {
            retryButton.addEventListener('click', function () { executeSearch(); });
        }
    }

    function showEmptyResults() {
        const container = document.querySelector('.irp-results-container');
        if (!container) return;
        container.innerHTML = '<div class="irp-empty-state">No results found</div>';
    }

    function renderResultsTable(results) {
        const container = document.querySelector('.irp-results-container');
        if (!container) return;

        if (!results || results.length === 0) {
            showEmptyResults();
            return;
        }

        const headers = [['Section','courseTitle'],['Meetings',''],['Instructor',''],['Rating','rmpRating'],['Difficulty','rmpDifficulty'],['Take again','rmpWTA'],['Grades','grades'],['Seats',''],['','']];
        let html = '<table class="irp-table"><thead><tr>' + headers.map(([label,key]) =>
            key ? '<th data-sort-key="'+key+'"><button type="button">'+label+'</button></th>' : '<th>'+label+'</th>'
        ).join('') + '</tr></thead><tbody>';
        for (const section of results) {
            const e = escapeHTML;
            const title = e(section.courseTitle);
            const code = e([section.subject,section.courseNumber].join(' '));
            const times = [...new Set((section.meetingsFaculty || []).map(({meetingTime:m}) => m && (m.beginTime
                ? formatDays(m)+' '+formatTime(m.beginTime)+'–'+formatTime(m.endTime) : 'Time TBA')).filter(Boolean))];
            const location = (section.meetingsFaculty || [])[0]?.meetingTime;
            const venue = [location?.building, location?.room].filter(Boolean).join(' ');
            const metric = (label,field) => '<td data-label="'+label+'"><span data-metric="'+field+'">'+(section.faculty?.length ? '…' : '—')+'</span></td>';
            html += '<tr data-crn="'+e(section.courseReferenceNumber)+'"><td class="irp-course"><small>'+code+' · '+e(section.sequenceNumber)+'</small>'
                +'<button class="irp-title" type="button" aria-expanded="false">'+title+'</button><small>CRN '+e(section.courseReferenceNumber)+' · '+e(section.creditHours ?? section.creditHourLow ?? '—')+' credits</small></td>'
                +'<td data-label="Meetings">'+e(times.join(' / ') || 'Time TBA')+'<small>'+e(venue)+'</small></td>'
                +'<td data-label="Instructor">'+renderProfessor(section)+'</td>'
                +metric('Rating','rating')+metric('Difficulty','difficulty')+metric('Take again','again')+metric('Grade history','grades')
                +'<td data-label="Seats">'+renderStatusDot(section)+' '+renderSeats(section)+'</td><td>'+renderAddButton(section)+'</td></tr>';
        }
        container.innerHTML = html+'</tbody></table>';
    }

    function renderPagination() {
        const paginationContainer = document.querySelector('.irp-pagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(totalResults / PAGE_SIZE);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        const start = currentPage * PAGE_SIZE + 1;
        const end = Math.min((currentPage + 1) * PAGE_SIZE, totalResults);

        const html = '<span class="irp-page-info">Showing ' + start + '-' + end + ' of ' + totalResults + ' results</span>'
            + '<div class="irp-page-buttons">'
            + '<button type="button" class="irp-page-btn" data-page="' + (currentPage - 1) + '"' + (currentPage === 0 ? ' disabled' : '') + '>Prev</button>'
            + '<button type="button" class="irp-page-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages - 1 ? ' disabled' : '') + '>Next</button>'
            + '</div>';

        paginationContainer.innerHTML = html;
    }

    function updateRMPCells(normalizedName) {
        const teacher = rmpDataMap.get(normalizedName);
        const rows = document.querySelectorAll('.irp-table tbody tr[data-crn]');

        for (let i = 0; i < rows.length; i++) {
            const profElement = rows[i].querySelector('.irp-professor');
            if (!profElement) continue;

            const rowNormalized = normalizeProfessorName(profElement.dataset.name).toLowerCase();
            if (rowNormalized !== normalizedName) continue;

            const cell = key => rows[i].querySelector('[data-metric="' + key + '"]');

            if (teacher.error || !teacher.numRatings) {
                cell('rating').innerHTML = '<span class="irp-text-muted">N/A</span>';
                cell('difficulty').innerHTML = '<span class="irp-text-muted">N/A</span>';
                cell('again').innerHTML = '<span class="irp-text-muted">N/A</span>';
            } else {
                cell('rating').innerHTML = '<span class="irp-' + getRatingColor(teacher.avgRating) + '">' + escapeHTML(teacher.avgRating) + '</span>';
                cell('difficulty').innerHTML = '<span class="irp-' + getDifficultyColor(teacher.avgDifficulty) + '">' + escapeHTML(teacher.avgDifficulty) + '</span>';
                cell('again').innerHTML = '<span class="irp-' + getWTAColor(teacher.wouldTakeAgainPercent) + '">' + (teacher.wouldTakeAgainPercent >= 0 ? Math.round(teacher.wouldTakeAgainPercent) + '%' : 'N/A') + '</span>';
            }
        }
    }

    function loadRMPDataForResults(results) {
        const professors = new Set();
        for (let i = 0; i < results.length; i++) {
            const faculty = results[i].faculty && results[i].faculty[0];
            if (faculty && faculty.displayName) {
                professors.add(faculty.displayName);
            }
        }

        professors.forEach(function (displayName) {
            const normalized = normalizeProfessorName(displayName).toLowerCase();
            if (rmpDataMap.has(normalized)) {
                updateRMPCells(normalized);
                return;
            }

            const professorName = normalizeProfessorName(displayName);
            const port = chrome.runtime.connect({ name: 'professor-rating' });
            port.postMessage({ professorName: professorName });
            port.onMessage.addListener(function (teacher) {
                rmpDataMap.set(normalized, teacher);
                updateRMPCells(normalized);
                refreshOpenMetrics(normalized);
                port.disconnect();
            });
        });
    }

    function updateGradeCells(normalizedName) {
        const gradeData = gradeDataMap.get(normalizedName);
        const rows = document.querySelectorAll('.irp-table tbody tr[data-crn]');

        for (let i = 0; i < rows.length; i++) {
            const profElement = rows[i].querySelector('.irp-professor');
            if (!profElement) continue;

            const rowNormalized = normalizeProfessorName(profElement.dataset.name).toLowerCase();
            if (rowNormalized !== normalizedName) continue;

            const cell = rows[i].querySelector('[data-metric="grades"]');
            if (!gradeData || gradeData.length === 0) {
                cell.innerHTML = '<span class="irp-text-muted">N/A</span>';
                continue;
            }

            const totals = { a: 0, b: 0, c: 0, d: 0, f: 0 };
            const count = gradeData.length;
            for (let j = 0; j < count; j++) {
                const row = gradeData[j].data;
                totals.a += parseFloat(row[4]) || 0;
                totals.b += parseFloat(row[5]) || 0;
                totals.c += parseFloat(row[6]) || 0;
                totals.d += parseFloat(row[7]) || 0;
                totals.f += parseFloat(row[8]) || 0;
            }

            const averageA = Math.round(totals.a / count);
            const averageB = Math.round(totals.b / count);
            const averageC = Math.round(totals.c / count);
            const averageD = Math.round(totals.d / count);
            const averageF = Math.round(totals.f / count);

            cell.innerHTML = '<div class="irp-grade-bar" title="A:' + averageA + '% B:' + averageB + '% C:' + averageC + '% D:' + averageD + '% F:' + averageF + '%">'
                + '<div class="irp-grade-a" style="width:' + averageA + '%"></div>'
                + '<div class="irp-grade-b" style="width:' + averageB + '%"></div>'
                + '<div class="irp-grade-c" style="width:' + averageC + '%"></div>'
                + '<div class="irp-grade-d" style="width:' + averageD + '%"></div>'
                + '<div class="irp-grade-f" style="width:' + averageF + '%"></div>'
                + '</div>';
        }
    }

    function loadGradeDataForResults(results) {
        const professors = new Set();
        for (let i = 0; i < results.length; i++) {
            const faculty = results[i].faculty && results[i].faculty[0];
            if (faculty && faculty.displayName) professors.add(faculty.displayName);
        }

        professors.forEach(function (displayName) {
            const normalized = normalizeProfessorName(displayName).toLowerCase();
            if (gradeDataMap.has(normalized)) {
                updateGradeCells(normalized);
                return;
            }

            const name = normalizeProfessorName(displayName);
            const nameParts = name.split(' ');
            if (nameParts.length < 2) return;

            const port = chrome.runtime.connect({ name: 'grade-distribution' });
            port.postMessage({ type: 'gradeDistribution', professor: { firstName: nameParts[0], lastName: nameParts[nameParts.length - 1] } });
            port.onMessage.addListener(function (response) {
                if (response.type === 'gradeDistribution') {
                    gradeDataMap.set(normalized, response.data);
                    updateGradeCells(normalized);
                    refreshOpenMetrics(normalized);
                    port.disconnect();
                }
            });
        });
    }

    function updateSortIndicators() {
        document.querySelector('.irp-sort-controls').hidden = currentSearchResults.length === 0;
        document.querySelector('.irp-sort-by').value = sortColumn;
        document.querySelector('.irp-sort-order').textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
        const headers = document.querySelectorAll('.irp-table thead th[data-sort-key]');
        for (let i = 0; i < headers.length; i++) {
            headers[i].removeAttribute('aria-sort');
            headers[i].classList.remove('irp-sort-asc', 'irp-sort-desc');
            if (headers[i].dataset.sortKey === sortColumn) {
                headers[i].setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
                headers[i].classList.add(sortDirection === 'asc' ? 'irp-sort-asc' : 'irp-sort-desc');
            }
        }
    }

    function sortResultsClientSide(key) {
        currentSearchResults.sort(function (a, b) {
            const nameA = normalizeProfessorName(a.faculty && a.faculty[0] ? a.faculty[0].displayName : '').toLowerCase();
            const nameB = normalizeProfessorName(b.faculty && b.faculty[0] ? b.faculty[0].displayName : '').toLowerCase();
            const dataA = rmpDataMap.get(nameA);
            const dataB = rmpDataMap.get(nameB);
            let valA, valB;

            if (key === 'rmpRating') {
                valA = (dataA && !dataA.error) ? dataA.avgRating : -1;
                valB = (dataB && !dataB.error) ? dataB.avgRating : -1;
            } else if (key === 'rmpDifficulty') {
                valA = (dataA && !dataA.error) ? dataA.avgDifficulty : 99;
                valB = (dataB && !dataB.error) ? dataB.avgDifficulty : 99;
            } else if (key === 'rmpWTA') {
                valA = (dataA && !dataA.error) ? dataA.wouldTakeAgainPercent : -1;
                valB = (dataB && !dataB.error) ? dataB.wouldTakeAgainPercent : -1;
            } else if (key === 'grades') {
                const gradeA = gradeDataMap.get(nameA);
                const gradeB = gradeDataMap.get(nameB);
                valA = computeAverageA(gradeA);
                valB = computeAverageA(gradeB);
            }

            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        renderResultsTable(currentSearchResults);
        updateSortIndicators();
        loadRMPDataForResults(currentSearchResults);
        loadGradeDataForResults(currentSearchResults);
    }

    function chooseSort(key) {
        sortDirection = sortColumn === key ? (sortDirection === 'asc' ? 'desc' : 'asc') : (insightSorts.includes(key) && key !== 'rmpDifficulty' ? 'desc' : 'asc');
        sortColumn = key;
        if (insightSorts.includes(key)) sortResultsClientSide(key);
        else executeSearch(0);
    }

    function fetchDetailHTML(endpoint, term, crn) {
        const url = BASE_PATH + '/searchResults/' + endpoint + '?term=' + term + '&courseReferenceNumber=' + crn;
        return fetch(url).then(function (response) {
            return response.text();
        }).then(function (html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return doc.body.textContent.trim() || null;
        }).catch(function () {
            return null;
        });
    }

    function fetchDetailJSON(endpoint, term, crn) {
        const url = BASE_PATH + '/searchResults/' + endpoint + '?term=' + term + '&courseReferenceNumber=' + crn;
        return fetch(url).then(function (response) {
            return response.json();
        }).catch(function () {
            return null;
        });
    }

    function formatMeetingTimesJSON(data) {
        if (!data || !data.fmt || data.fmt.length === 0) return null;

        return data.fmt.map(function (entry) {
            const meeting = entry.meetingTime;
            if (!meeting) return '';

            const days = formatDays(meeting);
            const time = formatTime(meeting.beginTime) + ' - ' + formatTime(meeting.endTime);
            const location = (meeting.buildingDescription || meeting.building || '') + (meeting.room ? ' ' + meeting.room : '');
            const type = meeting.meetingTypeDescription || '';
            const dates = (meeting.startDate || '') + ' - ' + (meeting.endDate || '');

            let line = days + ' ' + time;
            if (location) line += ', ' + location;
            if (type) line += ' (' + type + ')';
            if (dates) line += ' | ' + dates;

            return line;
        }).filter(Boolean).join('\n');
    }

    function formatLinkedSectionsJSON(data) {
        if (!data || !data.linkedData || data.linkedData.length === 0) return null;

        return data.linkedData.map(function (linked) {
            return linked.subject + ' ' + linked.courseNumber + '-' + linked.sequenceNumber + ' (CRN: ' + linked.courseReferenceNumber + ')';
        }).join('\n');
    }

    function renderGradeBars(chartId, gradeData, selection) {
        const chart = document.getElementById(chartId);
        if (!chart) return;

        let grades;
        const GRADE_LABELS = ['A', 'B', 'C', 'D', 'F'];
        const GRADE_COLORS = ['#4caf50', '#2196f3', '#ffc107', '#ff9800', '#f44336'];

        if (selection === 'all') {
            const totals = [0, 0, 0, 0, 0];
            for (let i = 0; i < gradeData.length; i++) {
                for (let j = 0; j < 5; j++) {
                    totals[j] += parseFloat(gradeData[i].data[4 + j]) || 0;
                }
            }
            grades = totals.map(function (total) { return Math.round(total / gradeData.length); });
        } else {
            const entry = gradeData[parseInt(selection)];
            grades = [];
            for (let k = 0; k < 5; k++) {
                grades.push(parseInt(entry.data[4 + k]) || 0);
            }
        }

        const maxPercent = Math.max.apply(null, grades) || 1;
        let barsHTML = '';

        for (let g = 0; g < 5; g++) {
            const height = Math.round((grades[g] / maxPercent) * 80);
            barsHTML += '<div class="irp-bar-wrapper">'
                + '<div class="irp-bar-value">' + grades[g] + '%</div>'
                + '<div class="irp-bar" style="height:' + height + 'px;background:' + GRADE_COLORS[g] + '"></div>'
                + '<div class="irp-bar-label">' + GRADE_LABELS[g] + '</div>'
                + '</div>';
        }

        chart.innerHTML = '<div class="irp-bar-chart">' + barsHTML + '</div>';
    }

    function renderDetailGradeChart(section, container) {
        const faculty = section.faculty && section.faculty[0];
        if (!faculty) return;

        const normalized = normalizeProfessorName(faculty.displayName).toLowerCase();
        const gradeData = gradeDataMap.get(normalized);

        if (!gradeData || gradeData.length === 0) {
            container.insertAdjacentHTML('beforeend', '<div class="irp-detail-section"><h4>Grade Distribution</h4><p class="irp-text-muted">No grade data available</p></div>');
            return;
        }

        let optionsHTML = '<option value="all">All Semesters (Average)</option>';
        for (let i = 0; i < gradeData.length; i++) {
            optionsHTML += '<option value="' + i + '">' + escapeHTML(gradeData[i].semester) + ' ' + escapeHTML(gradeData[i].year) + ' — ' + escapeHTML(gradeData[i].data[0]) + ' ' + escapeHTML(gradeData[i].data[1]) + '</option>';
        }

        const chartId = 'irp-grade-chart-' + section.courseReferenceNumber;
        container.insertAdjacentHTML('beforeend',
            '<div class="irp-detail-section">'
            + '<h4>Grade Distribution</h4>'
            + '<select class="irp-semester-select" data-chart-id="' + chartId + '">' + optionsHTML + '</select>'
            + '<div id="' + chartId + '" class="irp-grade-chart"></div>'
            + '</div>'
        );

        renderGradeBars(chartId, gradeData, 'all');

        container.querySelector('.irp-semester-select').addEventListener('change', function (event) {
            renderGradeBars(chartId, gradeData, event.target.value);
        });
    }

    function renderDetailRMPCard(section, container) {
        const faculty = section.faculty && section.faculty[0];
        if (!faculty) {
            container.innerHTML = '<p class="irp-text-muted">No professor assigned</p>';
            return;
        }

        const normalized = normalizeProfessorName(faculty.displayName).toLowerCase();
        const teacher = rmpDataMap.get(normalized);

        if (!teacher) {
            container.innerHTML = '<p class="irp-text-muted">Loading ratings…</p>';
            return;
        }

        if (teacher.error || !teacher.numRatings) {
            container.innerHTML = '<div class="irp-rmp-card"><p class="irp-text-muted">No RMP ratings available</p></div>';
            return;
        }

        container.innerHTML = '<div class="irp-rmp-card">'
            + '<h4>Rate My Professors</h4>'
            + '<div class="irp-rmp-stats">'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getRatingColor(teacher.avgRating) + '">' + escapeHTML(teacher.avgRating) + '</span><span class="irp-rmp-label">Rating</span></div>'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getDifficultyColor(teacher.avgDifficulty) + '">' + escapeHTML(teacher.avgDifficulty) + '</span><span class="irp-rmp-label">Difficulty</span></div>'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getWTAColor(teacher.wouldTakeAgainPercent) + '">' + (teacher.wouldTakeAgainPercent >= 0 ? Math.round(teacher.wouldTakeAgainPercent) + '%' : 'N/A') + '</span><span class="irp-rmp-label">Would Take Again</span></div>'
            + '</div>'
            + '<a href="https://www.ratemyprofessors.com/professor?tid=' + escapeHTML(teacher.legacyId) + '" target="_blank" rel="noopener noreferrer" class="irp-rmp-link">View on RMP (' + escapeHTML(teacher.numRatings) + ' ratings)</a>'
            + '</div>';
    }

    function isEmptyDetail(text) {
        if (!text) return true;
        const lower = text.toLowerCase();
        return lower.includes('no prerequisite information') ||
               lower.includes('no corequisite') ||
               lower.includes('no course restriction') ||
               lower.includes('no fee information') ||
               lower.includes('no linked') ||
               lower.includes('not available');
    }

    function renderDetailPanel(detailRow, section, details) {
        const panel = detailRow.querySelector('.irp-detail-panel');

        let infoHTML = '';
        if (details.description) infoHTML += '<div class="irp-detail-section"><h4>Description</h4><p>' + escapeHTML(details.description) + '</p></div>';
        if (details.meetingTimes) infoHTML += '<div class="irp-detail-section"><h4>Meeting Times</h4><p style="white-space:pre-line">' + escapeHTML(details.meetingTimes) + '</p></div>';
        if (!isEmptyDetail(details.fees)) infoHTML += '<div class="irp-detail-section"><h4>Fees</h4><p>' + escapeHTML(details.fees) + '</p></div>';
        if (!isEmptyDetail(details.attributes)) infoHTML += '<div class="irp-detail-section"><h4>Attributes</h4><p>' + escapeHTML(details.attributes) + '</p></div>';
        if (details.enrollment) infoHTML += '<div class="irp-detail-section"><h4>Enrollment</h4><p>' + escapeHTML(details.enrollment) + '</p></div>';
        panel.querySelector('.irp-detail-info-content').innerHTML = infoHTML || '<p class="irp-text-muted">No additional info</p>';

        let reqsHTML = '';
        if (!isEmptyDetail(details.prerequisites)) reqsHTML += '<div class="irp-detail-section"><h4>Prerequisites</h4><p>' + escapeHTML(details.prerequisites) + '</p></div>';
        if (!isEmptyDetail(details.corequisites)) reqsHTML += '<div class="irp-detail-section"><h4>Corequisites</h4><p>' + escapeHTML(details.corequisites) + '</p></div>';
        if (!isEmptyDetail(details.restrictions)) reqsHTML += '<div class="irp-detail-section"><h4>Restrictions</h4><p>' + escapeHTML(details.restrictions) + '</p></div>';
        if (details.linkedSections) reqsHTML += '<div class="irp-detail-section"><h4>Linked Sections</h4><p style="white-space:pre-line">' + escapeHTML(details.linkedSections) + '</p></div>';
        panel.querySelector('.irp-detail-reqs-content').innerHTML = reqsHTML || '<p class="irp-text-muted">No requirements</p>';

        const metrics = panel.querySelector('.irp-detail-rmp-content');
        renderDetailRMPCard(section, metrics);
        renderDetailGradeChart(section, metrics);
    }

    function refreshOpenMetrics(name) {
        for (const row of document.querySelectorAll('.irp-row-expanded')) {
            const section = currentSearchResults.find(s => s.courseReferenceNumber === row.dataset.crn);
            if (normalizeProfessorName(section?.faculty?.[0]?.displayName).toLowerCase() !== name) continue;
            const metrics = row.nextElementSibling?.querySelector('.irp-detail-rmp-content');
            if (metrics) {
                renderDetailRMPCard(section, metrics);
                renderDetailGradeChart(section, metrics);
            }
        }
    }

    function loadDetailData(section, detailRow) {
        const term = currentTerm;
        const crn = section.courseReferenceNumber;

        Promise.allSettled([
            fetchDetailHTML('getCourseDescription', term, crn),
            fetchDetailHTML('getSectionPrerequisites', term, crn),
            fetchDetailHTML('getCorequisites', term, crn),
            fetchDetailHTML('getRestrictions', term, crn),
            fetchDetailJSON('getFacultyMeetingTimes', term, crn),
            fetchDetailHTML('getFees', term, crn),
            fetchDetailHTML('getSectionAttributes', term, crn),
            fetchDetailHTML('getEnrollmentInfo', term, crn),
            fetchDetailJSON('fetchLinkedSections', term, crn),
        ]).then(function (results) {
            renderDetailPanel(detailRow, section, {
                description: results[0].value,
                prerequisites: results[1].value,
                corequisites: results[2].value,
                restrictions: results[3].value,
                meetingTimes: formatMeetingTimesJSON(results[4].value),
                fees: results[5].value,
                attributes: results[6].value,
                enrollment: results[7].value,
                linkedSections: formatLinkedSectionsJSON(results[8].value),
            });
        });
    }

    function handleRowClick(event) {
        if (event.target.closest('.irp-btn-add, .irp-btn-added, .irp-detail-row')) return;

        const row = event.target.closest('tr[data-crn]');
        if (!row) return;

        const existingDetail = row.nextElementSibling;
        if (existingDetail && existingDetail.classList.contains('irp-detail-row')) {
            existingDetail.remove();
            row.classList.remove('irp-row-expanded');
            row.querySelector('.irp-title').setAttribute('aria-expanded','false');
            return;
        }

        row.classList.add('irp-row-expanded');
        row.querySelector('.irp-title').setAttribute('aria-expanded','true');

        const crn = row.dataset.crn;
        const section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });
        if (!section) return;

        const detailRow = document.createElement('tr');
        detailRow.className = 'irp-detail-row';
        const detailCell = document.createElement('td');
        detailCell.colSpan = 9;

        detailCell.innerHTML = '<div class="irp-detail-panel">'
            + '<div class="irp-detail-col"><h3>Course Info</h3><div class="irp-detail-info-content"><div class="irp-skeleton-block"></div></div></div>'
            + '<div class="irp-detail-col"><h3>Requirements</h3><div class="irp-detail-reqs-content"><div class="irp-skeleton-block"></div></div></div>'
            + '<div class="irp-detail-col"><h3>RMP &amp; Grades</h3><div class="irp-detail-rmp-content"><div class="irp-skeleton-block"></div></div></div>'
            + '</div>';

        detailRow.appendChild(detailCell);
        row.after(detailRow);

        loadDetailData(section, detailRow);
    }

    function buildSearchParams(page) {
        const params = new URLSearchParams();
        params.set('txt_term', currentTerm);
        params.set('pageOffset', String(page * PAGE_SIZE));
        params.set('pageMaxSize', String(PAGE_SIZE));
        params.set('sortColumn', insightSorts.includes(sortColumn) ? 'subjectDescription' : sortColumn);
        params.set('sortDirection', sortDirection);

        const filterKeys = Object.keys(activeFilters);
        for (let i = 0; i < filterKeys.length; i++) {
            const key = filterKeys[i];
            const value = activeFilters[key];
            if (key === 'txt_creditHourRange') {
                const parts = value.code.split('-');
                if (parts[0]) params.set('txt_credithourlow', parts[0]);
                if (parts[1]) params.set('txt_credithourhigh', parts[1]);
            } else {
                params.set(key, value.code || value);
            }
        }

        return params;
    }

    async function resetBannerSearch() {
        const result = await fetch(BASE_PATH+'/classSearch/resetDataForm', {
            method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: ''
        });
        if (!result.ok || result.redirected) throw new Error('Search reset unavailable');
    }

    async function executeSearch(page = 0) {
        const sequence = ++searchSequence;
        currentPage = page;
        if (document.querySelector('.irp-sidebar-open')) toggleSidebar();
        document.querySelector('.irp-sort-controls').hidden = true;
        showLoadingState();
        document.querySelector('.irp-pagination').replaceChildren();
        const params = buildSearchParams(page);
        // Banner caches each search in the server session. Keep its reset and next read in order.
        const request = searchQueue.then(async () => {
            if (sequence !== searchSequence) return null;
            if (page === 0) await resetBannerSearch();
            if (sequence !== searchSequence) return null;
            const response = await fetch(BASE_PATH+'/searchResults/searchResults?'+params);
            if (!response.ok) throw new Error('Search unavailable');
            return response.json();
        });
        searchQueue = request.catch(() => {});
        try {
            const data = await request;
            if (sequence !== searchSequence) return;
            if (data?.success === true && data.data === null && data.totalCount === 0) data.data = [];
            if (!data || data.success === false || !Array.isArray(data.data)) throw new Error('Search unavailable');
            totalResults = data.totalCount ?? data.sectionsFetchedCount ?? data.data.length;
            currentSearchResults = data.data;
            if (insightSorts.includes(sortColumn)) sortResultsClientSide(sortColumn);
            else {
                renderResultsTable(currentSearchResults);
                updateSortIndicators();
                loadRMPDataForResults(currentSearchResults);
                loadGradeDataForResults(currentSearchResults);
            }
            renderPagination();
        } catch {
            if (sequence === searchSequence) showErrorState('Banner could not load these sections. Retry or use Banner view.');
        }
    }

    function closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.irp-autocomplete-dropdown');

        for (const dropdown of dropdowns) {
            dropdown.classList.add('irp-hidden');
            dropdown.innerHTML = '';
        }
    }

    function showAutocompleteResults(dropdown, results, filterKey) {
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.classList.add('irp-hidden');
            return;
        }

        for (const item of results) {
            const listItem = document.createElement('li');
            listItem.className = 'irp-autocomplete-item';
            const choice = document.createElement('button');
            choice.type = 'button';
            choice.textContent = item.description;
            listItem.append(choice);
            listItem.dataset.code = item.code;
            listItem.dataset.description = item.description;
            listItem.dataset.filterKey = filterKey;
            dropdown.appendChild(listItem);
        }

        dropdown.classList.remove('irp-hidden');
    }

    function updateCartBadge() {
        const badge = document.querySelector('.irp-cart-badge');
        if (!badge) return;

        badge.textContent = cartItems.length;

        if (cartItems.length > 0) {
            badge.classList.remove('irp-hidden');
        } else {
            badge.classList.add('irp-hidden');
        }
    }

    function updateAddButtons() {
        const buttons = document.querySelectorAll('.irp-btn-add, .irp-btn-added');

        for (let i = 0; i < buttons.length; i++) {
            const crn = buttons[i].dataset.crn;
            const inCart = cartItems.some(function (item) { return item.courseReferenceNumber === crn; });

            if (inCart) {
                buttons[i].className = 'irp-btn-added';
                buttons[i].textContent = 'Added';
                buttons[i].disabled = true;
            } else {
                buttons[i].className = 'irp-btn-add';
                buttons[i].textContent = 'Add';
                buttons[i].disabled = false;
            }
        }

        updateCartBadge();
    }

    function toggleCartDrawer(open) {
        const drawer = document.querySelector('.irp-drawer');
        if (typeof open !== 'boolean') open = drawer.inert;
        drawer.inert = !open;
        drawer.classList.toggle('irp-drawer-closed', !open);
        document.querySelector('.irp-drawer-overlay').classList.toggle('irp-hidden', !open);
        document.querySelector('.irp-topbar').inert = open;
        document.querySelector('.irp-body').inert = open;
        const toggle = document.querySelector('.irp-cart-toggle');
        toggle.setAttribute('aria-expanded', String(open));
        (open ? drawer.querySelector('.irp-drawer-close') : toggle).focus();
    }

    const scheduleColors = ['#613783','#a54516','#1a6370','#58662e','#86516b','#494982'];
    function renderCart() {
        const {events, conflicts, unscheduled} = iroarSchedule.build(cartItems);
        const conflictBox = document.querySelector('.irp-drawer-conflicts');
        conflictBox.classList.toggle('irp-hidden', !conflicts.length);
        const name = item => escapeHTML([item.subject,item.courseNumber].join(' '));
        conflictBox.innerHTML = conflicts.map(([a,b]) => '<div class="irp-conflict-warning">Time conflict · '+name(cartItems[a])+' and '+name(cartItems[b])+'</div>').join('');
        let schedule = '';
        if (events.length) {
            const start = Math.floor(Math.min(...events.map(e=>e.start))/60);
            const end = Math.ceil(Math.max(...events.map(e=>e.end))/60);
            const days = iroarSchedule.days.filter((day,i) => i<5 || events.some(e=>e.day===day));
            const hourHeight = 38;
            const stamp = minute => formatTime(String(Math.floor(minute/60)).padStart(2,'0')+String(minute%60).padStart(2,'0'));
            schedule = '<div class="irp-week" style="--days:'+days.length+';--height:'+((end-start)*hourHeight)+'px"><div></div>'
                + days.map(day=>'<b>'+day.slice(0,3)+'</b>').join('')+'<div class="irp-hour-axis">';
            for (let hour=start;hour<end;hour++) schedule+='<small>'+stamp(hour*60).replace(':00','')+'</small>';
            schedule += '</div>'+days.map(day=>'<div class="irp-day">'+events.filter(e=>e.day===day).map(event=>{
                const label = escapeHTML(event.label+' · '+day+' '+stamp(event.start)+'–'+stamp(event.end));
                return '<span class="irp-block" title="'+label+'" aria-label="'+label+'" style="background:'+scheduleColors[event.index%scheduleColors.length]
                    +';top:'+((event.start/60-start)*hourHeight)+'px;height:'+((event.end-event.start)/60*hourHeight)+'px;left:'+(100*event.lane/event.lanes)+'%;width:'+(100/event.lanes)+'%">'
                    +escapeHTML(event.label)+'</span>';
            }).join('')+'</div>').join('')+'</div>';
        }
        if (unscheduled.length) schedule += '<p class="irp-tba">Meeting time to be announced · '+unscheduled.map(escapeHTML).join(', ')+'</p>';
        document.querySelector('.irp-drawer-schedule').innerHTML = schedule;
        document.querySelector('.irp-cart-count').textContent = cartItems.length;
        document.querySelector('.irp-cart-credits').textContent = cartItems.reduce((sum,s)=>sum+(Number(s.creditHours ?? s.creditHourLow)||0),0)+' credits';
        document.querySelector('.irp-drawer-courses').innerHTML = cartItems.map((s,i) =>
            '<div class="irp-cart-card" style="border-color:'+scheduleColors[i%scheduleColors.length]+'"><div><strong>'+name(s)+'</strong><small>'+escapeHTML(s.courseTitle)+' · CRN '+escapeHTML(s.courseReferenceNumber)+'</small></div>'
            +'<button class="irp-cart-remove" type="button" data-crn="'+escapeHTML(s.courseReferenceNumber)+'" aria-label="Remove '+name(s)+'">×</button></div>'
        ).join('') || '<div class="irp-empty-state"><strong>Your week is open</strong><span>Add a section from the search results to preview its meeting times.</span></div>';
        updateAddButtons();
    }

    function addToCart(section) {
        if (!cartItems.some(item=>item.courseReferenceNumber===section.courseReferenceNumber)) cartItems.push(section);
        renderCart();
        toggleCartDrawer(true);
    }

    function toggleSidebar() {
        const open = document.querySelector('.irp-sidebar').classList.toggle('irp-sidebar-open');
        document.querySelector('.irp-menu-toggle').setAttribute('aria-expanded', String(open));
    }

    function bindEvents() {
        document.querySelector('.irp-sort-by').addEventListener('change', e=>chooseSort(e.target.value));
        document.querySelector('.irp-sort-order').addEventListener('click', ()=>chooseSort(sortColumn));
        const debouncedAutocomplete = debounce(function (input) {
            const endpoint = input.dataset.endpoint;
            const filterKey = input.dataset.key;
            const searchTerm = input.value.trim();
            const dropdown = input.parentElement.querySelector('.irp-autocomplete-dropdown');

            if (searchTerm.length === 0) {
                dropdown.classList.add('irp-hidden');
                dropdown.innerHTML = '';
                return;
            }

            fetchAutocomplete(endpoint, searchTerm).then(function (results) {
                if (input.value.trim() === searchTerm) showAutocompleteResults(dropdown, results, filterKey);
            }).catch(function (error) {
                console.warn('[IRoar Premium] Autocomplete error:', error);
                dropdown.classList.add('irp-hidden');
            });
        }, DEBOUNCE_DELAY);

        const sidebar = document.querySelector('.irp-sidebar');

        if (sidebar) {
            sidebar.addEventListener('input', function (event) {
                const input = event.target;

                if (input.dataset.endpoint) {
                    delete activeFilters[input.dataset.key];
                    renderActiveFilterChips();
                    debouncedAutocomplete(input);
                    return;
                }

                if (input.dataset.range) {
                    const key = input.dataset.key;
                    const minInput = document.getElementById('irp-' + key + '-min');
                    const maxInput = document.getElementById('irp-' + key + '-max');
                    const minValue = minInput ? minInput.value.trim() : '';
                    const maxValue = maxInput ? maxInput.value.trim() : '';

                    if (minValue || maxValue) {
                        const rangeLabel = (minValue || '0') + ' - ' + (maxValue || '∞');
                        activeFilters[key] = { code: minValue + '-' + maxValue, label: rangeLabel };
                    } else {
                        delete activeFilters[key];
                    }

                    renderActiveFilterChips();
                    return;
                }

                if (input.dataset.key) {
                    const value = input.value.trim();

                    if (value) {
                        activeFilters[input.dataset.key] = { code: value, label: value };
                    } else {
                        delete activeFilters[input.dataset.key];
                    }

                    renderActiveFilterChips();
                }
            });

            sidebar.addEventListener('click', function (event) {
                const autocompleteItem = event.target.closest('.irp-autocomplete-item');

                if (autocompleteItem) {
                    const filterKey = autocompleteItem.dataset.filterKey;
                    const code = autocompleteItem.dataset.code;
                    const description = autocompleteItem.dataset.description;
                    const input = document.getElementById('irp-' + filterKey);

                    if (input) {
                        input.value = description;
                    }

                    activeFilters[filterKey] = { code: code, label: description };
                    renderActiveFilterChips();
                    closeAllDropdowns();
                    return;
                }

                if (event.target.closest('.irp-clear-all')) {
                    clearAllFilters();
                    return;
                }

                if (event.target.closest('.irp-search-button')) {
                    executeSearch();
                }
            });
        }

        const activeFiltersContainer = document.querySelector('.irp-active-filters');

        if (activeFiltersContainer) {
            activeFiltersContainer.addEventListener('click', function (event) {
                const removeButton = event.target.closest('.irp-chip-remove');

                if (removeButton) {
                    clearFilter(removeButton.dataset.key);
                }
            });
        }

        const paginationContainer = document.querySelector('.irp-pagination');

        if (paginationContainer) {
            paginationContainer.addEventListener('click', function (event) {
                const pageButton = event.target.closest('.irp-page-btn');

                if (pageButton) {
                    executeSearch(parseInt(pageButton.dataset.page, 10));
                }
            });
        }

        const resultsContainer = document.querySelector('.irp-results-container');

        if (resultsContainer) {
            resultsContainer.addEventListener('click', function (event) {
                const header = event.target.closest('th[data-sort-key]');
                if (header) {
                    chooseSort(header.dataset.sortKey);
                    return;
                }

                const addButton = event.target.closest('.irp-btn-add');
                if (addButton) {
                    const crn = addButton.dataset.crn;
                    const section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });
                    if (section) addToCart(section);
                    return;
                }

                handleRowClick(event);
            });
        }

        const cartToggle = document.querySelector('.irp-cart-toggle');

        if (cartToggle) {
            cartToggle.addEventListener('click', toggleCartDrawer);
        }

        const drawerOverlay = document.querySelector('.irp-drawer-overlay');

        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', toggleCartDrawer);
        }

        const drawer = document.querySelector('.irp-drawer');

        if (drawer) {
            drawer.addEventListener('click', function (event) {
                if (event.target.closest('.irp-drawer-close')) {
                    toggleCartDrawer();
                    return;
                }

                const removeButton = event.target.closest('.irp-cart-remove');
                if (removeButton) {
                    cartItems = cartItems.filter(s => s.courseReferenceNumber !== removeButton.dataset.crn);
                    renderCart();
                    drawer.querySelector('.irp-drawer-close').focus();
                }
            });
        }

        const menuToggle = document.querySelector('.irp-menu-toggle');

        if (menuToggle) {
            menuToggle.addEventListener('click', toggleSidebar);
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && event.target.closest('.irp-sidebar input')) {
                executeSearch();
                return;
            }

            if (event.key === 'Escape') {
                const drawerEl = document.querySelector('.irp-drawer');

                if (drawerEl && !drawerEl.classList.contains('irp-drawer-closed')) {
                    toggleCartDrawer();
                    return;
                }

                const sidebarEl = document.querySelector('.irp-sidebar.irp-sidebar-open');

                if (sidebarEl) {
                    toggleSidebar();
                    document.querySelector('.irp-menu-toggle').focus();
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (!event.target.closest('.irp-autocomplete-wrapper')) {
                closeAllDropdowns();
            }
        });
    }

    function init() {
        currentTerm = extractTerm();
        if (!currentTerm || document.querySelector('.irp-app')) return;
        buildShell();
        const app = document.querySelector('.irp-app');
        const restore = document.createElement('button');
        restore.className = 'irp-restore';
        restore.textContent = 'Open course planner';
        document.body.append(restore);
        function setPlanner(open) {
            document.body.classList.toggle('irp-active', open);
            app.hidden = !open;
            restore.hidden = open;
        }
        restore.addEventListener('click', () => setPlanner(true));
        app.querySelector('.irp-native').addEventListener('click', async () => {
            ++searchSequence;
            await searchQueue;
            await resetBannerSearch().catch(() => {});
            setPlanner(false);
        });
        app.querySelector('.irp-term-display').textContent = termLabel || currentTerm;
        setPlanner(true);
        renderCart();
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
