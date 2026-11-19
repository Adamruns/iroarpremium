// These are Clemson entry pages. Banner handles term selection and account eligibility.
function createIroarNavigationLinks() {
    const registration = 'https://regssb.sis.clemson.edu/StudentRegistrationSsb/ssb/';
    const destinations = [
        ['iROAR portal', 'https://iroar.app.clemson.edu/dashboard/index.php'],
        ['Student directory', 'https://sadv.sis.clemson.edu/StudentSelfService/ssb/studentCommonDashboard'],
        ['Registration home', registration + 'registration'],
        ['Browse classes', registration + 'term/termSelection?mode=search'],
        ['Plan ahead', registration + 'term/termSelection?mode=plan'],
        ['View my registration', registration + 'registrationHistory/registrationHistory']
    ];
    // Banner serves and redirects to registration home at registration/ and registration/registration.
    const pagePath = pathname => pathname.replace(/\/+$/, '').replace(/\/ssb\/registration\/registration$/, '/ssb/registration');
    const currentParameters = new URLSearchParams(location.search);
    const links = document.createElement('div');
    links.className = 'iroar-navigation-links';
    for (const [label, url] of destinations) {
        const link = document.createElement('a');
        link.textContent = label;
        link.href = url;
        const destination = new URL(url);
        const isCurrentPage = destination.origin === location.origin
            && pagePath(destination.pathname) === pagePath(location.pathname)
            && [...destination.searchParams].every(([key, value]) => currentParameters.get(key) === value);
        if (isCurrentPage) link.setAttribute('aria-current', 'page');
        links.append(link);
    }
    return links;
}

(() => {
    const installed = new WeakSet();
    // A replaced menu reinstalls on a trigger that may already carry the fallback role.
    const bannerRoles = new WeakMap();
    function install() {
        const trigger = document.querySelector('#bannerMenuDiv #bannerMenu');
        const container = document.querySelector('#bannerMenuDiv #menuContainer');
        const menu = container?.querySelector('#menu');
        const list = menu?.querySelector('#menuList');
        if (!trigger || !list || installed.has(menu)) return;
        installed.add(menu);
        const links = createIroarNavigationLinks();
        trigger.setAttribute('aria-controls', container.id);
        if (!bannerRoles.has(trigger)) bannerRoles.set(trigger, trigger.getAttribute('role'));
        const originalRole = bannerRoles.get(trigger);
        const sync = () => {
            const currentList = menu.querySelector('#menuList');
            // A detached menu must not overwrite the state its replacement reports.
            if (!menu.isConnected || !currentList) return;
            if (links.previousElementSibling !== currentList) currentList.after(links);
            const expanded = container.classList.contains('show');
            trigger.setAttribute('aria-expanded', String(expanded));
            const hasItems = !!currentList.querySelector('a[href], button, [role="treeitem"], li:not(:empty)');
            if (!hasItems) trigger.setAttribute('role', 'button');
            else if (originalRole) trigger.setAttribute('role', originalRole);
            else trigger.removeAttribute('role');
            links.hidden = hasItems;
            menu.classList.toggle('iroar-empty-menu', !hasItems);
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(container, {attributes:true, attributeFilter:['class']});
        observer.observe(menu, {childList:true, subtree:true, attributes:true, attributeFilter:['role','href']});

        // Banner owns opening, dismissal and Alt+M. Supply keyboard navigation for the fallback,
        // and leave modified keys such as Cmd+Arrow and Ctrl+Home to the browser.
        trigger.parentElement.addEventListener('keydown', event => {
            if (!menu.isConnected || links.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
            const open = container.classList.contains('show');
            if (event.target === trigger && ([' ', 'ArrowDown', 'ArrowUp'].includes(event.key))) {
                event.preventDefault();
                event.stopPropagation();
                if (!open || event.key === ' ') trigger.click();
                if (event.key === 'ArrowDown') links.firstElementChild.focus();
                if (event.key === 'ArrowUp') links.lastElementChild.focus();
            } else if (open && event.target.parentElement === links && ['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
                event.preventDefault();
                event.stopPropagation();
                const items = [...links.children];
                let index = items.indexOf(event.target);
                if (event.key === 'Home') index = 0;
                if (event.key === 'End') index = items.length - 1;
                if (event.key === 'ArrowDown') index = (index + 1) % items.length;
                if (event.key === 'ArrowUp') index = (index + items.length - 1) % items.length;
                items[index].focus();
            } else if (open && event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                trigger.click();
                trigger.focus();
            }
        }, true);
    }
    install();
    // Some Banner applications assemble or replace their header after initial rendering.
    document.addEventListener('click', event => {
        if (event.target.closest?.('#bannerMenu')) install();
    }, true);
    document.addEventListener('focusin', event => { if (event.target.id === 'bannerMenu') install(); });
    document.addEventListener('keydown', event => { if (event.altKey && event.code === 'KeyM') install(); }, true);
})();
