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
        <div class="iroar-portal-field" role="search"><i class="bi bi-search" aria-hidden="true"></i>
            <label class="visually-hidden" for="iroar-service-query">Find a campus service</label>
            <input id="iroar-service-query" type="search" placeholder="Search all campus services" autocomplete="off" aria-controls="iroar-service-results">
            <button type="button" class="iroar-clear-search" aria-label="Clear search" hidden>Clear</button>
        </div>
        </div><img class="iroar-portal-photo" alt="" hidden>`;
    tabs.before(search);
    const input = search.querySelector('input');
    const clearButton = search.querySelector('.iroar-clear-search');
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
    results.id = 'iroar-service-results';
    results.innerHTML = '<p role="status" aria-atomic="true"></p><ul hidden></ul>';
    panes.after(results);
    const list = results.querySelector('ul');
    const status = results.querySelector('p');

    // Reuse the campus photograph without moving messages or links in the original panel.
    for (const img of panes.querySelectorAll('.tab-pane > .row > .col-lg-3 > div > img:only-child')) {
        if (!img.parentElement.textContent.trim()) img.parentElement.classList.add('iroar-pane-photo');
    }
    const panelIdFor = tab => tab?.getAttribute('aria-controls') || tab?.dataset.bsTarget?.slice(1);
    const sectionNames = new Map(sectionTabs.map(tab => [panelIdFor(tab), tab.textContent.trim()]));
    const menuButtons = new Map();
    function updateHeading(tab) {
        heading.textContent = tab?.textContent.trim() || 'Dashboard';
        const panelId = panelIdFor(tab);
        const source = panelId && document.getElementById(panelId)?.querySelector('.iroar-pane-photo img');
        photo.hidden = !source;
        if (source) photo.src = source.currentSrc || source.src;
        else photo.removeAttribute('src');
        for (const [section, button] of menuButtons) {
            if (section === tab) button.setAttribute('aria-current', 'true');
            else button.removeAttribute('aria-current');
        }
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
        clearButton.hidden = true;
        list.replaceChildren();
        list.hidden = true;
        status.textContent = '';
        panes.hidden = false;
        layout.classList.remove('iroar-searching');
    }
    function returnToSection() {
        clearSearch();
        updateHeading(activeTab());
        input.focus();
    }
    clearButton.addEventListener('click', returnToSection);
    input.addEventListener('keydown', event => {
        if (event.key === 'Escape' && input.value) {
            event.preventDefault();
            returnToSection();
        } else if (event.key === 'ArrowDown' && list.firstElementChild) {
            event.preventDefault();
            list.querySelector('a').focus();
        }
    });
    results.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            returnToSection();
        }
    });
    tabs.addEventListener('click', event => {
        if (event.target.closest('[data-bs-toggle="tab"]') && input.value) {
            clearSearch();
            updateHeading(activeTab());
        }
    });
    tabs.addEventListener('shown.bs.tab', event => {
        clearSearch();
        updateHeading(event.target);
        // The mobile tablist scrolls horizontally. Keep keyboard and menu selections in view.
        if (!desktop.matches) {
            const tab = event.target.getBoundingClientRect();
            const viewport = tabs.getBoundingClientRect();
            if (tab.left < viewport.left) tabs.scrollLeft += tab.left - viewport.left - 5;
            else if (tab.right > viewport.right) tabs.scrollLeft += tab.right - viewport.right + 5;
        }
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
            menuButtons.set(tab, button);
            if (tab === activeTab()) button.setAttribute('aria-current', 'true');
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
    const searchText = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    input.addEventListener('input', () => {
        if (!input.value.trim()) {
            clearSearch();
            updateHeading(activeTab());
            return;
        }
        layout.classList.add('iroar-searching');
        clearButton.hidden = false;
        heading.textContent = 'Search results';
        panes.hidden = true;
        list.replaceChildren();
        const terms = searchText(input.value).split(' ').filter(Boolean);
        const matches = new Map();
        for (const original of panes.querySelectorAll('.tab-item a[href]')) {
            const label = original.textContent.trim();
            const section = sectionNames.get(original.closest('.tab-pane')?.id) || '';
            const labelText = searchText(label);
            const searchable = labelText + ' ' + searchText(section);
            if (!terms.length || !terms.every(term => searchable.includes(term))) continue;
            // Keep the first matching section for each destination and put direct label matches first.
            if (!matches.has(original.href)) matches.set(original.href, {original, label, section, direct:terms.every(term => labelText.includes(term))});
        }
        const ranked = [...matches.values()].sort((a,b) => Number(b.direct) - Number(a.direct));
        for (const {original,label,section} of ranked) {
            const row = document.createElement('li');
            const link = original.cloneNode(false);
            link.removeAttribute('id');
            const copy = document.createElement('span');
            copy.textContent = label;
            if (section) {
                const context = document.createElement('small');
                context.textContent = section;
                copy.append(context);
            }
            link.append(copy);
            row.append(link);
            list.append(row);
        }
        list.hidden = !matches.size;
        status.textContent = matches.size ? matches.size+' matching '+(matches.size===1?'service':'services') : 'No matching services. Try a shorter search.';
    });
})();
