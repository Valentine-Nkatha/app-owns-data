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

## 4. Configure nginx reverse proxy

(…rest of your file continues unchanged…)
