const axios = require("axios");
const https = require("https");

/* ===============================
   EXECUTE DOMAIN (REAL WP)
=============================== */

async function executeDomain(domainRow, proxy) {
  // domain|username|password
  let [rawDomain, username, appPassword] = domainRow.domain.split("|");

// strip /wp-admin or /admin if present
rawDomain = rawDomain.replace(/\/wp-admin.*$/i, "");
rawDomain = rawDomain.replace(/\/admin.*$/i, "");
rawDomain = rawDomain.replace(/\/$/, "");


  if (!rawDomain || !username || !appPassword) {
    throw new Error("Invalid domain credentials format");
  }

  const baseUrl = rawDomain.startsWith("http")
    ? rawDomain
    : `https://${rawDomain}`;

  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");

  /* ===============================
     PROXY SAFE PARSING (FIX)
  =============================== */

  let axiosProxy = false;

  if (typeof proxy === "string" && proxy.trim()) {
    // expected: http://user:pass@host:port OR host:port
    const p = proxy.replace(/^https?:\/\//, "");
    const [authPart, hostPart] = p.includes("@") ? p.split("@") : [null, p];
    const [host, port] = hostPart.split(":");

    axiosProxy = {
      protocol: "http",
      host,
      port: Number(port)
    };

    if (authPart) {
      const [u, pw] = authPart.split(":");
      axiosProxy.auth = { username: u, password: pw };
    }
  }

  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`
    },
    proxy: axiosProxy,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  /* ===============================
     STEP 1 — DETECT SIDEBAR
  =============================== */

  const sidebarsResp = await client.get("/wp-json/wp/v2/sidebars");

  if (!Array.isArray(sidebarsResp.data) || !sidebarsResp.data.length) {
    throw new Error("No sidebars found");
  }

  const sidebar =
    sidebarsResp.data.find(sb => sb.status === "active") ||
    sidebarsResp.data.find(sb => Array.isArray(sb.widgets)) ||
    null;

  if (!sidebar || !sidebar.id) {
    throw new Error("No active sidebar detected");
  }

  const sidebarId = sidebar.id;
  const existingWidgets = Array.isArray(sidebar.widgets)
    ? sidebar.widgets
    : [];

  /* ===============================
     STEP 2 — CREATE WIDGET
  =============================== */

  const widgetHtml = `<a href="${domainRow.url}"><strong>${domainRow.keyword}</strong></a>`;

  const widgetResp = await client.post("/wp-json/wp/v2/widgets", {
    id_base: "custom_html",
    instance: {
      raw: {
        content: widgetHtml
      }
    }
  });

  if (widgetResp.status !== 201 || !widgetResp.data?.id) {
    throw new Error("Widget creation failed");
  }

  const widgetId = widgetResp.data.id;

  /* ===============================
     STEP 3 — ASSIGN WIDGET (TOP)
  =============================== */

  if (!existingWidgets.includes(widgetId)) {
    const updatedWidgets = [widgetId, ...existingWidgets];

    const assignResp = await client.post(
      `/wp-json/wp/v2/sidebars/${sidebarId}`,
      { widgets: updatedWidgets }
    );

    if (assignResp.status !== 200) {
      throw new Error("Failed to assign widget to sidebar");
    }
  }

  // ✅ success → engine handles message
}

module.exports = {
  executeDomain
};
