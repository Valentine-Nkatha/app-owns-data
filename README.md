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

### Edit `package.json`

After initializing your project with `npm init -y`, npm creates a default `package.json` file.  
By default, it will look roughly like this:

```json
{
  "name": "powerbi-demo",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

You should **edit this file** so that it uses `server.js` as the entry point and defines a convenient `start` script.  
Also, once you install dependencies (like `express` and `node-fetch`), npm will automatically add them under `"dependencies"`.

A good final version of `package.json` for this demo looks like this:

```json
{
  "name": "powerbi-demo",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "node-fetch": "^2.7.0",
    "cors": "^2.8.5"
  }
}
```

**Explanation:**
- `"main": "server.js"` → tells Node.js the entry point of your app.  
- `"scripts": { "start": "node server.js" }` → allows you to run the backend with `npm start`.  
- `"dependencies"` → managed automatically when you install libraries using `npm install <package>`.  

---

### About `package-lock.json`

When you install dependencies, npm also generates a file called `package-lock.json`.  
- It records the **exact versions** of every package (and sub-dependency) installed.  
- This ensures consistent installs across environments (important for reproducibility).  
- **You do not need to edit this file** for this project. Just commit it to version control if you want consistent builds.  

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

Run it:

```bash
node server.js
```

---

## 4. Configure nginx reverse proxy

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

### Keep backend alive with PM2

When you start your backend manually with:

```bash
node server.js
```

- The process runs in the foreground of your terminal.  
- If you close the terminal, log out, or the process crashes, the backend stops running.  
- That means your `/embed-info` endpoint would no longer respond, and the embedded report would fail.  

To fix this, we use **PM2**, a process manager for Node.js. PM2 provides:  
- **Daemonizing:** runs apps in the background.  
- **Auto-restart:** restarts if the app crashes.  
- **Startup scripts:** ensures backend starts automatically on VM reboot.  
- **Monitoring:** easy status checks, CPU/memory usage, and log viewing.  

Install globally:

```bash
sudo npm install -g pm2
```

Start backend with PM2:

```bash
pm2 start server.js --name powerbi-backend
```

Check status:

```bash
pm2 status
```

View logs:

```bash
pm2 logs powerbi-backend
```

Stop or restart:

```bash
pm2 stop powerbi-backend
pm2 restart powerbi-backend
```

Enable auto-start on reboot:

```bash
pm2 save
pm2 startup
```

---

### Enable HTTPS with self-signed cert

```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/ssl/private/powerbi.key -out /etc/ssl/certs/powerbi.crt -days 365
```

Update nginx config:

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
