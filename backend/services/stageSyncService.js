const { getOperationsDb } = require('../config/mongo');
const { transformRow, calculateDocHash, hasActualData } = require('../utils/cleanRow');

/**
 * Log error row to separate collection
 */
async function logErrorRow(errorCollection, sheetName, rowNumber, rowData, reason) {
    try {
        await errorCollection.insertOne({
            sheetName,
            rowNumber,
            rowData,
            reason,
            timestamp: new Date(),
            resolved: false
        });
        console.log(`   ⚠️  Row ${rowNumber} logged to error collection: ${reason}`);
    } catch (err) {
        console.error(`   ❌ Failed to log error row ${rowNumber}:`, err.message);
    }
}

/**
 * Main incremental sync function for a specific sheet/collection
 * Copied from leads_master (S-Automation) logic
 */
async function syncStageSheet(sheetName, rows, headers, collectionName, idHeaderName = 'ID') {
    console.log(`\n🔄 Incremental Sync Started for Sheet: "${sheetName}" -> Target Collection: "${collectionName}"`);

    try {
        const db = await getOperationsDb();
        const collection = db.collection(collectionName);
        const errorCollection = db.collection(`${collectionName}_sync_errors`);

        console.log(`✅ Processed ${rows.length} rows for sync`);

        // Create partial unique index if idHeaderName exists
        try {
            await collection.createIndex(
                { [idHeaderName]: 1 },
                {
                    unique: true,
                    sparse: true,
                    partialFilterExpression: { [idHeaderName]: { $type: 'string', $ne: null } }
                }
            );
        } catch (indexError) {
            // Index might exist or have issue, continue safely
        }

        // Fetch ALL existing documents ONCE
        console.log(`📋 Loading ALL existing documents from ${collectionName} (in-memory)...`);
        const loadStart = Date.now();
        const existingDocs = await collection.find({}).maxTimeMS(120000).toArray();
        const loadTime = ((Date.now() - loadStart) / 1000).toFixed(2);
        console.log(`✅ Loaded ${existingDocs.length} documents in ${loadTime}s`);

        // Create in-memory map
        const existingMap = new Map();
        existingDocs.forEach(doc => {
            const key = doc[idHeaderName];
            if (key) {
                existingMap.set(key, {
                    doc: doc,
                    hash: calculateDocHash(doc)
                });
            }
        });
        console.log(`📊 Indexed ${existingMap.size} documents in memory\n`);

        console.log(`🔍 Analyzing changes (in-memory) for ${sheetName}...`);
        let newCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let emptyCount = 0;
        const bulkOps = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = row.rowNumber;
            const newDoc = transformRow(row, headers, rowNumber);
            const primaryKey = newDoc[idHeaderName];

            // If completely empty without valid data, skip
            if (!hasActualData(newDoc)) {
                emptyCount++;
                continue;
            }

            if (!primaryKey || String(primaryKey).trim() === '') {
                await logErrorRow(
                    errorCollection,
                    sheetName,
                    rowNumber,
                    newDoc,
                    `Primary Key is null/empty but row has data. Header used: "${idHeaderName}"`
                );
                errorCount++;
                continue;
            }

            const existing = existingMap.get(primaryKey);

            if (!existing) {
                // NEW ROW
                newDoc._importedAt = new Date();
                bulkOps.push({
                    insertOne: { document: newDoc }
                });
                newCount++;
            } else {
                // EXISTING ROW - Compare hash
                const newHash = calculateDocHash(newDoc);
                if (existing.hash !== newHash) {
                    // CHANGED ROW
                    bulkOps.push({
                        updateOne: {
                            filter: { [idHeaderName]: primaryKey },
                            update: { $set: newDoc }
                        }
                    });
                    updatedCount++;
                } else {
                    // UNCHANGED ROW
                    skippedCount++;
                }
            }

            if ((i + 1) % 500 === 0) {
                console.log(`   ⏳ Processed ${i + 1}/${rows.length} rows...`);
            }
        }

        // Batch write to MongoDB
        if (bulkOps.length > 0) {
            console.log(`\n💾 Writing ${bulkOps.length} bulk changes to MongoDB...`);
            const writeStart = Date.now();
            await collection.bulkWrite(bulkOps, { ordered: false });
            const writeTime = ((Date.now() - writeStart) / 1000).toFixed(2);
            console.log(`✅ Wrote ${bulkOps.length} documents in ${writeTime}s`);
        } else {
            console.log(`\n✅ No changes detected - ${collectionName} is up to date`);
        }

        // Summary
        console.log(`\n✨ Sheet Sync Summary: ${sheetName}`);
        console.log(`✅ New rows inserted: ${newCount}`);
        console.log(`🔄 Existing rows updated: ${updatedCount}`);
        console.log(`⏭️  Rows skipped (unchanged): ${skippedCount}`);
        console.log(`🗑️  Rows skipped (empty): ${emptyCount}`);
        if (errorCount > 0) {
            console.log(`⚠️  Rows logged to error collection: ${errorCount}`);
        }
        console.log('-'.repeat(40));

    } catch (error) {
        console.error(`\n❌ Sync Failed for ${sheetName}:`, error.message);
        throw error;
    }
}

module.exports = {
    syncStageSheet
};
