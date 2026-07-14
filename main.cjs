const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  // We use the compiled CJS server for the desktop app
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Genesys Sales/Inventory System",
    icon: path.join(__dirname, 'public', 'favicon.ico'), // Place an icon here if available
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Give the server a moment to start before loading
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 2000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
