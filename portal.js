// Keep Bootstrap's role-specific tabs and links as the source of the dashboard.
(() => {
    const tabs = document.querySelector('#page_body .nav-tabs');
    const panes = document.querySelector('#page_body .tab-content');
    if (!tabs || !panes || !panes.querySelector('.tab-item a[href]') || document.querySelector('.iroar-portal-search')) return;

    const layout = tabs.parentElement;
    const sectionTabs = [...tabs.querySelectorAll('[data-bs-toggle="tab"]')];
    layout.classList.add('iroar-portal-layout');
    document.body.classList.add('iroar-portal-page');

    const search = document.createElement('header');
    search.className = 'iroar-portal-search';
    search.innerHTML = `<div class="iroar-portal-heading">
        <h1></h1>
        <label class="iroar-portal-field"><i class="bi bi-search" aria-hidden="true"></i>
            <span class="visually-hidden">Find a campus service</span>
            <input type="search" placeholder="Search all campus services" autocomplete="off">
        </label>
        </div><img class="iroar-portal-photo" alt="" hidden>`;
    tabs.before(search);
    const input = search.querySelector('input');
    input.id = 'iroar-service-query';
    const heading = search.querySelector('h1');
    const photo = search.querySelector('img');

    const sidebar = document.createElement('div');
    sidebar.className = 'iroar-portal-sidebar';
    sidebar.innerHTML = '<h2 id="iroar-sections-heading">Portal sections</h2>';
    tabs.before(sidebar);
    sidebar.append(tabs);
    if (!tabs.hasAttribute('aria-label') && !tabs.hasAttribute('aria-labelledby')) tabs.setAttribute('aria-labelledby', 'iroar-sections-heading');
    const desktop = matchMedia('(min-width: 992px)');
    function setOrientation() {
        tabs.setAttribute('aria-orientation', desktop.matches ? 'vertical' : 'horizontal');
    }
    setOrientation();
    desktop.addEventListener('change', setOrientation);

    const results = document.createElement('div');
    results.className = 'iroar-portal-results';
    results.innerHTML = '<p role="status"></p><ul hidden></ul>';
    panes.after(results);
    const list = results.querySelector('ul');
    const status = results.querySelector('p');

    // Reuse the campus photograph without moving messages or links in the original panel.
    for (const img of panes.querySelectorAll('.tab-pane > .row > .col-lg-3 > div > img:only-child')) {
        if (!img.parentElement.textContent.trim()) img.parentElement.classList.add('iroar-pane-photo');
    }
    function updateHeading(tab) {
        heading.textContent = tab?.textContent.trim() || 'Dashboard';
        const panelId = tab?.getAttribute('aria-controls') || tab?.dataset.bsTarget?.slice(1);
        const source = panelId && document.getElementById(panelId)?.querySelector('.iroar-pane-photo img');
        photo.hidden = !source;
        if (source) photo.src = source.currentSrc || source.src;
        else photo.removeAttribute('src');
    }
    const activeTab = () => tabs.querySelector('.active') || sectionTabs[0];
    updateHeading(activeTab());

    const brand = document.querySelector('#starter-nav .navbar-brand');
    const logoLink = document.querySelector('#header-link');
    const logo = logoLink?.querySelector('img');
    if (brand && logo && logoLink.href === brand.href) {
        const image = logo.cloneNode(false);
        image.className = 'iroar-portal-wordmark';
        image.alt = '';
        const title = document.createElement('span');
        title.textContent = brand.textContent.trim();
        brand.replaceChildren(image, title);
        document.body.classList.add('iroar-portal-branded');
    }

    function clearSearch() {
        input.value = '';
        list.replaceChildren();
        list.hidden = true;
        status.textContent = '';
        panes.hidden = false;
        layout.classList.remove('iroar-searching');
    }
    tabs.addEventListener('click', event => {
        if (event.target.closest('[data-bs-toggle="tab"]') && input.value) {
            clearSearch();
            updateHeading(activeTab());
        }
    });
    tabs.addEventListener('shown.bs.tab', event => {
        clearSearch();
        updateHeading(event.target);
    });

    const appMenu = document.querySelector('#app-nav #navbarSupportedContent');
    const appToggle = document.querySelector('#app-nav [aria-controls="navbarSupportedContent"]');
    if (appMenu && appToggle) {
        appToggle.setAttribute('aria-label', 'Portal navigation');
        const sections = document.createElement('div');
        sections.className = 'iroar-portal-sections';
        for (const tab of sectionTabs) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = tab.textContent.trim();
            button.addEventListener('click', () => {
                clearSearch();
                tab.click();
                updateHeading(tab);
                if (appToggle.getAttribute('aria-expanded') === 'true') appToggle.click();
                tab.focus();
            });
            sections.append(button);
        }
        appMenu.append(sections);
    }
    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
            clearSearch();
            updateHeading(activeTab());
            return;
        }
        layout.classList.add('iroar-searching');
        heading.textContent = 'Search results';
        panes.hidden = true;
        list.replaceChildren();
        const seen = new Set();
        for (const original of panes.querySelectorAll('.tab-item a[href]')) {
            const label = original.textContent.trim();
            if (!label.toLowerCase().includes(query) || seen.has(original.href)) continue;
            seen.add(original.href);
            const row = document.createElement('li');
            const link = original.cloneNode(false);
            link.removeAttribute('id');
            link.textContent = label;
            row.append(link);
            list.append(row);
        }
        list.hidden = !seen.size;
        status.textContent = seen.size ? seen.size+' matching '+(seen.size===1?'service':'services') : 'No matching services. Try a shorter search.';
    });
})();
