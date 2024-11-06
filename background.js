// Clemson: U2Nob29sLTI0Mg==
// found at: inspect->network->graphql->payload
// Auth token is just the basic everyone uses I guess
const AUTH_TOKEN = 'dGVzdDp0ZXN0';
const SCHOOL_ID = ['U2Nob29sLTI0Mg=='];

// List of grade distribution CSV files within the extension
const gradeDistributionFiles = [
    'grade_distributions_final/2013Fall.csv', 'grade_distributions_final/2014Fall.csv',
	'grade_distributions_final/2014Spring.csv', 'grade_distributions_final/2015Fall.csv',
	'grade_distributions_final/2015Spring.csv', 'grade_distributions_final/2016Fall.csv',
	'grade_distributions_final/2016Spring.csv', 'grade_distributions_final/2017Fall.csv',
	'grade_distributions_final/2018Spring.csv', 'grade_distributions_final/2018Fall.csv',
	'grade_distributions_final/2019Spring.csv', 'grade_distributions_final/2019Fall.csv',
	'grade_distributions_final/2020Spring.csv', 'grade_distributions_final/2020Fall.csv',
	'grade_distributions_final/2021Spring.csv', 'grade_distributions_final/2021Fall.csv',
	'grade_distributions_final/2022Spring.csv', 'grade_distributions_final/2022Fall.csv',
	'grade_distributions_final/2023Spring.csv', 'grade_distributions_final/2023Fall.csv',
	'grade_distributions_final/2024Spring.csv', 'grade_distributions_final/2017Spring.csv',
];

// Parse CSV data into a usable format
async function parseCSV(text) {
    return text.trim().split('\n').map(row => row.split(',').map(value => value.trim()));
}

// Load and search CSVs for grade distribution by professor
async function searchGradeDistributions(professorFirstName, professorLastName) {
    const results = [];

    for (const file of gradeDistributionFiles) {
        const fileURL = chrome.runtime.getURL(file);
        const response = await fetch(fileURL);
        const csvText = await response.text();
        const rows = await parseCSV(csvText);

        // Extract year and semester from filename
        const year = file.match(/\d{4}/)[0];
        const semester = file.includes('Fall') ? 'Fall' : 'Spring';

        // Search rows for professor name
        for (const row of rows) {
            const rowString = row.join(' ').toLowerCase();
            if (rowString.includes(professorFirstName.toLowerCase()) && rowString.includes(professorLastName.toLowerCase())) {
                results.push({ year, semester, data: row });
            }
        }
    }

    return results;
}

// Listen for content script requests to fetch grade distributions
// Listen for content script requests to fetch grade distributions
chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener(async (request) => {
        if (request.type === 'gradeDistribution') {
            const { firstName, lastName } = request.professor;

            // Check for valid firstName and lastName
            if (!firstName || !lastName) {
                console.warn("Invalid professor name received. First or last name is missing:", request.professor);
                port.postMessage({ type: 'gradeDistribution', data: [] }); // Send empty data
                return;
            }

            const results = await searchGradeDistributions(firstName, lastName);
            port.postMessage({ type: 'gradeDistribution', data: results });
        }
    });
});


const searchProfessor = async (name, schoolID) => {
	console.log('Searching for professor:', name);
	try {
		const response = await fetch(`https://www.ratemyprofessors.com/graphql`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${AUTH_TOKEN}`,
			},
			body: JSON.stringify({
				query: `query NewSearchTeachersQuery($text: String!, $schoolID: ID!) {
              newSearch {
                teachers(query: {text: $text, schoolID: $schoolID}) {
                  edges {
                    cursor
                    node {
                      id
                      firstName
                      lastName
                      school {
                        name
                        id
                      }
                    }
                  }
                }
              }
            }`,
				variables: {
					text: name,
					schoolID,
				},
			}),
		});
		const text = await response.text();
		let json;
		try {
			json = JSON.parse(text);
			// console.log('json response for ' + name + ' at ' + schoolID, json);
		} catch (error) {
			console.error('Error parsing JSON:', error);
			throw new Error('Error parsing JSON: ' + text);
		}
		if (json.data.newSearch.teachers === null) {
			// console.log('No results found for professor:', name);
			return [];
		}

		return json.data.newSearch.teachers.edges.map((edge) => edge.node);
	} catch (error) {
		console.error('Error searching for professor:', error);
		throw error;
	}
};

const getProfessor = async (id) => {
	// console.log('Fetching professor data for ID:', id);
	try {
		const response = await fetch(`https://www.ratemyprofessors.com/graphql`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${AUTH_TOKEN}`,
			},
			body: JSON.stringify({
				query: `query TeacherRatingsPageQuery($id: ID!) {
              node(id: $id) {
                ... on Teacher {
                  id
                  firstName
                  lastName
                  school {
                    name
                    id
                    city
                    state
                  }
                  avgDifficulty
                  avgRating
                  department
                  numRatings
                  legacyId
                  wouldTakeAgainPercent
                }
                id
              }
            }`,
				variables: {
					id,
				},
			}),
		});
		const json = await response.json();
		// console.log('Professor data by ID: ' + id, json.data.node);
		return json.data.node;
	} catch (error) {
		console.error('Error fetching professor data:', error);
		throw error;
	}
};

async function sendProfessorInfo(professorName) {
    // Check if professorName is a valid string before normalizing
    if (typeof professorName !== 'string') {
		// Small bug. Right now this is happening whenever
		// the grade distribution popup is being called
        return { error: 'Invalid professor name provided.' };
    }

    const normalizedName = professorName.normalize('NFKD');
    try {
        let professorID;
        for (let i = 0; i < SCHOOL_ID.length; i++) {
            const professors = await searchProfessor(normalizedName, SCHOOL_ID[i]);
            if (professors.length === 0) {
                continue;
            }
            professorID = professors[0].id;
            console.log('SUCCESS! ' + professorName + ' professorID: ' + professorID + ' found at schoolID: ' + SCHOOL_ID[i]);
            break;
        }
        if (professorID === undefined) {
            console.log('No ' + professorName + ' found for any schoolID:', SCHOOL_ID);
            return { error: professorName + ' not found on RMP for any given SCHOOL_ID' };
        }
        const professor = await getProfessor(professorID);
        console.log(professor);
        return professor;
    } catch (error) {
        console.error('Error sending professor info for ' + professorName, error);
        throw error;
    }
}

chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener((request) => {
		sendProfessorInfo(request.professorName)
			.then((professor) => {
				port.postMessage(professor);
			})
			.catch((error) => {
				console.error('Error:', error);
				port.postMessage({ error });
			});
	});
});