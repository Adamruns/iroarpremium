// Scope the visual layer to Banner application pages. SSO and unrelated SIS apps keep their own UI.
(() => {
    const apply = () => {
        if (!document.querySelector('#content, #mainContent, #title-panel, #landing-paths, .page-content, #banner-header-main-section')) return;
        document.documentElement.classList.add('iroar-banner');
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1';
            document.head.append(meta);
        }
    };
    apply();
    if (document.readyState !== 'complete') window.addEventListener('load', apply, { once: true });
})();
