// Enrich Banner's own Plan Ahead and registration tables in place.
(() => {
    const waiting = new WeakSet();
    function ask(name, message) {
        return new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({name});
            port.onMessage.addListener(data => { resolve(data); port.disconnect(); });
            port.onDisconnect.addListener(() => reject(new Error(chrome.runtime.lastError?.message || 'Data unavailable')));
            port.postMessage(message);
        });
    }
    async function showGrades(button, professor, displayName) {
        const dialog = document.createElement('dialog');
        dialog.className = 'iroar-grade-dialog';
        const title = document.createElement('h2');
        title.textContent = professor + ' · Grade history';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        const body = document.createElement('div');
        body.textContent = 'Loading grade history…';
        dialog.append(title,close,body);
        document.body.append(dialog);
        close.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { dialog.remove(); button.focus(); }, {once:true});
        dialog.showModal();
        const parts = professor.split(/\s+/);
        try {
            const result = await ask('grade-distribution',{type:'gradeDistribution',professor:{displayName,firstName:parts[0],lastName:parts.at(-1)}});
            if (result.error) throw new Error(result.error);
            body.textContent = result.data.length ? '' : 'No grade history available.';
            for (const {semester,year,data} of result.data) {
                const item = document.createElement('p');
                const headline = document.createElement('strong');
                headline.textContent = [semester, year, '·', data[0], data[1], data[2]].join(' ');
                item.append(headline, document.createElement('br'), ['A','B','C','D','F','P','F(P)','W','I'].map((g,i)=>g+' '+(data[i+4]||'unreported')).join(' · '));
                body.append(item);
            }
        } catch { body.textContent = 'Grade history could not be loaded.'; }
    }
    function enhance() {
        for (const link of document.querySelectorAll('td[data-property="instructor"] a[href^="mailto:"]')) {
            if (waiting.has(link)) continue;
            waiting.add(link);
            const [last,first] = link.textContent.trim().split(',').map(p=>p.trim());
            const professor = first ? first+' '+last : last;
            if (!professor) continue;
            const box = document.createElement('div');
            box.className = 'iroar-prof';
            const grades = document.createElement('button');
            grades.type = 'button'; grades.textContent = 'Grade history';
            grades.addEventListener('click', () => showGrades(grades, professor, link.textContent.trim()));
            const rating = document.createElement('a');
            rating.target = '_blank'; rating.rel = 'noopener noreferrer';
            rating.href = 'https://www.ratemyprofessors.com/search/teachers?query='+encodeURIComponent(professor);
            rating.textContent = 'Find ratings';
            box.append(rating, grades);
            link.after(box);
            ask('professor-rating',{professorName:professor}).then(data => {
                if (data.error || !data.numRatings) return;
                rating.textContent = data.avgRating+'/5 · '+data.numRatings+' ratings';
                rating.href = 'https://www.ratemyprofessors.com/professor/'+encodeURIComponent(data.legacyId);
                const stats = document.createElement('small');
                stats.textContent = 'Difficulty '+data.avgDifficulty+'/5'+(data.wouldTakeAgainPercent >= 0 ? ' · '+Math.round(data.wouldTakeAgainPercent)+'% would take again' : '');
                box.append(stats);
            }).catch(() => {});
        }
    }
    let frame;
    const observer = new MutationObserver(() => {
        if (!frame) frame = requestAnimationFrame(() => { frame = null; enhance(); });
    });
    enhance();
    observer.observe(document.body, {childList:true,subtree:true});
})();
