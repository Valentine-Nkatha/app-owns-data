const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

// Replace placeholders with your actual values
const tenantId = "<TENANT_ID>";
const clientId = "<CLIENT_ID>";
const clientSecret = "<CLIENT_SECRET>";
const workspaceId = "<WORKSPACE_ID>";
const reportId = "<REPORT_ID>";
const datasetId = "<DATASET_ID>";

// Helper: get AAD token
async function getAADToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("grant_type", "client_credentials");
  params.append("scope", "https://analysis.windows.net/powerbi/api/.default");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.access_token;
}

// API route: /embed-info
app.get("/embed-info", async (req, res) => {
  try {
    const aadToken = await getAADToken();

    // Get report metadata
    const reportRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`,
      { headers: { Authorization: `Bearer ${aadToken}` } }
    );
    const report = await reportRes.json();

    // Generate embed token
    const tokenRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aadToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessLevel: "View",
          datasets: [{ id: datasetId }]
        })
      }
    );
    const embedTokenResponse = await tokenRes.json();

    res.json({
      embedUrl: report.embedUrl,
      reportId: report.id,
      embedToken: embedTokenResponse.token,
      expiration: embedTokenResponse.expiration
    });
  } catch (err) {
    console.error("Error in /embed-info:", err);
    res.status(500).send("Failed to get embed info");
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running on http://0.0.0.0:3000");
});
