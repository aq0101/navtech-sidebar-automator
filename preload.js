const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

  ////// SETTINGS //////

  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: data => ipcRenderer.invoke("save-settings", data),

  ////// DOMAINS //////

  loadDomains: () => ipcRenderer.invoke("load-domains"),
  saveDomains: data => ipcRenderer.invoke("save-domains", data),

  ////// PROJECTS //////

  loadProjects: () => ipcRenderer.invoke("load-projects"),
  saveProjects: data => ipcRenderer.invoke("save-projects", data),
  retryFailed: id => ipcRenderer.invoke("retry-failed", id),

  ////// ENGINE //////

  startEngine: () => ipcRenderer.invoke("start-engine"),
  stopEngine: () => ipcRenderer.invoke("stop-engine"),

  ////// EDIT TOOL //////

  startEditRun: rows => ipcRenderer.invoke("edit-run", rows),
  stopEditRun: () => ipcRenderer.invoke("edit:stop"),
  resumeEditRun: () => ipcRenderer.invoke("edit:resume"),
  clearEditAll: () => ipcRenderer.invoke("edit:clearAll"),
  getEditState: () => ipcRenderer.invoke("edit:getState"),
  retryEditFailed: () => ipcRenderer.invoke("edit:retryFailed"),
  exportEdit: () => ipcRenderer.invoke("edit:getState"),
  removeEditRows: rows => ipcRenderer.invoke("edit:removeRows", rows),



////// REMOVE TOOL //////

startRemoveRun: rows => ipcRenderer.invoke("remove-run", rows),
stopRemoveRun: () => ipcRenderer.invoke("remove:stop"),
resumeRemoveRun: () => ipcRenderer.invoke("remove:resume"),
clearRemoveAll: () => ipcRenderer.invoke("remove:clearAll"),
getRemoveState: () => ipcRenderer.invoke("remove:getState"),
retryRemoveFailed: () => ipcRenderer.invoke("remove:retryFailed"),
exportRemove: () => ipcRenderer.invoke("remove:getState"),






 ////// EVENTS //////

onProjectsUpdated: cb =>
  ipcRenderer.on("projects-updated", cb),

onDomainsUpdated: cb =>
  ipcRenderer.on("domains-updated", cb),

onSettingsUpdated: cb =>
  ipcRenderer.on("settings-updated", cb),

// 🔥 CRITICAL — engine live updates
onEngineUpdate: cb => {
  ipcRenderer.on("engine:update", (_, data) => cb(data));
},


});
