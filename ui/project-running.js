console.log(window.api.retryFailed);
console.log("✅ PROJECT RUNNING JS LOADED");

/* ===============================
   STATE
=============================== */

let runningProject = null;
let runFilterValue = "all";
const runFilterEl = document.getElementById("runFilter");

/* ===============================
   ELEMENTS
=============================== */

const runTitleEl = document.getElementById("runProjectTitle");
const runTableBody = document.getElementById("runTableBody");


/* ===============================
   HELPERS
=============================== */

function displayDomain(raw) {
  if (!raw) return "";
  const first = raw.split("|")[0];
  return first.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function calculateRunStats(domains) {

  const total = domains.length;
  const success = domains.filter(d => d.status === "Success").length;
  const failed = domains.filter(d => d.status === "Failed").length;
  const pending = domains.filter(d => d.status === "Pending").length;

  return {
    total,
    success,
    failed,
    pending,
    processed: success + failed // 🔒 LOCKED RULE
  };
}

/* ===============================
   VIEW ENTRY
=============================== */

window.onProjectRunningView = async function () {
  const projectId = window.currentRunningProjectId;
  if (!projectId) return;

  const projects = await window.api.loadProjects();
  runningProject = projects.find(p => p.id === projectId);
  if (!runningProject || !runningProject.run) return;

  // Project title
  runTitleEl.textContent = runningProject.name;

  // Initial render
  renderRows();
  renderProgress();

  // Clear old timer if exists
  if (window.runStatsTimer) {
    clearInterval(window.runStatsTimer);
  }

  // 🔁 LIVE REFRESH (engine-driven)
  window.runStatsTimer = setInterval(async () => {
    const projects = await window.api.loadProjects();
    const project = projects.find(
      p => p.id === window.currentRunningProjectId
    );
    if (!project || !project.run) return;

    runningProject = project;
    if (runningProject.status?.includes("Blocked")) {
  showToast(
    "Domain set exhausted. Add more domains or reduce target.",
    true
  );
}

    const stats = calculateRunStats(project.run.domains);

    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statProcessed").textContent = stats.processed;
    document.getElementById("statSuccess").textContent = stats.success;
    document.getElementById("statFailed").textContent = stats.failed;
    document.getElementById("statPending").textContent = stats.pending;

    renderRows();
    renderProgress();
  }, 500);

  /* ===============================
     BUTTON HANDLERS
  =============================== */
  const startBtn = document.getElementById("engineStartBtn")
  const stopProjectBtn = document.getElementById("stopProjectBtn");
  const resumeProjectBtn = document.getElementById("resumeProjectBtn");
  const editConfigBtn = document.getElementById("editConfigBtn");
  
  if (startBtn) {
  startBtn.onclick = async () => {
    // prevent double clicks
    startBtn.disabled = true;

    await window.api.startEngine();
    showToast("Engine started");

    // re-enable after 3 seconds (same UX as Stop)
    setTimeout(() => {
      startBtn.disabled = false;
    }, 3000);
  };
}


if (stopProjectBtn) {
  stopProjectBtn.onclick = async () => {
    await window.api.stopEngine();

    const projects = await window.api.loadProjects();
    const p = projects.find(x => x.id === window.currentRunningProjectId);
    if (!p) return;

    p.status = "Stopped";

    if (p.run) {
      p.run.domains.forEach(d => {
        if (d.status === "Running") {
          d.status = "Pending";
          d.message = "Stopped";
        }
      });
    }

    await window.api.saveProjects(projects);
  };
}

  
if (resumeProjectBtn) {
  resumeProjectBtn.onclick = async () => {
    const projects = await window.api.loadProjects();
    const p = projects.find(x => x.id === window.currentRunningProjectId);
    if (!p) return;

    // 🔥 restore status so engine sees it
    p.status = "Running";

    await window.api.saveProjects(projects);

    // start engine
    await window.api.startEngine();
  };
}
 
if (editConfigBtn) {
  editConfigBtn.onclick = async () => {
    // 1️⃣ Stop engine
    await window.api.stopEngine();

    // 2️⃣ Ensure we have a running project
    if (!window.currentRunningProjectId) return;

    // 3️⃣ 🔑 MARK THAT WE ARE EDITING A RUNNING PROJECT
    window.isEditingRunningProject = true;

    // 4️⃣ Set active project for config screen
    window.activeProjectId = window.currentRunningProjectId;

    // 5️⃣ Navigate to Project Config screen
    window.showView("view-project-config");
  };
}

// ================= FILTER DROPDOWN =================
if (runFilterEl) {
  runFilterEl.onchange = () => {
    runFilterValue = runFilterEl.value;
    renderRows(); // re-render table only
  };
}

  }; // ✅ ← THIS WAS MISSING (ROOT CAUSE)



/* ===============================
   PROGRESS BAR
=============================== */

function renderProgress() {
  if (!runningProject || !runningProject.run) return;

  const stats = calculateRunStats(runningProject.run.domains);

  const done = stats.success + stats.failed;
  const total = stats.total;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const fill = document.getElementById("runProgressFill");
  const text = document.getElementById("runProgressText");
  const count = document.getElementById("runProgressCount");

  if (fill) fill.style.width = percent + "%";
  if (text) text.textContent = `Progress ${percent}%`;
  if (count) count.textContent = `${done} / ${total}`;
}

/* ===============================
   TABLE
=============================== */

function renderRows() {
  if (!runningProject || !runningProject.run) return;

  runTableBody.innerHTML = "";

  let rows = runningProject.run.domains;

  // APPLY FILTER
  if (runFilterValue !== "all") {
    rows = rows.filter(r =>
      r.status.toLowerCase() === runFilterValue.toLowerCase()
    );
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td></td>
      <td>${displayDomain(row.domain)}</td>
      <td>${row.url}</td>
      <td>${row.keyword}</td>
      <td>${row.status}</td>
      <td>
        ${
          row.status === "Failed"
            ? explainFailure(row.message)
            : (row.message || "")
        }
      </td>
    `;
    runTableBody.appendChild(tr);
  });
}


/* ===============================
   EXPORT
=============================== */

function getExportRows() {
  if (!runningProject || !runningProject.run) return [];

  return runningProject.run.domains.map(row => ({
    domain: displayDomain(row.domain),
    url: row.url,
    keyword: row.keyword,
    status: row.status
  }));
}

function exportRunToXLSX() {
  const rows = getExportRows();
  if (!rows.length) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

  const projectName = runningProject?.name || "project";
  const totalLinks = runningProject?.run?.domains?.length || 0;

  const fileName = `${projectName} (${totalLinks} sidebar links).xlsx`;
  XLSX.writeFile(workbook, fileName);
}

const exportRunBtn = document.getElementById("exportRunBtn");
if (exportRunBtn) {
  exportRunBtn.onclick = exportRunToXLSX;
}

/* ===============================
   BACK BUTTON
=============================== */

const runBackBtn = document.getElementById("backFromRun");
if (runBackBtn) {
  runBackBtn.onclick = () => window.viewManager.showDashboard();
}

/* ===============================
   RETRY FAILED
=============================== */

const retryFailedBtn = document.getElementById("retryFailedBtn");
if (retryFailedBtn) {
  retryFailedBtn.onclick = async () => {
    if (!window.currentRunningProjectId) return;

    await window.api.retryFailed(window.currentRunningProjectId);
    showToast("Failed domains reset. Click Resume to continue.");
  };
}

function explainFailure(message = "") {
  const m = message.toLowerCase();

  // AUTH / LOGIN
  if (
    m.includes("401") ||
    m.includes("unauthorized") ||
    m.includes("rest_not_logged_in") ||
    (m.includes("invalid") && m.includes("password"))
  ) {
    return "Login incorrect";
  }

  // PERMISSION
  if (m.includes("403") || m.includes("forbidden")) {
    return "Permission denied";
  }

  // WIDGET ERRORS
  if (m.includes("widget") && m.includes("already")) {
    return "Widget already exists";
  }

  if (m.includes("widget") && m.includes("not found")) {
    return "Widget not found";
  }

  if (m.includes("widget") && m.includes("failed")) {
    return "Widget not created";
  }

  // WORDPRESS / API
  if (m.includes("rest_no_route")) {
    return "Required plugin not installed";
  }

  // SECURITY / FIREWALL
  if (
    m.includes("cloudflare") ||
    m.includes("cf-ray") ||
    m.includes("challenge")
  ) {
    return "Blocked by website security";
  }

  // NETWORK
  if (
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("enotfound")
  ) {
    return "Connection problem";
  }

  // FALLBACK (real but simple)
  return "Execution failed";
}
