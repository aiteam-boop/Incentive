const crypto = require('crypto');

// Date columns (convert to Date objects)
const DATE_COLUMNS = [
    'Date', 'Created', 'Updated', 'Timestamp', 'Created_At', 'Updated_At'
];

// Numeric columns (convert to numbers)
const NUMERIC_COLUMNS = [
    'Amount', 'Quantity', 'Value', 'Price', 'Total'
];

/**
 * Parse date string to Date object
 */
function parseDate(value) {
    if (!value || value === '') return null;

    const str = String(value).trim();
    if (str === '') return null;

    // DD/MM/YYYY format
    const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10) - 1;
        const year = parseInt(ddmmyyyy[3], 10);
        return new Date(year, month, day);
    }

    // YYYY-MM-DD format
    const yyyymmdd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (yyyymmdd) {
        return new Date(str);
    }

    // Excel serial number
    const num = parseFloat(str);
    if (!isNaN(num) && num > 1000 && num < 100000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    }

    // Standard parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

/**
 * Parse numeric value
 */
function parseNumber(value) {
    if (!value || value === '') return null;
    const str = String(value).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

/**
 * Transform sheet row to MongoDB document
 */
function transformRow(row, headers, rowNumber) {
    const doc = {
        _sheetRowNumber: rowNumber,
        _lastSyncedAt: new Date()
    };

    headers.forEach(header => {
        let value;

        try {
            // Try to get value using exact header
            value = row.get(header);

            // If undefined, try alternative formats
            if (value === undefined || value === null) {
                // Try with spaces replaced by underscores
                const altHeader1 = header.replace(/ /g, '_');
                if (altHeader1 !== header) {
                    value = row.get(altHeader1);
                }

                // Try with underscores replaced by spaces
                if ((value === undefined || value === null) && header.includes('_')) {
                    const altHeader2 = header.replace(/_/g, ' ');
                    value = row.get(altHeader2);
                }
            }
        } catch (error) {
            value = null;
        }

        if (value === undefined || value === null || value === '') {
            doc[header] = null;
            return;
        }

        if (DATE_COLUMNS.includes(header)) {
            doc[header] = parseDate(value);
            return;
        }

        if (NUMERIC_COLUMNS.includes(header)) {
            doc[header] = parseNumber(value);
            return;
        }

        doc[header] = String(value).trim();
    });

    return doc;
}

/**
 * Calculate hash of document (for change detection)
 * Excludes metadata fields like _lastSyncedAt
 */
function calculateDocHash(doc) {
    const cleanDoc = { ...doc };
    delete cleanDoc._id;
    delete cleanDoc._lastSyncedAt;
    delete cleanDoc._importedAt;
    delete cleanDoc._sheetRowNumber;
    delete cleanDoc._syncErrorReason;

    const str = JSON.stringify(cleanDoc, Object.keys(cleanDoc).sort());
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Check if a row has actual data or is completely empty
 */
function hasActualData(doc) {
    const PLACEHOLDER_VALUES = ['0', 'n/a', 'none', '-'];

    return Object.keys(doc).some(key => {
        // Skip metadata fields
        if (key.startsWith('_')) return false;

        let val = doc[key];
        if (val === null || val === undefined) return false;

        // Convert to string for checking
        const strVal = String(val).trim();

        // Empty string is not data
        if (strVal === '') return false;

        // Check for placeholder/default values (case-insensitive)
        if (PLACEHOLDER_VALUES.includes(strVal.toLowerCase())) return false;

        // If we get here, it's real data
        return true;
    });
}

module.exports = {
    parseDate,
    parseNumber,
    transformRow,
    calculateDocHash,
    hasActualData
};
