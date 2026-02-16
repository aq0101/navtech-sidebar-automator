console.log("SETTINGS JS LOADED");

/* ===============================
   SETTINGS STATE
   =============================== */

let settings = {
  execution: {
    projectThreads: 1,
    domainThreads: 1,
    delaySeconds: 0,
    maxRetries: 0
  },
  proxies: []
};

/* ===============================
   ELEMENTS (MATCH HTML EXACTLY)
   =============================== */

// Execution inputs
const projectThreadsInput = document.getElementById("projectThreads");
const domainThreadsInput = document.getElementById("domainThreads");
const delaySecondsInput = document.getElementById("delaySeconds");
const maxRetriesInput = document.getElementById("maxRetries");

// Save button
const saveBtn = document.getElementById("saveSettings");

// Proxy elements
const addProxyBtn = document.getElementById("openProxyModal");
const proxyTableBody = document.getElementById("proxyTable");
const testProxyBtn = document.getElementById("testProxyBtn");
const removeProxyBtn = document.getElementById("removeProxyBtn");

// Modal elements
const proxyModal = document.getElementById("proxyModal");
const proxyBulkInput = document.getElementById("proxyBulkInput");
const confirmProxyBtn = document.getElementById("confirmProxy");
const cancelProxyBtn = document.getElementById("cancelProxy");

/* ===============================
   LOAD SETTINGS
   =============================== */

async function loadSettings() {
  try {
    const data = await window.api.getSettings();
    if (data && typeof data === "object") {
      settings = {
        execution: data.execution ?? settings.execution,
        proxies: Array.isArray(data.proxies) ? data.proxies : []
      };
    }
  } catch (err) {
    console.error("Failed to load settings", err);
  }

  renderExecution();
  renderProxies();
}

/* ===============================
   RENDER EXECUTION
   =============================== */

function renderExecution() {
  projectThreadsInput.value = settings.execution.projectThreads;
  domainThreadsInput.value = settings.execution.domainThreads;
  delaySecondsInput.value = settings.execution.delaySeconds;
  maxRetriesInput.value = settings.execution.maxRetries;
}

/* ===============================
   SAVE SETTINGS
   =============================== */

saveBtn.onclick = async () => {
  settings.execution.projectThreads = Number(projectThreadsInput.value);
  settings.execution.domainThreads = Number(domainThreadsInput.value);
  settings.execution.delaySeconds = Number(delaySecondsInput.value);
  settings.execution.maxRetries = Number(maxRetriesInput.value);

  try {
    await window.api.saveSettings(settings);
    showToast("Settings saved");
  } catch (err) {
    console.error(err);
    showToast("Failed to save settings", true);
  }
};

/* ===============================
   PROXY MANAGER (MODAL-BASED)
   =============================== */

// OPEN MODAL
addProxyBtn.onclick = () => {
  proxyBulkInput.value = "";
  proxyModal.classList.remove("hidden");
};

// CANCEL MODAL
cancelProxyBtn.onclick = () => {
  proxyModal.classList.add("hidden");
};

// CONFIRM ADD
confirmProxyBtn.onclick = () => {
  const lines = proxyBulkInput.value
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  lines.forEach(line => {
    const parts = line.split(":");
    if (parts.length !== 4) return;

    const [ip, port, user, pass] = parts;

    settings.proxies.push({
      ip,
      port,
      user,
      pass,
      status: "untested"
    });
  });

  proxyModal.classList.add("hidden");
  renderProxies();
};

// REMOVE SELECTED
removeProxyBtn.onclick = () => {
  const checks = proxyTableBody.querySelectorAll("input:checked");
  const indexes = [...checks].map(c => Number(c.dataset.index));

  settings.proxies = settings.proxies.filter(
    (_, i) => !indexes.includes(i)
  );

  renderProxies();
};

// TEST SELECTED (REAL)
testProxyBtn.onclick = async () => {
  const checks = proxyTableBody.querySelectorAll("input:checked");
  const indexes = [...checks].map(c => Number(c.dataset.index));

  if (!indexes.length) {
    showToast("No proxies selected", true);
    return;
  }

  showToast("Testing proxies...");

  try {
    await window.api.testProxies(indexes);
    await loadSettings(); // reload settings.json to refresh statuses
    showToast("Proxy test completed");
  } catch (err) {
    console.error(err);
    showToast("Proxy test failed", true);
  }
};

/* ===============================
   RENDER PROXIES
   =============================== */

function renderProxies() {
  proxyTableBody.innerHTML = "";

  settings.proxies.forEach((p, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-index="${index}"></td>
      <td>${p.ip}</td>
      <td>${p.port}</td>
      <td>${p.user}</td>
      <td>${p.status}</td>
    `;
    proxyTableBody.appendChild(tr);
  });
}

/* ===============================
   TOAST
   =============================== */

function showToast(text, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = text;

  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.right = "24px";
  toast.style.padding = "12px 18px";
  toast.style.background = isError ? "#e74c3c" : "#5b2ea6";
  toast.style.color = "#fff";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "14px";
  toast.style.zIndex = "9999";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.2s ease";

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ===============================
   INIT
   =============================== */

(async () => {
  console.log("INIT SETTINGS CALLED");
  await loadSettings();
})();
