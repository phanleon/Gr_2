"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tunnelWatchdog = exports.TunnelWatchdog = void 0;
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("events");
const gistDiscovery_1 = require("./gistDiscovery");
class TunnelWatchdog extends events_1.EventEmitter {
    tunnelProcess = null;
    localPort;
    activeUrl = null;
    checkInterval = null;
    heartbeatInterval = null;
    lastNetworkSignature = '';
    reconnectCount = 0;
    isShuttingDown = false;
    binaryPath = null;
    constructor(localPort = 8080) {
        super();
        this.localPort = localPort;
        this.resolveBinaryPath();
    }
    resolveBinaryPath() {
        const isWin = process.platform === 'win32';
        const binName = isWin ? 'cloudflared.exe' : 'cloudflared';
        const candidates = [
            path_1.default.resolve(process.resourcesPath || '', 'bin', binName),
            path_1.default.resolve(path_1.default.dirname(process.execPath), 'resources', 'bin', binName),
            path_1.default.resolve(path_1.default.dirname(process.execPath), 'bin', binName),
            path_1.default.resolve(process.cwd(), 'bin', binName),
            path_1.default.resolve(__dirname, '..', '..', 'bin', binName),
            path_1.default.resolve(__dirname, '..', 'bin', binName),
            path_1.default.resolve(process.resourcesPath || '', 'app.asar.unpacked', 'bin', binName),
        ];
        for (const p of candidates) {
            if (fs_1.default.existsSync(p)) {
                this.binaryPath = p;
                console.log(`[TunnelWatchdog] Located cloudflared binary at: ${p}`);
                if (!isWin) {
                    try {
                        fs_1.default.chmodSync(p, 0o755);
                    }
                    catch (e) { }
                }
                return;
            }
        }
        console.warn('[TunnelWatchdog] Cloudflared binary not found in standard paths. Fallback to Local LAN.');
        this.binaryPath = null;
    }
    getNetworkSignature() {
        const interfaces = os_1.default.networkInterfaces();
        const ips = [];
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name] || []) {
                if (!net.internal && net.family === 'IPv4') {
                    ips.push(net.address);
                }
            }
        }
        const signature = ips.sort().join(',');
        return { signature, ips };
    }
    async start() {
        this.isShuttingDown = false;
        const { signature, ips } = this.getNetworkSignature();
        this.lastNetworkSignature = signature;
        if (this.binaryPath && fs_1.default.existsSync(this.binaryPath)) {
            await this.spawnCloudflareTunnel();
        }
        else {
            // Local LAN / Loopback fallback
            const primaryIp = ips[0] || '127.0.0.1';
            this.activeUrl = `http://${primaryIp}:${this.localPort}`;
            const wsUrl = `ws://${primaryIp}:${this.localPort}`;
            console.log(`[TunnelWatchdog] Operating in High-Speed Local LAN mode: ${this.activeUrl}`);
            await gistDiscovery_1.gistDiscovery.publishEndpoint({
                serverUrl: this.activeUrl,
                wsUrl,
                updatedAt: new Date().toISOString(),
                hostName: os_1.default.hostname(),
                activeInterfaces: ips,
                version: '1.0.0',
            });
            this.emit('status', this.getStatus());
        }
        // Start 5-second network watchdog health check loop
        this.startWatchdogLoop();
        // Start 60-second heartbeat loop to keep discovery record active
        this.startHeartbeatLoop();
        return this.getStatus();
    }
    spawnCloudflareTunnel() {
        return new Promise((resolve) => {
            if (!this.binaryPath)
                return resolve(this.activeUrl || '');
            console.log(`[TunnelWatchdog] Spawning tunnel using binary: ${this.binaryPath}`);
            const customToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
            const customDomain = process.env.CLOUDFLARE_CUSTOM_DOMAIN;
            const args = customToken
                ? ['tunnel', 'run', '--token', customToken]
                : ['tunnel', '--url', `http://127.0.0.1:${this.localPort}`, '--no-autoupdate'];
            if (customToken && customDomain) {
                this.activeUrl = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
                console.log(`[TunnelWatchdog] Using Permanent Named Domain: ${this.activeUrl}`);
            }
            this.tunnelProcess = (0, child_process_1.spawn)(this.binaryPath, args, {
                windowsHide: true,
            });
            let tunnelUrlDetected = false;
            const handleOutput = async (data) => {
                const text = data.toString();
                // Regex to extract trycloudflare.com URL
                const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
                if (match && !tunnelUrlDetected) {
                    tunnelUrlDetected = true;
                    this.activeUrl = match[0];
                    const wsUrl = this.activeUrl.replace('https://', 'wss://');
                    console.log(`[TunnelWatchdog] Zero-Config Tunnel URL Established: ${this.activeUrl}`);
                    const { ips } = this.getNetworkSignature();
                    await gistDiscovery_1.gistDiscovery.publishEndpoint({
                        serverUrl: this.activeUrl,
                        wsUrl,
                        updatedAt: new Date().toISOString(),
                        hostName: os_1.default.hostname(),
                        activeInterfaces: ips,
                        version: '1.0.0',
                    });
                    this.emit('tunnel_ready', this.activeUrl);
                    this.emit('status', this.getStatus());
                    resolve(this.activeUrl);
                }
            };
            this.tunnelProcess.stderr?.on('data', handleOutput);
            this.tunnelProcess.stdout?.on('data', handleOutput);
            this.tunnelProcess.on('exit', (code) => {
                console.warn(`[TunnelWatchdog] Tunnel process exited with code ${code}`);
                this.tunnelProcess = null;
                if (!this.isShuttingDown) {
                    this.emit('tunnel_disconnected');
                    this.scheduleRestart(2000);
                }
            });
            this.tunnelProcess.on('error', (err) => {
                console.error('[TunnelWatchdog] Process error:', err);
                this.tunnelProcess = null;
                if (!tunnelUrlDetected) {
                    const { ips } = this.getNetworkSignature();
                    const primaryIp = ips[0] || '127.0.0.1';
                    this.activeUrl = `http://${primaryIp}:${this.localPort}`;
                    resolve(this.activeUrl);
                }
            });
            // Timeout safety
            setTimeout(() => {
                if (!tunnelUrlDetected) {
                    console.warn('[TunnelWatchdog] Tunnel startup detection timed out. Using current active URL.');
                    resolve(this.activeUrl || `http://127.0.0.1:${this.localPort}`);
                }
            }, 10000);
        });
    }
    startWatchdogLoop() {
        if (this.checkInterval)
            clearInterval(this.checkInterval);
        this.checkInterval = setInterval(async () => {
            if (this.isShuttingDown)
                return;
            const { signature, ips } = this.getNetworkSignature();
            // Check if network interface/IP has changed (e.g. Wi-Fi <-> 4G switch)
            if (signature !== this.lastNetworkSignature) {
                console.log(`[TunnelWatchdog] Network change detected! Old: [${this.lastNetworkSignature}], New: [${signature}]`);
                this.lastNetworkSignature = signature;
                this.reconnectCount++;
                this.emit('network_changed', { ips, reconnectCount: this.reconnectCount });
                // Respawn tunnel or re-publish endpoint
                if (this.binaryPath) {
                    console.log('[TunnelWatchdog] Respawning Cloudflare Tunnel for new network interface...');
                    this.stopTunnelProcess();
                    await this.spawnCloudflareTunnel();
                }
                else {
                    const primaryIp = ips[0] || '127.0.0.1';
                    this.activeUrl = `http://${primaryIp}:${this.localPort}`;
                    const wsUrl = `ws://${primaryIp}:${this.localPort}`;
                    await gistDiscovery_1.gistDiscovery.publishEndpoint({
                        serverUrl: this.activeUrl,
                        wsUrl,
                        updatedAt: new Date().toISOString(),
                        hostName: os_1.default.hostname(),
                        activeInterfaces: ips,
                        version: '1.0.0',
                    });
                    this.emit('status', this.getStatus());
                }
            }
        }, 5000);
    }
    startHeartbeatLoop() {
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (this.isShuttingDown || !this.activeUrl)
                return;
            const { ips } = this.getNetworkSignature();
            const wsUrl = this.activeUrl.startsWith('https://')
                ? this.activeUrl.replace('https://', 'wss://')
                : this.activeUrl.replace('http://', 'ws://');
            await gistDiscovery_1.gistDiscovery.publishEndpoint({
                serverUrl: this.activeUrl,
                wsUrl,
                updatedAt: new Date().toISOString(),
                hostName: os_1.default.hostname(),
                activeInterfaces: ips,
                version: '1.0.0',
            });
        }, 60000); // Heartbeat every 60s
    }
    scheduleRestart(delayMs) {
        setTimeout(async () => {
            if (!this.isShuttingDown && !this.tunnelProcess && this.binaryPath) {
                this.reconnectCount++;
                console.log(`[TunnelWatchdog] Attempting auto-heal restart (#${this.reconnectCount})...`);
                await this.spawnCloudflareTunnel();
            }
        }, delayMs);
    }
    stopTunnelProcess() {
        if (this.tunnelProcess) {
            try {
                this.tunnelProcess.kill('SIGTERM');
            }
            catch (e) { }
            this.tunnelProcess = null;
        }
    }
    stop() {
        this.isShuttingDown = true;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.stopTunnelProcess();
    }
    getStatus() {
        const { ips } = this.getNetworkSignature();
        const wsUrl = this.activeUrl
            ? (this.activeUrl.startsWith('https://')
                ? this.activeUrl.replace('https://', 'wss://')
                : this.activeUrl.replace('http://', 'ws://'))
            : null;
        return {
            isRunning: !!this.tunnelProcess || !this.binaryPath,
            activeUrl: this.activeUrl,
            wsUrl,
            lastChanged: new Date().toISOString(),
            localPort: this.localPort,
            ipAddresses: ips,
            reconnectCount: this.reconnectCount,
            mode: this.binaryPath ? 'cloudflared' : 'local_lan',
            message: this.binaryPath ? 'Quick Tunnel active' : 'Running in Zero-Cost Local LAN / Loopback Discovery mode',
        };
    }
}
exports.TunnelWatchdog = TunnelWatchdog;
exports.tunnelWatchdog = new TunnelWatchdog(8080);
