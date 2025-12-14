import { app, BrowserWindow, WebContentsView, session, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
const views: Record<string, WebContentsView> = {};

const commonPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  partition: 'persist:cortex' 
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: { 
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') 
    },
    backgroundColor: '#111827',
    icon: path.join(__dirname, '../resources/icon.ico'),
    autoHideMenuBar: true
  });

  // --- AI MOTORLARINI BAŞLAT (MODERN) ---
  views.chatgpt = new WebContentsView({ webPreferences: commonPreferences });
  mainWindow.contentView.addChildView(views.chatgpt);
  views.chatgpt.webContents.loadURL('https://chatgpt.com');

  views.gemini = new WebContentsView({ webPreferences: commonPreferences });
  mainWindow.contentView.addChildView(views.gemini);
  views.gemini.webContents.loadURL('https://gemini.google.com/app');

  views.deepseek = new WebContentsView({ webPreferences: commonPreferences });
  mainWindow.contentView.addChildView(views.deepseek);
  views.deepseek.webContents.loadURL('https://chat.deepseek.com');

  views.claude = new WebContentsView({ webPreferences: commonPreferences });
  mainWindow.contentView.addChildView(views.claude);
  views.claude.webContents.loadURL('https://claude.ai');

  session.fromPartition('persist:cortex').webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];
    callback({ cancel: false, responseHeaders });
  });

  ipcMain.on('update-view-bounds', (event, { id, bounds }) => {
    const view = views[id];
    if (view && mainWindow) {
      mainWindow.contentView.addChildView(view);
      view.setBounds(bounds);
    }
  });

  ipcMain.on('hide-view', (event, id) => {
    const view = views[id];
    if (view && mainWindow) mainWindow.contentView.removeChildView(view);
  });

  ipcMain.on('send-prompt', (event, text, targets) => {
    targets.forEach((id: string) => { if (views[id]) views[id].webContents.send('inject-prompt', text); });
  });

  ipcMain.on('ai-response-ready', (event, data) => {
    if (mainWindow) mainWindow.webContents.send('ai-response-to-ui', data);
  });

  if (!app.isPackaged) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });