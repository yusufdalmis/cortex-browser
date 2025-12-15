import { contextBridge, ipcRenderer } from 'electron';

// --- METİN OKUYUCU ---
function getLastResponseText(source: string): string {
    let text = "";
    try {
        if (source === "chatgpt") {
            const msgs = document.querySelectorAll('.markdown');
            if (msgs.length) text = (msgs[msgs.length - 1] as HTMLElement).innerText;
        }
        else if (source === "gemini") {
            const parts = document.querySelectorAll('.model-response-text, message-content, [data-message-author-role="model"]');
            if (parts.length) text = (parts[parts.length - 1] as HTMLElement).innerText;
        }
        else if (source === "claude") {
            const msgs = document.querySelectorAll('.font-claude-message, [data-test-render-count]');
            if (msgs.length) text = (msgs[msgs.length - 1] as HTMLElement).innerText;
        }
        else if (source === "deepseek") {
            const msgs = document.querySelectorAll('.ds-markdown, .markdown');
            if (msgs.length) text = (msgs[msgs.length - 1] as HTMLElement).innerText;
        }
    }
    catch (e) {
        console.error(e);
    }
    return text.trim();
}

contextBridge.exposeInMainWorld('electronAPI', {
    updateViewBounds: (bounds: any) => ipcRenderer.send('update-view-bounds', bounds),
    hideView: (id: string) => ipcRenderer.send('hide-view', id),
    sendPrompt: (text: string, targets: string[]) => ipcRenderer.send('send-prompt', text, targets),
    onResponse: (callback: any) => ipcRenderer.on('ai-response-to-ui', (_event, data) => callback(data))
});

ipcRenderer.on('inject-prompt', (_event, text) => {
    let source = "AI";
    const href = window.location.href;
    if (href.includes('chatgpt')) source = "chatgpt";
    else if (href.includes('gemini')) source = "gemini";
    else if (href.includes('deepseek')) source = "deepseek";
    else if (href.includes('claude')) source = "claude";

    // Snapshot al
    const previousResponse = getLastResponseText(source);
    console.log(`Nexus: ${source} - Snapshot alındı.`);

    // Yaz ve Gönder
    const inputArea = document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('#prompt-textarea') ||
        document.querySelector('textarea');

    if (!inputArea) return;

    (inputArea as HTMLElement).focus();
    document.execCommand('insertText', false, text);
    inputArea.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
        const sendButton = document.querySelector('[data-testid="send-button"]') ||
            document.querySelector('button[aria-label="Send message"]') ||
            document.querySelector('button[aria-label="Send Message"]') || // Claude
            document.querySelector('.send-button');

        if (sendButton && !sendButton.hasAttribute('disabled')) {
            (sendButton as HTMLElement).click();
        }
        else {
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
            inputArea.dispatchEvent(enterEvent);
        }
        monitorResponse(source, previousResponse);
    }, 600);
});

// --- CLAUDE KORUMALI TAKİP MOTORU ---
function monitorResponse(source: string, oldTextSnapshot: string) {
    console.log(`Nexus: ${source} takibe alındı.`);
    
    // --- AYARLAR ---
    let checkIntervalTime = 500;
    let requiredStabilityTicks = 3;

    if (source === 'deepseek') {
        checkIntervalTime = 1000;
        requiredStabilityTicks = 4;
    }
    else if (source === 'claude') {
        checkIntervalTime = 800; // Biraz daha sık kontrol et
        requiredStabilityTicks = 5; // 5 * 800ms = 4 saniye sessizlik olmadan bitirme
    }

    let lastReadText = "";
    let stableCount = 0;
    let attempts = 0;
    let hasStartedChanging = false;

    const checkInterval = setInterval(() => {
        attempts++;
        if (attempts * checkIntervalTime > 300000) { // 5 dakika sınır
            clearInterval(checkInterval);
            return;
        }

        // --- 1. KESİN ENGELLEYİCİLER (BLOCKERS) ---
        // DeepSeek "Thinking"
        const isDeepSeekThinking = source === 'deepseek' && (document.body.innerText.includes('Thinking') ||
            !!document.querySelector('.ds-stop-button'));

        // Claude "Working/Stop" - KRİTİK KISIM
        const isClaudeBusy = source === 'claude' && (!!document.querySelector('button[aria-label="Stop generating"]') || // Ana durdur butonu
            !!document.querySelector('div[class*="loading"]') // Yükleniyor barları
        );

        if (isDeepSeekThinking || isClaudeBusy) {
            console.log(`Nexus: ${source} hala çalışıyor (Blocker Aktif)...`);
            stableCount = 0;
            hasStartedChanging = true; 
            return; 
        }

        // --- 2. METİN ANALİZİ ---
        const currentText = getLastResponseText(source);

        if (!hasStartedChanging) {
            // Gemini ve Claude için toleranslı başlangıç
            if (currentText !== oldTextSnapshot && currentText.length > oldTextSnapshot.length + 5) {
                hasStartedChanging = true;
                console.log(`Nexus: ${source} yazmaya başladı!`);
            }
            else {
                return;
            }
        }

        // --- 3. KARARLILIK TESTİ ---
        if (currentText === lastReadText && currentText.length > 0) {
            stableCount++;
            console.log(`Nexus: ${source} sabit. Sayaç: ${stableCount}/${requiredStabilityTicks}`);
            if (stableCount >= requiredStabilityTicks) {
                clearInterval(checkInterval);
                console.log(`Nexus: ${source} tamamlandı! Gönderiliyor.`);
                ipcRenderer.send('ai-response-ready', { source, text: currentText });
            }
        }
        else {
            stableCount = 0;
            lastReadText = currentText;
        }
    }, checkIntervalTime);
}