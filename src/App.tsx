import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

// Sıralamanın bozulmaması için sabit liste (DeepSeek/Claude hatasını çözer)
const ALL_AIS = ['chatgpt', 'gemini', 'deepseek', 'claude'];

function App() {
  // --- STATE ---
  const [activeAIs, setActiveAIs] = useState<Record<string, boolean>>({
    chatgpt: true,
    gemini: true,
    deepseek: true,
    claude: true
  });
  
  // Tüm cevapları burada tutacağız: { 'chatgpt': 'Cevap...', 'gemini': 'Cevap...' }
  const [responses, setResponses] = useState<Record<string, string>>({});
  
  // Hangi AI'nın cevabını görüntülüyoruz? (Örn: 'chatgpt')
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  
  const [prompt, setPrompt] = useState("");
  const viewRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Aktif olanların listesi (Sabit sıraya göre filtrelenmiş)
  const activeKeys = ALL_AIS.filter(key => activeAIs[key]);

  // --- LOGIC ---
  useEffect(() => {
    // 1. Resize Observer
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        const id = entry.target.id;
        if (rect.width === 0 || rect.height === 0) continue;

        (window as any).electronAPI?.updateViewBounds({
          id: id,
          bounds: {
            x: Math.round(rect.x), y: Math.round(rect.y),
            width: Math.round(rect.width), height: Math.round(rect.height)
          }
        });
      }
    });

    activeKeys.forEach(key => {
      const el = viewRefs.current[key];
      if (el) observer.observe(el);
    });

    // 2. Cevap Dinleyici
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onResponse((data: {source: string, text: string}) => {
        // Gelen cevabı listeye ekle
        const lowerSource = data.source.toLowerCase();
        setResponses(prev => ({ ...prev, [lowerSource]: data.text }));
        
        // Eğer şu an bir tab seçili değilse, cevap geleni seç
        setSelectedTab(prev => prev || lowerSource);
      });
    }

    return () => observer.disconnect();
  }, [activeAIs]); // Liste değişince observer'ı yenile

  // --- LAYOUT HESAPLAMA ---
  const getGridClass = () => {
    const count = activeKeys.length;
    if (count === 1) return "grid-cols-1 grid-rows-1";
    if (count === 2) return "grid-cols-2 grid-rows-1";
    if (count === 3) return "grid-cols-3 grid-rows-1"; // İSTEK: 1x3 Layout
    return "grid-cols-2 grid-rows-2"; // 4 tane ise 2x2
  };

  const handleSend = () => {
    if (!prompt || activeKeys.length === 0) return;
    // Yeni soru sorulunca eski cevapları temizle ama sekmeyi koru
    setResponses({});
    (window as any).electronAPI?.sendPrompt(prompt, activeKeys);
    setPrompt("");
  };

  const toggleAI = (key: string) => {
    const newState = !activeAIs[key];
    setActiveAIs(prev => ({ ...prev, [key]: newState }));
    
    // Kapatılıyorsa Electron'a bildir (RAM temizliği)
    if (!newState) {
      (window as any).electronAPI?.hideView(key);
      // Eğer kapanan tab açıksa, tab seçimini temizle
      if (selectedTab === key) setSelectedTab(null);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
      
      {/* SOL PANEL */}
      <div className="w-80 bg-gray-800 p-4 flex flex-col gap-4 border-r border-gray-700 z-50 shadow-2xl">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Cortex
        </h1>

        {/* AI SEÇİCİ */}
        <div className="bg-gray-700/50 p-3 rounded-xl border border-gray-600">
          <div className="grid grid-cols-2 gap-2">
            {ALL_AIS.map(key => (
              <label key={key} className={`
                flex items-center gap-2 p-2 rounded cursor-pointer transition-all border select-none
                ${activeAIs[key] 
                  ? 'bg-blue-600/20 border-blue-500/50 text-white' 
                  : 'bg-gray-800 border-transparent text-gray-500 hover:bg-gray-700'}
              `}>
                <input 
                  type="checkbox" 
                  checked={activeAIs[key]} 
                  onChange={() => toggleAI(key)}
                  className="hidden" 
                />
                <span className="capitalize text-sm font-medium">{key}</span>
              </label>
            ))}
          </div>
        </div>

        {/* INPUT */}
        <div className="flex flex-col gap-2">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            className="w-full h-24 bg-gray-900 text-white p-3 rounded-lg text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none"
            placeholder="Tüm zekalara sor..."
          />
          <button 
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white text-sm font-bold shadow-lg active:scale-95 transition-all"
          >
            GÖNDER 🚀
          </button>
        </div>

        {/* --- CEVAP GÖRÜNTÜLEME ALANI (TAB SİSTEMİ) --- */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
          
          {/* --- TAB BUTONLARI (GRID DÜZENİ - GÜNCELLENDİ) --- */}
          <div className="bg-gray-800 border-b border-gray-700 p-2">
            <div className="grid grid-cols-2 gap-2">
               {activeKeys.map(key => (
                 <button
                   key={key}
                   onClick={() => setSelectedTab(key)}
                   className={`
                     relative flex items-center justify-center gap-2 px-2 py-2 rounded-lg border transition-all
                     ${selectedTab === key 
                       ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                       : 'bg-gray-700/30 border-transparent text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'}
                   `}
                 >
                   {/* AI İsmi */}
                   <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                     {key}
                   </span>

                   {/* Cevap Geldi İndikatörü (Yeşil Işık) */}
                   {responses[key] && (
                     <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                     </span>
                   )}
                 </button>
               ))}
            </div>
          </div>

          {/* CEVAP İÇERİĞİ */}
          <div className="flex-1 p-3 overflow-y-auto relative">
             {selectedTab && responses[selectedTab] ? (
               <div className="text-xs prose prose-invert prose-p:my-1 prose-headings:my-2 max-w-none">
                 <div className="flex justify-end mb-2">
                    <button 
                      onClick={() => setPrompt(responses[selectedTab!])} 
                      className="text-[9px] bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
                    >
                      GİRDİYE KOPYALA
                    </button>
                 </div>
                 <ReactMarkdown>{responses[selectedTab]}</ReactMarkdown>
               </div>
             ) : (
               <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs italic p-4 text-center">
                 {selectedTab 
                   ? `${selectedTab} bekleniyor...` 
                   : "Cevabını görmek için yukarıdan bir AI seçin."}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* SAĞ PANEL (IZGARA) */}
      <div className={`flex-1 grid ${getGridClass()} bg-gray-800 gap-[1px]`}>
        {activeKeys.map(key => (
          <div 
            key={key}
            id={key}
            ref={el => { viewRefs.current[key] = el; }} // Ref Hatası Düzeltildi
            className="relative bg-black w-full h-full min-h-0 min-w-0"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 pointer-events-none">
              <span className="animate-pulse font-bold text-lg capitalize">{key}</span>
              <span className="text-xs">Bağlanıyor...</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;