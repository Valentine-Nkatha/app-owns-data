# Power BI **App Owns Data** – End‑to‑End Reference (Ubuntu + NGINX + Node + Frontend)

> A practical, production‑leaning walkthrough for embedding a Power BI report using the **App Owns Data** pattern.  
> This repository is organized into two self‑contained stages:
> 1) **Obtain all required IDs/secrets**, and 2) **Run the full embed demo** on Ubuntu with a hardened layout (frontend, backend, reverse proxy).

---

## TL;DR

- **Step 1**: Collect everything you need — **Tenant ID, Client ID, Client Secret, Workspace ID, Report ID, Dataset ID**.  
  See: [`step-1_obtain_values/README.md`](./step-1_obtain_values/README.md) (includes a top‑to‑bottom flow diagram).

- **Step 2**: Deploy and run the working **App Owns Data** embed demo on Ubuntu with **Node/Express backend**, **web frontend** and **NGINX**.  
  See: [`step-2_embed_report_demo/README.md`](./step-2_embed_report_demo/README.md) (includes the end‑to‑end flow diagram and example files under `files/`).

---

## Why this repo exists

Most App‑Owns‑Data samples jump straight to code, assuming you already have every identifier and permission lined up. In practice, **gathering those values and aligning tenant settings** is where most teams lose time. This repo:
- Gives you a **repeatable checklist** to collect the exact values you need (Step 1).
- Provides a **minimal yet realistic deployment** on Ubuntu with a clean separation of concerns (frontend ↔ backend ↔ reverse proxy) (Step 2).
- Bakes in **operational tips** (PM2, NGINX, env files, and “don’t‑commit‑secrets” guardrails).

---

## Repository structure

```text
app-owns-data/
├─ step-1_obtain_values/
│  ├─ README.md                      # “How to Obtain All Required Placeholder Values (...)”
│  └─ virtical-flow-diagram.png      # (top-to-bottom flow of Step 1)
│
├─ step-2_embed_report_demo/
│  ├─ README.md                      # “Power BI App Owns Data – End-to-End Embed Report Demo Setup on Ubuntu”
│  ├─ virtical-flow-diagram.png      # (top-to-bottom runtime flow of Step 2)
│  └─ files/
│     ├─ backend/                    # Example backend (Node/Express) – auth + embed token issuance
│     ├─ frontend/                   # Example frontend – uses Power BI JavaScript SDK to render
│     └─ nginx-config/               # Example NGINX reverse proxy snippets
│
└─ (this file) README.md             # Top-level orientation & quickstart
```

> **Note**: Filenames and exact scaffolding under `files/` are intentionally simple so you can drop them into your own pipeline or customize on day one.

---

## What you’ll build (conceptual architecture)

```
[Browser/Client]
     │
     │  (HTTPS) Request: get page + embed details
     ▼
[Frontend]  ←— Power BI JS SDK renders <Report> with Embed Token
     │
     │  (HTTPS) /api/embed-token
     ▼
[Backend (Node/Express)]  — obtains Azure AD token using Client Credentials,
     │                      calls Power BI REST to create **Embed Token**
     │
     ▼
[Power BI Service / REST API]
     │
     └─ Validates app/workspace/dataset/report permissions and returns token claims
```

**Key points**
- The **backend** performs all **secure operations** (client secret stays server‑side).
- The **frontend** only receives an **embed token** (short‑lived, least privilege).
- **NGINX** terminates TLS and reverse‑proxies to the backend/frontend processes.
- **PM2** (or systemd) keeps Node processes alive and observable in Ubuntu.

---

## Prerequisites (high level)

Complete details are in each step’s README; here’s the bird’s‑eye view:

- **Azure AD app registration** (Client ID/Secret) with **client‑credentials** flow enabled.
- **Power BI tenant & workspace settings** aligned for service principal usage (App Owns Data).
- A **workspace** containing the **dataset** + **report** you plan to embed.
- **Ubuntu 22.04+** host (or equivalent) with:
  - Node.js **18+** and npm
  - **NGINX** (for TLS + reverse proxy)
  - Optional: **PM2** for process management
- A **trusted TLS certificate** for your chosen hostname (strongly recommended for production).
- The six values you’ll collect in Step 1:
  - `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `WORKSPACE_ID`, `REPORT_ID`, `DATASET_ID`

> ⚠️ **Security**: Never commit secrets. Use `.env` files, environment variables, and/or a vault. Rotate secrets regularly.

---

## Quickstart

1. **Do Step 1 first**  
   Follow [`step-1_obtain_values/README.md`](./step-1_obtain_values/README.md) to obtain all required IDs and the client secret.
   You’ll also see the **vertical flow diagram** that explains the identity pieces.

2. **Run the end‑to‑end demo (Step 2)**  
   Follow [`step-2_embed_report_demo/README.md`](./step-2_embed_report_demo/README.md). In short:
   - Copy the example **backend** and **frontend** from `step-2_embed_report_demo/files/`.
   - Create a **.env** for the backend (do **not** commit this):
     ```dotenv
     TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
     CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
     CLIENT_SECRET=super-secret-value
     WORKSPACE_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
     REPORT_ID=ffffffff-1111-2222-3333-444444444444
     DATASET_ID=55555555-6666-7777-8888-999999999999
     ```
   - Install deps and start:
     ```bash
     # Backend
     cd step-2_embed_report_demo/files/backend
     npm install
     # optional: pm2 start ecosystem.config.js --only powerbi-backend
     npm run start

     # Frontend (in a separate shell)
     cd ../frontend
     npm install
     npm run dev   # or the production build + serve flow per the step-2 README
     ```
   - Configure **NGINX** using the examples under `step-2_embed_report_demo/files/nginx-config/`.
   - Browse to your site (HTTPS) and you should see the embedded report.

3. **Operate it like a service**  
   - Keep Node processes up with **PM2** or **systemd**.
   - Use NGINX access/error logs and PM2 logs for troubleshooting.
   - Consider CI/CD for the frontend build and backend redeploy.

---

## Environment variables (canonical mapping)

Your backend will typically need at least:

| Variable        | Description |
|-----------------|-------------|
| `TENANT_ID`     | Azure AD tenant (directory) ID |
| `CLIENT_ID`     | App (service principal) ID |
| `CLIENT_SECRET` | App secret (store securely) |
| `WORKSPACE_ID`  | Power BI workspace ID containing the report/dataset |
| `REPORT_ID`     | Power BI report ID to embed |
| `DATASET_ID`    | Power BI dataset ID linked to the report |

Some implementations also surface optional values (authority host, scopes, audience, CORS allowlist, etc.). See the **Step 2 README** and example backend code for exact usage.

---

## Choosing the right embedding scenario (read me first)

This repository demonstrates **App Owns Data** (often called *Embed for your customers*). In production, that scenario expects:
- A **service principal** with appropriate **workspace/dataset permissions**, and
- The appropriate **Power BI (Fabric) capacity** for the workloads you’ll embed.

If your use case is *Embed for your organization* (same‑tenant users with Power BI licenses), the setup differs and capacity requirements may be different. This repo stays focused on **App Owns Data**; consult your licensing/capacity plan as you move to production.

---

## Production hardening checklist

- **HTTPS everywhere** (HSTS, modern ciphers).  
- **Secrets** in env vars or a vault; never in git.  
- **CORS** restricted to trusted origins.  
- **Least‑privilege embed tokens** (only datasets/reports actually needed).  
- **Short token lifetime** and server‑side issuance only.  
- **Logging/metrics** (NGINX, backend app logs, PM2/systemd, heartbeat).  
- **Key rotation** and periodic **secret re‑issuance**.  
- **Dependency updates** and CVE scanning.  
- **Backups** for config and TLS keys; disaster‑recovery runbooks.  

---

## Troubleshooting & Tips

- **Blank render or “unauthorized”**: Re‑check that the service principal has workspace/dataset access and that tenant settings allow service principals to use the Power BI API. Confirm the six IDs are correct.
- **CORS errors**: Tighten or correct the backend’s CORS configuration (origins must match where your frontend is served).
- **NGINX 502/504**: Verify upstream ports and PM2/process health; check NGINX `error.log` and backend logs.
- **Git push rejected (remote contains work)**:  
  ```bash
  git fetch origin
  git pull --rebase origin main   # integrate upstream changes
  git push origin main            # if still blocked, last resort:
  # git push --force-with-lease origin main
  ```

---

## Contributing

- Open issues/PRs with clear repro steps and expected/actual behavior.
- Keep examples minimal but **runnable**.
- Do **not** include real secrets, tokens, or private IDs in commits or screenshots.

---

## License

Add a `LICENSE` file that reflects how you want others to use this material. If omitted, assume **all rights reserved**.

---

## Acknowledgements

Thanks to everyone who stress‑tested the setup in real environments and highlighted the places where doc gaps slow teams down. This repo is designed to be **copy‑pasteable** and **team‑friendly**—from value collection to a working embed under TLS on Ubuntu.
