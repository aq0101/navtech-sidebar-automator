console.log("✅ VIEW MANAGER LOADED");

const views = document.querySelectorAll(".view");

function showView(id) {
  views.forEach(v => v.classList.remove("active"));

  const target = document.getElementById(id);
  if (!target) {
    console.error("View not found:", id);
    return;
  }

  target.classList.add("active");

  // ===============================
  // 🔑 LIFECYCLE HOOKS
  // ===============================

  if (id === "view-project-running" && typeof window.onProjectRunningView === "function") {
    window.onProjectRunningView();
  }

  if (id === "view-project-config" && typeof window.onProjectConfigView === "function") {
    window.onProjectConfigView();
  }

  if (id === "view-dashboard" && typeof window.onDashboardView === "function") {
    window.onDashboardView();
  }
}

/* ===============================
   PROJECT MODAL (CREATE / EDIT)
=============================== */

function openProjectModal({ title, value = "", onConfirm }) {
  const modal = document.getElementById("projectModal");
  const input = document.getElementById("projectNameInput");
  const confirmBtn = document.getElementById("confirmProject");
  const cancelBtn = document.getElementById("cancelProject");

  modal.querySelector("h3").textContent = title;
  input.value = value;
  modal.classList.remove("hidden");

  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);

  const cleanup = () => {
    modal.classList.add("hidden");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;

  confirmBtn.onclick = async () => {
    const name = input.value.trim();
    if (!name) return;
    await onConfirm(name);
    cleanup();
  };
}

/* ===============================
   CONFIRM MODAL
=============================== */

function confirm({ title, message, onConfirm }) {
  const modal = document.getElementById("globalModal");
  const titleEl = modal.querySelector("h3");
  const input = modal.querySelector("input");
  const cancelBtn = modal.querySelector(".cancel-btn");
  const confirmBtn = modal.querySelector(".confirm-btn");

  titleEl.textContent = title;
  input.style.display = "none";

  modal.classList.remove("hidden");

  const cleanup = () => {
    modal.classList.add("hidden");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;
  confirmBtn.onclick = async () => {
    await onConfirm();
    cleanup();
  };
}

/* ===============================
   PUBLIC API
=============================== */

window.viewManager = {
  showDashboard() {
    showView("view-dashboard");
  },

  showProjectConfig(projectId) {
    if (typeof window.openProjectConfig === "function" && projectId) {
      window.openProjectConfig(projectId);
    } else {
      showView("view-project-config");
    }
  },

  showRunningProject(projectId) {
    if (projectId) {
      window.currentRunningProjectId = projectId;
    }
    showView("view-project-running");
  },

  openProjectModal,
  confirm
};

window.showView = showView;
