"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemDiagnostics = getSystemDiagnostics;
exports.pingServer = pingServer;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../db/database");
const chatSocket_1 = require("../sockets/chatSocket");
async function getSystemDiagnostics(req, res) {
    try {
        const memory = process.memoryUsage();
        const uptime = process.uptime();
        // SQLite file info
        const dbPath = process.env.DB_PATH || path_1.default.resolve(process.cwd(), 'workspace.db');
        let dbSize = 0;
        let walSize = 0;
        if (fs_1.default.existsSync(dbPath)) {
            dbSize = fs_1.default.statSync(dbPath).size;
        }
        const walPath = `${dbPath}-wal`;
        if (fs_1.default.existsSync(walPath)) {
            walSize = fs_1.default.statSync(walPath).size;
        }
        // SQLite Page count
        const pageCountRow = database_1.db.pragma('page_count', { simple: true });
        const pageSizeRow = database_1.db.pragma('page_size', { simple: true });
        // Check Cloudflare tunnel discovery file
        const discoveryFile = path_1.default.resolve(process.cwd(), '.tunnel_url');
        let tunnelUrl = 'Chưa xác định';
        if (fs_1.default.existsSync(discoveryFile)) {
            try {
                tunnelUrl = fs_1.default.readFileSync(discoveryFile, 'utf-8').trim();
            }
            catch (e) { }
        }
        const onlineUsersCount = chatSocket_1.connectedUserSockets.size;
        // Format uptime
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const formattedUptime = `${hours}h ${minutes}m ${seconds}s`;
        res.json({
            success: true,
            diagnostics: {
                serverTime: new Date().toISOString(),
                uptimeSeconds: Math.floor(uptime),
                formattedUptime,
                os: {
                    platform: os_1.default.platform(),
                    arch: os_1.default.arch(),
                    cpus: os_1.default.cpus().length,
                    totalMemoryMB: Math.round(os_1.default.totalmem() / 1024 / 1024),
                    freeMemoryMB: Math.round(os_1.default.freemem() / 1024 / 1024),
                    loadAverage: os_1.default.loadavg(),
                },
                processMemory: {
                    heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
                    heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
                    rssMB: Math.round(memory.rss / 1024 / 1024),
                },
                database: {
                    path: dbPath,
                    sizeBytes: dbSize,
                    sizeFormatted: `${(dbSize / 1024 / 1024).toFixed(2)} MB`,
                    walSizeBytes: walSize,
                    walSizeFormatted: `${(walSize / 1024 / 1024).toFixed(2)} MB`,
                    pageCount: pageCountRow,
                    pageSize: pageSizeRow,
                    journalMode: 'WAL',
                },
                tunnel: {
                    status: tunnelUrl.startsWith('https://') ? 'CONNECTED' : 'DISCONNECTED',
                    publicUrl: tunnelUrl,
                    protocol: 'HTTP/2 & QUIC (Cloudflare Free)',
                },
                realtime: {
                    activeSocketUsers: onlineUsersCount,
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function pingServer(req, res) {
    res.json({
        pong: true,
        serverTimestamp: Date.now(),
        echo: req.body?.clientTimestamp || null,
    });
}
