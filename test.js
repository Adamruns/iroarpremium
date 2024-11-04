const fs = require('fs').promises;
const path = require('path');

// Helper function to parse CSV text
function parseCSV(csvText) {
    const rows = csvText.trim().split('\n');
    return rows.map(row => row.split(',').map(value => value.trim()));
}

// Main function to search through all CSV files for a professor's name
async function loadAndSearchCSVs(professorFirstName, professorLastName) {
    const csvFiles = [
        'grade_distributions_final/2013Fall.csv', 'grade_distributions_final/2014Fall.csv', 'grade_distributions_final/2014Spring.csv',
        'grade_distributions_final/2015Fall.csv', 'grade_distributions_final/2015Spring.csv', 'grade_distributions_final/2016Fall.csv',
        'grade_distributions_final/2016Spring.csv', 'grade_distributions_final/2017Fall.csv', 'grade_distributions_final/2017Spring.csv',
        'grade_distributions_final/2018Fall.csv', 'grade_distributions_final/2018Spring.csv', 'grade_distributions_final/2019Fall.csv',
        'grade_distributions_final/2019Spring.csv', 'grade_distributions_final/2020Fall.csv', 'grade_distributions_final/2020Spring.csv',
        'grade_distributions_final/2021Fall.csv', 'grade_distributions_final/2021Spring.csv', 'grade_distributions_final/2022Fall.csv',
        'grade_distributions_final/2022Spring.csv', 'grade_distributions_final/2023Fall.csv', 'grade_distributions_final/2023Spring.csv',
        'grade_distributions_final/2024Spring.csv'
    ];

    for (const file of csvFiles) {
        try {
            const filePath = path.join(__dirname, file);
            const csvText = await fs.readFile(filePath, 'utf8');
            const rows = parseCSV(csvText);

            // Extract the year and semester from the filename
            const filename = path.basename(file);
            const year = filename.slice(0, 4);
            const semester = filename.slice(4, filename.indexOf('.csv'));

            for (const row of rows) {
                // Join the row to a single string to search for the name more flexibly
                const rowString = row.join(' ').toLowerCase();
                if (rowString.includes(professorFirstName.toLowerCase()) && rowString.includes(professorLastName.toLowerCase())) {
                    // Include the year and semester in the output
                    console.log(`Year: ${year}, Semester: ${semester}`);
                    console.log(`Row: ${row.join(', ')}`);
                    console.log('--------------------------');
                }
            }
        } catch (error) {
            console.error(`Error loading file ${file}:`, error);
        }
    }
}

// Testing the function
loadAndSearchCSVs('Long', 'Cheng');
