function normalizeDomain(d) {
  if (!d) return "";

  return d
    .toLowerCase()
    .replace("http://", "")
    .replace("https://", "")
    .replace("www.", "")
    .split("/")[0]
    .trim();
}

function countSuccess(domains) {
  return domains.filter(d => d.status === "Success").length;
}

const fs = require("fs");
const path = require("path");
const { executeDomain } = require("./domainExecutor");
const { processEditRow } = require("./editExecutor");
const { processRemoveRow } = require("./removeExecutor");

const DOMAINS_FILE = path.join(__dirname, "..", "data", "domains.json");
const PROJECTS_FILE = path.join(__dirname, "..", "data", "projects.json");
const SETTINGS_FILE = path.join(__dirname, "..", "data", "settings.json");
const REMOVE_RUN_FILE = path.join(__dirname, "..", "data", "remove-run.json");
const EDIT_RUN_FILE = path.join(__dirname, "..", "data", "edit-run.json");

let engineRunning = false;
let stopRequested = false;
global.forceStop = false;

async function releaseUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}


/* ===============================
   ENGINE ENTRY
=============================== */

async function startEngine() {
  global.forceStop = false;
  // reset stop flag only
  stopRequested = false;

  // prevent double start
  if (engineRunning) {
    console.log("ENGINE already running → ignore start");
    return;
  }

  engineRunning = true;



  const settings = loadSettings();
  validateSettings(settings);

  console.log("🔥 ENGINE STARTED WITH SETTINGS:", settings);



  const projectLimit = settings.projectThreads;



 while (!stopRequested && !global.forceStop) {


  /* ================= TOOL MODE ================= */

  const run = global.editRun || global.removeRun;

  if (run && run.running) {

    if (typeof run.index !== "number") run.index = 0;

    // convert Idle → Pending only once
    run.rows.forEach(r => {
      if (r.status === "Idle") r.status = "Pending";
    });

    const settings = loadSettings();
    const THREADS = settings.domainThreads || 1;
    const DELAY = settings.delaySeconds * 1000;

    const hasPending = run.rows.some(r =>
  r.status === "Pending"
);



if (!hasPending) {
  run.running = false;

  if (run.mode === "edit") saveEditState(run);
  if (run.mode === "remove") saveRemoveState(run);

  engineRunning = false;
  
  break;
}

    const batch = [];
    const usedDomains = new Set();

    while (batch.length < THREADS) {
  let row = run.rows.find(r => r.status === "Pending");
  if (!row) break;

      const domainField =
        run.mode === "remove" ? row.domain : row.oldDomain;

      if (!domainField) continue;

      const d = normalizeDomain(domainField);
      if (usedDomains.has(d)) continue;

      usedDomains.add(d);
      batch.push(row);
    }

    if (!batch.length) {
      await sleep(DELAY);
      continue;
    }

    console.log(`⚡ ${run.mode.toUpperCase()} BATCH START (${batch.length})`);

    await Promise.all(
      batch.map(async row => {
       // NEVER touch success rows
    if (row.status === "Success") return;

        row.status = "Running";

        try {
          const domainMap = loadDomainSet(row.domainSetName);

          if (run.mode === "remove") {
            await processRemoveRow(row, settings, domainMap);
          } else {
            await processEditRow(row, settings, domainMap);
          }

          row.status = "Success";
          row.message = "Done";

        } catch (err) {
          row.status = "Failed";
          row.message = err.message;
        }

      })
    );

    if (run.mode === "edit") saveEditState(run);
    if (run.mode === "remove") saveRemoveState(run);

    await sleep(DELAY);
    continue;
  }

    /* ================= PROJECT MODE ================= */

    const projects = loadProjects();

    const runnable = projects.filter(
      p =>
        p.status === "Running" &&
        p.run &&
        p.run.domains.some(d => d.status === "Pending")
    );

    if (!runnable.length) {
  console.log("🛑 NO RUNNABLE PROJECTS — ENGINE STOPPING");

  // 🔥 FINAL SYNC: ensure all completed projects saved
  const finalProjects = loadProjects();

  let changed = false;

  finalProjects.forEach(p => {
    if (!p.run) return;

    const done = p.run.domains.every(d =>
      d.status === "Success" || d.status === "Failed"
    );

    if (done && p.status === "Running") {
      p.status = "Completed";
      changed = true;
    }
  });

  if (changed) saveProjects(finalProjects);

  engineRunning = false;
  stopRequested = true;

  setTimeout(() => {
    console.log("ENGINE LOOP FULLY EXITED");
  }, 0);

  break;
}




    const active = runnable.slice(0, projectLimit);

    await Promise.all(
      active.map(p => runProject(p, settings, projects))
    );
  }

 engineRunning = false;

console.log("ENGINE EXIT CLEAN");

// 🔥 allow Electron to breathe
await new Promise(r => setTimeout(r, 0));

// do NOT reset stopRequested here
}


/* ===============================
   PROJECT EXECUTION
=============================== */

async function runProject(project, settings, allProjects) {
  const delayMs = settings.delaySeconds * 1000;
  const batchSize = settings.domainThreads;
  const maxRetries = settings.maxRetries;

  while (!stopRequested && !global.forceStop) {
    const pending = project.run.domains.filter(
  d => d.status === "Pending"
);
    

    if (!pending.length) {
      const successCount = countSuccess(project.run.domains);

      if (successCount >= project.run.target) {
  project.status = "Completed";
  saveProjects(allProjects);

  // ⭐ CRITICAL: let Electron UI update before engine loop continues
  await new Promise(r => setTimeout(r, 0));

  return;
}

      const needed = project.run.target - successCount;
      const unused = project.run.domains.filter(d => d.status === "Unused");

      if (!unused.length) {
  project.status = "Blocked";
  project.message = "Not enough domains to reach target";
  saveProjects(allProjects);

  await new Promise(r => setTimeout(r, 0));

  return;
}

      unused.slice(0, needed).forEach(d => {
        d.status = "Pending";
        d.message = "";
      });

      saveProjects(allProjects);
      continue;
    }

    console.log(`⏳ Waiting ${settings.delaySeconds}s before batch`);
    await sleep(delayMs);
    if (stopRequested) return;

    const batch = pending.slice(0, batchSize);

    batch.forEach(d => {
      d.status = "Running";
      d.message = "Executing";
      if (typeof d.retries !== "number") d.retries = 0;
    });

    saveProjects(allProjects);

    await Promise.all(
      batch.map((d, i) =>
        runDomain(d, maxRetries, settings.proxies, i)
      )
    );

    saveProjects(allProjects);
// 🔥 yield to Electron
await new Promise(r => setImmediate(r));
  }
}

/* ===============================
   DOMAIN EXECUTION
=============================== */

async function runDomain(domain, maxRetries, proxies, index) {
  let proxyIndex = index % proxies.length;

  while (!stopRequested && !global.forceStop) {
    try {
      const proxy = proxies[proxyIndex];
      await executeDomain(domain, proxy);

      domain.status = "Success";
      domain.message = "Done";
      return;

    } catch (err) {
      domain.retries++;

      const realMessage = err?.message || "Execution failed";
      domain.message = realMessage;

      if (domain.retries > maxRetries) {
        domain.status = "Failed";
        return;
      }

      proxyIndex = (proxyIndex + 1) % proxies.length;
      domain.status = "Pending";
    }
  }
}

/* ===============================
   ENGINE API
=============================== */

function retryFailed(projectId) {
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project || !project.run) return;

  project.run.domains.forEach(d => {
    if (d.status === "Failed") {
      d.status = "Pending";
      d.retries = 0;
      d.message = "";
    }
  });

  saveProjects(projects);
}

function stopEngine() {
  stopRequested = true;
  global.forceStop = true;
// 🔥 allow restart later
  setTimeout(() => {
    stopRequested = false;
  }, 50);

  const projects = loadProjects();

  projects.forEach(project => {
    if (!project.run) return;

    project.run.domains.forEach(d => {
      if (d.status === "Running") {
        d.status = "Pending";   // ← put back to queue
        d.message = "Paused";
      }
    });
  });

  saveProjects(projects);
}



/* ===============================
   SETTINGS / STORAGE
=============================== */

function validateSettings(s) {
  if (!Number.isInteger(s.projectThreads) || s.projectThreads < 1)
    throw new Error("Invalid projectThreads");
  if (!Number.isInteger(s.domainThreads) || s.domainThreads < 1)
    throw new Error("Invalid domainThreads");
  if (typeof s.delaySeconds !== "number" || s.delaySeconds < 0)
    throw new Error("Invalid delaySeconds");
  if (!Number.isInteger(s.maxRetries) || s.maxRetries < 0)
    throw new Error("Invalid maxRetries");
}

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE))
    throw new Error("Settings file missing");

  const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));

  return {
    projectThreads: Number(raw.execution.projectThreads),
    domainThreads: Number(raw.execution.domainThreads),
    delaySeconds: Number(raw.execution.delaySeconds),
    maxRetries: Number(raw.execution.maxRetries),
    proxies: raw.proxies || []
  };
}

function loadDomainSet(name) {
  if (!fs.existsSync(DOMAINS_FILE)) return {};

  const all = JSON.parse(fs.readFileSync(DOMAINS_FILE, "utf-8"));
  const set = all[name];
  if (!set) return {};

  const map = {};

  set.forEach(line => {
    const [url, user, pass] = line.split("|");
    if (!url) return;

    map[normalizeDomain(url)] = { url, username: user, password: pass };
  });

  return map;
}

function loadProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
}

function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function saveEditState(run) {
  if (!run || run.mode !== "edit") return;
  fs.writeFileSync(EDIT_RUN_FILE, JSON.stringify(run, null, 2));
}


function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  startEngine,
  stopEngine,
  retryFailed,
  clearRemoveState,
  clearEditState
};

function loadEditState() {
  if (!fs.existsSync(EDIT_RUN_FILE)) return null;
  return JSON.parse(fs.readFileSync(EDIT_RUN_FILE, "utf-8"));
}


function saveRemoveState(run) {
  if (!run || run.mode !== "remove") return;
  fs.writeFileSync(REMOVE_RUN_FILE, JSON.stringify(run, null, 2));
}

function clearRemoveState() {
  // stop engine loop
  stopRequested = true;

  // clear memory run
  if (global.editRun && global.editRun.mode === "remove") {
    global.editRun = null;
  }

  // reset engine flag
  engineRunning = false;

  // delete file
  if (fs.existsSync(REMOVE_RUN_FILE)) {
    fs.unlinkSync(REMOVE_RUN_FILE);
  }

  console.log("🧹 REMOVE STATE CLEARED");
}

function clearEditState() {
  stopRequested = true;

  global.editRun = null;

  if (fs.existsSync(EDIT_RUN_FILE)) {
    fs.unlinkSync(EDIT_RUN_FILE);
  }

  engineRunning = false;

  console.log("🧹 EDIT STATE CLEARED");
}

