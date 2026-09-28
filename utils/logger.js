const fs = require('fs');
const path = require('path');

// 1. Ensure the 'logs' directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Helper function to get a formatted timestamp
const getTimestamp = () => {
    return new Date().toISOString();
};

// 2. Log significant operational events (e.g., server start, DB connection)
exports.logEvent = (message) => {
    const logMessage = `[${getTimestamp()}] EVENT: ${message}\n`;
    
    // Append the log to events.log file
    fs.appendFile(path.join(logsDir, 'events.log'), logMessage, (err) => {
        if (err) console.error('Failed to write to events log:', err);
    });
};

// 3. Log system errors or failed requests
exports.logError = (message, error) => {
    const errorDetails = error ? (error.message || error) : 'No specific details';
    const logMessage = `[${getTimestamp()}] ERROR: ${message} | Details: ${errorDetails}\n`;
    
    // Append the log to errors.log file
    fs.appendFile(path.join(logsDir, 'errors.log'), logMessage, (err) => {
        if (err) console.error('Failed to write to errors log:', err);
    });
};