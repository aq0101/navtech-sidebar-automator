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
  httpAgent: agent,     // 🔥 ADD THIS LINE
  httpsAgent: agent,
  proxy: false
});

  }


/* ================= MAIN ================= */

async function processEditRow(row, settings, domainMap) {
  console.log("ROW:", row);

  const oldKey = normalize(row.oldDomain);
  const newKey = row.newDomain
    ? normalize(row.newDomain)
    : oldKey;

  const oldCreds = domainMap[oldKey];
  const newCreds = domainMap[newKey];

  if (!oldCreds) throw new Error("Old domain not in set");
  if (!newCreds) throw new Error("New domain not in set");

  /* ========= BUILD PROXY ========= */

  const proxy = settings.currentProxy || null;
  console.log("PROXY STRING:", proxy);

  /* ========= CLIENT ========= */

  const oldClient = buildClient(oldCreds, proxy);
  console.log(oldClient.defaults.httpAgent, oldClient.defaults.httpsAgent);


  const targetHref = normalize(row.oldUrl);
  const targetAnchor = row.oldKeyword.trim().toLowerCase();

  console.log("Searching widget...");
  console.log("TARGET URL:", targetHref);
  console.log("TARGET KEYWORD:", targetAnchor);

  const sidebarsResp = await oldClient.get("/wp-json/wp/v2/sidebars");
  const sidebars = sidebarsResp.data;

  for (const sb of sidebars) {
    if (sb.id === "wp_inactive_widgets") continue;

    for (const widgetId of sb.widgets || []) {
      let w;
      try {
        w = await oldClient.get(
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
          console.log("FOUND WIDGET:", widgetId);

          const finalUrl = row.newUrl || row.oldUrl;
          const finalKeyword = row.newKeyword || row.oldKeyword;
          const newHtml = `<a href="${finalUrl}"><strong>${finalKeyword}</strong></a>`;

          /* ===== SAME DOMAIN ===== */

          if (oldKey === newKey) {
            await oldClient.post(
              `/wp-json/wp/v2/widgets/${widgetId}`,
              {
                instance: {
                  raw: {
                    content: newHtml,
                    text: newHtml
                  }
                }
              }
            );

            console.log("MODIFIED");
            return;
          }

          /* ===== MOVE DOMAIN ===== */

          const newClient = buildClient(newCreds, proxy);

          const createResp = await newClient.post(
            "/wp-json/wp/v2/widgets",
            {
              id_base: "custom_html",
              instance: { raw: { content: newHtml } }
            }
          );

          const newWidgetId = createResp.data.id;

          const newWidgets = [newWidgetId, ...sb.widgets];

          await newClient.post(
            `/wp-json/wp/v2/sidebars/${sb.id}`,
            { widgets: newWidgets }
          );

          const remaining = sb.widgets.filter(id => id !== widgetId);

          await oldClient.post(
            `/wp-json/wp/v2/sidebars/${sb.id}`,
            { widgets: remaining }
          );

          await oldClient.delete(
            `/wp-json/wp/v2/widgets/${widgetId}`
          );

          console.log("MOVED");
          return;
        }
      }
    }
  }

  throw new Error("Widget not found");
}

module.exports = { processEditRow };
