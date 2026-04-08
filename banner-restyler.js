// IRoar Premium - General Banner Page Restyler
// CSS is injected via manifest. This JS handles overrides that need higher priority
// than Ellucian's dynamically-loaded CSS, plus header links and branding badge.

(function () {
    // Point the iRoar branding link to the dashboard instead of registration
    const branding = document.getElementById('branding');
    if (branding) {
        branding.setAttribute('href', 'https://sadv.sis.clemson.edu/StudentSelfService/ssb/studentCommonDashboard');
    }

    // Close the banner menu panel if it's open (and hide it)
    const menuNav = document.querySelector('#header-main-section-west-part nav, nav#menu');
    if (menuNav) menuNav.style.display = 'none';
    // Click the menu button to close the panel state if it was open
    const menuBtn = document.getElementById('bannerMenu');
    if (menuBtn) {
        const menuOpen = document.querySelector('.banner-menu-open, [aria-expanded="true"]');
        if (menuOpen) menuBtn.click();
    }

    // Inject late-loading CSS overrides that must beat dynamically-loaded styles
    const overrides = document.createElement('style');
    overrides.id = 'iroar-late-overrides';
    overrides.textContent = `
        /* Hide stuck menu panel */
        #header-main-section-west-part nav,
        nav#menu {
            display: none !important;
        }

        /* Tabs - must load after page CSS */
        ul.ui-tabs-nav,
        #content ul.ui-tabs-nav,
        .ui-layout-pane ul.ui-tabs-nav {
            background: #f8f8fa !important;
            border-bottom: 2px solid #e0e0e0 !important;
            overflow: visible !important;
            position: relative !important;
            z-index: 5 !important;
        }
        ul.ui-tabs-nav li.ui-tabs-tab,
        ul.ui-tabs-nav li.ui-state-default {
            background: transparent !important;
            border: none !important;
        }
        ul.ui-tabs-nav li.ui-tabs-tab a,
        ul.ui-tabs-nav li.ui-tabs-tab a.ui-tabs-anchor,
        ul.ui-tabs-nav li.ui-state-default a {
            color: #222 !important;
            font-size: 14px !important;
            font-weight: 700 !important;
            padding: 10px 18px !important;
            background: #f0f0f0 !important;
            border-bottom: 3px solid transparent !important;
            text-decoration: none !important;
            display: inline-block !important;
        }
        ul.ui-tabs-nav li.ui-tabs-active a,
        ul.ui-tabs-nav li.ui-state-active a,
        ul.ui-tabs-nav li.ui-tabs-tab a:hover,
        ul.ui-tabs-nav li.ui-state-default a:hover {
            color: #F56600 !important;
            border-bottom-color: #F56600 !important;
            background: #fff !important;
        }

        /* h2.title - subtle on inner pages, orange only on landing tiles */
        h2.title {
            color: #522D80 !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            background: none !important;
            border-bottom: 2px solid #e5e5e7 !important;
            border-radius: 0 !important;
            padding: 12px 16px !important;
            margin: 0 0 12px 0 !important;
        }
        .landing-path h2.title {
            background: linear-gradient(135deg, #F56600 0%, #E55A00 100%) !important;
            color: #fff !important;
            border-bottom: none !important;
            border-radius: 8px 8px 0 0 !important;
            padding: 16px 20px !important;
            margin: 0 !important;
        }
    `;
    document.head.appendChild(overrides);

    function addBadge() {
        if (document.querySelector('.iroar-premium-badge')) return;
        if (document.querySelector('.irp-app')) return;
        const badge = document.createElement('div');
        badge.className = 'iroar-premium-badge';
        badge.innerHTML = 'Enhanced by <strong>IRoar Premium</strong>';
        document.body.appendChild(badge);
    }

    addBadge();
})();
