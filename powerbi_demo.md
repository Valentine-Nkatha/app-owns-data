# Power BI App Owns Data - End-to-End Demo Setup on Ubuntu

## 1. Prerequisites
- Fresh Ubuntu 22.04/24.04 VM  
- Internet access to Azure endpoints (`login.microsoftonline.com`, `api.powerbi.com`, `app.powerbi.com`)  
- Power BI Service principal registered in Entra ID (with `Tenant.Read.All`, `Dataset.Read.All`, and `Report.Read.All` permissions)  
- Service principal added to the target workspace with **Reshare** permissions  

Replace placeholders with your actual values:
- **Tenant ID**: `<TENANT_ID>`  
- **Client ID**: `<CLIENT_ID>`  
- **Client Secret**: `<CLIENT_SECRET>`  
- **Workspace ID**: `<WORKSPACE_ID>`  
- **Report ID**: `<REPORT_ID>`  
- **Dataset ID**: `<DATASET_ID>`  

---

## 2. Install required packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx
```

Install Node.js LTS (20.x):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Check versions:
```bash
node -v
npm -v
```

---

## 3. Setup backend project

```bash
mkdir ~/powerbi-demo && cd ~/powerbi-demo
npm init -y
npm install express node-fetch@2 cors
```

Create `server.js`:

```javascript
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
```

Run it:
```bash
node server.js
```

Test:
```bash
curl http://localhost:3000/embed-info
```
Expected JSON with `embedUrl`, `reportId`, `embedToken`.

---

## 4. Configure nginx reverse proxy

Edit `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;

    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy /embed-info to Node.js backend
    location /embed-info {
        proxy_pass http://127.0.0.1:3000/embed-info;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify:
```bash
curl http://localhost/embed-info
```

---

## 5. Create frontend

`/var/www/html/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Power BI Demo</title>
  <script src="https://cdn.jsdelivr.net/npm/powerbi-client/dist/powerbi.js"></script>
</head>
<body>
  <h2>Embedded Power BI Report</h2>
  <div id="reportContainer" style="height:800px; width:100%; border:1px solid #ccc;"></div>

  <script>
    async function loadReport() {
      if (!window['powerbi-client']) {
        console.error("❌ Power BI SDK not loaded!");
        return;
      }

      try {
        const res = await fetch("/embed-info");
        if (!res.ok) throw new Error("Failed to fetch embed info");
        const { embedUrl, embedToken, reportId } = await res.json();

        console.log("✅ Embed info received:", { embedUrl, reportId });

        const models = window['powerbi-client'].models;

        const config = {
          type: "report",
          id: reportId,
          embedUrl: embedUrl,
          accessToken: embedToken,
          tokenType: models.TokenType.Embed,
          settings: {
            panes: { filters: { visible: false } },
            navContentPaneEnabled: true
          }
        };

        const container = document.getElementById("reportContainer");
        const report = powerbi.embed(container, config);

        report.on("loaded", () => console.log("✅ Report loaded successfully"));
        report.on("error", err => console.error("❌ Report error:", err));

      } catch (err) {
        console.error("❌ loadReport() failed:", err);
      }
    }

    loadReport();
  </script>
</body>
</html>
```

Open in browser:
```
http://<VM-IP>/index.html
```

---

## 6. Optional polish

**Keep backend alive with pm2:**
```bash
sudo npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

**Enable HTTPS with self-signed cert:**
```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/ssl/private/powerbi.key -out /etc/ssl/certs/powerbi.crt -days 365
```

Update nginx config:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/powerbi.crt;
    ssl_certificate_key /etc/ssl/private/powerbi.key;

    root /var/www/html;
    index index.html;

    location /embed-info {
        proxy_pass http://127.0.0.1:3000/embed-info;
        proxy_set_header Host $host;
    }
}
```

Reload nginx:
```bash
sudo systemctl reload nginx
```

Now access:
```
https://<VM-IP>/index.html
```

---

✅ You now have a **complete working demo** for Power BI App Owns Data embedding.
