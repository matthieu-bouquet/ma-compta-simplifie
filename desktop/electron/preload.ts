import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('app', {
  /** Resolves to `app.getVersion()` from the packaged app or dev `desktop/package.json`. */
  getVersion: (): Promise<string> => ipcRenderer.invoke('desktop:getAppVersion'),
})

