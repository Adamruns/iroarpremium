console.log('Content script running');

// Inject CSS
const style = document.createElement('link');
style.rel = 'stylesheet';
style.type = 'text/css';
style.href = chrome.runtime.getURL('styles.css');
document.head.appendChild(style);

function removePrimary(cell) {
    cell.innerHTML = cell.innerHTML.replace(/\s*\(Primary\)\s*<br>/, '');
}

function appendRMP() {
    const professorCells = document.querySelectorAll('td[data-property="instructor"]');
    if (professorCells.length > 0) {
        professorCells.forEach((cell) => {
            const link = cell.querySelector('a[href^="mailto:"]');
            if (!link || link.dataset.processed === "true") {
                return;
            }
            link.dataset.processed = "true";

            let professorName = link.textContent.trim();
            if (professorName.includes(',')) {
                professorName = professorName.split(',').join(' ').trim();
            }

            // Debugging: Log professor name and cell
            console.log(`Processing professor: ${professorName}`, cell);

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
                        insertGradeDistributionLink(link, professorName);  // Add clickable text here
                    }
                    removePrimary(cell);
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
            setTimeout(appendRMP, 100); // Small delay to ensure elements are loaded
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

// Function to add "Grade Distribution" clickable text under RMP data
function insertGradeDistributionLink(link, professorName) {
    if (link.nextElementSibling && link.nextElementSibling.classList.contains('grade-distribution-link')) {
        return;
    }

    const gradeLink = document.createElement('div');
    gradeLink.classList.add('grade-distribution-link');
    gradeLink.textContent = 'Grade Distribution';
    gradeLink.style.cursor = 'pointer';

    // Add a custom data attribute to hold the professor's name
    gradeLink.setAttribute('data-professor', professorName);

    console.log('Grade Distribution link added for:', professorName);

    link.insertAdjacentElement('afterend', gradeLink);
}


// Function to fetch grade distribution data from background.js
function fetchGradeDistribution(professorName) {
    const [firstName, lastName] = professorName.split(' '); // Assuming name format "First Last"
    const port = chrome.runtime.connect({ name: 'grade-distribution' });

    return new Promise((resolve) => {
        port.postMessage({ type: 'gradeDistribution', professor: { firstName, lastName } });

        port.onMessage.addListener((response) => {
            if (response.type === 'gradeDistribution') {
                resolve(response.data);
            }
        });
    });
}

// Update popup content with grade distribution data
// Update popup content with grade distribution data
async function openGradePopup(professorName) {
    console.log('openGradePopup function called for', professorName);

    const gradeData = await fetchGradeDistribution(professorName);

    let popup = document.querySelector('.grade-distribution-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'grade-distribution-popup';
        popup.innerHTML = `
            <div class="grade-popup-header">
                <span class="grade-popup-title">Grade Distribution for ${professorName}</span>
                <button class="grade-popup-close">&times;</button>
            </div>
            <div class="grade-popup-content"></div>
        `;
        document.body.appendChild(popup);

        popup.querySelector('.grade-popup-close').addEventListener('click', () => {
            popup.style.display = 'none';
        });
    } else {
        popup.querySelector('.grade-popup-title').textContent = `Grade Distribution for ${professorName}`;
    }

    const content = popup.querySelector('.grade-popup-content');

    // Labels for each grade column
    const gradeLabels = ['A', 'B', 'C', 'D', 'F', 'P', 'F(P)', 'W', 'I'];

    // Reverse the data to display newest first
    const reversedData = gradeData.reverse();

    // Format grade distribution with labels
    content.innerHTML = reversedData.length > 0 ? reversedData.map((entry) => {
        const row = entry.data;
        // Map the grade percentages with their labels
        const gradeDistribution = row.slice(4, 13).map((value, index) => {
            const rawValue = value.replace('%', '').trim(); // Ensure value is clean of any existing '%'
            return `${rawValue}% (${gradeLabels[index]})`;
        }).join(', ');

        return `
            <p><b>Year:</b> ${entry.year}, <b>Semester:</b> ${entry.semester}</p>
            <p><b>Course:</b> ${row[0]} ${row[1]} ${row[2]}, ${row[3]}</p>
            <p><b>Distribution:</b> ${gradeDistribution}</p>
            <hr>
        `;
    }).join('') : '<p>No grade distribution data found for this professor.</p>';

    popup.style.display = 'block';
    popup.style.zIndex = '10000'; // Ensure it's on top
}

// Event delegation to handle clicks on Grade Distribution links
document.body.addEventListener('click', (event) => {
    if (event.target.classList.contains('grade-distribution-link')) {
        const professorName = event.target.getAttribute('data-professor');
        openGradePopup(professorName);
    }
});
