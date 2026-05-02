import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOGS_DIR = path.join(process.cwd(), 'logs/runtime');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const getLogFilename = (type: string, profile?: string) => {
    const date = new Date().toISOString().split('T')[0];
    const prefix = profile ? `${profile}-` : '';
    return path.join(LOGS_DIR, `${prefix}${type}-${date}.log`);
};

// Custom format for clean logs
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

export const createLogger = (profile?: string) => {
    return winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        transports: [
            // Generic info log
            new winston.transports.File({ 
                filename: getLogFilename('info', profile),
                level: 'info' 
            }),
            // Dedicated error log
            new winston.transports.File({ 
                filename: getLogFilename('error', profile),
                level: 'error' 
            }),
            // Console output for development
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp(),
                    customFormat
                )
            })
        ]
    });
};

// Default system logger
export const logger = createLogger();

// Server Error Logger
export const serverErrorLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.File({ filename: path.join(LOGS_DIR, `server.error-${new Date().toISOString().split('T')[0]}.log`) })
    ]
});
