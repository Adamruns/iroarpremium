// Clemson: U2Nob29sLTI0Mg==
// found at: inspect->network->graphql->payload
// Auth token is just the basic everyone uses I guess
const AUTH_TOKEN = 'dGVzdDp0ZXN0';
const SCHOOL_ID = ['U2Nob29sLTI0Mg=='];

// Cache configuration
const RMP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// In-memory cache for parsed CSV data (persists for service worker lifetime)
let csvCache = null;

// In-memory cache for RMP data (also backed by chrome.storage.local)
const rmpMemoryCache = new Map();

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

// Parse CSV data into a usable format (handles quoted fields with commas)
function parseCSV(text) {
    const rows = [];
    const lines = text.trim().split('\n');

    for (const line of lines) {
        const row = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (inQuotes) {
                if (char === '"') {
                    // Check for escaped quote ("")
                    if (line[i + 1] === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    row.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        row.push(current.trim()); // Push last field
        rows.push(row);
    }

    return rows;
}

// Load all CSV data into cache (called once per service worker lifetime)
async function loadAllCSVData() {
    if (csvCache !== null) {
        return csvCache;
    }

    console.log('Loading CSV data into cache...');
    csvCache = [];

    for (const file of gradeDistributionFiles) {
        const fileURL = chrome.runtime.getURL(file);
        const response = await fetch(fileURL);
        const csvText = await response.text();
        const rows = parseCSV(csvText);

        // Extract year and semester from filename
        const year = file.match(/\d{4}/)[0];
        const semester = file.includes('Fall') ? 'Fall' : 'Spring';

        // Store each row with its metadata
        for (const row of rows) {
            csvCache.push({ year, semester, data: row, searchText: row.join(' ').toLowerCase() });
        }
    }

    console.log(`CSV cache loaded: ${csvCache.length} rows`);
    return csvCache;
}

// Load and search CSVs for grade distribution by professor (uses cache)
async function searchGradeDistributions(professorFirstName, professorLastName) {
    const allData = await loadAllCSVData();
    const firstNameLower = professorFirstName.toLowerCase();
    const lastNameLower = professorLastName.toLowerCase();

    return allData.filter(entry =>
        entry.searchText.includes(firstNameLower) && entry.searchText.includes(lastNameLower)
    ).map(({ year, semester, data }) => ({ year, semester, data }));
}

// RMP Cache helpers
async function getRMPFromCache(professorName) {
    const cacheKey = `rmp_${professorName.toLowerCase()}`;

    // Check memory cache first
    if (rmpMemoryCache.has(cacheKey)) {
        const cached = rmpMemoryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < RMP_CACHE_TTL) {
            console.log(`RMP cache hit (memory): ${professorName}`);
            return cached.data;
        }
        rmpMemoryCache.delete(cacheKey);
    }

    // Check chrome.storage.local
    try {
        const result = await chrome.storage.local.get(cacheKey);
        if (result[cacheKey]) {
            const cached = result[cacheKey];
            if (Date.now() - cached.timestamp < RMP_CACHE_TTL) {
                console.log(`RMP cache hit (storage): ${professorName}`);
                // Populate memory cache
                rmpMemoryCache.set(cacheKey, cached);
                return cached.data;
            }
            // Expired, remove from storage
            await chrome.storage.local.remove(cacheKey);
        }
    } catch (error) {
        console.warn('Error reading from cache:', error);
    }

    return null;
}

async function setRMPCache(professorName, data) {
    const cacheKey = `rmp_${professorName.toLowerCase()}`;
    const cacheEntry = { data, timestamp: Date.now() };

    // Set in memory cache
    rmpMemoryCache.set(cacheKey, cacheEntry);

    // Set in chrome.storage.local
    try {
        await chrome.storage.local.set({ [cacheKey]: cacheEntry });
        console.log(`RMP cached: ${professorName}`);
    } catch (error) {
        console.warn('Error writing to cache:', error);
    }
}



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
        return { error: 'Invalid professor name provided.' };
    }

    const normalizedName = professorName.normalize('NFKD');

    // Check cache first
    const cached = await getRMPFromCache(normalizedName);
    if (cached) {
        return cached;
    }

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
            const errorResult = { error: professorName + ' not found on RMP for any given SCHOOL_ID' };
            // Cache "not found" results too to avoid repeated lookups
            await setRMPCache(normalizedName, errorResult);
            return errorResult;
        }
        const professor = await getProfessor(professorID);
        console.log(professor);

        // Cache the successful result
        await setRMPCache(normalizedName, professor);

        return professor;
    } catch (error) {
        console.error('Error sending professor info for ' + professorName, error);
        throw error;
    }
}

// Single consolidated listener for all content script requests
chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener(async (request) => {
		// Handle grade distribution requests
		if (request.type === 'gradeDistribution') {
			const { firstName, lastName } = request.professor;

			// Check for valid firstName and lastName
			if (!firstName || !lastName) {
				console.warn("Invalid professor name received. First or last name is missing:", request.professor);
				port.postMessage({ type: 'gradeDistribution', data: [] });
				return;
			}

			const results = await searchGradeDistributions(firstName, lastName);
			port.postMessage({ type: 'gradeDistribution', data: results });
		}
		// Handle professor rating requests
		else if (request.professorName) {
			sendProfessorInfo(request.professorName)
				.then((professor) => {
					port.postMessage(professor);
				})
				.catch((error) => {
					console.error('Error:', error);
					port.postMessage({ error });
				});
		}
	});
});