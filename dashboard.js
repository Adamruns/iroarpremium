// Keep Banner's original directory available, including contact links and role-specific destinations.
(() => {
    const primaryServices = [
        ['Schedule of Classes', 'Browse classes', 'Find course sections', '▦'],
        ['View Registration', 'My registration', 'View your schedule', '▤'],
        ['View Grades', 'View grades', 'Open academic records', '▥']
    ];

    function searchable(text) {
        return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }

    // Banner places billing instructions and contact links inline between lists and line breaks.
    function neighboringText(link, direction) {
        let text = '';
        for (let node = link[direction]; node?.nodeType === Node.TEXT_NODE; node = node[direction]) {
            text = direction === 'previousSibling' ? node.textContent + text : text + node.textContent;
        }
        return text.replace(/\s+/g, ' ');
    }

    function mount() {
        if (document.querySelector('.iroar-dashboard')) return true;
        const source = document.querySelector('#content .heading-txt, #mainContent .heading-txt, .page-content .heading-txt');
        if (!source) return false;
        const headings = [...source.querySelectorAll('h2,h3')];
        if (!headings.length || !source.querySelector('a[href]')) return false;

        const dashboard = document.createElement('section');
        dashboard.className = 'iroar-dashboard';
        dashboard.innerHTML = `
            <header class="iroar-hero"><div><p>Clemson University</p><h1>Student directory</h1></div>
                <label>Find a service<input type="search" placeholder="Transcript, grades, registration…" autocomplete="off"></label></header>
            <nav class="iroar-shortcuts" aria-label="Frequently used services"></nav>
            <div class="iroar-tools"><h2>All services</h2><label>Category <select><option value="">All categories</option></select></label></div>
            <div class="iroar-filter-feedback" hidden><p class="iroar-search-status" role="status"></p>
                <button type="button" class="iroar-clear-filters">Clear filters</button></div>
            <div class="iroar-card-grid"></div>`;
        const grid = dashboard.querySelector('.iroar-card-grid');
        const cards = [];
        const category = dashboard.querySelector('select');
        const shortcuts = dashboard.querySelector('.iroar-shortcuts');
        const shortcutLinks = new Map();

        for (const heading of headings) {
            const links = [];
            for (let node = heading.nextElementSibling; node && !headings.includes(node); node = node.nextElementSibling) {
                if (node.matches('a[href]')) links.push(node);
                else links.push(...node.querySelectorAll('a[href]'));
            }
            if (!links.length) continue;
            const card = document.createElement('section');
            card.className = 'iroar-service-card';
            const title = document.createElement('h3');
            const name = heading.textContent.trim();
            title.textContent = name;
            const list = document.createElement('ul');
            const rows = [];
            for (const original of links) {
                const link = original.cloneNode(false);
                link.removeAttribute('id');
                link.removeAttribute('style');
                const label = original.textContent.trim();
                link.textContent = label;
                const row = document.createElement('li');
                const before = neighboringText(original, 'previousSibling');
                const after = neighboringText(original, 'nextSibling');
                if (before.trim() || after.trim()) {
                    row.className = 'iroar-directory-note';
                    row.append(before, link, after);
                    if (/^(here|click here)$/i.test(label) && !link.hasAttribute('aria-label')) {
                        link.setAttribute('aria-label', row.textContent.trim());
                    }
                } else {
                    row.append(link);
                }
                list.append(row);

                const shortcut = primaryServices.find(([nativeLabel]) => nativeLabel === label);
                if (shortcut && !shortcutLinks.has(label)) shortcutLinks.set(label, link);
                rows.push({row, text: searchable([name, row.textContent, ...(shortcut?.slice(1, 3) || [])].join(' '))});
            }
            card.append(title, list);
            category.add(new Option(name, name));
            grid.append(card);
            cards.push({card, name, rows});
        }
        if (!cards.length) return false;
        for (const [match, label, hint, glyph] of primaryServices) {
            const original = shortcutLinks.get(match);
            if (!original) continue;
            const link = original.cloneNode(false);
            const icon = document.createElement('span');
            icon.setAttribute('aria-hidden','true');
            icon.textContent = glyph;
            const copy = document.createElement('strong');
            copy.textContent = label;
            const small = document.createElement('small');
            small.textContent = hint;
            copy.append(small);
            link.append(icon,copy);
            shortcuts.append(link);
        }
        source.before(dashboard);
        source.hidden = true;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'iroar-directory-toggle';
        toggle.textContent = 'Show original directory';
        dashboard.before(toggle);
        toggle.addEventListener('click', () => {
            source.hidden = !source.hidden;
            dashboard.hidden = !source.hidden;
            toggle.textContent = source.hidden ? 'Show original directory' : 'Show enhanced directory';
        });
        const search = dashboard.querySelector('input');
        const feedback = dashboard.querySelector('.iroar-filter-feedback');
        const status = feedback.querySelector('[role=status]');
        function filterServices() {
            const query = searchable(search.value);
            const terms = query ? query.split(' ') : [];
            let matches = 0;
            for (const {card, name, rows} of cards) {
                let count = 0;
                const inCategory = !category.value || category.value === name;
                for (const {row, text} of rows) {
                    row.hidden = !inCategory || !terms.every(term => text.includes(term));
                    if (!row.hidden) count++;
                }
                card.hidden = count === 0;
                matches += count;
            }
            const filtered = Boolean(search.value.trim() || category.value);
            shortcuts.hidden = filtered;
            feedback.hidden = !filtered;
            status.textContent = filtered ? (matches ? matches + (matches === 1 ? ' service found' : ' services found')
                : 'No services found. Try another keyword or category.') : '';
        }
        search.addEventListener('input', filterServices);
        category.addEventListener('change', filterServices);
        feedback.querySelector('button').addEventListener('click', () => {
            search.value = '';
            category.value = '';
            filterServices();
            search.focus();
        });
        return true;
    }
    if (!mount()) {
        const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
    }
})();
