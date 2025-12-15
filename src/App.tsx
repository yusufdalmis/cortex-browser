import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Bot, 
  Copy, 
  GitCompare, 
  Cpu, 
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Settings,
  Save,
  RotateCcw,
  Zap,
  Trash2,
  Plus,
  History, 
  Clock,   
  X,
  Share, // Zincirleme İkonu (Yeni)
  ArrowRightCircle // Yönlendirme Oku
} from 'lucide-react';

// Varsayılan Komutlar
const DEFAULT_COMMANDS = [
  { trigger: 'fix', text: 'Aşağıdaki kod bloğundaki hataları tespit et, düzelt ve nedenlerini açıkla:\n\n' },
  { trigger: 'refactor', text: 'Bu kodu Clean Code prensiplerine göre refactor et, daha okunabilir ve performanslı hale getir:\n\n' },
  { trigger: 'explain', text: 'Bu kodun tam olarak ne yaptığını adım adım, teknik olmayan bir dille açıkla:\n\n' },
  { trigger: 'unit-test', text: 'Aşağıdaki kod için kapsamlı Unit Test senaryoları yaz (Jest/Vitest kullanarak):\n\n' },
  { trigger: 'tr-en', text: 'Aşağıdaki metni profesyonel ve akademik bir İngilizceye çevir:\n\n' }
];

const DEFAULT_COMPARE_TEMPLATE = `Aşağıdaki yapay zeka yanıtlarını doğruluk, detay ve üslup açısından karşılaştır:

{{YANITLAR}}

Sonuç: Hangisi bu görev için daha iyiydi ve neden?`;

interface Command {
  trigger: string;
  text: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  prompt: string;
  responses: Record<string, string>;
  selectedAIs: string[];
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [selectedAIs, setSelectedAIs] = useState<string[]>(['chatgpt', 'gemini', 'deepseek', 'claude']);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chatgpt');

  // Modallar
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Zincirleme Menüsü (Hangi cevabın üzerinde açık?)
  const [chainMenuOpen, setChainMenuOpen] = useState(false);

  // Ayarlar & Geçmiş
  const [settingsTab, setSettingsTab] = useState<'general' | 'commands'>('general');
  const [compareTemplate, setCompareTemplate] = useState(DEFAULT_COMPARE_TEMPLATE);
  const [commands, setCommands] = useState<Command[]>(DEFAULT_COMMANDS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Slash Menü
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Komut Ekleme
  const [newCmdTrigger, setNewCmdTrigger] = useState("");
  const [newCmdText, setNewCmdText] = useState("");

  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  // Aktif oturum
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const ais = [
    { id: 'chatgpt', name: 'ChatGPT', color: 'bg-green-600', text: 'text-green-500', border: 'border-green-600' },
    { id: 'gemini', name: 'Gemini', color: 'bg-blue-600', text: 'text-blue-500', border: 'border-blue-600' },
    { id: 'deepseek', name: 'DeepSeek', color: 'bg-indigo-600', text: 'text-indigo-500', border: 'border-indigo-600' },
    { id: 'claude', name: 'Claude', color: 'bg-orange-600', text: 'text-orange-500', border: 'border-orange-600' },
  ];

  // --- YÜKLEME ---
  useEffect(() => {
    const savedTemplate = localStorage.getItem('cortex_compare_template');
    const savedCommands = localStorage.getItem('cortex_commands');
    const savedHistory = localStorage.getItem('cortex_history');
    
    if (savedTemplate) setCompareTemplate(savedTemplate);
    if (savedCommands) setCommands(JSON.parse(savedCommands));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // --- KAYDETME ---
  const saveSettings = () => {
    localStorage.setItem('cortex_compare_template', compareTemplate);
    localStorage.setItem('cortex_commands', JSON.stringify(commands));
    setIsSettingsOpen(false);
    alert("Ayarlar kaydedildi!");
  };

  useEffect(() => {
    localStorage.setItem('cortex_history', JSON.stringify(history));
  }, [history]);

  const resetSettings = () => {
    if(confirm("Sıfırlamak istediğinize emin misiniz?")) {
      setCompareTemplate(DEFAULT_COMPARE_TEMPLATE);
      setCommands(DEFAULT_COMMANDS);
      localStorage.removeItem('cortex_compare_template');
      localStorage.removeItem('cortex_commands');
    }
  };

  // --- ZİNCİRLEME FONKSİYONU (NEURAL LINK) ---
  const handleChain = (targetAiId: string) => {
    const sourceAiId = activeTab;
    const sourceText = responses[sourceAiId];
    const sourceName = ais.find(a => a.id === sourceAiId)?.name;

    if (!sourceText) return;

    // 1. Hedef AI'yı seç, diğerlerini kapat (Odaklanma Modu)
    setSelectedAIs([targetAiId]);

    // 2. Prompt'u hazırla
    const chainPrompt = `--- BAĞLAM: ${sourceName?.toUpperCase()} ÇIKTISI ---\n${sourceText}\n\n--- GÖREV ---\nYukarıdaki içeriği dikkate alarak şunları yap:\n`;
    setPrompt(chainPrompt);

    // 3. Menüyü kapat ve inputa odaklan
    setChainMenuOpen(false);
    promptInputRef.current?.focus();
    // İmleci en sona koyma, "GÖREV" kısmının altına koy ki kullanıcı hemen yazabilsin
    // (React state update sonrası manuel focus gerekebilir, basit tutuyoruz)
  };

  // --- GEÇMİŞ YÖNETİMİ ---
  const addToHistory = (currentPrompt: string, currentSelectedAIs: string[]) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      prompt: currentPrompt,
      selectedAIs: currentSelectedAIs,
      responses: {}
    };
    setHistory(prev => [newItem, ...prev]);
    return newItem.id;
  };

  const updateHistoryResponse = (historyId: string, source: string, text: string) => {
    setHistory(prev => prev.map(item => {
      if (item.id === historyId) {
        return {
          ...item,
          responses: { ...item.responses, [source]: text }
        };
      }
      return item;
    }));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const clearHistory = () => {
    if(confirm("Tüm geçmiş silinsin mi?")) setHistory([]);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setSelectedAIs(item.selectedAIs);
    setResponses(item.responses);
    setIsHistoryOpen(false);
    setIsSidebarOpen(true);
  };

  // --- SLASH KOMUTLARI ---
  const addCommand = () => {
    if(!newCmdTrigger || !newCmdText) return;
    const newCmd = { trigger: newCmdTrigger.replace('/', ''), text: newCmdText };
    setCommands([...commands, newCmd]);
    setNewCmdTrigger("");
    setNewCmdText("");
  };

  const deleteCommand = (index: number) => {
    const newCmds = [...commands];
    newCmds.splice(index, 1);
    setCommands(newCmds);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);
    const lastWord = val.split(/[\s\n]/).pop();

    if (lastWord && lastWord.startsWith('/')) {
      const filter = lastWord.substring(1).toLowerCase();
      setCommandFilter(filter);
      
      // --- YENİ EKLENEN KISIM: KONUM HESAPLAMA ---
      if (promptInputRef.current) {
        const rect = promptInputRef.current.getBoundingClientRect();
        // Menü, kutunun hemen altında (bottom) ve aynı genişlikte olsun
        setMenuPos({ 
            top: rect.bottom + 5, // Kutunun 5px altı
            left: rect.left,      // Kutunun sol hizası
            width: rect.width     // Kutu genişliği
        });
      }
      // -------------------------------------------
      
      setShowCommandMenu(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandMenu(false);
    }
  };

  const insertCommand = (cmd: Command) => {
    const words = prompt.split(/([\s\n])/);
    let lastWordIndex = -1;
    for (let i = words.length - 1; i >= 0; i--) {
        if (words[i].startsWith('/')) {
            lastWordIndex = i;
            break;
        }
    }
    if (lastWordIndex !== -1) {
        words[lastWordIndex] = cmd.text;
        setPrompt(words.join(''));
    } else {
        setPrompt(prompt + cmd.text);
    }
    setShowCommandMenu(false);
    promptInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandMenu) {
      const filteredCommands = commands.filter(c => c.trigger.toLowerCase().startsWith(commandFilter));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredCommands[selectedCommandIndex]) insertCommand(filteredCommands[selectedCommandIndex]);
      } else if (e.key === 'Escape') {
        setShowCommandMenu(false);
      }
    }
  };

  // --- GENEL UI ---
  const toggleAI = (id: string) => {
    setSelectedAIs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getGridClass = () => {
    const count = selectedAIs.length;
    switch (count) {
      case 1: return 'grid-cols-1 grid-rows-1';
      case 2: return 'grid-cols-2 grid-rows-1';
      case 3: return 'grid-cols-3 grid-rows-1';
      default: return 'grid-cols-2 grid-rows-2';
    }
  };

  const handleSend = () => {
    if (!prompt.trim() || selectedAIs.length === 0) return;
    const newResponses = { ...responses };
    selectedAIs.forEach(id => newResponses[id] = ""); 
    setResponses(newResponses);
    const newId = addToHistory(prompt, selectedAIs);
    setCurrentSessionId(newId);
    window.electronAPI.sendPrompt(prompt, selectedAIs);
  };

  const handleCopyToPrompt = (text: string) => {
    setPrompt(text);
    navigator.clipboard.writeText(text);
    setCopyFeedback("Kopyalandı!");
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCompareResponses = () => {
    const activeResponses = Object.entries(responses).filter(([id, text]) => selectedAIs.includes(id) && text && text.trim().length > 0);
    if (activeResponses.length < 2) {
      alert("Karşılaştırma için en az 2 aktif yanıt lazım.");
      return;
    }
    let allResponsesText = "";
    activeResponses.forEach(([source, text]) => {
      allResponsesText += `--- ${source.toUpperCase()} ---\n${text}\n\n`;
    });
    let finalPrompt = compareTemplate.replace('{{YANITLAR}}', allResponsesText);
    if (!compareTemplate.includes('{{YANITLAR}}')) finalPrompt = compareTemplate + "\n\n" + allResponsesText;
    setPrompt(finalPrompt);
    setIsSidebarOpen(true);
  };

  useEffect(() => {
    window.electronAPI.onResponse((data: { source: string, text: string }) => {
      setResponses(prev => ({ ...prev, [data.source]: data.text }));
      setActiveTab(data.source);
      if (currentSessionId) updateHistoryResponse(currentSessionId, data.source, data.text);
    });
  }, [currentSessionId]);

  useEffect(() => {
    const updateBounds = () => {
      if (isSettingsOpen || isHistoryOpen) {
        ais.forEach(ai => window.electronAPI.hideView(ai.id));
        return; 
      }
      ais.forEach((ai) => {
        if (selectedAIs.includes(ai.id)) {
          const element = containerRefs.current[ai.id];
          if (element) {
            const bounds = element.getBoundingClientRect();
            window.electronAPI.updateViewBounds({
              id: ai.id,
              bounds: {
                x: Math.round(bounds.x),
                y: Math.round(bounds.y),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height)
              }
            });
          }
        } else {
          window.electronAPI.hideView(ai.id);
        }
      });
    };
    setTimeout(updateBounds, 150);
    const resizeObserver = new ResizeObserver(updateBounds);
    Object.values(containerRefs.current).forEach(el => {
      if (el) resizeObserver.observe(el);
    });
    window.addEventListener('resize', updateBounds);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [isSidebarOpen, selectedAIs, isSettingsOpen, isHistoryOpen]);

  const filteredCommands = commands.filter(c => c.trigger.toLowerCase().startsWith(commandFilter));

  return (
    // 1. DÜZELTME: pt-12 eklendi (Üst barın altında kalmasın diye)
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans relative">
      
      {/* --- AYARLAR --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-800 border border-gray-600 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg text-cyan-400"><Settings size={24} /></div>
                <h2 className="text-xl font-bold text-white">Cortex Ayarları</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex border-b border-gray-700">
                <button onClick={() => setSettingsTab('general')} className={`flex-1 py-3 text-sm font-bold ${settingsTab === 'general' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Genel Ayarlar</button>
                <button onClick={() => setSettingsTab('commands')} className={`flex-1 py-3 text-sm font-bold ${settingsTab === 'commands' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Hızlı Komutlar (/)</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {settingsTab === 'general' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-cyan-400 uppercase">Karşılaştırma Prompt Şablonu</label>
                    <p className="text-xs text-gray-400 mb-2"><span className="text-yellow-400">{'{{YANITLAR}}'}</span> etiketi yerine cevaplar gelecektir.</p>
                    <textarea value={compareTemplate} onChange={(e) => setCompareTemplate(e.target.value)} className="w-full h-48 bg-gray-900 border border-gray-600 rounded-xl p-4 text-sm text-gray-300 focus:border-cyan-500 outline-none resize-none font-mono"/>
                  </div>
                </div>
              )}
              {settingsTab === 'commands' && (
                <div className="space-y-4">
                   <div className="flex gap-2 items-start bg-gray-900/50 p-3 rounded-xl border border-gray-700">
                     <div className="flex flex-col gap-2 flex-1">
                         <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-bold">/</span>
                             <input type="text" placeholder="tetikleyici (örn: fix)" value={newCmdTrigger} onChange={(e) => setNewCmdTrigger(e.target.value)} className="bg-transparent border-b border-gray-600 focus:border-cyan-500 outline-none text-white text-sm w-full py-1"/>
                         </div>
                         <textarea placeholder="Komut metni..." value={newCmdText} onChange={(e) => setNewCmdText(e.target.value)} className="bg-gray-800 text-gray-300 text-xs p-2 rounded border border-gray-700 outline-none resize-none h-16"/>
                     </div>
                      <button onClick={addCommand} className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white mt-1"><Plus size={20} /></button>
                   </div>
                   <div className="space-y-2">
                      {commands.map((cmd, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg border border-gray-700 group hover:border-gray-500 transition-colors">
                           <div><span className="text-cyan-400 font-bold mr-2">/{cmd.trigger}</span><span className="text-gray-400 text-xs truncate max-w-[200px] inline-block align-bottom">{cmd.text.substring(0, 50)}...</span></div>
                           <button onClick={() => deleteCommand(idx)} className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-700 bg-gray-800/50 rounded-b-2xl flex justify-between items-center">
              <button onClick={resetSettings} className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"><RotateCcw size={16} /> Varsayılana Dön</button>
              <button onClick={saveSettings} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg"><Save size={18} /> Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* --- GEÇMİŞ MODAL --- */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-800 border border-gray-600 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[80vh]">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg text-orange-400"><History size={24} /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">Sohbet Geçmişi</h2>
                  <p className="text-xs text-gray-400">{history.length} kayıt</p>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={clearHistory} className="flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-900/20 rounded-lg text-sm transition-colors border border-transparent hover:border-red-900"><Trash2 size={14} /> Tümünü Sil</button>
                 <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-white p-1"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50"><History size={64} className="mb-4" /><p>Geçmiş boş.</p></div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} onClick={() => loadHistoryItem(item)} className="group bg-gray-700/30 border border-gray-700 hover:border-cyan-500/50 hover:bg-gray-700/50 rounded-xl p-4 cursor-pointer transition-all duration-200">
                      <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock size={12} /><span>{new Date(item.timestamp).toLocaleString('tr-TR')}</span>
                            <div className="flex gap-1 ml-2">{item.selectedAIs.map(ai => (<span key={ai} className={`w-2 h-2 rounded-full ${ais.find(a=>a.id===ai)?.color}`}></span>))}</div>
                         </div>
                         <button onClick={(e) => deleteHistoryItem(item.id, e)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={14} /></button>
                      </div>
                      <p className="text-sm text-gray-200 line-clamp-2 font-medium">{item.prompt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div className={`${isSidebarOpen ? 'w-[400px]' : 'w-20'} bg-gray-800 flex flex-col border-r border-gray-700 transition-all duration-300 ease-in-out relative flex-shrink-0 z-50 shadow-2xl`}>
        <div className={`p-4 border-b border-gray-700 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} h-16`}>
           {isSidebarOpen ? (
             <>
               <div className="flex items-center gap-2">
                  <Cpu className="text-cyan-400 animate-pulse" />
                  <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600 tracking-widest">CORTEX</h1>
               </div>
               <div className="flex gap-1">
                 {/* YENİ EKLENEN: YENİLEME BUTONU */}
                 <button onClick={() => window.electronAPI.reloadView(activeTab)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400 transition-colors" title="Sayfayı Yenile">
                    <RotateCcw size={20} />
                 </button>
                 
                 <button onClick={() => setIsHistoryOpen(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-orange-400 transition-colors" title="Geçmiş"><History size={20} /></button>
                 <button onClick={() => setIsSettingsOpen(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-cyan-400 transition-colors" title="Ayarlar"><Settings size={20} /></button>
                 <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"><PanelLeftClose size={20} /></button>
               </div>
             </>
           ) : (
             // Kapalıyken de logoya basınca yenilesin mi? İsteğe bağlı, şimdilik menü açma olarak kalsın.
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-700 rounded-lg text-cyan-400 hover:bg-cyan-900/30 transition-all shadow-lg"><Cpu size={24} /></button>
           )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!isSidebarOpen && (
            <div className="flex flex-col items-center gap-4 py-6 w-full overflow-y-auto custom-scrollbar">
              {ais.map((ai) => (
                <button key={ai.id} onClick={() => toggleAI(ai.id)} title={ai.name} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${selectedAIs.includes(ai.id) ? `${ai.color} text-white shadow-lg scale-110` : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}><Bot size={18} /></button>
              ))}
              <div className="w-8 h-px bg-gray-700 my-2"></div>
              <button onClick={() => setIsHistoryOpen(true)} className="p-2 text-gray-400 hover:text-orange-400 transition-colors"><History size={20} /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"><Settings size={20} /></button>
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white"><PanelLeftOpen size={20} /></button>
            </div>
          )}

          {isSidebarOpen && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-5 overflow-y-auto custom-scrollbar flex-shrink-0 max-h-[50%]">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {ais.map((ai) => (
                    <button key={ai.id} onClick={() => toggleAI(ai.id)} className={`p-2 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2 ${selectedAIs.includes(ai.id) ? `${ai.color} border-transparent text-white shadow-lg scale-105` : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 opacity-60'}`}>{ai.name}</button>
                  ))}
                </div>

                <div className="relative mb-3">
                  {/* 3. DÜZELTME: SLASH MENÜSÜ AŞAĞI AÇILIYOR (top-full mt-2) */}
                  {showCommandMenu && filteredCommands.length > 0 && (
                     <div 
                        className="fixed bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        style={{ 
                            top: menuPos.top, 
                            left: menuPos.left, 
                            width: menuPos.width,
                            maxHeight: '300px' // Çok uzarsa kendi içinde scroll olsun
                        }}
                     >
                        <div className="p-2 text-xs text-gray-500 font-bold bg-gray-900/50 border-b border-gray-700 flex items-center gap-1">
                            <Zap size={12} className="text-yellow-400" /> HIZLI KOMUTLAR
                        </div>
                        <div className="flex flex-col max-h-60 overflow-y-auto custom-scrollbar"> 
                            {filteredCommands.map((cmd, idx) => (
                               <button 
                                  key={idx} 
                                  onClick={() => insertCommand(cmd)} 
                                  className={`w-full text-left px-3 py-3 text-sm flex flex-col gap-1 transition-colors border-b border-gray-700/50 last:border-0 ${idx === selectedCommandIndex ? 'bg-cyan-900/50 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                >
                                    <span className="font-bold text-cyan-400 flex items-center gap-2">
                                        /{cmd.trigger}
                                        {idx === selectedCommandIndex && <span className="text-[10px] bg-cyan-500 text-black px-1 rounded font-bold">ENTER</span>}
                                    </span>
                                    <span className="opacity-70 text-xs line-clamp-1">{cmd.text}</span>
                               </button>
                            ))}
                        </div>
                     </div>
                  )}
                  <textarea ref={promptInputRef} value={prompt} onChange={handlePromptChange} onKeyDown={handleKeyDown} placeholder="Tüm zekalara sor... (Komutlar için / yazın)" className="w-full h-24 bg-gray-900/50 border border-gray-600 rounded-xl p-3 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none transition-all placeholder-gray-500" />
                  {copyFeedback && <div className="absolute top-2 right-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1"><CheckCheck size={12}/> {copyFeedback}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleSend} disabled={!prompt || selectedAIs.length === 0} className="py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Send size={16} /> GÖNDER</button>
                  <button onClick={handleCompareResponses} className="py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg font-medium text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2"><GitCompare size={16} /> Karşılaştır</button>
                </div>
              </div>

              {/* YANIT PANELİ */}
              <div className="flex-1 flex flex-col border-t border-gray-700 bg-gray-800/50 overflow-hidden relative">
                <div className="flex border-b border-gray-700 overflow-x-auto custom-scrollbar bg-gray-900/30">
                  {ais.map(ai => (
                    <button key={ai.id} onClick={() => setActiveTab(ai.id)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 min-w-[80px] ${activeTab === ai.id ? `text-white border-b-2 ${ai.border} bg-gray-800` : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>
                      <span className={`w-2 h-2 rounded-full ${responses[ai.id] ? ai.color : 'bg-gray-600'}`}></span>
                      {ai.name}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-900/50 relative">
                  {responses[activeTab] ? (
                    <div className="text-sm text-gray-300 space-y-2">
                      <div className="flex justify-between items-start mb-2 opacity-50 relative">
                        <span className="text-xs uppercase text-cyan-500 font-bold">{ais.find(a=>a.id===activeTab)?.name} Yanıtı:</span>
                        <div className="flex gap-2">
                           <button onClick={() => setChainMenuOpen(!chainMenuOpen)} className="hover:text-cyan-400" title="Zincirleme (Neural Link)"><Share size={14} /></button>
                           <button onClick={() => handleCopyToPrompt(responses[activeTab])} title="Kopyala"><Copy size={14} className="hover:text-white"/></button>
                        </div>
                        {/* ZİNCİRLEME MENÜSÜ */}
                        {chainMenuOpen && (
                          <div className="absolute right-0 top-6 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 p-2 w-48 animate-in fade-in zoom-in duration-100">
                             <div className="text-[10px] font-bold text-gray-500 mb-2 uppercase px-1">Şuna Yönlendir:</div>
                             {ais.filter(a => a.id !== activeTab).map(ai => (
                               <button 
                                  key={ai.id} 
                                  onClick={() => handleChain(ai.id)}
                                  className="w-full text-left flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded text-xs text-gray-300 hover:text-white transition-colors"
                               >
                                  <ArrowRightCircle size={12} className={ai.text.replace('text-', 'text-')} />
                                  {ai.name}
                               </button>
                             ))}
                          </div>
                        )}
                      </div>
                      <ReactMarkdown>{responses[activeTab]}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50">
                      <MessageSquare size={32} />
                      <span className="text-xs text-center px-4">Cevabını görmek için yukarıdan bir AI seçin.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-black">
        <div className={`grid w-full h-full ${getGridClass()}`}>
          {ais.filter(ai => selectedAIs.includes(ai.id)).map((ai) => (
            <div key={ai.id} ref={(el) => (containerRefs.current[ai.id] = el)} className="relative border border-gray-800 group bg-gray-900/50">
              <div className="absolute inset-0 flex items-center justify-center text-gray-700 font-mono text-sm pointer-events-none">
                <div className="flex flex-col items-center gap-2 opacity-30"><Bot size={32} /><span>{ai.name}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;