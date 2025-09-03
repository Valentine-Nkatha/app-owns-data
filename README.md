# Power BI App Owns Data – End-to-End Demo Setup on Ubuntu

This document provides a **step-by-step guide** to setting up a Power BI App Owns Data embedding demo on a fresh Ubuntu VM.  
Every command, config file, and code snippet includes detailed explanations of what it does and why it is required.

---

## 1. Prerequisites

- A fresh Ubuntu 22.04/24.04 Virtual Machine.  
- Internet access to Azure endpoints (`login.microsoftonline.com`, `api.powerbi.com`, `app.powerbi.com`).  
- A Power BI Service Principal registered in Entra ID with **API permissions**:  
  - `Tenant.Read.All`  
  - `Dataset.Read.All`  
  - `Report.Read.All`  
- The Service Principal must be added to the target Power BI workspace with **Member** access (minimum role that grants “Reshare” permissions required for embed token generation).

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

**Explanation:**  
- `apt update` refreshes the package index so your system knows about the latest versions.  
- `apt upgrade -y` upgrades existing packages to their newest versions (`-y` auto-confirms).  
- `curl` is a command-line tool to download files/URLs.  
- `git` allows you to clone/manage repositories (useful but optional).  
- `nginx` is the web server that will serve your frontend HTML and proxy backend API calls.  

---

### Install Node.js LTS (20.x)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Explanation:**  
- The `curl` command downloads a setup script from NodeSource.  
  - `-f` → fail silently on errors.  
  - `-sS` → silent but still show errors.  
  - `-L` → follow redirects.  
- `| sudo -E bash -` pipes the script into `bash`, running it as root (`sudo`), preserving your environment (`-E`).  
- The script adds NodeSource’s APT repository to your system and imports its GPG key.  
- After that, `sudo apt install -y nodejs` installs the Node.js runtime and **npm** (Node Package Manager).  

Check versions:

```bash
node -v
npm -v
```

**Explanation:**  
- `node -v` shows the installed Node.js version.  
- `npm -v` shows the npm version (used to install JavaScript libraries).  

---

## 3. Setup backend project

```bash
mkdir ~/powerbi-demo && cd ~/powerbi-demo
npm init -y
npm install express node-fetch@2 cors
```

**Explanation:**  
- `mkdir ~/powerbi-demo && cd ~/powerbi-demo` creates a project directory and navigates into it.  
- `npm init -y` initializes a Node.js project with default settings (`package.json` created).  
- `npm install express node-fetch@2 cors` installs required dependencies:  
  - **express** → lightweight web framework to build the backend API.  
  - **node-fetch@2** → library for making HTTP requests (v2 chosen for CommonJS compatibility).  
  - **cors** → enables cross-origin requests (so the frontend can call the backend API).  

---

### Create `server.js`

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

**Explanation:**  
- `express()` starts a web server.  
- `app.use(cors())` allows frontend requests from another origin.  
- `getAADToken()` acquires an Azure AD access token using client credentials flow.  
- `/embed-info` is a REST endpoint:  
  1. Fetches report metadata.  
  2. Requests an embed token.  
  3. Returns JSON with `embedUrl`, `reportId`, `embedToken`.  
- `app.listen(3000, "0.0.0.0")` starts the backend on port 3000.  

Run it:

```bash
node server.js
```

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

**Explanation:**  
- `listen 80;` makes nginx listen on HTTP port 80.  
- `root /var/www/html;` serves static files (our frontend `index.html`).  
- `location /embed-info { proxy_pass http://127.0.0.1:3000/embed-info; }` forwards API calls to Node.js backend.  
- Headers ensure proper request forwarding.  

Reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Explanation:**  
- `nginx -t` tests configuration for errors.  
- `systemctl reload nginx` applies changes without restarting the server.  

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

**Explanation:**  
- Loads the Power BI JS SDK from CDN.  
- Calls `/embed-info` to retrieve embed details.  
- Creates a config object with `embedUrl`, `reportId`, and `embedToken`.  
- Embeds the report inside `#reportContainer`.  
- Adds event listeners for success/error logging.  

Open in browser:  
```
http://<VM-IP>/index.html
```

---

## 6. Optional polish

### Keep backend alive with pm2

```bash
sudo npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

**Explanation:**  
- `npm install -g pm2` installs PM2 globally.  
- `pm2 start server.js` runs backend under PM2.  
- `pm2 save` saves process list.  
- `pm2 startup` configures startup script so backend auto-starts on reboot.  

### Enable HTTPS with self-signed cert

```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/ssl/private/powerbi.key -out /etc/ssl/certs/powerbi.crt -days 365
```

**Explanation:**  
- Generates a self-signed TLS certificate valid for 365 days.  
- `-nodes` means no passphrase required.  
- `-keyout` stores private key, `-out` stores cert.  

Update nginx config:

Edit `/etc/nginx/sites-available/default`:

```nginx
# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    server_name _;

    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/ssl/certs/powerbi.crt;
    ssl_certificate_key /etc/ssl/private/powerbi.key;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /embed-info {
        proxy_pass http://127.0.0.1:3000/embed-info;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Explanation:**  
- Configures nginx to serve HTTPS on port 443.  
- Uses the self-signed cert and key created earlier.  

Reload nginx:

```bash
sudo systemctl reload nginx
```

Now access:  
```
https://<VM-IP>/index.html
```

---

✅ You should now have a complete demo for Power BI App Owns Data embedding.
