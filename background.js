// Public client identifier used by Rate My Professors for its read-only teacher search.
const AUTH_TOKEN = 'dGVzdDp0ZXN0';
const CLEMSON_ID = 'U2Nob29sLTI0Mg==';
const DAY = 24 * 60 * 60 * 1000;
const rmpMemoryCache = new Map();
const pendingRatings = new Map();
let csvLoad = null;

const gradeDistributionFiles = [
    'grade_distributions_final/2026Spring.csv',
    'grade_distributions_final/2025Fall.csv',
    'grade_distributions_final/2025Spring.csv',
    'grade_distributions_final/2024Fall.csv',
    'grade_distributions_final/2024Spring.csv',
    'grade_distributions_final/2023Fall.csv',
    'grade_distributions_final/2023Spring.csv',
    'grade_distributions_final/2022Fall.csv',
    'grade_distributions_final/2022Spring.csv',
    'grade_distributions_final/2021Fall.csv',
    'grade_distributions_final/2021Spring.csv',
    'grade_distributions_final/2020Fall.csv',
    'grade_distributions_final/2020Spring.csv',
    'grade_distributions_final/2019Fall.csv',
    'grade_distributions_final/2019Spring.csv',
    'grade_distributions_final/2018Fall.csv',
    'grade_distributions_final/2018Spring.csv',
    'grade_distributions_final/2017Fall.csv',
    'grade_distributions_final/2017Spring.csv',
    'grade_distributions_final/2016Fall.csv',
    'grade_distributions_final/2016Spring.csv',
    'grade_distributions_final/2015Fall.csv',
    'grade_distributions_final/2015Spring.csv',
    'grade_distributions_final/2014Fall.csv',
    'grade_distributions_final/2014Spring.csv',
    'grade_distributions_final/2013Fall.csv',
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
function loadAllCSVData() {
    if (!csvLoad) csvLoad = readGradeFiles().catch(error => { csvLoad = null; throw error; });
    return csvLoad;
}

async function readGradeFiles() {

    console.log('Loading CSV data into cache...');
    const csvCache = [];

    for (const file of gradeDistributionFiles) {
        const fileURL = chrome.runtime.getURL(file);
        const response = await fetch(fileURL);
        if (!response.ok) throw new Error('Grade file unavailable: ' + file);
        const csvText = await response.text();
        const rows = parseCSV(csvText);

        // Extract year and semester from filename
        const year = file.match(/\d{4}/)[0];
        const semester = file.includes('Fall') ? 'Fall' : 'Spring';

        // Store each row with its metadata
        for (const row of rows) {
            csvCache.push({ year, semester, data: row, instructor: normalizeName(row.at(-1)) });
        }
    }

    console.log(`CSV cache loaded: ${csvCache.length} rows`);
    return csvCache;
}

function normalizeName(name) {
    return String(name || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function nameParts(professor) {
    if (professor.displayName?.includes(',')) {
        const [family, given] = professor.displayName.split(',');
        return [normalizeName(family), normalizeName(given).split(' ')[0]];
    }
    return [normalizeName(professor.lastName), normalizeName(professor.firstName).split(' ')[0]];
}

async function searchGradeDistributions(professor) {
    const [family, first] = nameParts(professor);
    if (!family || !first) return [];
    const prefix = family + ' ' + first;
    return (await loadAllCSVData()).filter(entry => entry.instructor === prefix || entry.instructor.startsWith(prefix + ' '))
        .map(({year,semester,data}) => ({year,semester,data}));
}

// RMP Cache helpers
async function getRMPFromCache(professorName) {
    const cacheKey = `rmp_v22_${professorName.toLowerCase()}`;

    // Check memory cache first
    if (rmpMemoryCache.has(cacheKey)) {
        const cached = rmpMemoryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < (cached.data.error ? DAY / 12 : DAY)) {
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
            if (Date.now() - cached.timestamp < (cached.data.error ? DAY / 12 : DAY)) {
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
    const cacheKey = `rmp_v22_${professorName.toLowerCase()}`;
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



async function rmpQuery(query, variables) {
    const response = await fetch('https://www.ratemyprofessors.com/graphql', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: 'Basic ' + AUTH_TOKEN},
        body: JSON.stringify({query, variables})
    });
    if (!response.ok) throw new Error('Rating service unavailable');
    const result = await response.json();
    if (result.errors?.length || !result.data) throw new Error('Rating service unavailable');
    return result.data;
}

async function fetchRating(name) {
    const cached = await getRMPFromCache(name);
    if (cached) return cached;
    const search = await rmpQuery(`query($text:String!,$schoolID:ID!){
        newSearch { teachers(query:{text:$text,schoolID:$schoolID}){
            edges { node { id firstName lastName school { id } } }
        } }
    }`, {text: name, schoolID: CLEMSON_ID});
    const canonical = normalizeName(name);
    const candidates = (search.newSearch?.teachers?.edges || []).map(edge => edge.node).filter(n => n.school?.id === CLEMSON_ID);
    const exact = candidates.filter(n => normalizeName(n.firstName+' '+n.lastName) === canonical);
    const matches = exact.length ? exact : candidates.filter(n => {
        const family = normalizeName(n.lastName);
        const given = canonical.slice(0, -(family.length + 1));
        return family && canonical.endsWith(' '+family) && given.split(' ')[0] === normalizeName(n.firstName).split(' ')[0];
    });
    let result = {error:'No unique matching Clemson profile'};
    if (matches.length === 1) {
        const detail = await rmpQuery(`query($id:ID!){node(id:$id){... on Teacher {
            id firstName lastName school { id } avgDifficulty avgRating numRatings legacyId wouldTakeAgainPercent
        }}}`, {id:matches[0].id});
        if (!detail.node || detail.node.school?.id !== CLEMSON_ID) throw new Error('Rating service unavailable');
        result = {...detail.node, checkedAt:Date.now()};
    }
    await setRMPCache(name,result);
    return result;
}

function sendProfessorInfo(name) {
    const key = normalizeName(name);
    if (!key) return Promise.resolve({error:'Missing instructor name'});
    if (!pendingRatings.has(key)) {
        pendingRatings.set(key,fetchRating(name).finally(() => pendingRatings.delete(key)));
    }
    return pendingRatings.get(key);
}

chrome.runtime.onConnect.addListener(port => {
    let connected = true;
    port.onDisconnect.addListener(() => { connected = false; });
    port.onMessage.addListener(async request => {
        let result;
        try {
            result = request.type === 'gradeDistribution'
                ? {type:'gradeDistribution', data:await searchGradeDistributions(request.professor || {})}
                : await sendProfessorInfo(request.professorName);
        } catch {
            result = request.type === 'gradeDistribution' ? {type:'gradeDistribution',data:[],error:'Grade history unavailable'}
                : {error:'Rating service unavailable'};
        }
        if (connected) port.postMessage(result);
    });
});
