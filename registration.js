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
            <aside class="irp-drawer irp-drawer-closed"></aside>
            <div class="irp-drawer-overlay irp-hidden"></div>
        `;

        document.body.appendChild(app);
    }

    function startKeepalive() {
        setInterval(function () {
            fetch(BASE_PATH + '/keepAlive/data').then(function (response) {
                if (!response.ok) {
                    console.warn('[IRoar Premium] Keepalive failed with status:', response.status);
                }
            }).catch(function (error) {
                console.warn('[IRoar Premium] Keepalive request error:', error);
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

    function executeSearch() {
        console.log('[IRoar Premium] Search with filters:', activeFilters);
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

        const cartToggle = document.querySelector('.irp-cart-toggle');

        if (cartToggle) {
            cartToggle.addEventListener('click', toggleCartDrawer);
        }

        const drawerOverlay = document.querySelector('.irp-drawer-overlay');

        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', toggleCartDrawer);
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
