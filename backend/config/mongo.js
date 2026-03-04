const { MongoClient } = require('mongodb');
require('dotenv').config();

let operationsDbClient = null;

async function connectToOperationsDb() {
    if (operationsDbClient) {
        return operationsDbClient.db('operations');
    }

    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not set in environment variables');
        }

        console.log('🔌 Connecting to MongoDB (Operations Database)...');
        operationsDbClient = new MongoClient(uri);
        await operationsDbClient.connect();

        const db = operationsDbClient.db('operations');
        console.log(`✅ Connected to MongoDB: ${db.databaseName} database`);

        return db;
    } catch (error) {
        console.error('❌ Failed to connect to Operations database:', error.message);
        throw error;
    }
}

async function getOperationsDb() {
    if (!operationsDbClient) {
        return await connectToOperationsDb();
    }
    return operationsDbClient.db('operations');
}

module.exports = {
    connectToOperationsDb,
    getOperationsDb
};
