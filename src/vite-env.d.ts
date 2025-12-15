/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    updateViewBounds: (bounds: any) => void;
    hideView: (id: string) => void;
    sendPrompt: (text: string, targets: string[]) => void;
    onResponse: (callback: (data: any) => void) => void;
  }
}