import fs from 'fs';
import path from 'path';
import os from 'os';

export interface DiscoveryEndpoint {
  serverUrl: string;
  wsUrl: string;
  updatedAt: string;
  hostName: string;
  activeInterfaces: string[];
  version: string;
}

class GistDiscovery {
  private localFallbackFile: string;

  constructor() {
    this.localFallbackFile = path.join(os.tmpdir(), 'secure_workspace_discovery.json');
  }

  async publishEndpoint(endpoint: DiscoveryEndpoint): Promise<boolean> {
    const gistId = process.env.GIST_ID;
    const gistToken = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN;

    // Always cache locally for immediate LAN / loopback resolution
    try {
      fs.writeFileSync(this.localFallbackFile, JSON.stringify(endpoint, null, 2), 'utf-8');
    } catch (e) {}

    if (!gistId || !gistToken) {
      // Zero-cost LAN mode without exposing external Gist credentials
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

  async resolveEndpoint(): Promise<DiscoveryEndpoint | null> {
    const gistId = process.env.GIST_ID;
    const gistToken = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN;

    if (gistId) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'SecureWorkspace-Discovery/1.0',
        };
        if (gistToken) {
          headers['Authorization'] = `Bearer ${gistToken}`;
        }
        const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
        if (res.ok) {
          const data: any = await res.json();
          const fileContent = data?.files?.['endpoint.json']?.content;
          if (fileContent) {
            return JSON.parse(fileContent) as DiscoveryEndpoint;
          }
        }
      } catch (err) {
        console.warn('[GistDiscovery] Error fetching Gist endpoint:', err);
      }
    }

    // Local fallback
    if (fs.existsSync(this.localFallbackFile)) {
      try {
        const data = fs.readFileSync(this.localFallbackFile, 'utf-8');
        return JSON.parse(data) as DiscoveryEndpoint;
      } catch (e) {}
    }

    return null;
  }
}

export const gistDiscovery = new GistDiscovery();
