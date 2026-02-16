console.log("✅ DASHBOARD JS LOADED");

/* ===============================
   STATE
=============================== */

let projects = [];
let selectedIds = new Set();

/* ===============================
   ELEMENTS
=============================== */

const dashboardView = document.getElementById("view-dashboard");
const tableBody = dashboardView.querySelector("tbody");

const createBtn = document.getElementById("createProjectBtn");
const editBtn = document.getElementById("editProjectBtn");
const duplicateBtn = document.getElementById("duplicateProjectBtn");
const deleteBtn = document.getElementById("deleteProjectBtn");

/* ===============================
   LOAD PROJECTS
=============================== */

async function loadProjects() {
  try {
    const data = await window.api.loadProjects();
    projects = Array.isArray(data) ? data : [];
  } catch {
    projects = [];
  }
  renderProjects();
}

/* ===============================
   RENDER TABLE
=============================== */

function renderProjects() {
  tableBody.innerHTML = "";
  selectedIds.clear();

  projects.forEach(project => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td class="project-name">${project.name}</td>
      <td>${new Date(project.created).toLocaleString()}</td>
      <td>${project.status || "Idle"}</td>
    `;

    const checkbox = tr.querySelector("input");
    const nameCell = tr.querySelector(".project-name");

    checkbox.onclick = e => {
      e.stopPropagation();
      checkbox.checked
        ? selectedIds.add(project.id)
        : selectedIds.delete(project.id);
      updateActionState();
    };

    // ✅ ONLY correct entry point
    nameCell.onclick = e => {
      e.stopPropagation();
      window.openProjectConfig(project.id);
    };

    tableBody.appendChild(tr);
  });

  updateActionState();
}

/* ===============================
   ACTION STATE
=============================== */

function updateActionState() {
  editBtn.disabled = selectedIds.size !== 1;
  duplicateBtn.disabled = selectedIds.size !== 1;
  deleteBtn.disabled = selectedIds.size === 0;
}

/* ===============================
   BUTTON ACTIONS
=============================== */

// CREATE
createBtn.onclick = () => {
  window.viewManager.openProjectModal({
    title: "Create New Project",
    onConfirm: async name => {
      projects.push({
        id: crypto.randomUUID(),
        name,
        created: Date.now(),
        status: "Idle",
        config: {}
      });
      await window.api.saveProjects(projects);
      renderProjects();
    }
  });
};

// EDIT
editBtn.onclick = () => {
  const id = [...selectedIds][0];
  const project = projects.find(p => p.id === id);
  if (!project) return;

  window.viewManager.openProjectModal({
    title: "Edit Project",
    value: project.name,
    onConfirm: async name => {
      project.name = name;
      await window.api.saveProjects(projects);
      renderProjects();
    }
  });
};

// DUPLICATE
duplicateBtn.onclick = async () => {
  const id = [...selectedIds][0];
  const original = projects.find(p => p.id === id);
  if (!original) return;

  const copy = {
    ...original,

    id: crypto.randomUUID(),
    name: `${original.name} copy`,
    created: Date.now(),

    // 🔴 RESET STATE
    status: "Idle",
    run: null,
    message: ""
  };

  projects.push(copy);

  await window.api.saveProjects(projects);
  renderProjects();
};


// DELETE (THEMED)
deleteBtn.onclick = () => {
  if (!selectedIds.size) return;

  window.viewManager.confirm({
    title: "Delete Projects",
    message: `Delete ${selectedIds.size} project(s)? This cannot be undone.`,
    onConfirm: async () => {
      projects = projects.filter(p => !selectedIds.has(p.id));
      selectedIds.clear();
      await window.api.saveProjects(projects);
      renderProjects();
    }
  });
};

/* ===============================
   INIT
=============================== */

loadProjects();

window.onDashboardView = async function () {
  await loadProjects();
};

// 🔴 FORCE refresh when dashboard becomes visible
document.addEventListener("view:dashboard", loadProjects);
