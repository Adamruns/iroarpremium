// Scope the visual layer to Banner application pages. SSO and unrelated SIS apps keep their own UI.
(() => {
    const icons = {
        classSearchLink:'M3 3h8v8H3z M14 3h7v8h-7z M3 14h8v7H3z M14 14h7v7h-7z',
        planningLink:'M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16 M8 15h4',
        registerLink:'M3 6h12 M3 11h9 M3 16h7 M15 16l2 2 5-6',
        regHistoryLink:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',
        catalogSearchLink:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15',
        preRegLink:'M5 4h14v16H5z M8 12l3 3 6-7'
    };
    function decorateMenu(menu) {
        for (const link of menu.querySelectorAll('.landing-path a')) {
            // Banner's click handler chooses the entry point for the current session. A real
            // URL also lets students copy a link or open it in a separate tab.
            if (link.getAttribute('href') === '#' && link.dataset.login?.startsWith('/')) {
                const entry = new URL(link.dataset.login, location.origin);
                if (entry.origin === location.origin) {
                    link.href = entry.href;
                    link.dataset.iroarEntry = '';
                }
            }
            if (!icons[link.id] || link.querySelector('.iroar-task-icon')) continue;
            const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
            svg.setAttribute('class','iroar-task-icon');
            svg.setAttribute('aria-hidden','true');
            svg.setAttribute('viewBox','0 0 24 24');
            const path = document.createElementNS(svg.namespaceURI,'path');
            path.setAttribute('d',icons[link.id]);
            svg.append(path);
            link.prepend(svg);
        }
    }
    const apply = () => {
        if (!document.querySelector('#content, #mainContent, #title-panel, #landing-paths, .page-content, #header-main-section, #banner-header-main-section')) return;
        document.documentElement.classList.add('iroar-banner');
        const menu = document.getElementById('landingPathMenu');
        if (menu && !menu.dataset.iroarEnhanced) {
            menu.dataset.iroarEnhanced = 'true';
            decorateMenu(menu);
            menu.addEventListener('click', event => {
                if ((event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                    && event.target.closest?.('a[data-iroar-entry]')) event.stopPropagation();
            });
            const observer = new MutationObserver(() => decorateMenu(menu));
            observer.observe(menu,{childList:true,subtree:true});
        }
    };
    apply();
    if (document.readyState !== 'complete') window.addEventListener('load', apply, { once: true });
})();
