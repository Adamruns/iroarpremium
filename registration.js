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

    let synchronizerToken = '';
    let currentTerm = '';
    let cartItems = [];
    let currentSearchResults = [];
    let currentPage = 0;
    let totalResults = 0;
    let sortColumn = 'subjectDescription';
    let sortDirection = 'asc';
    let activeFilters = {};
    let searchFormReset = false;

    const rmpDataMap = new Map();
    const gradeDataMap = new Map();

    function escapeHTML(text) {
        if (text === null || text === undefined) return '';
        const element = document.createElement('span');
        element.textContent = String(text);
        return element.innerHTML;
    }

    function extractSessionData() {
        const metaToken = document.querySelector('meta[name="synchronizerToken"]');

        if (metaToken) {
            synchronizerToken = metaToken.content;
        }

        if (!synchronizerToken) {
            const inputToken = document.querySelector('input[name="synchronizerToken"]');

            if (inputToken) {
                synchronizerToken = inputToken.value;
            }
        }

        if (!synchronizerToken) {
            const scripts = document.querySelectorAll('script');

            for (const script of scripts) {
                const text = script.textContent;
                const tokenMatch = text.match(/synchronizerToken['":\s]+=?\s*['"]([^'"]+)['"]/);

                if (tokenMatch) {
                    synchronizerToken = tokenMatch[1];
                    break;
                }
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const urlTerm = urlParams.get('term');

        if (urlTerm) {
            currentTerm = urlTerm;
        }

        if (!currentTerm) {
            const termElement = document.querySelector('[data-term]');

            if (termElement) {
                currentTerm = termElement.dataset.term;
            }
        }

        if (!currentTerm) {
            const scripts = document.querySelectorAll('script');

            for (const script of scripts) {
                const text = script.textContent;
                const termMatch = text.match(/\b(20\d{4})\b/);

                if (termMatch) {
                    currentTerm = termMatch[1];
                    break;
                }
            }
        }

        console.log('[IRoar Premium] Session data extracted — token:', synchronizerToken ? 'found' : 'missing', '| term:', currentTerm || 'missing');
    }

    function hideOriginalUI() {
        const bodyChildren = document.body.children;

        for (const child of bodyChildren) {
            child.style.display = 'none';
        }

        document.body.classList.add('irp-active');
    }

    function injectCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('registration.css');
        document.head.appendChild(link);
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
                        <input type="number" id="irp-${filter.key}-min" placeholder="Min"
                               min="0" data-key="${filter.key}" data-range="min">
                        <input type="number" id="irp-${filter.key}-max" placeholder="Max"
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
                    <button type="button" class="irp-menu-toggle" aria-label="Toggle filters">
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
                    <span class="irp-keepalive-dot" title="Session active"></span>
                    <button type="button" class="irp-cart-toggle" aria-label="Toggle cart">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"/>
                            <circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        <span class="irp-cart-badge irp-hidden">0</span>
                    </button>
                </div>
            </header>
            <div class="irp-body">
                <aside class="irp-sidebar">
                    <div class="irp-sidebar-header">
                        <h2>Filters</h2>
                        <button type="button" class="irp-clear-all">Clear All</button>
                    </div>
                    <div class="irp-sidebar-filters">
                        ${filterGroupsHTML}
                    </div>
                    <div class="irp-sidebar-footer">
                        <button type="button" class="irp-search-button">Search</button>
                    </div>
                </aside>
                <main class="irp-main">
                    <div class="irp-active-filters"></div>
                    <div class="irp-results-container">
                        <div class="irp-empty-state">Search for classes using the filters on the left</div>
                    </div>
                    <nav class="irp-pagination"></nav>
                </main>
            </div>
            <aside class="irp-drawer irp-drawer-closed">
                <div class="irp-drawer-header">
                    <div>
                        <h2>My Courses (<span class="irp-cart-count">0</span>)</h2>
                        <span class="irp-cart-credits">0 Credit Hours</span>
                    </div>
                    <button type="button" class="irp-drawer-close" aria-label="Close cart">&times;</button>
                </div>
                <div class="irp-drawer-crn">
                    <input type="text" class="irp-crn-input" placeholder="Add by CRN...">
                    <button type="button" class="irp-crn-add">Add</button>
                </div>
                <div class="irp-drawer-courses"></div>
                <div class="irp-drawer-schedule"></div>
                <div class="irp-drawer-conflicts irp-hidden"></div>
                <div class="irp-drawer-footer">
                    <button type="button" class="irp-submit-registration">Submit Registration</button>
                </div>
            </aside>
            <div class="irp-drawer-overlay irp-hidden"></div>
        `;

        document.body.appendChild(app);
    }

    function startKeepalive() {
        setInterval(function () {
            fetch(BASE_PATH + '/keepAlive/data').then(function (response) {
                if (!response.ok) {
                    console.warn('[IRoar Premium] Keepalive failed with status:', response.status);
                    const dot = document.querySelector('.irp-keepalive-dot');
                    if (dot) dot.classList.add('irp-keepalive-dead');
                    showSessionExpired();
                }
            }).catch(function (error) {
                console.warn('[IRoar Premium] Keepalive request error:', error);
                const dot = document.querySelector('.irp-keepalive-dot');
                if (dot) dot.classList.add('irp-keepalive-dead');
                showSessionExpired();
            });
        }, 5 * 60 * 1000);
    }

    function formatTermCode(termCode) {
        const SEMESTER_MAP = {
            '01': 'Spring',
            '05': 'Summer I',
            '06': 'Summer II',
            '08': 'Fall'
        };

        const year = termCode.substring(0, 4);
        const semesterCode = termCode.substring(4, 6);
        const semesterName = SEMESTER_MAP[semesterCode] || 'Unknown';

        return semesterName + ' ' + year;
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
        if (inCart) return '<button class="irp-btn-added" disabled>Added</button>';
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

        let html = '<table class="irp-table">'
            + '<thead><tr>'
            + '<th style="width:32px"></th>'
            + '<th data-sort-key="courseReferenceNumber" style="width:70px">CRN</th>'
            + '<th data-sort-key="subjectDescription" style="width:60px">Subj</th>'
            + '<th data-sort-key="courseNumber" style="width:60px">Crse</th>'
            + '<th data-sort-key="sequenceNumber" style="width:50px">Sec</th>'
            + '<th data-sort-key="courseTitle">Title</th>'
            + '<th data-sort-key="creditHours" style="width:45px">Hrs</th>'
            + '<th style="width:140px">Professor</th>'
            + '<th data-sort-key="rmpRating" style="width:55px">Rating</th>'
            + '<th data-sort-key="rmpDifficulty" style="width:50px">Diff</th>'
            + '<th data-sort-key="rmpWTA" style="width:55px">WTA%</th>'
            + '<th data-sort-key="grades" style="width:80px">Grades</th>'
            + '<th style="width:100px">Time</th>'
            + '<th style="width:60px">Days</th>'
            + '<th style="width:100px">Location</th>'
            + '<th style="width:70px">Seats</th>'
            + '<th style="width:70px"></th>'
            + '</tr></thead><tbody>';

        for (let i = 0; i < results.length; i++) {
            const section = results[i];
            const meeting = section.meetingsFaculty && section.meetingsFaculty[0] && section.meetingsFaculty[0].meetingTime;

            let timeDisplay = '';
            let daysDisplay = 'TBA';
            let locationDisplay = 'TBA';

            if (meeting) {
                const begin = formatTime(meeting.beginTime);
                const end = formatTime(meeting.endTime);
                timeDisplay = begin && end ? begin + '-' + end : '';
                daysDisplay = formatDays(meeting);
                const building = meeting.building || '';
                const room = meeting.room || '';
                locationDisplay = (building + ' ' + room).trim() || 'TBA';
            }

            const credits = section.creditHours || section.creditHourLow || '—';

            html += '<tr data-crn="' + escapeHTML(section.courseReferenceNumber) + '">'
                + '<td>' + renderStatusDot(section) + '</td>'
                + '<td>' + escapeHTML(section.courseReferenceNumber) + '</td>'
                + '<td>' + escapeHTML(section.subject || '') + '</td>'
                + '<td>' + escapeHTML(section.courseNumber || '') + '</td>'
                + '<td>' + escapeHTML(section.sequenceNumber || '') + '</td>'
                + '<td>' + escapeHTML(section.courseTitle || '') + '</td>'
                + '<td>' + escapeHTML(credits) + '</td>'
                + '<td>' + renderProfessor(section) + '</td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td>' + escapeHTML(timeDisplay) + '</td>'
                + '<td>' + escapeHTML(daysDisplay) + '</td>'
                + '<td>' + escapeHTML(locationDisplay) + '</td>'
                + '<td>' + renderSeats(section) + '</td>'
                + '<td>' + renderAddButton(section) + '</td>'
                + '</tr>';
        }

        html += '</tbody></table>';
        container.innerHTML = html;
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

            const cells = rows[i].querySelectorAll('td');

            if (teacher.error || teacher.wouldTakeAgainPercent === -1) {
                cells[8].innerHTML = '<span class="irp-text-muted">N/A</span>';
                cells[9].innerHTML = '<span class="irp-text-muted">N/A</span>';
                cells[10].innerHTML = '<span class="irp-text-muted">N/A</span>';
            } else {
                cells[8].innerHTML = '<span class="irp-' + getRatingColor(teacher.avgRating) + '">' + teacher.avgRating + '</span>';
                cells[9].innerHTML = '<span class="irp-' + getDifficultyColor(teacher.avgDifficulty) + '">' + teacher.avgDifficulty + '</span>';
                cells[10].innerHTML = '<span class="irp-' + getWTAColor(teacher.wouldTakeAgainPercent) + '">' + Math.round(teacher.wouldTakeAgainPercent) + '%</span>';
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

            const cell = rows[i].querySelectorAll('td')[11];
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
                }
            });
        });
    }

    function updateSortIndicators() {
        const headers = document.querySelectorAll('.irp-table thead th[data-sort-key]');
        for (let i = 0; i < headers.length; i++) {
            headers[i].classList.remove('irp-sort-asc', 'irp-sort-desc');
            if (headers[i].dataset.sortKey === sortColumn) {
                headers[i].classList.add(sortDirection === 'asc' ? 'irp-sort-asc' : 'irp-sort-desc');
            }
        }
    }

    function sortResultsClientSide(key) {
        if (sortColumn === key) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = key;
            sortDirection = 'desc';
        }

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

    function handleSortClick(event) {
        const header = event.target.closest('th[data-sort-key]');
        if (!header) return;

        const key = header.dataset.sortKey;
        const CLIENT_SORT_KEYS = ['rmpRating', 'rmpDifficulty', 'rmpWTA', 'grades'];

        if (CLIENT_SORT_KEYS.indexOf(key) !== -1) {
            sortResultsClientSide(key);
            return;
        }

        if (sortColumn === key) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = key;
            sortDirection = 'asc';
        }

        executeSearch(0);
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
            container.innerHTML = '<p class="irp-text-muted">Loading RMP data...</p>';
            return;
        }

        if (teacher.error || teacher.wouldTakeAgainPercent === -1) {
            container.innerHTML = '<div class="irp-rmp-card"><p class="irp-text-muted">No RMP ratings available</p></div>';
            return;
        }

        container.innerHTML = '<div class="irp-rmp-card">'
            + '<h4>Rate My Professors</h4>'
            + '<div class="irp-rmp-stats">'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getRatingColor(teacher.avgRating) + '">' + teacher.avgRating + '</span><span class="irp-rmp-label">Rating</span></div>'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getDifficultyColor(teacher.avgDifficulty) + '">' + teacher.avgDifficulty + '</span><span class="irp-rmp-label">Difficulty</span></div>'
            + '<div class="irp-rmp-stat"><span class="irp-rmp-value irp-' + getWTAColor(teacher.wouldTakeAgainPercent) + '">' + Math.round(teacher.wouldTakeAgainPercent) + '%</span><span class="irp-rmp-label">Would Take Again</span></div>'
            + '</div>'
            + '<a href="https://www.ratemyprofessors.com/professor?tid=' + teacher.legacyId + '" target="_blank" rel="noopener noreferrer" class="irp-rmp-link">View on RMP (' + teacher.numRatings + ' ratings)</a>'
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

        const rmpContent = panel.querySelector('.irp-detail-rmp-content');
        renderDetailRMPCard(section, rmpContent);
        renderDetailGradeChart(section, rmpContent);
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
        if (event.target.closest('.irp-btn-add, .irp-btn-added')) return;

        const row = event.target.closest('tr[data-crn]');
        if (!row) return;

        const existingDetail = row.nextElementSibling;
        if (existingDetail && existingDetail.classList.contains('irp-detail-row')) {
            existingDetail.remove();
            row.classList.remove('irp-row-expanded');
            return;
        }

        row.classList.add('irp-row-expanded');

        const crn = row.dataset.crn;
        const section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });
        if (!section) return;

        const detailRow = document.createElement('tr');
        detailRow.className = 'irp-detail-row';
        const detailCell = document.createElement('td');
        detailCell.colSpan = 17;

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
        params.set('sortColumn', sortColumn);
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

    function resetSearchForm() {
        return fetch(BASE_PATH + '/classSearch/resetDataForm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch(function () {
            // Non-critical — search may still work without reset
        });
    }

    function executeSearch(page) {
        if (page === undefined) page = 0;
        currentPage = page;

        const params = buildSearchParams(page);
        showLoadingState();

        const searchUrl = BASE_PATH + '/searchResults/searchResults?' + params.toString();

        // First attempt the search directly
        fetch(searchUrl)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                console.log('[IRoar Premium] Search response:', data);

                // Banner may return results at data.data or at the top level
                const results = data.data || [];
                const count = data.totalCount || data.sectionsFetchedCount || results.length || 0;

                if (results.length === 0 && !searchFormReset) {
                    // If no results on first try, reset search form and retry
                    console.log('[IRoar Premium] No results — resetting search form and retrying...');
                    searchFormReset = true;
                    resetSearchForm().then(function () {
                        return fetch(searchUrl);
                    }).then(function (response) {
                        return response.json();
                    }).then(function (retryData) {
                        console.log('[IRoar Premium] Retry response:', retryData);
                        totalResults = retryData.totalCount || retryData.sectionsFetchedCount || 0;
                        currentSearchResults = retryData.data || [];
                        renderResultsTable(currentSearchResults);
                        updateSortIndicators();
                        renderPagination();
                        loadRMPDataForResults(currentSearchResults);
                        loadGradeDataForResults(currentSearchResults);
                    }).catch(function (error) {
                        showErrorState('Search failed. Please try again.');
                        console.error('[IRoar Premium] Retry search error:', error);
                    });
                    return;
                }

                totalResults = count;
                currentSearchResults = results;
                renderResultsTable(currentSearchResults);
                updateSortIndicators();
                renderPagination();
                loadRMPDataForResults(currentSearchResults);
                loadGradeDataForResults(currentSearchResults);
            })
            .catch(function (error) {
                showErrorState('Search failed. Please try again.');
                console.error('[IRoar Premium] Search error:', error);
            });
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
            listItem.textContent = item.description;
            listItem.dataset.code = item.code;
            listItem.dataset.description = item.description;
            listItem.dataset.filterKey = filterKey;
            dropdown.appendChild(listItem);
        }

        dropdown.classList.remove('irp-hidden');
    }

    function timeToMinutes(timeString) {
        if (!timeString || timeString.length < 4) return 0;
        return parseInt(timeString.substring(0, 2), 10) * 60 + parseInt(timeString.substring(2, 4), 10);
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

    function openDrawer() {
        const drawer = document.querySelector('.irp-drawer');
        const overlay = document.querySelector('.irp-drawer-overlay');
        if (!drawer || !overlay) return;

        drawer.classList.remove('irp-drawer-closed');
        overlay.classList.remove('irp-hidden');
    }

    function renderMiniSchedule() {
        const container = document.querySelector('.irp-drawer-schedule');
        if (!container) return;

        if (cartItems.length === 0) {
            container.innerHTML = '';
            return;
        }

        const DAYS = ['M', 'T', 'W', 'R', 'F'];
        const DAY_MAP = { M: 'monday', T: 'tuesday', W: 'wednesday', R: 'thursday', F: 'friday' };
        const START_HOUR = 7;
        const END_HOUR = 22;
        const HOUR_HEIGHT = 18;
        const SCHEDULE_COLORS = ['#522D80', '#F56600', '#2196f3', '#4caf50', '#ff9800', '#e91e63'];

        let html = '<div class="irp-schedule">';
        html += '<div class="irp-schedule-header">';

        for (let d = 0; d < DAYS.length; d++) {
            html += '<div class="irp-schedule-day-label">' + DAYS[d] + '</div>';
        }

        html += '</div>';
        html += '<div class="irp-schedule-body">';

        html += '<div class="irp-schedule-times">';

        for (let h = START_HOUR; h <= END_HOUR; h++) {
            const label = h > 12 ? (h - 12) + 'p' : (h === 12 ? '12p' : h + 'a');
            html += '<div class="irp-schedule-time" style="height:' + HOUR_HEIGHT + 'px">' + label + '</div>';
        }

        html += '</div>';

        for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
            html += '<div class="irp-schedule-column" style="height:' + ((END_HOUR - START_HOUR + 1) * HOUR_HEIGHT) + 'px">';

            for (let c = 0; c < cartItems.length; c++) {
                const meeting = cartItems[c].meetingsFaculty && cartItems[c].meetingsFaculty[0] ? cartItems[c].meetingsFaculty[0].meetingTime : null;
                if (!meeting || !meeting[DAY_MAP[DAYS[dayIndex]]]) continue;

                const startMinutes = timeToMinutes(meeting.beginTime) - (START_HOUR * 60);
                const endMinutes = timeToMinutes(meeting.endTime) - (START_HOUR * 60);
                const top = (startMinutes / 60) * HOUR_HEIGHT;
                const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                const color = SCHEDULE_COLORS[c % SCHEDULE_COLORS.length];

                html += '<div class="irp-schedule-block" style="top:' + top + 'px;height:' + Math.max(height, 10) + 'px;background:' + color + '"'
                    + ' title="' + escapeHTML(cartItems[c].subject) + ' ' + escapeHTML(cartItems[c].courseNumber) + '">'
                    + escapeHTML(cartItems[c].subject.substring(0, 4))
                    + '</div>';
            }

            html += '</div>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

    function checkConflicts() {
        const conflicts = [];

        for (let i = 0; i < cartItems.length; i++) {
            for (let j = i + 1; j < cartItems.length; j++) {
                const meetingA = cartItems[i].meetingsFaculty && cartItems[i].meetingsFaculty[0] ? cartItems[i].meetingsFaculty[0].meetingTime : null;
                const meetingB = cartItems[j].meetingsFaculty && cartItems[j].meetingsFaculty[0] ? cartItems[j].meetingsFaculty[0].meetingTime : null;
                if (!meetingA || !meetingB) continue;

                const sharedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].filter(function (day) {
                    return meetingA[day] && meetingB[day];
                });
                if (sharedDays.length === 0) continue;

                const startA = timeToMinutes(meetingA.beginTime);
                const endA = timeToMinutes(meetingA.endTime);
                const startB = timeToMinutes(meetingB.beginTime);
                const endB = timeToMinutes(meetingB.endTime);

                if (startA < endB && startB < endA) {
                    conflicts.push(escapeHTML(cartItems[i].subject) + ' ' + escapeHTML(cartItems[i].courseNumber) + ' & ' + escapeHTML(cartItems[j].subject) + ' ' + escapeHTML(cartItems[j].courseNumber));
                }
            }
        }

        const conflictContainer = document.querySelector('.irp-drawer-conflicts');
        if (!conflictContainer) return;

        if (conflicts.length > 0) {
            conflictContainer.classList.remove('irp-hidden');
            conflictContainer.innerHTML = conflicts.map(function (c) {
                return '<div class="irp-conflict-warning">⚠ Time conflict: ' + c + '</div>';
            }).join('');
        } else {
            conflictContainer.classList.add('irp-hidden');
            conflictContainer.innerHTML = '';
        }
    }

    function renderCart() {
        const coursesContainer = document.querySelector('.irp-drawer-courses');
        if (!coursesContainer) return;

        let totalCredits = 0;

        for (let i = 0; i < cartItems.length; i++) {
            totalCredits += cartItems[i].creditHours || cartItems[i].creditHourLow || 0;
        }

        const countEl = document.querySelector('.irp-cart-count');
        if (countEl) countEl.textContent = cartItems.length;

        const creditsEl = document.querySelector('.irp-cart-credits');
        if (creditsEl) creditsEl.textContent = totalCredits + ' Credit Hours';

        updateCartBadge();

        let html = '';

        for (let j = 0; j < cartItems.length; j++) {
            const section = cartItems[j];
            const meeting = section.meetingsFaculty && section.meetingsFaculty[0] ? section.meetingsFaculty[0].meetingTime : null;
            const days = meeting ? formatDays(meeting) : 'TBA';
            const time = meeting ? formatTime(meeting.beginTime) + '-' + formatTime(meeting.endTime) : '';

            html += '<div class="irp-cart-card" data-crn="' + escapeHTML(section.courseReferenceNumber) + '">'
                + '<div class="irp-cart-card-header">'
                + '<span class="irp-cart-card-title">' + escapeHTML(section.subject) + ' ' + escapeHTML(section.courseNumber) + '-' + escapeHTML(section.sequenceNumber) + '</span>'
                + '<button type="button" class="irp-cart-remove" data-crn="' + escapeHTML(section.courseReferenceNumber) + '" aria-label="Remove">&times;</button>'
                + '</div>'
                + '<div class="irp-cart-card-detail">' + escapeHTML(days) + ' ' + escapeHTML(time) + '</div>'
                + '<div class="irp-cart-card-detail">CRN: ' + escapeHTML(section.courseReferenceNumber) + '</div>'
                + '</div>';
        }

        coursesContainer.innerHTML = html || '<p class="irp-text-muted" style="padding:16px;text-align:center;">No courses added yet</p>';

        renderMiniSchedule();
        checkConflicts();
    }

    function addToCart(section) {
        const crn = section.courseReferenceNumber;
        if (cartItems.some(function (item) { return item.courseReferenceNumber === crn; })) return;

        fetch(BASE_PATH + '/classRegistration/addRegistrationItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'term=' + encodeURIComponent(currentTerm)
                + '&courseReferenceNumber=' + encodeURIComponent(crn)
                + '&synchronizerToken=' + encodeURIComponent(synchronizerToken)
        })
        .then(function (response) { return response.json(); })
        .then(function () {
            cartItems.push(section);
            renderCart();
            openDrawer();
            updateAddButtons();
        })
        .catch(function (error) {
            console.error('[IRoar Premium] Failed to add course:', error);
        });
    }

    function removeFromCart(crn) {
        fetch(BASE_PATH + '/classRegistration/dropRegistrationItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'term=' + encodeURIComponent(currentTerm)
                + '&courseReferenceNumber=' + encodeURIComponent(crn)
                + '&synchronizerToken=' + encodeURIComponent(synchronizerToken)
        })
        .then(function () {
            cartItems = cartItems.filter(function (item) { return item.courseReferenceNumber !== crn; });
            renderCart();
            updateAddButtons();
        })
        .catch(function (error) {
            console.error('[IRoar Premium] Failed to remove course:', error);
        });
    }

    function addByCRN(crnValue) {
        const crn = crnValue.trim();
        if (!crn) return;

        const section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });

        if (section) {
            addToCart(section);
        } else {
            console.warn('[IRoar Premium] CRN ' + crn + ' not found in current search results');
        }
    }

    function showDrawerError(message) {
        const existing = document.querySelector('.irp-drawer-error');
        if (existing) existing.remove();

        const errorEl = document.createElement('div');
        errorEl.className = 'irp-drawer-error';
        errorEl.textContent = message;

        const footer = document.querySelector('.irp-drawer-footer');
        if (footer) footer.parentNode.insertBefore(errorEl, footer);

        setTimeout(function () {
            if (errorEl.parentNode) errorEl.remove();
        }, 5000);
    }

    function renderSubmitResult(data) {
        const existing = document.querySelector('.irp-submit-result');
        if (existing) existing.remove();

        const resultEl = document.createElement('div');
        resultEl.className = 'irp-submit-result';
        let html = '';

        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                if (item.statusDescription === 'Registered' || item.statusIndicator === 'RS') {
                    html += '<div class="irp-submit-success">&#10003; ' + escapeHTML(item.subject || '') + ' ' + escapeHTML(item.courseNumber || '') + ' — Registered</div>';
                } else {
                    const errorMsg = item.message || item.statusDescription || 'Registration failed';
                    html += '<div class="irp-submit-error">&#10007; ' + escapeHTML(item.subject || '') + ' ' + escapeHTML(item.courseNumber || '') + ' — ' + escapeHTML(errorMsg) + '</div>';
                }
            }
        } else if (data && data.message) {
            html = '<div class="irp-submit-error">&#10007; ' + escapeHTML(data.message) + '</div>';
        } else {
            html = '<div class="irp-submit-success">&#10003; Registration submitted</div>';
        }

        resultEl.innerHTML = html;

        const footer = document.querySelector('.irp-drawer-footer');
        if (footer) footer.parentNode.insertBefore(resultEl, footer);
    }

    function submitRegistration() {
        const submitButton = document.querySelector('.irp-submit-registration');
        if (!submitButton) return;

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        fetch(BASE_PATH + '/classRegistration/submitRegistration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'synchronizerToken=' + encodeURIComponent(synchronizerToken)
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            renderSubmitResult(data);
        })
        .catch(function (error) {
            showDrawerError('Registration submission failed. Please try again.');
            console.error('[IRoar Premium] Submit error:', error);
        })
        .finally(function () {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Registration';
        });
    }

    function showSessionExpired() {
        if (document.querySelector('.irp-session-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'irp-session-banner';
        banner.innerHTML = 'Session expired. <a href="/StudentRegistrationSsb/ssb/prepareRegistration/prepareRegistration">Log in again</a>';

        const app = document.querySelector('.irp-app');
        if (app) app.prepend(banner);
    }

    function loadExistingCart() {
        fetch(BASE_PATH + '/classRegistration/getRegistrationItems')
            .then(function (response) {
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    // Endpoint returned HTML (likely not in registration context yet)
                    return null;
                }
                return response.json();
            })
            .then(function (data) {
                if (data && Array.isArray(data)) {
                    cartItems = data;
                    renderCart();
                    updateAddButtons();
                }
            })
            .catch(function () {
                // Silently ignore — cart will start empty
            });
    }

    function toggleCartDrawer() {
        const drawer = document.querySelector('.irp-drawer');
        const overlay = document.querySelector('.irp-drawer-overlay');

        if (!drawer || !overlay) {
            return;
        }

        drawer.classList.toggle('irp-drawer-closed');
        overlay.classList.toggle('irp-hidden');
    }

    function toggleSidebar() {
        const sidebar = document.querySelector('.irp-sidebar');

        if (sidebar) {
            sidebar.classList.toggle('irp-sidebar-open');
        }
    }

    function bindEvents() {
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
                showAutocompleteResults(dropdown, results, filterKey);
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
                    handleSortClick(event);
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
                    removeFromCart(removeButton.dataset.crn);
                    return;
                }

                if (event.target.closest('.irp-crn-add')) {
                    const crnInput = document.querySelector('.irp-crn-input');
                    if (crnInput) {
                        addByCRN(crnInput.value);
                        crnInput.value = '';
                    }
                    return;
                }

                if (event.target.closest('.irp-submit-registration')) {
                    submitRegistration();
                }
            });

            const crnInput = drawer.querySelector('.irp-crn-input');
            if (crnInput) {
                crnInput.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter') {
                        addByCRN(crnInput.value);
                        crnInput.value = '';
                    }
                });
            }
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
                    sidebarEl.classList.remove('irp-sidebar-open');
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (!event.target.closest('.irp-autocomplete-wrapper')) {
                closeAllDropdowns();
            }
        });
    }

    function fetchCurrentTerm() {
        return fetch(BASE_PATH + '/term/current')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data && data.studentTerm) {
                    currentTerm = String(data.studentTerm);
                } else if (data && data.term) {
                    currentTerm = String(data.term);
                } else if (data && typeof data === 'string') {
                    currentTerm = data;
                }
            })
            .catch(function (error) {
                console.warn('[IRoar Premium] Could not fetch term from API:', error);
            });
    }

    function init() {
        extractSessionData();
        hideOriginalUI();
        injectCSS();
        buildShell();
        startKeepalive();
        bindEvents();

        var ready = currentTerm
            ? Promise.resolve()
            : fetchCurrentTerm();

        ready.then(function () {
            console.log('[IRoar Premium] Term resolved:', currentTerm || 'still missing');
            var termDisplay = document.querySelector('.irp-term-display');

            if (termDisplay && currentTerm) {
                termDisplay.textContent = formatTermCode(currentTerm);
            }

            loadExistingCart();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
