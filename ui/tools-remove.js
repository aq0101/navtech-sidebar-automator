(function(){
// ===============================
// NAVTECH REMOVE TOOL
// ===============================

const SESSION_FILE = "tools-remove-session";

if (window.navtechRemoveInit) {
  console.log("REMOVE TOOL already initialized");
} else {
window.navtechRemoveInit = true;

console.log("TOOLS REMOVE JS LOADED");

document.addEventListener("DOMContentLoaded", initRemoveTool);

function initRemoveTool() {

const domainSelect = document.getElementById("removeDomainSet");
const addRowsBtn = document.getElementById("addRemoveRowsBtn");
const clearBtn = document.getElementById("clearRemoveTableBtn");
const runBtn = document.getElementById("runRemoveBtn");
const tableBody = document.getElementById("removeRunTable");
const stopBtn = document.getElementById("stopRemoveBtn");
const resumeBtn = document.getElementById("resumeRemoveBtn");
const retryBtn = document.getElementById("retryRemoveFailedBtn");
const exportBtn = document.getElementById("exportRemoveBtn");

if (!tableBody) return;

let totalRows = 0;

/* SESSION */

function loadSession() {
  const saved = localStorage.getItem(SESSION_FILE);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch { return []; }
}

function saveSession(rows) {
  localStorage.setItem(SESSION_FILE, JSON.stringify(rows));
}

/* DOMAIN SETS */

async function loadDomainSets() {
  if (!window.api || !domainSelect) return;

  const sets = await window.api.loadDomains();
  if (!sets) return;

  domainSelect.innerHTML = "";

  Object.keys(sets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    domainSelect.appendChild(opt);
  });
}
loadDomainSets();

window.api.onDomainsUpdated(loadDomainSets);

/* CREATE ROWS */

function createRows(count) {
  for (let i = 0; i < count; i++) {
    totalRows++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${totalRows}</td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td>Idle</td>
      <td></td>
    `;
    tableBody.appendChild(tr);
  }

  bindAutosave();
  enableColumnPaste();
}

/* COLLECT */

function collectRows() {
  const rows = [];
  tableBody.querySelectorAll("tr").forEach(tr => {
    const c = tr.querySelectorAll("td");
    rows.push({
      domain: c[1].innerText,
      keyword: c[2].innerText,
      url: c[3].innerText,
      status: c[4].innerText,
      message: c[5].innerText
    });
  });
  return rows;
}

/* AUTOSAVE */

function bindAutosave() {
  tableBody.querySelectorAll("td[contenteditable]").forEach(cell => {
    cell.oninput = () => saveSession(collectRows());
  });
}

function enableColumnPaste() {
  tableBody.querySelectorAll("td[contenteditable]").forEach(cell => {
    cell.onpaste = function (e) {
      e.preventDefault();

      const paste = (e.clipboardData || window.clipboardData)
        .getData("text")
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean);

      const startRow = this.parentElement.rowIndex - 1;
      const colIndex = this.cellIndex;

      paste.forEach((val, i) => {
        const row = tableBody.rows[startRow + i];
        if (!row) return;

        const targetCell = row.cells[colIndex];
        if (targetCell) targetCell.innerText = val;
      });

      saveSession(collectRows());
    };
  });
}


/* LOAD SAVED */

function loadSaved() {
  const data = loadSession();
  if (!data.length) return;

  data.forEach(d => {
    totalRows++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${totalRows}</td>
      <td contenteditable="true">${d.domain||""}</td>
      <td contenteditable="true">${d.keyword||""}</td>
      <td contenteditable="true">${d.url||""}</td>
      <td>${d.status||"Idle"}</td>
      <td>${d.message||""}</td>
    `;
    tableBody.appendChild(tr);
  });

  bindAutosave();
  enableColumnPaste();
}
loadSaved();
restoreFromEngine();

async function restoreFromEngine() {
  const state = await window.api.getRemoveState();
  if (!state || !state.rows || !state.rows.length) return;

  tableBody.innerHTML = "";
  totalRows = 0;

  state.rows.forEach(r => {
    if (!r.domain || !r.domain.trim()) return;

    totalRows++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${totalRows}</td>
      <td contenteditable="true">${r.domain||""}</td>
      <td contenteditable="true">${r.keyword||""}</td>
      <td contenteditable="true">${r.url||""}</td>
      <td>${r.status||"Idle"}</td>
      <td>${r.message||""}</td>
    `;
    tableBody.appendChild(tr);
  });

  bindAutosave();
  enableColumnPaste();
}




/* BUTTONS */

if (addRowsBtn)
addRowsBtn.onclick = () => createRows(500);

if (clearBtn)
clearBtn.onclick = async () => {
  await window.api.clearRemoveAll();
  tableBody.innerHTML = "";
  totalRows = 0;
  localStorage.removeItem(SESSION_FILE);
};

if (runBtn)
runBtn.onclick = async () => {

  if (!domainSelect.value) {
    alert("Select domain set first");
    return;
  }

  const rows = collectRows();
  saveSession(rows);

  const setName = domainSelect.value;
  rows.forEach(r => r.domainSetName = setName);

  const state = await window.api.getRemoveState();

// make Idle rows runnable
rows.forEach(r => {
  if (r.status === "Idle") r.status = "Pending";
});

if (!state || !state.rows || !state.rows.length) {
  // first run
  await window.api.startRemoveRun(rows);

} else if (state.running === false) {
  // resume stopped run
  await window.api.resumeRemoveRun();

} else {
  // restart fresh run with new rows
  await window.api.startRemoveRun(rows);
}

};


// STOP
if (stopBtn)
stopBtn.onclick = async () => {
  await window.api.stopRemoveRun();
};



// RESUME
if (resumeBtn)
resumeBtn.onclick = async () => {
  const state = await window.api.getRemoveState();

  if (!state || !state.rows || !state.rows.length) {
    alert("Nothing to resume");
    return;
  }

  await window.api.resumeRemoveRun();
};



// RETRY FAILED
if (retryBtn)
retryBtn.onclick = async () => {
  const state = await window.api.getRemoveState();
  if (!state || !state.rows) return;

  const hasFailed = state.rows.some(r => r.status === "Failed");

  if (!hasFailed) {
    alert("No failed domains");
    return;
  }

  await window.api.retryRemoveFailed();
  await window.api.resumeRemoveRun();
};



// EXPORT
if (exportBtn)
exportBtn.onclick = async () => {

  let rows = collectRows();

  if (!rows.length) {
    const state = await window.api.getRemoveState();
    if (state && state.rows) rows = state.rows;
  }

  exportXLSX(rows, "remove-export");
};



/* LIVE STATUS */

if (window.api) {
  window.api.onEngineUpdate(state => {
    if (!state) return;
    if (state.mode !== "remove") return;

    updateRemoveTable(state);
  });
}

function exportXLSX(rows, filename) {
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]).join("\t");

  let content = headers + "\n";

  rows.forEach(r => {
    content += Object.values(r).join("\t") + "\n";
  });

  const blob = new Blob([content], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".xlsx";
  a.click();

  URL.revokeObjectURL(url);
}



function updateRemoveTable(state) {
  if (!state.rows) return;

  const trs = tableBody.querySelectorAll("tr");

  let visibleIndex = 0;

  state.rows.forEach((r, i) => {
    const tr = trs[i];
    if (!tr) return;

    const cells = tr.querySelectorAll("td");

    const hasData = r.domain && r.domain.trim();

    if (!hasData) {
      cells[0].innerText = "";
      cells[4].innerText = "";
      cells[5].innerText = "";
      return;
    }

    visibleIndex++;

    cells[0].innerText = visibleIndex;
    cells[4].innerText = r.status || "";
    cells[5].innerText = r.message || "";
  });
}


} // init
}
})();
