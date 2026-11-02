import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import { EventEmitter } from 'events';

export interface PtySessionOptions {
  sessionId: string;
  cols?: number;
  rows?: number;
}

export class SshPtyBridge extends EventEmitter {
  public sessionId: string;
  private process: ChildProcess | null = null;
  private isAlive: boolean = false;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  public start(): boolean {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
    const shellArgs = isWin ? ['-NoLogo'] : ['-i'];

    try {
      this.process = spawn(shell, shellArgs, {
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
        shell: false,
      });

      this.isAlive = true;

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        this.emit('data', data.toString());
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('data', data.toString());
      });

      this.process.on('close', (code) => {
        this.isAlive = false;
        this.emit('exit', code);
      });

      this.process.on('error', (err) => {
        this.emit('error', err);
      });

      console.log(`[SshPtyBridge] Spawned remote shell session (${shell}) for session: ${this.sessionId}`);
      return true;
    } catch (err) {
      console.error('[SshPtyBridge] Failed to spawn shell process:', err);
      return false;
    }
  }

  public write(data: string) {
    if (this.isAlive && this.process && this.process.stdin) {
      this.process.stdin.write(data);
    }
  }

  public kill() {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch (err) {
        // Ignore
      }
      this.isAlive = false;
      this.process = null;
    }
  }

  public getIsAlive(): boolean {
    return this.isAlive;
  }
}

