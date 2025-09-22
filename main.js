const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let frontendProcess;

// Kill process helper
function killProcess(pid) {
  try {
    process.kill(pid);
  } catch (e) {
    // Process already killed
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'Accenture Mainframe AI Assistant'
  });

  // Start backend Python server
  console.log('🚀 Starting backend server...');
  backendProcess = spawn('python3', ['scripts/real-db-server.py'], {
    cwd: __dirname,
    detached: false
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  // Wait for backend to be ready then load the app
  setTimeout(() => {
    // Load the Next.js app in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:3000'); // Next.js dev server
      mainWindow.webContents.openDevTools();
    } else {
      // In production, load the built Next.js app
      mainWindow.loadFile(path.join(__dirname, 'src/renderer/out/index.html'));
    }
  }, 2000);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Kill backend processes
  if (backendProcess) {
    killProcess(backendProcess.pid);
  }
  if (frontendProcess) {
    killProcess(frontendProcess.pid);
  }

  // On macOS, keep app running unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app termination
app.on('before-quit', () => {
  // Clean up backend processes
  if (backendProcess) {
    console.log('🛑 Stopping backend server...');
    killProcess(backendProcess.pid);
  }
  if (frontendProcess) {
    console.log('🛑 Stopping frontend server...');
    killProcess(frontendProcess.pid);
  }
});