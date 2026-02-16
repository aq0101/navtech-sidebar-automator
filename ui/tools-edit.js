// ===============================
// NAVTECH EDIT TOOL
// ===============================
const SESSION_FILE = "tools-edit-session";

// prevent double init
if (window.navtechEditInit) {
  console.log("EDIT TOOL already initialized");
} else {
window.navtechEditInit = true;

console.log("TOOLS EDIT JS LOADED");

// wait until DOM ready (important for Electron views)
document.addEventListener("DOMContentLoaded", initEditTool);

function initEditTool() {

// ===============================
// ELEMENTS
// ===============================
const domainSelect = document.getElementById("editDomainSet");
const editBtn = document.getElementById("editTableBtn");
const addRowsBtn = document.getElementById("addRowsBtn");
const clearBtn = document.getElementById("clearTableBtn");
const runBtn = document.getElementById("runEditBtn");
const removeBtn = document.getElementById("removeRowBtn");
const tableBody = document.getElementById("editRunTable");
const stopBtn = document.getElementById("stopEditBtn");
const resumeBtn = document.getElementById("resumeEditBtn");
const retryBtn = document.getElementById("retryFailedBtn");
const exportBtn = document.getElementById("exportEditBtn");


if (!tableBody) {
  console.log("Edit table not ready yet");
  return;
}

let totalRows = 0;

// ===============================
// SESSION
// ===============================
function loadSession() {
  const saved = localStorage.getItem(SESSION_FILE);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch { return []; }
}

function saveSession(rows) {
  localStorage.setItem(SESSION_FILE, JSON.stringify(rows));
}

// ===============================
// LOAD DOMAIN SETS
// ===============================
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

// live refresh when domains change
window.api.onDomainsUpdated(() => {
  console.log("🔄 domain sets updated → refreshing dropdown");
  loadDomainSets();
});

// ===============================
// DOMAIN SET CHANGE FIX
// ===============================
if (domainSelect)
domainSelect.onchange = async () => {

  if (!window.api) return;

  const state = await window.api.getEditState();

  // if engine already running → reset it
  if (state && state.running) {
    console.log("⚠ Domain set changed during run → resetting engine");

    await window.api.stopEditRun();
    await window.api.clearEditAll();
  }

};


// ===============================
// CREATE ROWS
// ===============================
function createRows(count) {
  for (let i = 0; i < count; i++) {
    totalRows++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="rowCheck"></td>
      <td>${totalRows}</td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td>Idle</td>
      <td></td>
    `;
    tableBody.appendChild(tr);
  }

  enableColumnPaste();
  bindAutosave();
}

// ===============================
// COLLECT ROWS
// ===============================
function collectRows() {
  const rows = [];
  tableBody.querySelectorAll("tr").forEach(tr => {
    const c = tr.querySelectorAll("td");
    rows.push({
      oldDomain: c[2].innerText,
      oldKeyword: c[3].innerText,
      oldUrl: c[4].innerText,
      newDomain: c[5].innerText,
      newKeyword: c[6].innerText,
      newUrl: c[7].innerText,
      status: c[8].innerText,
      message: c[9].innerText
    });
  });
  return rows;
}

// ===============================
// AUTOSAVE
// ===============================
function bindAutosave() {
  tableBody.querySelectorAll("td[contenteditable]").forEach(cell => {
    cell.oninput = () => saveSession(collectRows());
  });
}

// ===============================
// LOAD SAVED
// ===============================
function loadSaved() {
  const data = loadSession();
  if (!data.length) return;

  data.forEach(d => {
    totalRows++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="rowCheck"></td>
      <td>${totalRows}</td>
      <td contenteditable="true">${d.oldDomain||""}</td>
      <td contenteditable="true">${d.oldKeyword||""}</td>
      <td contenteditable="true">${d.oldUrl||""}</td>
      <td contenteditable="true">${d.newDomain||""}</td>
      <td contenteditable="true">${d.newKeyword||""}</td>
      <td contenteditable="true">${d.newUrl||""}</td>
      <td>${d.status||"Idle"}</td>
      <td>${d.message||""}</td>
    `;
    tableBody.appendChild(tr);
  });

  enableColumnPaste();
  bindAutosave();
}
// ===============================
// LOAD ENGINE STATE FIRST
// ===============================
async function loadFromEngineFirst() {

  const state = await window.api.getEditState();

  // If engine has data → use it
  if (state && state.rows && state.rows.length) {

    console.log("Restoring table from ENGINE state");

    tableBody.innerHTML = "";
    totalRows = 0;

    state.rows.forEach(r => {

      if (!r.oldDomain || !r.oldDomain.trim()) return;

      totalRows++;

      const tr = document.createElement("tr");
      tr.dataset.rowId = r.rowId;
      tr.innerHTML = `

        <td><input type="checkbox" class="rowCheck"></td>
        <td>${totalRows}</td>
        <td contenteditable="true">${r.oldDomain||""}</td>
        <td contenteditable="true">${r.oldKeyword||""}</td>
        <td contenteditable="true">${r.oldUrl||""}</td>
        <td contenteditable="true">${r.newDomain||""}</td>
        <td contenteditable="true">${r.newKeyword||""}</td>
        <td contenteditable="true">${r.newUrl||""}</td>
        <td>${r.status||"Idle"}</td>
        <td>${r.message||""}</td>
      `;

      tableBody.appendChild(tr);
    });

    enableColumnPaste();
    bindAutosave();

  } else {
    // No engine state → load local session
    console.log("No engine state → loading session");
    loadSaved();
  }
}

// run it
loadFromEngineFirst();


// ===============================
// COLUMN PASTE
// ===============================
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
        row.cells[colIndex].innerText = val;
      });

      saveSession(collectRows());
    };
  });
}

// ===============================
// BUTTONS SAFE BIND
// ===============================
if (editBtn)
editBtn.onclick = () => {
  tableBody.innerHTML = "";
  totalRows = 0;
  createRows(500);
  saveSession([]);
};

if (addRowsBtn)
addRowsBtn.onclick = () => createRows(500);

if (clearBtn)
clearBtn.onclick = async () => {

  await window.api.stopEditRun();
  await window.api.clearEditAll();

  tableBody.innerHTML = "";
  totalRows = 0;

  localStorage.removeItem(SESSION_FILE);

  console.log("FULL RESET DONE");
};


if (removeBtn)
removeBtn.onclick = async () => {

  const ids = [];

  tableBody.querySelectorAll("tr").forEach(tr => {
    const cb = tr.querySelector(".rowCheck");
    if (!cb || !cb.checked) return;

    const id = tr.dataset.rowId;
    if (id) ids.push(id);
  });

  if (!ids.length) return;

  await window.api.removeEditRows(ids);
};







if (runBtn)
runBtn.onclick = async () => {

  console.log("EDIT RUN CLICK");

  if (!domainSelect.value) {
    alert("Select domain set first");
    return;
  }

  let rows = collectRows();

// remove empty rows
rows = rows.filter(r => r.oldDomain && r.oldDomain.trim());

if (!rows.length) {
  alert("No rows to run");
  return;
}

// 🔥 ADD UNIQUE ROW ID HERE
rows = rows.map((r, i) => ({
  ...r,
  rowId: Date.now() + "_" + i,
  status: "Pending"
}));

tableBody.innerHTML = "";
totalRows = 0;  

rows.forEach((r,i) => {
  totalRows++;
  const tr = document.createElement("tr");
  tr.dataset.rowId = r.rowId;
  
      tr.innerHTML = `
      <td><input type="checkbox" class="rowCheck"></td>
      <td>${totalRows}</td>
      <td>${r.oldDomain}</td>
      <td>${r.oldKeyword}</td>
      <td>${r.oldUrl}</td>
      <td>${r.newDomain}</td>
      <td>${r.newKeyword}</td>
      <td>${r.newUrl}</td>
      <td>Pending</td>
      <td></td>
    `;

    tableBody.appendChild(tr);
  });

  const setName = domainSelect.value;
  rows.forEach(r => r.domainSetName = setName);

  await window.api.startEditRun(rows);
};


// ================= STOP =================
if (stopBtn)
stopBtn.onclick = async () => {
  await window.api.stopEditRun();
  console.log("⛔ EDIT STOP REQUESTED");
};

// RESUME
if (resumeBtn)
resumeBtn.onclick = async () => {
  await window.api.resumeEditRun();
  console.log("▶ EDIT RESUME REQUESTED");
};


// RETRY FAILED
if (retryBtn)
retryBtn.onclick = async () => {
  await window.api.retryEditFailed();
};

// EXPORT
if (exportBtn)
exportBtn.onclick = async () => {

  let rows = collectRows();

  if (!rows.length) {
    const state = await window.api.getEditState();
    if (state && state.rows) rows = state.rows;
  }

  exportXLSX(rows, "edit-export");
};

// 🔥 LIVE updates from engine worker
if (window.api) {
  window.api.onEngineUpdate(state => {
    if (!state) return;
    if (state.mode !== "edit") return;
    updateEditTable(state);
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



// ===============================
// LIVE STATUS REFRESH
// ===============================

function updateEditTable(state) {
  if (!state.rows) return;

  // 🔥 FIX: rebuild table if rows removed
  const trs = tableBody.querySelectorAll("tr");
  if (trs.length !== state.rows.length) {
    tableBody.innerHTML = "";
    totalRows = 0;

    state.rows.forEach((r,i)=>{
      totalRows++;

      const tr = document.createElement("tr");
      tr.dataset.rowId = r.rowId || "";

      tr.innerHTML = `
        <td><input type="checkbox" class="rowCheck"></td>
        <td>${totalRows}</td>
        <td>${r.oldDomain||""}</td>
        <td>${r.oldKeyword||""}</td>
        <td>${r.oldUrl||""}</td>
        <td>${r.newDomain||""}</td>
        <td>${r.newKeyword||""}</td>
        <td>${r.newUrl||""}</td>
        <td>${r.status||""}</td>
        <td>${r.message||""}</td>
      `;

      tableBody.appendChild(tr);
    });

    return;
  }

  // existing logic
  let visibleIndex = 0;

  state.rows.forEach((r, i) => {
    const tr = trs[i];
    if (!tr) return;

    tr.dataset.rowId = r.rowId || "";
    const cells = tr.querySelectorAll("td");

    const hasData =
      (r.oldDomain && r.oldDomain.trim()) ||
      (r.newDomain && r.newDomain.trim());

    if (!hasData) {
      cells[1].innerText = "";
      cells[8].innerText = "";
      cells[9].innerText = "";
      return;
    }

    visibleIndex++;
    cells[1].innerText = visibleIndex;

    if (cells[8].innerText === "Success") return;
    cells[8].innerText = r.status || "Pending";
    cells[9].innerText = r.message || "";
  });
}





} // init
} // prevent double init
