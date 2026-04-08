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

    const rmpDataMap = new Map();
    const gradeDataMap = new Map();

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
                    <span class="irp-brand">IRoar <span class="irp-brand-premium">Premium</span></span>
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
                    var dot = document.querySelector('.irp-keepalive-dot');
                    if (dot) dot.classList.add('irp-keepalive-dead');
                    showSessionExpired();
                }
            }).catch(function (error) {
                console.warn('[IRoar Premium] Keepalive request error:', error);
                var dot = document.querySelector('.irp-keepalive-dot');
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
            chip.innerHTML = '<span class="irp-chip-label">' + label + ': ' + displayValue + '</span>'
                + '<button type="button" class="irp-chip-remove" data-key="' + key + '" aria-label="Remove ' + label + ' filter">&times;</button>';
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
            var parts = displayName.split(',');
            return parts[1].trim() + ' ' + parts[0].trim();
        }
        return displayName;
    }

    function formatTime(timeString) {
        if (!timeString || timeString.length < 4) return '';
        var hours = parseInt(timeString.substring(0, 2), 10);
        var minutes = timeString.substring(2, 4);
        var period = hours >= 12 ? 'pm' : 'am';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        return hours + ':' + minutes + period;
    }

    function formatDays(meetingTime) {
        var days = '';
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
        var total = 0;
        for (var i = 0; i < gradeData.length; i++) {
            total += parseFloat(gradeData[i].data[4]) || 0;
        }
        return total / gradeData.length;
    }

    function renderStatusDot(section) {
        var enrolled = section.enrollment || 0;
        var max = section.maximumEnrollment || 0;
        var waitCount = section.waitCount || 0;
        if (enrolled >= max && waitCount > 0) return '<span class="irp-status irp-status-waitlist" title="Waitlist"></span>';
        if (enrolled >= max) return '<span class="irp-status irp-status-closed" title="Closed"></span>';
        return '<span class="irp-status irp-status-open" title="Open"></span>';
    }

    function renderProfessor(section) {
        var faculty = section.faculty && section.faculty[0];
        if (!faculty) return '<span class="irp-text-muted">TBA</span>';
        return '<span class="irp-professor" data-name="' + faculty.displayName + '">' + faculty.displayName + '</span>';
    }

    function renderSeats(section) {
        var enrolled = section.enrollment || 0;
        var max = section.maximumEnrollment || 0;
        var remaining = max - enrolled;
        var colorClass = remaining > 5 ? 'irp-good' : remaining > 0 ? 'irp-medium' : 'irp-poor';
        return '<span class="' + colorClass + '">' + enrolled + '/' + max + '</span>';
    }

    function renderAddButton(section) {
        var inCart = cartItems.some(function (item) { return item.courseReferenceNumber === section.courseReferenceNumber; });
        if (inCart) return '<button class="irp-btn-added" disabled>Added</button>';
        return '<button class="irp-btn-add" data-crn="' + section.courseReferenceNumber + '">Add</button>';
    }

    function showLoadingState() {
        var container = document.querySelector('.irp-results-container');
        if (!container) return;

        var html = '';
        for (var i = 0; i < 8; i++) {
            html += '<div class="irp-skeleton-row"></div>';
        }
        container.innerHTML = html;
    }

    function showErrorState(message) {
        var container = document.querySelector('.irp-results-container');
        if (!container) return;

        container.innerHTML = '<div class="irp-empty-state">'
            + '<p>' + message + '</p>'
            + '<button type="button" class="irp-btn-add" onclick="this.closest(\'.irp-results-container\').dispatchEvent(new Event(\'irp-retry\'))">Retry</button>'
            + '</div>';

        container.addEventListener('irp-retry', function () {
            executeSearch(currentPage);
        }, { once: true });
    }

    function showEmptyResults() {
        var container = document.querySelector('.irp-results-container');
        if (!container) return;
        container.innerHTML = '<div class="irp-empty-state">No results found</div>';
    }

    function renderResultsTable(results) {
        var container = document.querySelector('.irp-results-container');
        if (!container) return;

        if (!results || results.length === 0) {
            showEmptyResults();
            return;
        }

        var html = '<table class="irp-table">'
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

        for (var i = 0; i < results.length; i++) {
            var section = results[i];
            var meeting = section.meetingsFaculty && section.meetingsFaculty[0] && section.meetingsFaculty[0].meetingTime;

            var timeDisplay = '';
            var daysDisplay = 'TBA';
            var locationDisplay = 'TBA';

            if (meeting) {
                var begin = formatTime(meeting.beginTime);
                var end = formatTime(meeting.endTime);
                timeDisplay = begin && end ? begin + '-' + end : '';
                daysDisplay = formatDays(meeting);
                var building = meeting.building || '';
                var room = meeting.room || '';
                locationDisplay = (building + ' ' + room).trim() || 'TBA';
            }

            var credits = section.creditHours || section.creditHourLow || '—';

            html += '<tr data-crn="' + section.courseReferenceNumber + '">'
                + '<td>' + renderStatusDot(section) + '</td>'
                + '<td>' + section.courseReferenceNumber + '</td>'
                + '<td>' + (section.subject || '') + '</td>'
                + '<td>' + (section.courseNumber || '') + '</td>'
                + '<td>' + (section.sequenceNumber || '') + '</td>'
                + '<td>' + (section.courseTitle || '') + '</td>'
                + '<td>' + credits + '</td>'
                + '<td>' + renderProfessor(section) + '</td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td><span class="irp-cell-loading"></span></td>'
                + '<td>' + timeDisplay + '</td>'
                + '<td>' + daysDisplay + '</td>'
                + '<td>' + locationDisplay + '</td>'
                + '<td>' + renderSeats(section) + '</td>'
                + '<td>' + renderAddButton(section) + '</td>'
                + '</tr>';
        }

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderPagination() {
        var paginationContainer = document.querySelector('.irp-pagination');
        if (!paginationContainer) return;

        var totalPages = Math.ceil(totalResults / PAGE_SIZE);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        var start = currentPage * PAGE_SIZE + 1;
        var end = Math.min((currentPage + 1) * PAGE_SIZE, totalResults);

        var html = '<span class="irp-page-info">Showing ' + start + '-' + end + ' of ' + totalResults + ' results</span>'
            + '<div class="irp-page-buttons">'
            + '<button type="button" class="irp-page-btn" data-page="' + (currentPage - 1) + '"' + (currentPage === 0 ? ' disabled' : '') + '>Prev</button>'
            + '<button type="button" class="irp-page-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages - 1 ? ' disabled' : '') + '>Next</button>'
            + '</div>';

        paginationContainer.innerHTML = html;
    }

    function updateRMPCells(normalizedName) {
        var teacher = rmpDataMap.get(normalizedName);
        var rows = document.querySelectorAll('.irp-table tbody tr[data-crn]');

        for (var i = 0; i < rows.length; i++) {
            var profElement = rows[i].querySelector('.irp-professor');
            if (!profElement) continue;

            var rowNormalized = normalizeProfessorName(profElement.dataset.name).toLowerCase();
            if (rowNormalized !== normalizedName) continue;

            var cells = rows[i].querySelectorAll('td');

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
        var professors = new Set();
        for (var i = 0; i < results.length; i++) {
            var faculty = results[i].faculty && results[i].faculty[0];
            if (faculty && faculty.displayName) {
                professors.add(faculty.displayName);
            }
        }

        professors.forEach(function (displayName) {
            var normalized = normalizeProfessorName(displayName).toLowerCase();
            if (rmpDataMap.has(normalized)) {
                updateRMPCells(normalized);
                return;
            }

            var professorName = normalizeProfessorName(displayName);
            var port = chrome.runtime.connect({ name: 'professor-rating' });
            port.postMessage({ professorName: professorName });
            port.onMessage.addListener(function (teacher) {
                rmpDataMap.set(normalized, teacher);
                updateRMPCells(normalized);
            });
        });
    }

    function updateGradeCells(normalizedName) {
        var gradeData = gradeDataMap.get(normalizedName);
        var rows = document.querySelectorAll('.irp-table tbody tr[data-crn]');

        for (var i = 0; i < rows.length; i++) {
            var profElement = rows[i].querySelector('.irp-professor');
            if (!profElement) continue;

            var rowNormalized = normalizeProfessorName(profElement.dataset.name).toLowerCase();
            if (rowNormalized !== normalizedName) continue;

            var cell = rows[i].querySelectorAll('td')[11];
            if (!gradeData || gradeData.length === 0) {
                cell.innerHTML = '<span class="irp-text-muted">N/A</span>';
                continue;
            }

            var totals = { a: 0, b: 0, c: 0, d: 0, f: 0 };
            var count = gradeData.length;
            for (var j = 0; j < count; j++) {
                var row = gradeData[j].data;
                totals.a += parseFloat(row[4]) || 0;
                totals.b += parseFloat(row[5]) || 0;
                totals.c += parseFloat(row[6]) || 0;
                totals.d += parseFloat(row[7]) || 0;
                totals.f += parseFloat(row[8]) || 0;
            }

            var averageA = Math.round(totals.a / count);
            var averageB = Math.round(totals.b / count);
            var averageC = Math.round(totals.c / count);
            var averageD = Math.round(totals.d / count);
            var averageF = Math.round(totals.f / count);

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
        var professors = new Set();
        for (var i = 0; i < results.length; i++) {
            var faculty = results[i].faculty && results[i].faculty[0];
            if (faculty && faculty.displayName) professors.add(faculty.displayName);
        }

        professors.forEach(function (displayName) {
            var normalized = normalizeProfessorName(displayName).toLowerCase();
            if (gradeDataMap.has(normalized)) {
                updateGradeCells(normalized);
                return;
            }

            var name = normalizeProfessorName(displayName);
            var nameParts = name.split(' ');
            if (nameParts.length < 2) return;

            var port = chrome.runtime.connect({ name: 'grade-distribution' });
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
        var headers = document.querySelectorAll('.irp-table thead th[data-sort-key]');
        for (var i = 0; i < headers.length; i++) {
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
            var nameA = normalizeProfessorName(a.faculty && a.faculty[0] ? a.faculty[0].displayName : '').toLowerCase();
            var nameB = normalizeProfessorName(b.faculty && b.faculty[0] ? b.faculty[0].displayName : '').toLowerCase();
            var dataA = rmpDataMap.get(nameA);
            var dataB = rmpDataMap.get(nameB);
            var valA, valB;

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
                var gradeA = gradeDataMap.get(nameA);
                var gradeB = gradeDataMap.get(nameB);
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
        var header = event.target.closest('th[data-sort-key]');
        if (!header) return;

        var key = header.dataset.sortKey;
        var CLIENT_SORT_KEYS = ['rmpRating', 'rmpDifficulty', 'rmpWTA', 'grades'];

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
        var url = BASE_PATH + '/searchResults/' + endpoint + '?term=' + term + '&courseReferenceNumber=' + crn;
        return fetch(url).then(function (response) {
            return response.text();
        }).then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            return doc.body.textContent.trim() || null;
        }).catch(function () {
            return null;
        });
    }

    function renderGradeBars(chartId, gradeData, selection) {
        var chart = document.getElementById(chartId);
        if (!chart) return;

        var grades;
        var GRADE_LABELS = ['A', 'B', 'C', 'D', 'F'];
        var GRADE_COLORS = ['#4caf50', '#2196f3', '#ffc107', '#ff9800', '#f44336'];

        if (selection === 'all') {
            var totals = [0, 0, 0, 0, 0];
            for (var i = 0; i < gradeData.length; i++) {
                for (var j = 0; j < 5; j++) {
                    totals[j] += parseFloat(gradeData[i].data[4 + j]) || 0;
                }
            }
            grades = totals.map(function (total) { return Math.round(total / gradeData.length); });
        } else {
            var entry = gradeData[parseInt(selection)];
            grades = [];
            for (var k = 0; k < 5; k++) {
                grades.push(parseInt(entry.data[4 + k]) || 0);
            }
        }

        var maxPercent = Math.max.apply(null, grades) || 1;
        var barsHTML = '';

        for (var g = 0; g < 5; g++) {
            var height = Math.round((grades[g] / maxPercent) * 80);
            barsHTML += '<div class="irp-bar-wrapper">'
                + '<div class="irp-bar-value">' + grades[g] + '%</div>'
                + '<div class="irp-bar" style="height:' + height + 'px;background:' + GRADE_COLORS[g] + '"></div>'
                + '<div class="irp-bar-label">' + GRADE_LABELS[g] + '</div>'
                + '</div>';
        }

        chart.innerHTML = '<div class="irp-bar-chart">' + barsHTML + '</div>';
    }

    function renderDetailGradeChart(section, container) {
        var faculty = section.faculty && section.faculty[0];
        if (!faculty) return;

        var normalized = normalizeProfessorName(faculty.displayName).toLowerCase();
        var gradeData = gradeDataMap.get(normalized);

        if (!gradeData || gradeData.length === 0) {
            container.insertAdjacentHTML('beforeend', '<div class="irp-detail-section"><h4>Grade Distribution</h4><p class="irp-text-muted">No grade data available</p></div>');
            return;
        }

        var optionsHTML = '<option value="all">All Semesters (Average)</option>';
        for (var i = 0; i < gradeData.length; i++) {
            optionsHTML += '<option value="' + i + '">' + gradeData[i].semester + ' ' + gradeData[i].year + ' — ' + gradeData[i].data[0] + ' ' + gradeData[i].data[1] + '</option>';
        }

        var chartId = 'irp-grade-chart-' + section.courseReferenceNumber;
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
        var faculty = section.faculty && section.faculty[0];
        if (!faculty) {
            container.innerHTML = '<p class="irp-text-muted">No professor assigned</p>';
            return;
        }

        var normalized = normalizeProfessorName(faculty.displayName).toLowerCase();
        var teacher = rmpDataMap.get(normalized);

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

    function renderDetailPanel(detailRow, section, details) {
        var panel = detailRow.querySelector('.irp-detail-panel');

        var infoHTML = '';
        if (details.description) infoHTML += '<div class="irp-detail-section"><h4>Description</h4><p>' + details.description + '</p></div>';
        if (details.meetingTimes) infoHTML += '<div class="irp-detail-section"><h4>Meeting Times</h4><p>' + details.meetingTimes + '</p></div>';
        if (details.fees) infoHTML += '<div class="irp-detail-section"><h4>Fees</h4><p>' + details.fees + '</p></div>';
        if (details.attributes) infoHTML += '<div class="irp-detail-section"><h4>Attributes</h4><p>' + details.attributes + '</p></div>';
        if (details.enrollment) infoHTML += '<div class="irp-detail-section"><h4>Enrollment</h4><p>' + details.enrollment + '</p></div>';
        panel.querySelector('.irp-detail-info-content').innerHTML = infoHTML || '<p class="irp-text-muted">No additional info</p>';

        var reqsHTML = '';
        if (details.prerequisites) reqsHTML += '<div class="irp-detail-section"><h4>Prerequisites</h4><p>' + details.prerequisites + '</p></div>';
        if (details.corequisites) reqsHTML += '<div class="irp-detail-section"><h4>Corequisites</h4><p>' + details.corequisites + '</p></div>';
        if (details.restrictions) reqsHTML += '<div class="irp-detail-section"><h4>Restrictions</h4><p>' + details.restrictions + '</p></div>';
        if (details.linkedSections) reqsHTML += '<div class="irp-detail-section"><h4>Linked Sections</h4><p>' + details.linkedSections + '</p></div>';
        panel.querySelector('.irp-detail-reqs-content').innerHTML = reqsHTML || '<p class="irp-text-muted">No requirements</p>';

        var rmpContent = panel.querySelector('.irp-detail-rmp-content');
        renderDetailRMPCard(section, rmpContent);
        renderDetailGradeChart(section, rmpContent);
    }

    function loadDetailData(section, detailRow) {
        var term = currentTerm;
        var crn = section.courseReferenceNumber;

        Promise.allSettled([
            fetchDetailHTML('getCourseDescription', term, crn),
            fetchDetailHTML('getSectionPrerequisites', term, crn),
            fetchDetailHTML('getCorequisites', term, crn),
            fetchDetailHTML('getRestrictions', term, crn),
            fetchDetailHTML('getFacultyMeetingTimes', term, crn),
            fetchDetailHTML('getFees', term, crn),
            fetchDetailHTML('getSectionAttributes', term, crn),
            fetchDetailHTML('getEnrollmentInfo', term, crn),
            fetchDetailHTML('fetchLinkedSections', term, crn),
        ]).then(function (results) {
            renderDetailPanel(detailRow, section, {
                description: results[0].value,
                prerequisites: results[1].value,
                corequisites: results[2].value,
                restrictions: results[3].value,
                meetingTimes: results[4].value,
                fees: results[5].value,
                attributes: results[6].value,
                enrollment: results[7].value,
                linkedSections: results[8].value,
            });
        });
    }

    function handleRowClick(event) {
        if (event.target.closest('.irp-btn-add, .irp-btn-added')) return;

        var row = event.target.closest('tr[data-crn]');
        if (!row) return;

        var existingDetail = row.nextElementSibling;
        if (existingDetail && existingDetail.classList.contains('irp-detail-row')) {
            existingDetail.remove();
            row.classList.remove('irp-row-expanded');
            return;
        }

        row.classList.add('irp-row-expanded');

        var crn = row.dataset.crn;
        var section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });
        if (!section) return;

        var detailRow = document.createElement('tr');
        detailRow.className = 'irp-detail-row';
        var detailCell = document.createElement('td');
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

    function executeSearch(page) {
        if (page === undefined) page = 0;
        currentPage = page;

        var params = new URLSearchParams();
        params.set('term', currentTerm);
        params.set('pageOffset', String(page * PAGE_SIZE));
        params.set('pageMaxSize', String(PAGE_SIZE));
        params.set('sortColumn', sortColumn);
        params.set('sortDirection', sortDirection);

        var filterKeys = Object.keys(activeFilters);
        for (var i = 0; i < filterKeys.length; i++) {
            var key = filterKeys[i];
            var value = activeFilters[key];
            if (key === 'txt_creditHourRange') {
                var parts = value.code.split('-');
                if (parts[0]) params.set('txt_credithourlow', parts[0]);
                if (parts[1]) params.set('txt_credithourhigh', parts[1]);
            } else {
                params.set(key, value.code || value);
            }
        }

        showLoadingState();

        fetch(BASE_PATH + '/searchResults/searchResults?' + params.toString())
            .then(function (response) { return response.json(); })
            .then(function (data) {
                totalResults = data.totalCount || 0;
                currentSearchResults = data.data || [];
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
        var badge = document.querySelector('.irp-cart-badge');
        if (!badge) return;

        badge.textContent = cartItems.length;

        if (cartItems.length > 0) {
            badge.classList.remove('irp-hidden');
        } else {
            badge.classList.add('irp-hidden');
        }
    }

    function updateAddButtons() {
        var buttons = document.querySelectorAll('.irp-btn-add, .irp-btn-added');

        for (var i = 0; i < buttons.length; i++) {
            var crn = buttons[i].dataset.crn;
            var inCart = cartItems.some(function (item) { return item.courseReferenceNumber === crn; });

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
        var drawer = document.querySelector('.irp-drawer');
        var overlay = document.querySelector('.irp-drawer-overlay');
        if (!drawer || !overlay) return;

        drawer.classList.remove('irp-drawer-closed');
        overlay.classList.remove('irp-hidden');
    }

    function renderMiniSchedule() {
        var container = document.querySelector('.irp-drawer-schedule');
        if (!container) return;

        if (cartItems.length === 0) {
            container.innerHTML = '';
            return;
        }

        var DAYS = ['M', 'T', 'W', 'R', 'F'];
        var DAY_MAP = { M: 'monday', T: 'tuesday', W: 'wednesday', R: 'thursday', F: 'friday' };
        var START_HOUR = 7;
        var END_HOUR = 22;
        var HOUR_HEIGHT = 18;
        var SCHEDULE_COLORS = ['#522D80', '#F56600', '#2196f3', '#4caf50', '#ff9800', '#e91e63'];

        var html = '<div class="irp-schedule">';
        html += '<div class="irp-schedule-header">';

        for (var d = 0; d < DAYS.length; d++) {
            html += '<div class="irp-schedule-day-label">' + DAYS[d] + '</div>';
        }

        html += '</div>';
        html += '<div class="irp-schedule-body">';

        html += '<div class="irp-schedule-times">';

        for (var h = START_HOUR; h <= END_HOUR; h++) {
            var label = h > 12 ? (h - 12) + 'p' : (h === 12 ? '12p' : h + 'a');
            html += '<div class="irp-schedule-time" style="height:' + HOUR_HEIGHT + 'px">' + label + '</div>';
        }

        html += '</div>';

        for (var dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
            html += '<div class="irp-schedule-column" style="height:' + ((END_HOUR - START_HOUR + 1) * HOUR_HEIGHT) + 'px">';

            for (var c = 0; c < cartItems.length; c++) {
                var meeting = cartItems[c].meetingsFaculty && cartItems[c].meetingsFaculty[0] ? cartItems[c].meetingsFaculty[0].meetingTime : null;
                if (!meeting || !meeting[DAY_MAP[DAYS[dayIndex]]]) continue;

                var startMinutes = timeToMinutes(meeting.beginTime) - (START_HOUR * 60);
                var endMinutes = timeToMinutes(meeting.endTime) - (START_HOUR * 60);
                var top = (startMinutes / 60) * HOUR_HEIGHT;
                var height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                var color = SCHEDULE_COLORS[c % SCHEDULE_COLORS.length];

                html += '<div class="irp-schedule-block" style="top:' + top + 'px;height:' + Math.max(height, 10) + 'px;background:' + color + '"'
                    + ' title="' + cartItems[c].subject + ' ' + cartItems[c].courseNumber + '">'
                    + cartItems[c].subject.substring(0, 4)
                    + '</div>';
            }

            html += '</div>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

    function checkConflicts() {
        var conflicts = [];

        for (var i = 0; i < cartItems.length; i++) {
            for (var j = i + 1; j < cartItems.length; j++) {
                var meetingA = cartItems[i].meetingsFaculty && cartItems[i].meetingsFaculty[0] ? cartItems[i].meetingsFaculty[0].meetingTime : null;
                var meetingB = cartItems[j].meetingsFaculty && cartItems[j].meetingsFaculty[0] ? cartItems[j].meetingsFaculty[0].meetingTime : null;
                if (!meetingA || !meetingB) continue;

                var sharedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].filter(function (day) {
                    return meetingA[day] && meetingB[day];
                });
                if (sharedDays.length === 0) continue;

                var startA = timeToMinutes(meetingA.beginTime);
                var endA = timeToMinutes(meetingA.endTime);
                var startB = timeToMinutes(meetingB.beginTime);
                var endB = timeToMinutes(meetingB.endTime);

                if (startA < endB && startB < endA) {
                    conflicts.push(cartItems[i].subject + ' ' + cartItems[i].courseNumber + ' & ' + cartItems[j].subject + ' ' + cartItems[j].courseNumber);
                }
            }
        }

        var conflictContainer = document.querySelector('.irp-drawer-conflicts');
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
        var coursesContainer = document.querySelector('.irp-drawer-courses');
        if (!coursesContainer) return;

        var totalCredits = 0;

        for (var i = 0; i < cartItems.length; i++) {
            totalCredits += cartItems[i].creditHours || cartItems[i].creditHourLow || 0;
        }

        var countEl = document.querySelector('.irp-cart-count');
        if (countEl) countEl.textContent = cartItems.length;

        var creditsEl = document.querySelector('.irp-cart-credits');
        if (creditsEl) creditsEl.textContent = totalCredits + ' Credit Hours';

        updateCartBadge();

        var html = '';

        for (var j = 0; j < cartItems.length; j++) {
            var section = cartItems[j];
            var meeting = section.meetingsFaculty && section.meetingsFaculty[0] ? section.meetingsFaculty[0].meetingTime : null;
            var days = meeting ? formatDays(meeting) : 'TBA';
            var time = meeting ? formatTime(meeting.beginTime) + '-' + formatTime(meeting.endTime) : '';

            html += '<div class="irp-cart-card" data-crn="' + section.courseReferenceNumber + '">'
                + '<div class="irp-cart-card-header">'
                + '<span class="irp-cart-card-title">' + section.subject + ' ' + section.courseNumber + '-' + section.sequenceNumber + '</span>'
                + '<button type="button" class="irp-cart-remove" data-crn="' + section.courseReferenceNumber + '" aria-label="Remove">&times;</button>'
                + '</div>'
                + '<div class="irp-cart-card-detail">' + days + ' ' + time + '</div>'
                + '<div class="irp-cart-card-detail">CRN: ' + section.courseReferenceNumber + '</div>'
                + '</div>';
        }

        coursesContainer.innerHTML = html || '<p class="irp-text-muted" style="padding:16px;text-align:center;">No courses added yet</p>';

        renderMiniSchedule();
        checkConflicts();
    }

    function addToCart(section) {
        if (cartItems.some(function (item) { return item.courseReferenceNumber === section.courseReferenceNumber; })) return;

        cartItems.push(section);
        renderCart();
        openDrawer();
        updateAddButtons();
    }

    function removeFromCart(crn) {
        cartItems = cartItems.filter(function (item) { return item.courseReferenceNumber !== crn; });
        renderCart();
        updateAddButtons();
    }

    function addByCRN(crnValue) {
        var crn = crnValue.trim();
        if (!crn) return;

        var section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });

        if (section) {
            addToCart(section);
        } else {
            console.warn('[IRoar Premium] CRN ' + crn + ' not found in current search results');
        }
    }

    function showDrawerError(message) {
        var existing = document.querySelector('.irp-drawer-error');
        if (existing) existing.remove();

        var errorEl = document.createElement('div');
        errorEl.className = 'irp-drawer-error';
        errorEl.textContent = message;

        var footer = document.querySelector('.irp-drawer-footer');
        if (footer) footer.parentNode.insertBefore(errorEl, footer);

        setTimeout(function () {
            if (errorEl.parentNode) errorEl.remove();
        }, 5000);
    }

    function renderSubmitResult(data) {
        var existing = document.querySelector('.irp-submit-result');
        if (existing) existing.remove();

        var resultEl = document.createElement('div');
        resultEl.className = 'irp-submit-result';
        var html = '';

        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                if (item.statusDescription === 'Registered' || item.statusIndicator === 'RS') {
                    html += '<div class="irp-submit-success">&#10003; ' + (item.subject || '') + ' ' + (item.courseNumber || '') + ' — Registered</div>';
                } else {
                    var errorMsg = item.message || item.statusDescription || 'Registration failed';
                    html += '<div class="irp-submit-error">&#10007; ' + (item.subject || '') + ' ' + (item.courseNumber || '') + ' — ' + errorMsg + '</div>';
                }
            }
        } else if (data && data.message) {
            html = '<div class="irp-submit-error">&#10007; ' + data.message + '</div>';
        } else {
            html = '<div class="irp-submit-success">&#10003; Registration submitted</div>';
        }

        resultEl.innerHTML = html;

        var footer = document.querySelector('.irp-drawer-footer');
        if (footer) footer.parentNode.insertBefore(resultEl, footer);
    }

    function submitRegistration() {
        var submitButton = document.querySelector('.irp-submit-registration');
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

        var banner = document.createElement('div');
        banner.className = 'irp-session-banner';
        banner.innerHTML = 'Session expired. <a href="/StudentRegistrationSsb/ssb/prepareRegistration/prepareRegistration">Log in again</a>';

        var app = document.querySelector('.irp-app');
        if (app) app.prepend(banner);
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

        var paginationContainer = document.querySelector('.irp-pagination');

        if (paginationContainer) {
            paginationContainer.addEventListener('click', function (event) {
                var pageButton = event.target.closest('.irp-page-btn');

                if (pageButton) {
                    executeSearch(parseInt(pageButton.dataset.page, 10));
                }
            });
        }

        var resultsContainer = document.querySelector('.irp-results-container');

        if (resultsContainer) {
            resultsContainer.addEventListener('click', function (event) {
                var header = event.target.closest('th[data-sort-key]');
                if (header) {
                    handleSortClick(event);
                    return;
                }

                var addButton = event.target.closest('.irp-btn-add');
                if (addButton) {
                    var crn = addButton.dataset.crn;
                    var section = currentSearchResults.find(function (s) { return s.courseReferenceNumber === crn; });
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

        var drawer = document.querySelector('.irp-drawer');

        if (drawer) {
            drawer.addEventListener('click', function (event) {
                if (event.target.closest('.irp-drawer-close')) {
                    toggleCartDrawer();
                    return;
                }

                var removeButton = event.target.closest('.irp-cart-remove');
                if (removeButton) {
                    removeFromCart(removeButton.dataset.crn);
                    return;
                }

                if (event.target.closest('.irp-crn-add')) {
                    var crnInput = document.querySelector('.irp-crn-input');
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

            var crnInput = drawer.querySelector('.irp-crn-input');
            if (crnInput) {
                crnInput.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter') {
                        addByCRN(crnInput.value);
                        crnInput.value = '';
                    }
                });
            }
        }

        document.addEventListener('click', function (event) {
            if (!event.target.closest('.irp-autocomplete-wrapper')) {
                closeAllDropdowns();
            }
        });
    }

    function init() {
        extractSessionData();
        hideOriginalUI();
        injectCSS();
        buildShell();
        startKeepalive();

        const termDisplay = document.querySelector('.irp-term-display');

        if (termDisplay && currentTerm) {
            termDisplay.textContent = formatTermCode(currentTerm);
        }

        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
