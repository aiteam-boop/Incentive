const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const cron = require('node-cron');
const { syncStageSheet } = require('../services/stageSyncService');

const SHEET_ID = '1_9Lsg4Arz-dFWflaIBKJq8LHWkextr0w3XLPGiP1Iic';

// Target Sheets and their respective collection names
const TARGET_SHEETS = [
    { sheetTitle: 'STAGE1', collectionName: 'stage1_data' },
    { sheetTitle: 'STAGE6', collectionName: 'stage6_data' },
    { sheetTitle: 'STAGE6.1', collectionName: 'stage6_1_data' }
];

/**
 * Configure Google Auth and sync all relevant sheets using googleapis directly
 * to avoid duplicate header constraints from google-spreadsheet
 */
async function syncOperationsDb() {
    console.log('\n======================================================');
    console.log('🔄 Google Sheets Operations Sync Starting...');
    console.log('======================================================\n');

    try {
        console.log('📡 Connecting to Google Sheets API...');

        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (privateKey && privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        const jwt = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: privateKey,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly'
            ]
        });

        const sheets = google.sheets({ version: 'v4', auth: jwt });

        for (const target of TARGET_SHEETS) {
            console.log(`\n📥 Fetching raw data for sheet: "${target.sheetTitle}"...`);

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: `${target.sheetTitle}`,
            });

            const data = res.data.values;
            if (!data || data.length < 2) {
                console.log(`⚠️ Sheet "${target.sheetTitle}" is empty or has only headers. Skipping...`);
                continue;
            }

            const rawHeaders = data[0];
            const headers = [];
            const headerCounts = {};

            // Rename duplicate headers automatically (e.g. Product Type -> Product Type1, Product Type2)
            rawHeaders.forEach(h => {
                let name = h ? String(h).trim() : 'Unknown_Column';

                if (!headerCounts[name]) {
                    headerCounts[name] = 1;
                    headers.push(name);
                } else {
                    headerCounts[name]++;
                    headers.push(`${name}${headerCounts[name]}`);
                }
            });

            const rawRows = data.slice(1);

            // Map raw row arrays into pseudo-objects with a `get` method
            // This mimics the google-spreadsheet module's row object locally
            const mockRows = rawRows.map((rowArr, index) => {
                return {
                    rowNumber: index + 2, // 1 for header row, 1 for 0-index
                    get: (headerName) => {
                        const idx = headers.indexOf(headerName);
                        if (idx !== -1 && idx < rowArr.length) {
                            return rowArr[idx];
                        }
                        return null; // Return null intentionally if not found
                    }
                };
            });

            let idHeaderName = headers.find(h =>
                h.toLowerCase().trim() === 'order received number'
            );

            if (!idHeaderName) {
                console.log(`⚠️ ID Header "Order Received Number" not found in ${target.sheetTitle}. Cannot proceed with sync safely.`);
                continue;
            } else {
                console.log(`🔑 Using Primary Key: "${idHeaderName}" for ${target.sheetTitle}`);
            }

            // Execute the incremental sync process
            await syncStageSheet(target.sheetTitle, mockRows, headers, target.collectionName, idHeaderName);
        }

        console.log('\n======================================================');
        console.log('✅ Google Sheets Operations Sync Completed Successfully');
        console.log('======================================================\n');
    } catch (error) {
        console.error('\n❌ Google Sheets Sync Failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

/**
 * Starts the Auto-Sync using node-cron.
 * By default, runs every 10 minutes similar to incrementalSync in leads_master
 */
function startOperationsAutoSync(cronExpression = '*/10 * * * *') {
    // Run an initial sync first immediately 
    syncOperationsDb().then(() => {
        console.log(`⏰ Scheduling Operations auto-sync with cron: ${cronExpression}`);
        cron.schedule(cronExpression, async () => {
            console.log('\n⏰ Running scheduled operations auto-sync...');
            await syncOperationsDb();
        });
    }).catch(err => {
        console.error('❌ Error during initial Operations sync:', err.message);
    });
}

module.exports = {
    syncOperationsDb,
    startOperationsAutoSync
};
