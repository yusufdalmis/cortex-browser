import { app, BrowserWindow, WebContentsView, ipcMain, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
const views: Record<string, WebContentsView> = {};

const commonPreferences = {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    partition: 'persist:nexus'
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: { ...commonPreferences },
        backgroundColor: '#111827' // React arka plan rengi
    });

    // --- AI MOTORLARINI BAŞLAT ---
    // 1. ChatGPT
    views.chatgpt = new WebContentsView({ webPreferences: commonPreferences });
    views.chatgpt.webContents.loadURL('https://chatgpt.com');

    // 2. Gemini
    views.gemini = new WebContentsView({ webPreferences: commonPreferences });
    views.gemini.webContents.loadURL('https://gemini.google.com/app');

    // 3. DeepSeek
    views.deepseek = new WebContentsView({ webPreferences: commonPreferences });
    views.deepseek.webContents.loadURL('https://chat.deepseek.com');

    // 4. Claude
    views.claude = new WebContentsView({ webPreferences: commonPreferences });
    views.claude.webContents.loadURL('https://claude.ai');

    // --- Header Temizliği (X-Frame Options Engeli Kaldırma) ---
    session.fromPartition('persist:nexus').webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
        
        // Zararlı headerları sil
        const keysToDelete = [];
        for (const key in responseHeaders) {
            if (key.toLowerCase() === 'x-frame-options' || key.toLowerCase() === 'content-security-policy') {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => delete responseHeaders[key]);

        callback({ cancel: false, responseHeaders });
    });

    // --- GÖRÜNÜM YÖNETİMİ ---
    ipcMain.on('update-view-bounds', (event, { id, bounds }) => {
        const view = views[id];
        if (view && mainWindow) {
            try {
                mainWindow.contentView.addChildView(view);
            } catch (e) {
                // Zaten ekli hatası önemsiz
            }
            view.setBounds(bounds);
        }
    });

    ipcMain.on('hide-view', (event, id) => {
        const view = views[id];
        if (view && mainWindow) {
            mainWindow.contentView.removeChildView(view);
        }
    });

    // --- ORKESTRASYON ---
    ipcMain.on('send-prompt', (event, text, targets) => {
        console.log(`Prompt gönderiliyor: ${targets.join(', ')}`);
        targets.forEach((id: string) => {
            if (views[id]) {
                views[id].webContents.send('inject-prompt', text);
            }
        });
    });

    ipcMain.on('ai-response-ready', (event, { source, text }) => {
        if (mainWindow) {
            mainWindow.webContents.send('ai-response-to-ui', { source, text });
        }
    });

    // Geliştirme Ortamı Kontrolü
    if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        // İsteğe bağlı: Konsolu otomatik açmak isterseniz yorumu kaldırın:
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // Paketlenmişse (EXE olduysa) dosyadan oku
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});