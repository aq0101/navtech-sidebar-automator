const { executeDomain } = require("./domainExecutor");

async function runProjectScheduler(project, settings, shouldStop) {
  const domains = project.run.domains;
  const domainThreads = settings.execution.domainThreads || 1;
  const delayMs = (settings.execution.delaySeconds || 0) * 1000;

  const pendingDomains = domains.filter(
    d => d.status === "Pending" || d.status === "Running"
  );

  for (let i = 0; i < pendingDomains.length; i += domainThreads) {
    if (shouldStop()) break;

    const batch = pendingDomains.slice(i, i + domainThreads);

    await Promise.all(
      batch.map(async domain => {
        if (shouldStop()) return;

        domain.status = "Running";
        await executeDomain(domain);
        await sleep(delayMs);
      })
    );
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  runProjectScheduler
};
