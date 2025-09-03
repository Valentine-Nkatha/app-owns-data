# Power BI **App Owns Data** – End‑to‑End Reference (Ubuntu + NGINX + Node + Frontend)

> A practical, production‑leaning walkthrough for embedding a Power BI report using the **App Owns Data** pattern.  
> This repository is organized into two self‑contained stages:
> 1) **Obtain all required IDs/secrets**, and 2) **Run the full embed demo** on Ubuntu with a hardened layout (frontend, backend, reverse proxy).

---

## Steps

- **Step 1**: Collect everything you need — **Tenant ID, Client ID, Client Secret, Workspace ID, Report ID, Dataset ID**.  
  See: [`step-1_obtain_values/README.md`](./step-1_obtain_values/README.md) (includes a top‑to‑bottom flow diagram).

- **Step 2**: Deploy and run the working **App Owns Data** embed demo on Ubuntu with **Node/Express backend**, **web frontend** and **NGINX**.  
  See: [`step-2_embed_report_demo/README.md`](./step-2_embed_report_demo/README.md) (includes the end‑to‑end flow diagram and example files under `files/`).

---

