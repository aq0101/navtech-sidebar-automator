console.log("✅ NAVIGATION JS LOADED");

const navItems = document.querySelectorAll(".nav-item");

navItems.forEach(item => {
  item.addEventListener("click", () => {
    // sidebar active state only
    navItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    const viewName = item.dataset.view;

    // 🔥 delegate ALL view switching
    const fullView = `view-${viewName}`;
showView(fullView);

// 🔥 if dashboard opened → reload projects from disk
if (fullView === "view-dashboard" && window.onDashboardView) {
  window.onDashboardView();
}

  });
});
