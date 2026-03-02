const { syncOperationsDb } = require('./sync/googleSheetsSync');
require('dotenv').config({ path: '../.env' });

async function run() {
    await syncOperationsDb();
    process.exit(0);
}

run();
