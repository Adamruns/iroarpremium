// Keep Banner's original directory available, including contact links and role-specific destinations.
(() => {
    function mount() {
        const source = document.querySelector('#content .heading-txt, #mainContent .heading-txt, .page-content .heading-txt');
        if (!source || document.querySelector('.iroar-dashboard')) return false;
        const headings = [...source.querySelectorAll('h2,h3')];
        if (!headings.length || !source.querySelector('a[href]')) return false;

        const dashboard = document.createElement('section');
        dashboard.className = 'iroar-dashboard';
        dashboard.innerHTML = `
            <header class="iroar-hero"><div><p>Clemson University</p><h1>Student directory</h1></div>
                <label>Find a service<input type="search" placeholder="Grades, transcripts, registration…" autocomplete="off"></label></header>
            <nav class="iroar-shortcuts" aria-label="Frequently used services"></nav>
            <div class="iroar-tools"><h2>All services</h2><label>Category <select><option value="">All categories</option></select></label></div>
            <p class="iroar-search-status" role="status"></p>
            <div class="iroar-card-grid"></div>`;
        const grid = dashboard.querySelector('.iroar-card-grid');
        const cards = [];
        const category = dashboard.querySelector('select');
        for (const heading of headings) {
            const links = [];
            for (let node = heading.nextElementSibling; node && !headings.includes(node); node = node.nextElementSibling) {
                if (node.matches('a[href]')) links.push(node);
                else links.push(...node.querySelectorAll('a[href]'));
            }
            if (!links.length) continue;
            const card = document.createElement('section');
            card.className = 'iroar-service-card';
            const title = document.createElement('h2');
            title.textContent = heading.textContent.trim();
            const list = document.createElement('ul');
            for (const original of links) {
                const link = original.cloneNode(true);
                link.removeAttribute('id');
                link.removeAttribute('style');
                link.textContent = original.textContent.trim();
                const row = document.createElement('li');
                row.append(link);
                list.append(row);
            }
            card.append(title, list);
            category.add(new Option(title.textContent, title.textContent));
            grid.append(card);
            cards.push(card);
        }
        if (!cards.length) return false;
        const shortcuts = dashboard.querySelector('.iroar-shortcuts');
        const primary = [
            ['Schedule of Classes','Browse classes','Find course sections', '▦'],
            ['View Registration','My registration','View your schedule', '▤'],
            ['View Grades','View grades','Open academic records', '▥']
        ];
        for (const [match, label, hint, glyph] of primary) {
            const original = [...grid.querySelectorAll('a')].find(a=>a.textContent.trim() === match);
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
        function filterServices() {
            const query = search.value.trim().toLowerCase();
            let matches = 0;
            for (const card of cards) {
                const sectionMatch = card.querySelector('h2').textContent.toLowerCase().includes(query);
                let count = 0;
                for (const row of card.querySelectorAll('li')) {
                    row.hidden = (category.value && category.value !== card.querySelector('h2').textContent) || !(sectionMatch || row.textContent.toLowerCase().includes(query));
                    if (!row.hidden) count++;
                }
                card.hidden = count === 0;
                matches += count;
            }
            dashboard.querySelector('[role=status]').textContent = query
                ? (matches ? matches + (matches === 1 ? ' service found' : ' services found') : 'No services found. Try a course, record, or account keyword.') : '';
            shortcuts.hidden = Boolean(query || category.value);
        }
        search.addEventListener('input', filterServices);
        category.addEventListener('change', filterServices);
        return true;
    }
    if (!mount()) {
        const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
    }
})();
