import { contextBridge, ipcRenderer } from 'electron';

// --- 1. HEDEF ELEMENT BULUCULAR ---
function getLatestAIResponseElement(source: string): HTMLElement | null {
  try {
    if (source === 'chatgpt') {
      const assistants = document.querySelectorAll('div[data-message-author-role="assistant"]');
      if (assistants.length > 0) return assistants[assistants.length - 1] as HTMLElement;
    } 
    else if (source === 'gemini') {
      // Gemini'de metni barındıran asıl içerik
      const responses = document.querySelectorAll('.model-response-text, message-content');
      if (responses.length > 0) return responses[responses.length - 1] as HTMLElement;
    } 
    else if (source === 'deepseek') {
      const responses = document.querySelectorAll('.ds-markdown, .markdown');
      if (responses.length > 0) return responses[responses.length - 1] as HTMLElement;
    }
    else if (source === 'claude') {
      const responses = document.querySelectorAll('.font-claude-message');
      if (responses.length > 0) return responses[responses.length - 1] as HTMLElement;
    }
  } catch (e) { console.error(e); }
  return null;
}

// --- 2. DURUM ANALİZİ ---
interface AIState {
  isBusy: boolean;
  isComplete: boolean;
  text: string;
}

function getAIState(source: string): AIState {
  let isBusy = false;
  let isComplete = false;
  const element = getLatestAIResponseElement(source);
  const text = element ? element.innerText.trim() : "";

  try {
    // --- CHATGPT ---
    if (source === 'chatgpt') {
      isBusy = !!document.querySelector('[data-testid="stop-button"]') || !!document.querySelector('.result-streaming');
      if (element) {
         const container = element.closest('.text-token-text-primary') || element.parentElement;
         if (container) {
             const actionBtns = container.querySelectorAll('button[aria-label]');
             // Sadece bu mesaja ait butonlara bak
             for (let i = 0; i < actionBtns.length; i++) {
                 const label = actionBtns[i].getAttribute('aria-label') || "";
                 if (label.includes("Good response") || label.includes("Bad response") || label.includes("Copy") || label.includes("Regenerate")) {
                     if (!isBusy) isComplete = true;
                     break;
                 }
             }
         }
      }
    }

    // --- GEMINI (DÜZELTİLEN KISIM) ---
    else if (source === 'gemini') {
      // 1. Genel Meşguliyet
      const stopBtn = document.querySelector('[aria-label="Stop generating"]') || document.querySelector('[aria-label="Yanıtı durdur"]');
      const spinner = document.querySelector('.mat-mdc-progress-spinner');
      isBusy = !!stopBtn || !!spinner;

      // 2. Buton Kontrolü (ARTIK SCOPED - Sadece son mesaja bakıyor)
      if (element) {
          // Gemini'de butonlar genellikle metin kutusunun ebeveyninin kardeşidir veya altındadır.
          // En garantisi: Elementin ebeveynlerine çıkıp, o bölgedeki butonları aramak.
          const parentContainer = element.closest('user-query-response-item') || element.parentElement?.parentElement;
          
          if (parentContainer) {
              // Bu kapsayıcı içindeki butonları ara
              const likeBtn = parentContainer.querySelector('[aria-label="Good response"], [aria-label="İyi yanıt"]');
              const dislikeBtn = parentContainer.querySelector('[aria-label="Bad response"], [aria-label="Kötü yanıt"]');
              const shareBtn = parentContainer.querySelector('[aria-label="Share response"], [aria-label="Yanıtı paylaş"]');
              const modifyBtn = parentContainer.querySelector('[aria-label="Modify response"], [aria-label="Yanıtı değiştir"]');
              const copyBtn = parentContainer.querySelector('[aria-label="Copy"], [aria-label="Kopyala"]'); // Bazen menüde olur

              if ((likeBtn || dislikeBtn || shareBtn || modifyBtn || copyBtn) && !isBusy) {
                  isComplete = true;
              }
          }
      }
      
      // Yedek Plan: Butonlar yoksa ama spinner da yoksa ve metin uzunsa
      if (!isComplete && !isBusy && text.length > 10) {
          // Gemini'de butonlar bazen DOM'a geç eklenir, o yüzden metin uzunluğuna da güvenebiliriz.
          // Ancak bunu sadece "Strict" modda değil, normal akışta kullanacağız.
          // Şimdilik isComplete'i false bırakıp stability check'e güvenmek daha sağlıklı.
      }
    }

    // --- DEEPSEEK ---
    else if (source === 'deepseek') {
      isBusy = !!document.querySelector('.ds-stop-button') || document.body.innerText.includes('Thinking');
      if (element && element.parentElement) {
        const hasIcon = element.parentElement.querySelector('.ds-icon-thumb-up') || element.parentElement.querySelector('.ds-icon-refresh');
        if (hasIcon && !isBusy) isComplete = true;
      }
    }

    // --- CLAUDE ---
    else if (source === 'claude') {
      isBusy = !!document.querySelector('button[aria-label="Stop generating"]');
      if (element) {
         const container = element.parentElement?.parentElement; 
         if (container) {
             const btns = container.querySelectorAll('button');
             for(let i=0; i<btns.length; i++) {
                 const label = btns[i].getAttribute('aria-label') || "";
                 if((label.includes("Copy") || label.includes("Retry") || label.includes("Thumbs")) && !isBusy) {
                     isComplete = true;
                     break;
                 }
             }
         }
      }
    }

  } catch (e) { console.error("AI State Hatası:", e); }

  return { isBusy, isComplete, text };
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

  // Snapshot
  const initialElement = getLatestAIResponseElement(source);
  const initialText = initialElement ? initialElement.innerText.trim() : "";

  // Gönderim
  const inputArea = document.querySelector('div[contenteditable="true"]') || document.querySelector('#prompt-textarea') || document.querySelector('textarea');
  if (!inputArea) return;

  (inputArea as HTMLElement).focus();
  document.execCommand('insertText', false, text);
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));

  setTimeout(() => {
    const sendButton = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label="Send message"]') || document.querySelector('.send-button');
    if (sendButton && !sendButton.hasAttribute('disabled')) { (sendButton as HTMLElement).click(); } 
    else { inputArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }
    
    // 2. Soru Sendromu için Bekleme
    setTimeout(() => { monitorResponse(source, initialText); }, 2000);
  }, 500);
});

function monitorResponse(source: string, oldTextSnapshot: string) {
  let checkIntervalTime = 1000; 
  let stabilityCounter = 0;
  let timeoutCounter = 0;

  const checkInterval = setInterval(() => {
    timeoutCounter++;
    if (timeoutCounter > 300) { clearInterval(checkInterval); return; }

    const state = getAIState(source);

    // 1. MEŞGUL İSE BEKLE
    if (state.isBusy) {
        stabilityCounter = 0;
        console.log(`Nexus: ${source} meşgul...`);
        return; 
    }

    // 2. YENİ CEVAP ALGILANDI MI?
    const isTextNew = state.text !== oldTextSnapshot && state.text.length > 0;
    
    if (isTextNew) {
        // A) BUTONLAR ÇIKTI MI? (Kesin Bitiş)
        if (state.isComplete) {
             clearInterval(checkInterval);
             console.log(`Nexus: ${source} - Action Butonları ile Bitti.`);
             ipcRenderer.send('ai-response-ready', { source, text: state.text });
             return;
        }

        // B) METİN DURDU MU? (Yedek Kontrol)
        stabilityCounter++;
        console.log(`Nexus: ${source} sabit (${stabilityCounter}/3)`);

        if (stabilityCounter >= 3) {
             clearInterval(checkInterval);
             console.log(`Nexus: ${source} - Süre ile Bitti.`);
             ipcRenderer.send('ai-response-ready', { source, text: state.text });
        }
    } else {
        // Metin değişmediyse (Hala eski cevap duruyorsa veya yeni cevap boşsa)
        stabilityCounter = 0;
        console.log(`Nexus: ${source} bekleniyor...`);
    }
  }, checkIntervalTime);
}