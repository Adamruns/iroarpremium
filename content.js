console.log('Content script running');

const style = document.createElement('link');
style.rel = 'stylesheet';
style.type = 'text/css';
style.href = chrome.runtime.getURL('style.css');
document.head.appendChild(style);

function appendRMP() {
    const professorLinks = document.querySelectorAll('.col-sm-3 a[href^="mailto:"], .instructor-row a.text-xsmall, td.instructor-name');
    if (professorLinks.length > 0) {
        professorLinks.forEach(async (link) => {
            if (link.dataset.processed === "true") {
                return;
            }
            link.dataset.processed = "true";
            
            let professorName = link.textContent.trim();
            if (professorName.includes(',')) {
                professorName = professorName.split(',').join(' ').trim();
            }
            try {
                const port = chrome.runtime.connect({ name: 'professor-rating' });
                port.postMessage({ professorName });
                port.onMessage.addListener((teacher) => {
                    if (teacher.error) {
                        console.error('Error:', teacher.error);
                        insertNoProfError(link, professorName);
                    } else {
                        const { avgRating, numRatings, avgDifficulty, wouldTakeAgainPercent, legacyId } = teacher;
                        if (wouldTakeAgainPercent === -1) {
                            console.error('Error: No ratings found for professor.');
                            insertNoRatingsError(link, legacyId);
                            return;
                        }
                        insertNumRatings(link, numRatings, legacyId);
                        insertWouldTakeAgainPercent(link, wouldTakeAgainPercent);
                        insertAvgDifficulty(link, avgDifficulty);
                        insertRating(link, avgRating);
                    }
                });
            } catch (error) {
                console.error('Error:', error);
                insertNoProfError(link, professorName);
            }
        });
    } else {
        console.log('No professor links found.');
    }
}

appendRMP();

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            appendRMP();
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('hashchange', appendRMP, false);

function insertRating(link, avgRating) {
    link.insertAdjacentHTML('afterend', `<div class="rating"><b>Rating:</b> ${avgRating}/5</div>`);
}

function insertAvgDifficulty(link, avgDifficulty) {
    link.insertAdjacentHTML('afterend', `<div class="rating"><b>Difficulty:</b> ${avgDifficulty}/5</div>`);
}

function insertWouldTakeAgainPercent(link, wouldTakeAgainPercent) {
    link.insertAdjacentHTML('afterend', `<div class="rating"><b>${Math.round(wouldTakeAgainPercent)}%</b> of students would take this professor again.</div>`);
}

function insertNumRatings(link, numRatings, legacyId) {
    const profLink = `<a target="_blank" rel="noopener noreferrer" href='https://www.ratemyprofessors.com/professor?tid=${legacyId}'>${numRatings} ratings</a>`;
    link.insertAdjacentHTML('afterend', `<div class="rating">${profLink}</div>`);
}

function insertNoRatingsError(link, legacyId) {
    link.insertAdjacentHTML(
        'afterend',
        `<div class="rating"><b>Error:</b> this professor has <a target="_blank" rel="noopener noreferrer" href='https://www.ratemyprofessors.com/search/teachers?query=${legacyId}'>no ratings on RateMyProfessors.</a></div>`
    );
}

function insertNoProfError(link, professorName) {
    link.insertAdjacentHTML(
        'afterend',
        `<div class="rating"><b>Professor not found: </b><a target="_blank" rel="noopener noreferrer" href='https://www.ratemyprofessors.com/search/teachers?query=${encodeURIComponent(
            professorName
        )}'>Click to Search RMP</a></div>`
    );
}