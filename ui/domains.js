console.log("DOMAINS JS LOADED");
/* =========================
   STATE
========================= */
let domainData = {};
let currentSet = null;
let selectedRows = [];

/* =========================
   ELEMENTS
========================= */
const setsView = document.getElementById("domainSetsView");
const editorView = document.getElementById("domainEditorView");
const setsGrid = document.getElementById("setsGrid");

const editorTitle = document.getElementById("editorTitle");
const domainsTable = document.getElementById("domainsTable");

const addSetModal = document.getElementById("addSetModal");
const deleteSetModal = document.getElementById("deleteSetModal");

const newSetName = document.getElementById("newSetName");
const bulkInput = document.getElementById("bulkInput");
const addDomainsPanel = document.getElementById("addDomainsPanel");
const removeBtn = document.getElementById("removeDomainsBtn");

/* =========================
   LOAD / SAVE
========================= */
async function loadData() {
  domainData = await window.api.loadDomains();
  if (!domainData || typeof domainData !== "object") domainData = {};
  renderSets();
}

async function saveData() {
  await window.api.saveDomains(domainData);
}

/* =========================
   HELPERS
========================= */
function isValidFormat(line) {
  const parts = line.split("|");
  if (parts.length !== 3) return false;
  const [domain, user, pass] = parts;
  if (!domain || !user || !pass) return false;
  if (user.includes(" ")) return false;
  return domain.includes(".");
}

function normalizeDomain(line) {
  return line
    .split("|")[0]
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/* =========================
   RENDER SETS
========================= */
function renderSets() {
  setsGrid.innerHTML = "";

  Object.keys(domainData).forEach(set => {
    const list = Array.isArray(domainData[set]) ? domainData[set] : [];

    const card = document.createElement("div");
    card.className = "domain-set-card";
    card.innerHTML = `
      <h3>${set}</h3>
      <span>${list.length} domains</span>
    `;
    card.onclick = () => openSet(set);
    setsGrid.appendChild(card);
  });
}

/* =========================
   OPEN / CLOSE SET
========================= */
function openSet(set) {
  currentSet = set;
  selectedRows = [];

  setsView.classList.add("hidden");
  editorView.classList.remove("hidden");

  editorTitle.textContent = `${set} (${domainData[set].length} domains)`;
  renderDomains();
}

document.getElementById("backToSets").onclick = () => {
  editorView.classList.add("hidden");
  setsView.classList.remove("hidden");
};

/* =========================
   RENDER DOMAINS
========================= */
function renderDomains() {
  domainsTable.innerHTML = "";
  selectedRows = [];
  removeBtn.disabled = true;

  domainData[currentSet].forEach((line, index) => {
    const [domain, user] = line.split("|");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-index="${index}"></td>
      <td>${domain}</td>
      <td>${user}</td>
      <td>******</td>
      <td>${isValidFormat(line) ? "Valid" : "Invalid"}</td>
    `;

    tr.querySelector("input").onchange = e => {
      const idx = Number(e.target.dataset.index);
      if (e.target.checked) selectedRows.push(idx);
      else selectedRows = selectedRows.filter(i => i !== idx);
      removeBtn.disabled = selectedRows.length === 0;
    };

    domainsTable.appendChild(tr);
  });
}

/* =========================
   ADD DOMAIN SET
========================= */
document.getElementById("openAddSetModal").onclick = () => {
  newSetName.value = "";
  addSetModal.classList.remove("hidden");
};

document.getElementById("closeAddSetModal").onclick = () =>
  addSetModal.classList.add("hidden");

document.getElementById("createSetConfirm").onclick = async () => {
  const name = newSetName.value.trim();
  if (!name || domainData[name]) return;

  domainData[name] = [];
  await saveData();

  addSetModal.classList.add("hidden");
  renderSets();
  openSet(name);
};

/* =========================
   DELETE SET
========================= */
document.getElementById("openDeleteSetModal").onclick = () =>
  deleteSetModal.classList.remove("hidden");

document.getElementById("closeDeleteSetModal").onclick = () =>
  deleteSetModal.classList.add("hidden");

document.getElementById("confirmDeleteSet").onclick = async () => {
  delete domainData[currentSet];
  await saveData();

  deleteSetModal.classList.add("hidden");
  editorView.classList.add("hidden");
  setsView.classList.remove("hidden");
  renderSets();
};

/* =========================
   ADD DOMAINS
========================= */
document.getElementById("showAddDomains").onclick = () => {
  bulkInput.value = "";
  addDomainsPanel.classList.remove("hidden");
};

document.getElementById("cancelAddDomains").onclick = () =>
  addDomainsPanel.classList.add("hidden");

document.getElementById("confirmAddDomains").onclick = async () => {
  const lines = bulkInput.value
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const existing = new Set(domainData[currentSet].map(normalizeDomain));

  lines.forEach(line => {
    if (!isValidFormat(line)) return;
    const norm = normalizeDomain(line);
    if (existing.has(norm)) return;

    existing.add(norm);
    domainData[currentSet].push(line);
  });

  await saveData();
  addDomainsPanel.classList.add("hidden");

  editorTitle.textContent =
    `${currentSet} (${domainData[currentSet].length} domains)`;

  renderDomains();
  renderSets();
};

/* =========================
   REMOVE DOMAINS
========================= */
removeBtn.onclick = async () => {
  domainData[currentSet] = domainData[currentSet].filter(
    (_, idx) => !selectedRows.includes(idx)
  );

  await saveData();
  editorTitle.textContent =
    `${currentSet} (${domainData[currentSet].length} domains)`;

  renderDomains();
  renderSets();
};

/* =========================
   INIT
========================= */
loadData();
