"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gistDiscovery = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));

class GistDiscovery {
    constructor() {
        this.localFallbackFile = path_1.default.join(os_1.default.tmpdir(), 'secure_workspace_discovery.json');
    }

    async publishEndpoint(endpoint) {
        const gistId = process.env.GIST_ID;
        const gistToken = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN;

        try {
            fs_1.default.writeFileSync(this.localFallbackFile, JSON.stringify(endpoint, null, 2), 'utf-8');
        } catch (e) {}

        if (!gistId || !gistToken) {
            return true;
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${gistToken}`,
                    'User-Agent': 'SecureWorkspace-Discovery/1.0',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: `Secure Workspace Dynamic Endpoint - Updated ${new Date().toISOString()}`,
                    files: {
                        'endpoint.json': {
                            content: JSON.stringify(endpoint, null, 2),
                        },
                    },
                }),
            });
            return response.ok;
        } catch (err) {
            console.warn('[GistDiscovery] Could not push to Gist, fallback to local discovery:', err);
            return false;
        }
    }

    async resolveEndpoint() {
        const gistId = process.env.GIST_ID;
        const gistToken = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN;

        if (gistId) {
            try {
                const headers = {
                    'User-Agent': 'SecureWorkspace-Discovery/1.0',
                };
                if (gistToken) {
                    headers['Authorization'] = `Bearer ${gistToken}`;
                }
                const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    const fileContent = data?.files?.['endpoint.json']?.content;
                    if (fileContent) {
                        return JSON.parse(fileContent);
                    }
                }
            } catch (err) {
                console.warn('[GistDiscovery] Error fetching Gist endpoint:', err);
            }
        }

        if (fs_1.default.existsSync(this.localFallbackFile)) {
            try {
                const data = fs_1.default.readFileSync(this.localFallbackFile, 'utf-8');
                return JSON.parse(data);
            } catch (e) {}
        }

        return null;
    }
}

exports.gistDiscovery = new GistDiscovery();
