/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    // BURAYI DİKKATLE İNCELE: Hem 'id' hem 'bounds' beklediğini belirtiyoruz.
    updateViewBounds: (arg: { id: string; bounds: { x: number; y: number; width: number; height: number } }) => void;
    
    hideView: (id: string) => void;
    sendPrompt: (text: string, targets: string[], imagePath?: string | null) => void;
    selectImage: () => Promise<string | null>;
    onResponse: (callback: (data: any) => void) => void;
    reloadView: (id: string) => void;
  };
}