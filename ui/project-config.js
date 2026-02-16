console.log("✅ PROJECT CONFIG JS LOADED");

/* ===============================
   STATE
=============================== */

let activeProjectId = null;
let activeProject = null;

let domainSets = {};
let selectedDomainSet = "";

/* ===============================
   ELEMENTS
=============================== */
const sheetModeCard = document.getElementById("sheetModeCard");
const sheetDomainsInput = document.getElementById("sheetDomainsInput");
const sheetUrlsInput = document.getElementById("sheetUrlsInput");
const sheetKeywordsInput = document.getElementById("sheetKeywordsInput");
const backBtn = document.getElementById("backToDashboard");
const titleEl = document.getElementById("projectConfigTitle");
const modeSelect = document.getElementById("modeSelect");
const domainSetSelect = document.getElementById("domainSetSelect");
const keywordSetsContainer = document.getElementById("keywordSetsContainer");
const addSetBtn = document.getElementById("addKeywordSetBtn");
const desiredLinksInput = document.getElementById("desiredLinksInput");
const summaryEl = document.getElementById("projectSummary");
const startBtn = document.getElementById("projectStartBtn");

startBtn.textContent = "Run";

/* ===============================
   NAVIGATION
=============================== */

backBtn.onclick = e => {
  e.preventDefault();
  activeProjectId = null;
  activeProject = null;
  window.viewManager.showDashboard();
};

/* ===============================
   ENTRY POINT (FIXED)
=============================== */

window.openProjectConfig = async function (projectId) {

  // 🔒 IMPORTANT: if this project already active → DO NOT reload from disk
  if (activeProject && activeProject.id === projectId) {
    activeProjectId = projectId;
    window.viewManager.showProjectConfig();

    titleEl.textContent = activeProject.name;
    await loadDomainSets();

    desiredLinksInput.value = activeProject.config.desiredTotalLinks || "";
    modeSelect.value = activeProject.config.mode || "normal";
    toggleSheetModeUI();

    sheetDomainsInput.value = activeProject.config.sheetDomains || "";
    sheetUrlsInput.value = activeProject.config.sheetUrls || "";
    sheetKeywordsInput.value = activeProject.config.sheetKeywords || "";

    renderKeywordSets();
    updateSummary();
    validateStart();
    return;
  }

  // 🧠 FIRST LOAD ONLY
  activeProjectId = projectId;
  window.viewManager.showProjectConfig();

  const projects = await window.api.loadProjects();
  activeProject = projects.find(p => p.id === projectId);
  if (!activeProject) return;

  titleEl.textContent = activeProject.name;

  activeProject.config ??= {};
  activeProject.config.mode ??= "normal";

  if (!["normal", "sheet"].includes(activeProject.config.mode)) {
    activeProject.config.mode = "normal";
  }

  activeProject.config.domainSet ??= "";
  activeProject.config.desiredTotalLinks ??= "";
  activeProject.config.keywordSets ??= [];
  activeProject.config.sheetDomains ??= "";
  activeProject.config.sheetUrls ??= "";
  activeProject.config.sheetKeywords ??= "";

  await loadDomainSets();

  desiredLinksInput.value = activeProject.config.desiredTotalLinks || "";
  modeSelect.value = activeProject.config.mode || "normal";
  toggleSheetModeUI();

  sheetDomainsInput.value = activeProject.config.sheetDomains || "";
  sheetUrlsInput.value = activeProject.config.sheetUrls || "";
  sheetKeywordsInput.value = activeProject.config.sheetKeywords || "";

  renderKeywordSets();
  updateSummary();
  validateStart();
};


/* ===============================
   DOMAIN SET CHANGE
=============================== */

domainSetSelect.onchange = async () => {
  selectedDomainSet = domainSetSelect.value;
  activeProject.config.domainSet = selectedDomainSet;
  await saveProject();
  updateSummary();
  validateStart();
};

/* ===============================
   TARGET LINKS CHANGE
=============================== */

desiredLinksInput.oninput = async () => {
  const value = desiredLinksInput.value.trim();
  activeProject.config.desiredTotalLinks = value ? Number(value) : "";
  await saveProject();
  updateSummary();
  validateStart();
};

modeSelect.onchange = async () => {
  activeProject.config.mode = modeSelect.value;
  toggleSheetModeUI();
  await saveProject();
};



/* ===============================
   KEYWORD SETS UI
=============================== */

function renderKeywordSets() {
  keywordSetsContainer.innerHTML = "";
  const sets = activeProject.config.keywordSets;

  if (!sets.length) {
    keywordSetsContainer.innerHTML = `
      <div class="keyword-placeholder">
        No keyword sets yet. Add at least one set to continue.
      </div>
    `;
    return;
  }

  sets.forEach((set, index) => {
    const div = document.createElement("div");
    div.className = "keyword-set-card";

    div.innerHTML = `
      <div class="keyword-set-header">
        <strong>Set ${index + 1}</strong>
        <button class="keyword-set-remove" data-id="${set.id}">Remove</button>
      </div>

      <div class="keyword-set-body">
        <textarea data-type="urls" data-id="${set.id}" placeholder="Paste URLs here">${set.urls || ""}</textarea>
        <textarea data-type="keywords" data-id="${set.id}" placeholder="Paste keywords here">${set.keywords || ""}</textarea>

        <div class="set-required-links-box">
          <label>Required Links for this Set</label>
          <input
            type="number"
            min="0"
            data-type="requiredLinks"
            data-id="${set.id}"
            value="${set.requiredLinks || ""}"
          />
        </div>
      </div>
    `;

    keywordSetsContainer.appendChild(div);
  });
}

addSetBtn.onclick = async () => {
  activeProject.config.keywordSets.push({
    id: crypto.randomUUID(),
    urls: "",
    keywords: "",
    requiredLinks: ""
  });

  await saveProject();
  renderKeywordSets();
  updateSummary();
  validateStart();
};

keywordSetsContainer.oninput = async e => {
  const id = e.target.dataset.id;
  const type = e.target.dataset.type;
  if (!id || !type) return;

  const set = activeProject.config.keywordSets.find(s => s.id === id);
  if (!set) return;

  set[type] = e.target.value;
  await saveProject();
  updateSummary();
  validateStart();
};

sheetDomainsInput.oninput = async () => {
  activeProject.config.sheetDomains = sheetDomainsInput.value;
  await saveProject();
};

sheetUrlsInput.oninput = async () => {
  activeProject.config.sheetUrls = sheetUrlsInput.value;
  await saveProject();
};

sheetKeywordsInput.oninput = async () => {
  activeProject.config.sheetKeywords = sheetKeywordsInput.value;
  await saveProject();
};


keywordSetsContainer.onclick = async e => {
  if (!e.target.classList.contains("keyword-set-remove")) return;

  const id = e.target.dataset.id;
  activeProject.config.keywordSets =
    activeProject.config.keywordSets.filter(s => s.id !== id);

  await saveProject();
  renderKeywordSets();
  updateSummary();
  validateStart();
};

/* ===============================
   START (NORMAL + MULTI-SET)
=============================== */

startBtn.onclick = async () => {
  if (!activeProject) return;

// 🛑 DO NOT rebuild if run already exists
if (activeProject.run) {
  window.currentRunningProjectId = activeProject.id;
  window.showView("view-project-running");
  return;
}

// 🔴 RESUME STOPPED PROJECT
if (activeProject.status === "Stopped" && activeProject.run) {
  activeProject.status = "Running";
  window.currentRunningProjectId = activeProject.id;

  await saveProject();
  window.showView("view-project-running");
  return;
}


  /* ===============================
     SHEET MODE
  =============================== */
  if (activeProject.config.mode === "sheet") {
    try {
      validateSheetMode();
      buildSheetRun();
      activeProject.status = "Running";
      window.currentRunningProjectId = activeProject.id;
      await saveProject();
      window.showView("view-project-running");
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const domainList = domainSets[selectedDomainSet] || [];
  if (!domainList.length) return;

  let totalRequired;
  try {
    totalRequired = getTotalRequiredLinks();
  } catch (err) {
    alert(err.message);
    return;
  }

  const targetLinks = Number(activeProject.config.desiredTotalLinks);
  if (!targetLinks || targetLinks !== totalRequired) {
    alert(
      `Target Links must equal sum of all sets.\n\n` +
      `Sets total: ${totalRequired}\n` +
      `Target Links: ${targetLinks || 0}`
    );
    return;
  }

  if (domainList.length < totalRequired) {
    alert(
      `Not enough domains.\n\n` +
      `Required links: ${totalRequired}\n` +
      `Available domains: ${domainList.length}`
    );
    return;
  }

  /* ===============================
     FIRST RUN (NO EXISTING RUN)
  =============================== */
  if (!activeProject.run) {
    activeProject.run = {
      startedAt: Date.now(),
      domainSet: selectedDomainSet,
      target: targetLinks,
      domains: []
    };

    let cursor = 0;

    activeProject.config.keywordSets.forEach((set, setIndex) => {
      const urls = expandLines(set.urls);
      const keywords = buildKeywordTasksForSet(set, setIndex);

      keywords.forEach((kw, i) => {
        activeProject.run.domains.push({
          domain: domainList[cursor],
          url: urls[i % urls.length],
          keyword: kw,
          setIndex,
          status: "Pending",
          role: "primary",
          message: ""
        });
        cursor++;
      });
    });

    for (let i = cursor; i < domainList.length; i++) {
      activeProject.run.domains.push({
        domain: domainList[i],
        url: "",
        keyword: "",
        setIndex: null,
        status: "Unused",
        role: "extra",
        message: ""
      });
    }
  }

  /* ===============================
     RESUME WITH EDITS
     (DO NOT TOUCH SUCCESS)
  =============================== */
  else {
    const run = activeProject.run;

    let editableIndex = 0;

    activeProject.config.keywordSets.forEach((set, setIndex) => {
      const urls = expandLines(set.urls);
      const keywords = buildKeywordTasksForSet(set, setIndex);

      keywords.forEach((kw, i) => {

        // 🔵 find next NON-success row
        let row = null;

        while (editableIndex < run.domains.length) {
          const candidate = run.domains[editableIndex];
          editableIndex++;

          if (candidate.status !== "Success") {
            row = candidate;
            break;
          }
        }

        if (!row) return;

        // update ONLY non-success rows
        row.url = urls[i % urls.length];
        row.keyword = kw;
        row.setIndex = setIndex;

        if (row.status !== "Failed") {
          row.status = "Pending";
          row.message = "";
        }
      });
    });
  }

  /* ===============================
     START ENGINE
  =============================== */

  activeProject.status = "Running";
  window.currentRunningProjectId = activeProject.id;

  await saveProject();
  window.showView("view-project-running");
};


/* ===============================
   KEYWORD NORMALIZATION (MERGED)
=============================== */

function normalizeKeywordLines(raw) {
  if (!raw) return [];

  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed = [];

  lines.forEach(line => {
    let qty = null;
    let keyword = line;

    // (5)
    let m = line.match(/^(.*)\((\d+)\)$/);
    if (m) {
      keyword = m[1].trim();
      qty = Number(m[2]);
    } else {
      // old flexible formats
      m = line.match(/^(.*?)(?:[:@])\s*(\d+)(?:\s+\w+)?$/);
      if (m) {
        keyword = m[1].trim();
        qty = Number(m[2]);
      } else {
        // new strict: start or end
        m = line.match(/^(\d+)\s+(.*)$/);
        if (m) {
          qty = Number(m[1]);
          keyword = m[2].trim();
        } else {
          m = line.match(/^(.*)\s+(\d+)$/);
          if (m) {
            keyword = m[1].trim();
            qty = Number(m[2]);
          }
        }
      }
    }

    keyword = keyword
      .replace(/[@():\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    parsed.push({
      keyword,
      qty: qty && qty > 0 ? qty : null
    });
  });

  return parsed;
}

/* ===============================
   EXPAND LINES (URL + KEYWORD SAFE)
=============================== */

function expandLines(raw) {
  if (!raw) return [];
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const out = [];

  lines.forEach(line => {
    const m = line.match(/^(.*)\((\d+)\)$/);
    if (m) {
      for (let i = 0; i < Number(m[2]); i++) {
        out.push(m[1].trim());
      }
    } else {
      out.push(line);
    }
  });

  return out;
}

/* ===============================
   HELPERS
=============================== */

function buildKeywordTasksForSet(set, index) {
  if (!set.keywords || !set.keywords.trim()) {
    throw new Error(`Set ${index + 1}: Please add keywords.`);
  }

  const required = Number(set.requiredLinks);
  if (!required || required <= 0) {
    throw new Error(`Set ${index + 1}: Required Links must be greater than 0.`);
  }

  const parsed = normalizeKeywordLines(set.keywords);

  if (!parsed.length) {
    throw new Error(`Set ${index + 1}: No valid keywords found.`);
  }

  const result = [];
  let explicitUsed = 0;

  // first, push explicit quantities
  parsed.forEach(p => {
    if (p.qty) {
      for (let i = 0; i < p.qty; i++) result.push(p.keyword);
      explicitUsed += p.qty;
    }
  });

  const remaining = required - explicitUsed;
  if (remaining < 0) {
    throw new Error(`Set ${index + 1}: Keyword quantities exceed required links.`);
  }

  const pool = parsed.filter(p => !p.qty).map(p => p.keyword);
  if (!pool.length && remaining > 0) {
    throw new Error(`Set ${index + 1}: Not enough keywords to fill required links.`);
  }

  let i = 0;
  while (result.length < required) {
    result.push(pool[i % pool.length]);
    i++;
  }

  return result;
}

function getTotalRequiredLinks() {
  return activeProject.config.keywordSets.reduce(
    (sum, s) => sum + Number(s.requiredLinks || 0),
    0
  );
}

/* ===============================
   DOMAIN SETS
=============================== */

async function loadDomainSets() {
  domainSetSelect.innerHTML = "<option value=''>Select domain set</option>";
  domainSets = await window.api.loadDomains();

  Object.keys(domainSets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `${name} (${domainSets[name].length})`;
    domainSetSelect.appendChild(opt);
  });

  selectedDomainSet = activeProject.config.domainSet || "";
  domainSetSelect.value = selectedDomainSet;
}

function toggleSheetModeUI() {
  if (!activeProject) return;

  const isSheet = activeProject.config.mode === "sheet";

  sheetModeCard.style.display = isSheet ? "block" : "none";
}

function validateSheetMode() {
  const domains = (activeProject.config.sheetDomains || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const urls = (activeProject.config.sheetUrls || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const keywords = (activeProject.config.sheetKeywords || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  if (!domains.length || !urls.length || !keywords.length) {
    throw new Error("Sheet mode: all fields must be filled.");
  }

  if (domains.length !== urls.length || domains.length !== keywords.length) {
    throw new Error("Sheet mode: domains, URLs, and keywords must have same number of lines.");
  }

  const uniqueDomains = new Set(domains);
  if (uniqueDomains.size !== domains.length) {
    throw new Error("Sheet mode: domains must be unique.");
  }

  const domainSetList = domainSets[selectedDomainSet] || [];
  if (domainSetList.length < domains.length) {
    throw new Error(
      `Sheet mode: not enough domains in selected domain set.\n` +
      `Needed: ${domains.length}\nAvailable: ${domainSetList.length}`
    );
  }
}

function buildSheetRun() {
  const domains = activeProject.config.sheetDomains
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const urls = activeProject.config.sheetUrls
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const keywords = activeProject.config.sheetKeywords
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const domainPool = domainSets[selectedDomainSet] || [];

  activeProject.run = {
    startedAt: Date.now(),
    domainSet: selectedDomainSet,
    target: domains.length,
    domains: []
  };

  // primary rows
  for (let i = 0; i < domains.length; i++) {
  const pool = domainSets[selectedDomainSet] || [];

  const cleanInput = domains[i].replace(/^https?:\/\//, "").trim();

  const fullDomain = pool.find(d => {
    const base = d.split("|")[0].replace(/^https?:\/\//, "").trim();
    return base === cleanInput;
  });

  if (!fullDomain) {
    throw new Error(`Domain not found in selected set: ${domains[i]}`);
  }

  activeProject.run.domains.push({
      domain: fullDomain,
      url: urls[i],
      keyword: keywords[i],
      setIndex: null,
      status: "Pending",
      role: "primary",
      message: ""
    });
  }

  // backups
  for (let i = domains.length; i < domainPool.length; i++) {
    activeProject.run.domains.push({
      domain: domainPool[i],
      url: "",
      keyword: "",
      setIndex: null,
      status: "Unused",
      role: "backup",
      message: ""
    });
  }
}


/* ===============================
   SUMMARY / SAVE
=============================== */
function updateSummary() {
  const domains = domainSets[selectedDomainSet] || [];

  summaryEl.innerHTML = `
    <div class="summary-row">
      <span><strong>Project:</strong> ${activeProject.name}</span>
      <span><strong>Domain set:</strong> ${selectedDomainSet || "Not selected"}</span>
      <span><strong>Total domains:</strong> ${domains.length}</span>
      <span><strong>Target links:</strong> ${activeProject.config.desiredTotalLinks || "Auto"}</span>
    </div>
  `;
}


function validateStart() {
  startBtn.disabled = !selectedDomainSet;
}

async function saveProject() {
  const projects = await window.api.loadProjects();
  const idx = projects.findIndex(p => p.id === activeProject.id);
  if (idx === -1) return;

  const diskProject = projects[idx];

  projects[idx] = {
    ...diskProject,
    ...activeProject,

    // 🔒 preserve status only if disk already has one
    status: activeProject.status ?? diskProject.status,

    // 🔒 preserve run ONLY if activeProject has none
    run: activeProject.run ?? diskProject.run
  };

  await window.api.saveProjects(projects);
}




