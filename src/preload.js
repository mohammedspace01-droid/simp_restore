const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('simprestore', {
  selectBackup: () => ipcRenderer.invoke('dialog:backup'),
  selectLibrary: () => ipcRenderer.invoke('dialog:library'),
  getState: () => ipcRenderer.invoke('app:state'),
  processBackup: payload => ipcRenderer.invoke('backup:process', payload),
  loadLibrary: folder => ipcRenderer.invoke('library:load', folder),
  addLocalFolder: () => ipcRenderer.invoke('library:add-local-folder'),
  revealFolder: folder => ipcRenderer.invoke('folder:reveal', folder),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  onProgress: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('process:progress', listener);
    return () => ipcRenderer.removeListener('process:progress', listener);
  },
  onLocalScanProgress: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('local-scan:progress', listener);
    return () => ipcRenderer.removeListener('local-scan:progress', listener);
  }
});
