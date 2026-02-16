global.forceStop = false;
const { parentPort } = require("worker_threads");
const { startEngine, stopEngine } = require("./engine");

global.editRun = null;
global.removeRun = null;
global.forceStop = false;

parentPort.on("message", (msg) => {
  console.log("WORKER GOT MESSAGE", msg.type);

  // ================= REMOVE ROWS =================
  if (msg.type === "edit:removeRows") {
  if (!global.editRun) return;

  global.editRun.rows = global.editRun.rows.filter(r => 
    !msg.ids.includes(r.rowId)
  );

  // 🔥 force UI update immediately
  parentPort.postMessage({
    type: "update",
    editRun: global.editRun
  });

  return;
}

  // ================= START PROJECT MODE =================
 if (msg.type === "startProject") {
  global.forceStop = false;
  startEngine();
  return;
}

  // ================= EDIT MODE START =================
  if (msg.type === "editRun") {
  global.editRun = msg.data;
  global.removeRun = null;

  global.forceStop = false;
  startEngine();
  return;
}


  // ================= REMOVE MODE START =================
  if (msg.type === "removeRun") {
  global.removeRun = msg.data;
  global.editRun = null;

  global.forceStop = false;
  startEngine();
  return;
}

  // ================= STOP =================
  if (msg.type === "stop") {
  global.forceStop = true;
  stopEngine();
  return;
}
});


// ================= LIVE UI SYNC =================
setInterval(() => {
// 🔥 DO NOT override UI if nothing loaded yet
  if (!global.editRun && !global.removeRun) return;
  parentPort.postMessage({
    type: "update",
    editRun: global.editRun,
    removeRun: global.removeRun
  });
}, 500);
