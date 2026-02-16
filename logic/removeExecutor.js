const axios = require("axios");
const cheerio = require("cheerio");
const { HttpsProxyAgent } = require("https-proxy-agent");

/* ================= NORMALIZE ================= */

function normalize(d = "") {
  return d
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .trim();
}

/* ================= CLIENT ================= */

function buildClient(domainCreds, proxyString) {
  const authToken = Buffer.from(
    `${domainCreds.username}:${domainCreds.password}`
  ).toString("base64");

  const agent = proxyString
    ? new HttpsProxyAgent(proxyString)
    : null;

  return axios.create({
    baseURL: domainCreds.url,
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
      "Accept": "application/json",
      "Authorization": `Basic ${authToken}`,
    },
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false
  });
}

/* ================= MAIN ================= */

async function processRemoveRow(row, settings, domainMap) {

  const key = normalize(row.domain);
  const creds = domainMap[key];

  if (!creds) {
    throw new Error("Domain not in set");
  }

  const proxy = settings.currentProxy || null;
  const client = buildClient(creds, proxy);

  const targetHref = normalize(row.url);
  const targetAnchor = row.keyword.trim().toLowerCase();

  const sidebarsResp = await client.get("/wp-json/wp/v2/sidebars");
  const sidebars = sidebarsResp.data;

  for (const sb of sidebars) {

    if (sb.id === "wp_inactive_widgets") continue;

    for (const widgetId of sb.widgets || []) {

      let w;
      try {
        w = await client.get(
          `/wp-json/wp/v2/widgets/${widgetId}?context=edit`
        );
      } catch {
        continue;
      }

      const raw = w.data.instance?.raw || {};
      const content = raw.text || raw.content || "";
      if (!content.trim()) continue;

      const $ = cheerio.load(content);

      for (const el of $("a[href]").toArray()) {

        const href = normalize($(el).attr("href"));
        const anchor = $(el).text().trim().toLowerCase();

        if (href === targetHref && anchor === targetAnchor) {

          // ================= REMOVE FROM SIDEBAR =================
          const remaining = (sb.widgets || []).filter(id => id !== widgetId);

          await client.post(
            `/wp-json/wp/v2/sidebars/${sb.id}`,
            { widgets: remaining }
          );

          // ================= DELETE WIDGET =================
          await client.delete(
            `/wp-json/wp/v2/widgets/${widgetId}`
          );

          return;
        }
      }
    }
  }

  throw new Error("Widget not found");
}

module.exports = { processRemoveRow };
