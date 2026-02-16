const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { Worker } = require("worker_threads");

const { clearRemoveState } = require("./logic/engine");

const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
const DOMAINS_FILE = path.join(__dirname, "data", "domains.json");
const PROJECTS_FILE = path.join(__dirname, "data", "projects.json");

let mainWindow;
let engineWorker = null;
global.editRun = null;
global.removeRun = null;
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, "app", "build", "icon.ico")
  : path.join(__dirname, "build", "icon.icns");


// 🔁 RESTORE EDIT RUN AFTER APP RESTART
const EDIT_FILE = path.join(__dirname, "data", "edit-run.json");


 if (fs.existsSync(EDIT_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(EDIT_FILE, "utf-8"));

    if (saved && saved.rows) {

      saved.rows.forEach(r => {

        // 🟢 SUCCESS must stay forever
        if (r.status === "Success") {
          r.message = r.message || "Done";
          return;
        }

        // if app closed while running
        if (r.status === "Running") {
          r.status = "Stopped";
          r.message = "Stopped (app closed)";
          return;
        }

        // keep stopped as stopped
        if (r.status === "Stopped") {
          r.message = r.message || "Stopped";
          return;
        }

      });

    }

    saved.running = false;
    global.editRun = saved;

    // 🔥 CRITICAL: re-save corrected state
    fs.writeFileSync(EDIT_FILE, JSON.stringify(saved, null, 2));

  } catch {}
}

// 🔁 RESTORE REMOVE RUN AFTER APP RESTART
const REMOVE_FILE = path.join(__dirname, "data", "remove-run.json");

if (fs.existsSync(REMOVE_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(REMOVE_FILE, "utf-8"));

    if (saved && saved.rows) {

      saved.rows.forEach(r => {

        // keep success untouched
        if (r.status === "Success") {
          r.message = r.message || "Done";
          return;
        }

        // if app closed mid-run
        if (r.status === "Running" || r.status === "Pending") {
          r.status = "Stopped";
          r.message = "Stopped (app closed)";
          return;
        }

        if (r.status === "Stopped") {
          r.message = r.message || "Stopped";
        }

      });

    }

    saved.running = false;
    global.removeRun = saved;

    // ensure disk reflects corrected state
    fs.writeFileSync(REMOVE_FILE, JSON.stringify(saved, null, 2));

  } catch {}
}



function attachWorkerEvents(worker) {

  worker.on("message", msg => {

    // worker finished
    

    // 🔥 LIVE UI UPDATE
if (msg.type === "update") {

  BrowserWindow.getAllWindows().forEach(win => {

    // send edit updates
    if (msg.editRun) {
      win.webContents.send("engine:update", {
        mode: "edit",
        ...msg.editRun
      });
    }

    // send remove updates
    if (msg.removeRun) {
      win.webContents.send("engine:update", {
        mode: "remove",
        ...msg.removeRun
      });
    }

  });

}
    
  });

  worker.on("exit", () => {
    engineWorker = null;
  });
}


function createWindow() {
  Menu.setApplicationMenu(null);
app.commandLine.appendSwitch("disk-cache-size", "0");
app.commandLine.appendSwitch("disable-http-cache");


  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));
  

  mainWindow.on("minimize", () => {
    console.log("window minimized");
  });

  mainWindow.on("show", () => {
    if (mainWindow.isMinimized()) mainWindow.restore();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();

    mainWindow.focus();
  });
});

app.on("window-all-closed", () => {});

/* =========================
   ENGINE WORKER CONTROL
========================= */

function stopEngineWorker() {
  if (!engineWorker) return;

  try {
    engineWorker.postMessage({ type: "stop" });
  } catch {}

  try {
    engineWorker.terminate();
  } catch {}

  engineWorker = null;
}


function notifyAll(channel) {
  BrowserWindow.getAllWindows().forEach(w => {
    w.webContents.send(channel);
  });
}

/* ================= SETTINGS ================= */

ipcMain.handle("get-settings", async () => {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
});

ipcMain.handle("save-settings", async (e, data) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  notifyAll("settings-updated");
  return { success: true };
});

/* ================= DOMAINS ================= */

ipcMain.handle("load-domains", async () => {
  if (!fs.existsSync(DOMAINS_FILE)) return {};
  return JSON.parse(fs.readFileSync(DOMAINS_FILE, "utf-8"));
});

ipcMain.handle("save-domains", async (e, data) => {
  fs.writeFileSync(DOMAINS_FILE, JSON.stringify(data, null, 2));
  notifyAll("domains-updated");
  return { success: true };
});

/* ================= PROJECTS ================= */

ipcMain.handle("load-projects", async () => {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
});

ipcMain.handle("save-projects", async (e, data) => {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
  notifyAll("projects-updated");
  return { success: true };
});

/* ================= ENGINE ================= */

ipcMain.handle("start-engine", async () => {

  // if old worker stuck → kill it
  if (engineWorker) {
    try {
      engineWorker.terminate();
    } catch {}
    engineWorker = null;
  }

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "startProject"
  });

  return true;
});



ipcMain.handle("stop-engine", async () => {
  stopEngineWorker();
});

/* ================= EDIT TOOL ================= */

ipcMain.handle("edit-run", async (_, rows) => {
console.log("MAIN RECEIVED EDIT RUN", rows.length);
  // always kill old worker
  if (engineWorker) {
    try { engineWorker.terminate(); } catch {}
    engineWorker = null;
  }


  // wipe remove memory
  global.removeRun = null;

  
const runState = {
  rows,
  index: 0,
  running: true,
  mode: "edit",
  domainSet: rows[0]?.domainSetName || "default"
};

  global.editRun = runState;

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "editRun",
    data: runState
  });

  return { success: true };
});


ipcMain.handle("edit:getState", () => {
  return global.editRun;
});

ipcMain.handle("edit:stop", () => {
  if (!global.editRun) return;

  // stop worker first
  if (engineWorker) {
    try {
      engineWorker.postMessage({ type: "stop" });
      engineWorker.terminate();
    } catch {}
    engineWorker = null;
  }

  global.editRun.running = false;

  // 🔥 IMPORTANT: reload latest state from disk FIRST
  const file = path.join(__dirname, "data", "edit-run.json");

  if (fs.existsSync(file)) {
    try {
      const latest = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (latest && latest.rows) {
        global.editRun.rows = latest.rows;
      }
    } catch {}
  }

  // now apply stop only to non-success
  global.editRun.rows.forEach(r => {

    if (r.status === "Success") return;

    if (r.status === "Running" || r.status === "Pending") {
      r.status = "Stopped";
      r.message = "Stopped by user";
    }

  });

  fs.writeFileSync(file, JSON.stringify(global.editRun, null, 2));

  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("engine:update", {
      mode: "edit",
      ...global.editRun
    });
  });
});



ipcMain.handle("edit:resume", async () => {
  if (!global.editRun) return;
global.editRun.running = true;
  // stop any stuck worker
  if (engineWorker) {
    try { engineWorker.terminate(); } catch {}
    engineWorker = null;
  }

  // convert stopped → pending
  global.editRun.rows.forEach(r => {
    if (r.status === "Stopped") {
      r.status = "Pending";
      r.message = "";
    }
  });

  global.editRun.running = true;

  // save state FIRST
  const file = path.join(__dirname, "data", "edit-run.json");
  fs.writeFileSync(file, JSON.stringify(global.editRun, null, 2));

  // start fresh worker
  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "editRun",
    data: global.editRun
  });
});



ipcMain.handle("edit:clearAll", () => {
  global.editRun = null;
  stopEngineWorker();

  const file = path.join(__dirname, "data", "edit-run.json");
  if (fs.existsSync(file)) fs.unlinkSync(file);

  return true;
});

ipcMain.handle("edit:retryFailed", async () => {
  if (!global.editRun) return false;

  let hasFailed = false;

  global.editRun.rows.forEach(r => {
    if (r.status === "Failed") {
      r.status = "Pending";
      r.message = "";
      hasFailed = true;
    }
  });

  if (!hasFailed) return false;

  global.editRun.running = true;

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "editRun",
    data: global.editRun
  });

  return true;
});

ipcMain.handle("edit:removeRows", (_, ids) => {
console.log("REMOVE IDS IN MAIN:", ids);
  if (!global.editRun) return false;

  // update main memory
  global.editRun.rows = global.editRun.rows.filter(r => {
    return !ids.includes(r.rowId);
  });

  // 🔥 tell worker to remove too
  if (engineWorker) {
    engineWorker.postMessage({
      type: "edit:removeRows",
      ids
    });
  }

  // save for restart restore
  const file = path.join(__dirname, "data", "edit-run.json");
  fs.writeFileSync(file, JSON.stringify(global.editRun, null, 2));

  // refresh UI
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("engine:update", {
      mode: "edit",
      ...global.editRun
    });
  });

  return true;
});





/* ================= REMOVE TOOL ================= */
ipcMain.handle("remove-run", async (_, rows) => {

  if (engineWorker) {
    engineWorker.terminate();
    engineWorker = null;
  }

  // wipe edit memory
  global.editRun = null;

  const runState = {
    rows,
    index: 0,
    running: true,
    mode: "remove",
    domainSet: rows[0]?.domainSetName || "default"
  };

  global.removeRun = runState;

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "removeRun",
    data: runState
  });

  return { success: true };
});



ipcMain.handle("remove:getState", () => {
  return global.removeRun;
});

ipcMain.handle("remove:stop", () => {
  if (!global.removeRun) return;

  // stop worker first
  if (engineWorker) {
    try {
      engineWorker.postMessage({ type: "stop" });
      engineWorker.terminate();
    } catch {}
    engineWorker = null;
  }

  global.removeRun.running = false;

  // 🔥 reload latest disk state so we don't overwrite success
  const file = path.join(__dirname, "data", "remove-run.json");

  if (fs.existsSync(file)) {
    try {
      const latest = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (latest && latest.rows) {
        global.removeRun.rows = latest.rows;
      }
    } catch {}
  }

  global.removeRun.rows.forEach(r => {

    // DO NOT TOUCH SUCCESS
    if (r.status === "Success") return;

    if (r.status === "Running" || r.status === "Pending") {
      r.status = "Stopped";
      r.message = "Stopped by user";
    }

  });

  fs.writeFileSync(file, JSON.stringify(global.removeRun, null, 2));

  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("engine:update", {
      mode: "remove",
      ...global.removeRun
    });
  });
});


ipcMain.handle("remove:resume", async () => {
  if (!global.removeRun) return;

  global.removeRun.rows.forEach(r => {
    if (r.status === "Stopped") {
      r.status = "Pending";
      r.message = "";
    }
  });

  global.removeRun.running = true;

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "removeRun",
    data: global.removeRun
  });
});



ipcMain.handle("remove:clearAll", async () => {
  if (engineWorker) {
    engineWorker.terminate();
    engineWorker = null;
  }

  global.removeRun = null;
  clearRemoveState();
  return true;
});



ipcMain.handle("remove:retryFailed", async () => {
  if (!global.removeRun) return false;

  let hasFailed = false;

  global.removeRun.rows.forEach(r => {
    if (r.status === "Failed") {
      r.status = "Pending";
      r.message = "";
      hasFailed = true;
    }
  });

  if (!hasFailed) return false;

  global.removeRun.running = true;

  engineWorker = new Worker(
    path.join(__dirname, "logic", "engineWorker.js")
  );

  attachWorkerEvents(engineWorker);

  engineWorker.postMessage({
    type: "removeRun",
    data: global.removeRun
  });

  return true;
});

