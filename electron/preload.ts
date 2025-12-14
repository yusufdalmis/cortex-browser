import { contextBridge, ipcRenderer } from 'electron';

// --- GELİŞMİŞ DOM OKUYUCU (Düşünen Modeller İçin) ---
function getLastResponseText(source: string): string {
  let text = "";
  try {
    // --- CHATGPT ---
    if (source === "chatgpt") {
      // ChatGPT'nin tüm mesaj balonlarını bul
      const bubbles = document.querySelectorAll('div[data-message-author-role="assistant"]');
      if (bubbles.length > 0) {
        // En sonuncusunu al
        text = (bubbles[bubbles.length - 1] as HTMLElement).innerText;
      } else {
        // Yedek: Markdown sınıfları
        const markdowns = document.querySelectorAll('.markdown');
        if (markdowns.length) text = (markdowns[markdowns.length - 1] as HTMLElement).innerText;
      }
    } 
    
    // --- GEMINI ---
    else if (source === "gemini") {
      // Gemini'nin en geniş kapsayıcısı
      // 'model-response-text' bazen değişiyor, bu yüzden daha genel bir yapıya bakıyoruz
      const parts = document.querySelectorAll('message-content, .model-response-text, [data-test-id="model-response-text"]');
      if (parts.length > 0) {
         text = (parts[parts.length - 1] as HTMLElement).innerText;
      } else {
         // Eğer hiçbir şey bulamazsa, en son eklenen büyük metin bloğunu bulmaya çalış
         // Bu biraz riskli ama Gemini yapısını değiştirdiğinde hayat kurtarır
         const allTextBlocks = Array.from(document.querySelectorAll('div')).filter(div => 
            div.innerText.length > 50 && // Çok kısa olmasın
            !div.querySelector('div') // En alt çocuk olsun (içinde başka div olmasın)
         );
         if (allTextBlocks.length) text = allTextBlocks[allTextBlocks.length - 1].innerText;
      }
    } 
    
    // --- CLAUDE ---
    else if (source === "claude") {
      const msgs = document.querySelectorAll('.font-claude-message, [data-test-render-count]');
      if (msgs.length) text = (msgs[msgs.length - 1] as HTMLElement).innerText;
    }
    
    // --- DEEPSEEK ---
    else if (source === "deepseek") {
      const msgs = document.querySelectorAll('.ds-markdown, .markdown');
      if (msgs.length) text = (msgs[msgs.length - 1] as HTMLElement).innerText;
    }
  } catch (e) { 
    console.error("Metin okuma hatası:", e); 
  }
  return text ? text.trim() : "";
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

  // 1. Snapshot (Eski cevabı hafızaya al)
  const previousResponse = getLastResponseText(source);
  console.log(`Cortex: ${source} - Snapshot alındı (${previousResponse.length} kar.)`);

  // 2. Yaz ve Gönder
  const inputArea = 
    document.querySelector('div[contenteditable="true"]') || 
    document.querySelector('#prompt-textarea') || 
    document.querySelector('textarea');

  if (!inputArea) return;

  (inputArea as HTMLElement).focus();
  document.execCommand('insertText', false, text);
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));

  setTimeout(() => {
    const sendButton = 
      document.querySelector('[data-testid="send-button"]') || 
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Send Message"]') ||
      document.querySelector('.send-button');

    if (sendButton && !sendButton.hasAttribute('disabled')) {
      (sendButton as HTMLElement).click();
    } else {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
      inputArea.dispatchEvent(enterEvent);
    }
    
    // Takibi başlat
    monitorResponse(source, previousResponse);
  }, 800); // Tıklama gecikmesini biraz artırdık
});

// --- FİNAL TAKİP MEKANİZMASI ---
function monitorResponse(source: string, oldTextSnapshot: string) {
  console.log(`Cortex: ${source} izleniyor (Thinking Mode Uyumlu)...`);

  // --- AYARLAR ---
  // ChatGPT ve Gemini düşünürken çok bekletir, sabır süresini artırıyoruz
  let checkIntervalTime = 800; 
  let requiredStabilityTicks = 4; // 4 * 800ms = 3.2 saniye sessizlik şart

  let lastReadText = "";
  let stableCount = 0;
  let attempts = 0;
  let hasStartedChanging = false;

  const checkInterval = setInterval(() => {
    attempts++;
    // 5 dakika zaman aşımı (Düşünen modeller uzun sürer)
    if (attempts * checkIntervalTime > 300000) { 
      clearInterval(checkInterval);
      return;
    }

    // --- 1. KESİN ENGELLEYİCİLER (BLOCKERS) ---
    // Eğer ekranda hala "Durdur" butonu veya "Thinking" ibaresi varsa asla bitirme.
    
    // DeepSeek
    if (source === 'deepseek' && (document.body.innerText.includes('Thinking') || !!document.querySelector('.ds-stop-button'))) {
        stableCount = 0; hasStartedChanging = true; return; 
    }
    
    // Claude
    if (source === 'claude' && !!document.querySelector('button[aria-label="Stop generating"]')) {
        stableCount = 0; hasStartedChanging = true; return; 
    }

    // ChatGPT (Stop butonu varsa kesinlikle yazıyordur)
    if (source === 'chatgpt' && !!document.querySelector('[data-testid="stop-button"]')) {
        stableCount = 0; hasStartedChanging = true; return; 
    }

    // Gemini (Spinner veya Stop varsa)
    if (source === 'gemini' && (!!document.querySelector('.mat-mdc-progress-spinner') || !!document.querySelector('[aria-label="Stop generating"]'))) {
        stableCount = 0; hasStartedChanging = true; return; 
    }

    // --- 2. METİN ANALİZİ ---
    const currentText = getLastResponseText(source);

    // Başlangıç Kontrolü
    if (!hasStartedChanging) {
       // Metin değişti mi? (Eski snapshot'tan farklı mı?)
       // Not: Sadece uzunluk kontrolü değil, içerik kontrolü de yapıyoruz.
       if (currentText !== oldTextSnapshot && currentText.length > 0) {
           hasStartedChanging = true;
           console.log(`Cortex: ${source} yeni cevabı yazmaya başladı!`);
       } else {
           // Hala eski cevapta, bekle.
           return;
       }
    }

    // --- 3. KARARLILIK TESTİ ---
    if (currentText === lastReadText && currentText.length > 0) {
      stableCount++;
      console.log(`Cortex: ${source} sabit. Sayaç: ${stableCount}/${requiredStabilityTicks}`);
      
      if (stableCount >= requiredStabilityTicks) {
        clearInterval(checkInterval);
        console.log(`Cortex: ${source} tamamlandı! Gönderiliyor.`);
        ipcRenderer.send('ai-response-ready', { source, text: currentText });
      }
    } else {
      // Metin değişti
      stableCount = 0;
      lastReadText = currentText;
      console.log(`Cortex: ${source} yazıyor... (${currentText.length} karakter)`);
    }

  }, checkIntervalTime);
}