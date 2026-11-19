// Search the links that the portal actually supplied for this student's role.
(() => {
    const tabs = document.querySelector('#page_body .nav-tabs');
    const panes = document.querySelector('#page_body .tab-content');
    if (!tabs || !panes || !panes.querySelector('.tab-item a[href]')) return;
    const search = document.createElement('section');
    search.className = 'iroar-portal-search';
    search.innerHTML = '<label for="iroar-service-query">Find a campus service</label><input id="iroar-service-query" type="search" placeholder="Search across all tabs" autocomplete="off"><p role="status"></p><ul hidden></ul>';
    tabs.before(search);
    const input = search.querySelector('input'), list = search.querySelector('ul'), status = search.querySelector('p');
    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        list.replaceChildren();
        list.hidden = !query;
        tabs.hidden = Boolean(query);
        panes.hidden = Boolean(query);
        status.textContent = '';
        if (!query) return;
        const seen = new Set();
        for (const original of panes.querySelectorAll('.tab-item a[href]')) {
            const label = original.textContent.trim();
            if (!label.toLowerCase().includes(query) || seen.has(original.href)) continue;
            seen.add(original.href);
            const row = document.createElement('li');
            const a = original.cloneNode(false);
            a.removeAttribute('id');
            a.textContent = label;
            row.append(a);
            list.append(row);
        }
        status.textContent = seen.size ? seen.size+' matching '+(seen.size===1?'service':'services') : 'No matching services. Try a shorter search.';
    });
})();
