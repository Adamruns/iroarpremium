(function () {
    'use strict';

    const BASE_PATH = '/StudentRegistrationSsb/ssb';
    const PAGE_SIZE = 25;

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

    function buildShell() {
        const app = document.createElement('div');
        app.className = 'irp-app';

        app.innerHTML = `
            <header class="irp-topbar">
                <span>IRoar Premium — Registration</span>
            </header>
            <div class="irp-body">
                <aside class="irp-sidebar">
                    <p style="padding:16px;color:#888;">Filters loading...</p>
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

    function init() {
        extractSessionData();
        hideOriginalUI();
        injectCSS();
        buildShell();
        startKeepalive();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
