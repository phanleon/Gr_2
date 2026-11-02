import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// 1. Crash Log & Error Trap: Prevent the application from ever failing silently
function writeCrashLog(type: string, error: any) {
  try {
    const errorMsg = error?.stack || error?.message || String(error);
    console.error(`[Electron ${type}]`, errorMsg);
    
    const logDir = app.isReady() ? app.getPath('userData') : process.cwd();
    const logFile = path.join(logDir, 'secure-workspace-error.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] [${type}] ${errorMsg}\n\n`);
  } catch (e) {
    // ignore filesystem logging errors
  }
}

process.on('uncaughtException', (err) => {
  writeCrashLog('UncaughtException', err);
  try {
    dialog.showErrorBox(
      'SecureWorkspace Error',
      `An unexpected error occurred:\n\n${err.message}\n\nPlease check secure-workspace-error.log.`
    );
  } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  writeCrashLog('UnhandledRejection', reason);
});

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
function getAppMode(): 'SERVER' | 'CLIENT' {
  if (process.env.APP_MODE === 'CLIENT' || process.argv.includes('--client')) return 'CLIENT';
  if (process.env.APP_MODE === 'SERVER' || process.argv.includes('--server')) return 'SERVER';
  const name = (app.getName() || '').toLowerCase();
  if (name.includes('client')) return 'CLIENT';
  if (name.includes('server')) return 'SERVER';
  return 'SERVER';
}
const mode = getAppMode();

async function createWindow() {
  const windowTitle = mode === 'SERVER'
    ? 'Secure Workspace - SERVER EDITION (Quản Trị Máy Chủ)'
    : 'Secure Workspace - CLIENT EDITION (Nhân Viên Làm Việc)';

  mainWindow = new BrowserWindow({
    title: windowTitle,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    show: true, // Always show immediately so the user sees the window appear!
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const candidates = [
      path.join(__dirname, '../../dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.resolve(process.cwd(), 'dist/index.html'),
    ];
    let loaded = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        console.log(`[Electron] Loading UI from: ${p}`);
        mainWindow.loadFile(p);
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      console.warn('[Electron] UI dist/index.html not found, fallback to first candidate');
      mainWindow.loadFile(candidates[0]);
    }
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc) => {
    writeCrashLog('RendererFailLoad', `Code: ${errorCode}, Description: ${errorDesc}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 2. Main Lifecycle
app.whenReady().then(async () => {
  // A. Immediately show UI window (0ms delay)
  await createWindow();

  // B. Initialize Win32 Remote Control IPC safely
  try {
    const { win32RemoteControl } = require('./services/win32RemoteControl');
    globalShortcut.register('F12', () => {
      console.warn('[Electron] Global F12 Emergency Panic Key pressed! Disconnecting all remote sessions.');
      win32RemoteControl.stopSession();
      mainWindow?.webContents.send('emergency-f12-pressed');
    });

    ipcMain.on('trigger-panic-disconnect', () => {
      win32RemoteControl.stopSession();
    });
  } catch (err) {
    writeCrashLog('Win32RemoteControlInit', err);
  }

  // C. Initialize Discovery IPC safely
  try {
    ipcMain.handle('get-app-mode', () => mode);
    ipcMain.handle('is-server-mode', () => mode === 'SERVER');
    const { gistDiscovery } = require('./services/gistDiscovery');
    ipcMain.handle('get-discovery-endpoint', async () => {
      return await gistDiscovery.resolveEndpoint();
    });
  } catch (err) {
    writeCrashLog('GistDiscoveryInit', err);
  }

  // D. Initialize Watchdog & Server safely
  try {
    const { tunnelWatchdog } = require('./services/tunnelWatchdog');
    ipcMain.handle('get-tunnel-status', () => {
      return tunnelWatchdog.getStatus();
    });

    if (mode === 'SERVER') {
      console.log('[Electron] Starting embedded Zero-Trust Server...');
      try {
        const { startServer } = require('../server/index');
        await startServer(8080);
      } catch (srvErr) {
        writeCrashLog('StartServerWarning', srvErr);
      }

      tunnelWatchdog.on('status', (status: any) => {
        mainWindow?.webContents.send('tunnel-status-changed', status);
      });

      // Start tunnel asynchronously in background (never blocks UI)
      tunnelWatchdog.start().catch((tunErr: any) => {
        writeCrashLog('TunnelWatchdogStart', tunErr);
      });
    } else {
      console.log('[Electron] Running in CLIENT Mode. Connecting via Auto-Discovery...');
    }
  } catch (err) {
    writeCrashLog('WatchdogOrServerInit', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
    const { tunnelWatchdog } = require('./services/tunnelWatchdog');
    tunnelWatchdog.stop();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
