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
    const links = document.createElement('div');
    links.className = 'iroar-navigation-links';
    for (const [label, url] of destinations) {
        const link = document.createElement('a');
        link.textContent = label;
        link.href = url;
        if (url === location.origin + location.pathname + location.search) link.setAttribute('aria-current', 'page');
        links.append(link);
    }
    return links;
}

(() => {
    function install() {
        const trigger = document.querySelector('#bannerMenuDiv #bannerMenu');
        const container = document.querySelector('#bannerMenuDiv #menuContainer');
        const menu = container?.querySelector('#menu');
        const list = menu?.querySelector('#menuList');
        if (!trigger || !list || menu.querySelector('.iroar-navigation-links')) return;
        const links = createIroarNavigationLinks();
        list.after(links);
        trigger.setAttribute('aria-controls', container.id);
        const originalRole = trigger.getAttribute('role');
        const sync = () => {
            const expanded = container.classList.contains('show');
            trigger.setAttribute('aria-expanded', String(expanded));
            const hasItems = !!list.querySelector('a[href], button, [role="treeitem"], li:not(:empty)');
            if (!hasItems) trigger.setAttribute('role', 'button');
            else if (originalRole) trigger.setAttribute('role', originalRole);
            else trigger.removeAttribute('role');
            links.hidden = hasItems;
            menu.classList.toggle('iroar-empty-menu', !hasItems);
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(container, {attributes:true, attributeFilter:['class']});
        observer.observe(list, {childList:true, subtree:true, attributes:true, attributeFilter:['role','href']});

        // Banner owns opening, dismissal and Alt+M. Supply keyboard navigation for the fallback.
        trigger.parentElement.addEventListener('keydown', event => {
            if (links.hidden) return;
            const open = container.classList.contains('show');
            if (event.target === trigger && (event.key === ' ' || event.key === 'ArrowDown')) {
                event.preventDefault();
                event.stopPropagation();
                if (!open || event.key === ' ') trigger.click();
                if (event.key === 'ArrowDown') links.firstElementChild.focus();
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
