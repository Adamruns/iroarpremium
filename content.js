// Enrich Banner's own Plan Ahead and registration tables in place.
(() => {
    const enhanced = new WeakMap();
    const gradeLabels = ['A', 'B', 'C', 'D', 'F', 'P', 'F(P)', 'W', 'I'];

    function ask(name, message) {
        return new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({name});
            port.onMessage.addListener(data => { resolve(data); port.disconnect(); });
            port.onDisconnect.addListener(() => reject(new Error(chrome.runtime.lastError?.message || 'Data unavailable')));
            port.postMessage(message);
        });
    }

    function renderGradeHistory(body, reports) {
        if (!reports.length) {
            body.textContent = 'No grade history available.';
            return;
        }
        const terms = [...new Set(reports.map(report => report.semester + ' ' + report.year))];
        const label = document.createElement('label');
        label.textContent = 'Semester';
        const select = document.createElement('select');
        select.add(new Option('All semesters', ''));
        for (const term of terms) select.add(new Option(term, term));
        label.append(select);
        label.hidden = terms.length === 1;
        const count = document.createElement('p');
        count.className = 'iroar-grade-count';
        count.setAttribute('role', 'status');
        const list = document.createElement('ul');
        list.className = 'iroar-grade-sections';
        list.tabIndex = 0;
        list.setAttribute('aria-label', 'Reported sections');
        function render() {
            const sections = document.createDocumentFragment();
            for (const {semester, year, data} of reports) {
                const term = semester + ' ' + year;
                if (select.value && select.value !== term) continue;
                const item = document.createElement('li');
                const headline = document.createElement('strong');
                headline.textContent = [term, '·', data[0], data[1], data[2]].join(' ');
                const grades = document.createElement('dl');
                for (const [index, letter] of gradeLabels.entries()) {
                    const group = document.createElement('div');
                    const heading = document.createElement('dt');
                    heading.textContent = letter;
                    const value = document.createElement('dd');
                    value.textContent = data[index + 4] === '' || data[index + 4] == null ? 'unreported' : data[index + 4];
                    group.append(heading, value);
                    grades.append(group);
                }
                item.append(headline, grades);
                sections.append(item);
            }
            const total = sections.childElementCount;
            count.textContent = total + (total === 1 ? ' reported section' : ' reported sections');
            list.replaceChildren(sections);
            list.scrollTop = 0;
        }
        select.addEventListener('change', render);
        body.replaceChildren(label, count, list);
        render();
    }

    async function showGrades(button, professor, displayName) {
        const dialog = document.createElement('dialog');
        dialog.className = 'iroar-grade-dialog';
        dialog.setAttribute('aria-label', 'Grade history for ' + professor);
        const header = document.createElement('header');
        const title = document.createElement('h2');
        title.textContent = professor + ' · Grade history';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        header.append(title,close);
        const body = document.createElement('div');
        body.className = 'iroar-grade-content';
        body.textContent = 'Loading grade history…';
        dialog.append(header,body);
        document.body.append(dialog);
        close.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { dialog.remove(); if (button.isConnected) button.focus(); }, {once:true});
        dialog.showModal();
        const parts = professor.split(/\s+/);
        try {
            const result = await ask('grade-distribution',{type:'gradeDistribution',professor:{displayName,firstName:parts[0],lastName:parts.at(-1)}});
            if (!dialog.open) return;
            if (result.error) throw new Error(result.error);
            renderGradeHistory(body, result.data);
        } catch { body.textContent = 'Grade history could not be loaded.'; }
    }

    function enhance() {
        for (const link of document.querySelectorAll('td[data-property="instructor"] a[href^="mailto:"]')) {
            const displayName = link.textContent.trim();
            const previous = enhanced.get(link);
            if (previous && previous.name === displayName && previous.box === link.nextElementSibling) continue;
            previous?.box.remove();
            enhanced.delete(link);
            // Banner can replace just the mailto anchor while keeping the rest of the cell.
            if (link.nextElementSibling?.classList.contains('iroar-prof')) link.nextElementSibling.remove();
            if (!displayName) continue;
            const [last,first] = displayName.split(',').map(p=>p.trim());
            const professor = first ? first+' '+last : last;
            const box = document.createElement('div');
            box.className = 'iroar-prof';
            const grades = document.createElement('button');
            grades.type = 'button'; grades.textContent = 'Grade history';
            grades.setAttribute('aria-haspopup', 'dialog');
            grades.addEventListener('click', () => showGrades(grades, professor, displayName));
            const rating = document.createElement('a');
            rating.target = '_blank'; rating.rel = 'noopener noreferrer';
            rating.href = 'https://www.ratemyprofessors.com/search/professors/242?q='+encodeURIComponent(professor);
            rating.textContent = 'Find on Rate My Professors';
            box.append(rating, grades);
            enhanced.set(link, {name:displayName,box});
            link.after(box);
            ask('professor-rating',{professorName:professor}).then(data => {
                if (!box.isConnected || data.error || !data.numRatings || !data.legacyId) return;
                rating.textContent = 'Rate My Professors · '+data.avgRating+'/5';
                rating.href = 'https://www.ratemyprofessors.com/professor/'+encodeURIComponent(data.legacyId);
                const stats = document.createElement('small');
                stats.textContent = data.numRatings+(data.numRatings===1 ? ' rating' : ' ratings')+' · Difficulty '+data.avgDifficulty+'/5'+(data.wouldTakeAgainPercent >= 0 ? ' · '+Math.round(data.wouldTakeAgainPercent)+'% would take again' : '');
                box.append(stats);
            }).catch(() => {});
        }
    }
    let frame;
    const observer = new MutationObserver(() => {
        if (!frame) frame = requestAnimationFrame(() => { frame = null; enhance(); });
    });
    enhance();
    observer.observe(document.body, {childList:true, characterData:true, subtree:true});
})();
