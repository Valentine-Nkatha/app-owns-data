
# How to Obtain All Required Placeholder Values (Tenant ID, Client ID, Client Secret, Workspace ID, Report ID, Dataset ID)

This companion guide explains **exactly how to find or create** every value you’ll need for the Power BI App Owns Data embedding setup.  
It’s organized from **Azure (Microsoft Entra)** steps first, then **Power BI workspace** steps.

> You’ll capture the following values:
> - `<TENANT_ID>` — Microsoft Entra (Azure AD) **Directory (tenant) ID**
> - `<CLIENT_ID>` — App registration **Application (client) ID**
> - `<CLIENT_SECRET>` — App registration **Client secret (Value)**
> - `<WORKSPACE_ID>` — Power BI workspace GUID
> - `<REPORT_ID>` — Power BI report GUID
> - `<DATASET_ID>` — Power BI dataset GUID

---

## Prerequisites

- You have access to **Azure Portal** (role that can register apps; e.g., Application Developer or equivalent) and **Power BI Service**.
- You can access the **target Power BI workspace** and the **report** you plan to embed.
- Optional: Azure CLI installed (for quick checks).

> **Security note:** Treat secrets like passwords. Never commit them to version control or paste them in chat/email. Prefer environment variables and secret stores (e.g., Azure Key Vault).

---

## Part A — Microsoft Entra (Azure AD): Tenant ID, Client ID, Client Secret

### A1) Get your Tenant ID (`<TENANT_ID>`)

**Path (Portal):**
1. Go to **Azure Portal** → search **Microsoft Entra ID** (or **Azure Active Directory**).
2. In **Overview**, copy **Directory (tenant) ID**.

**Optional (CLI):**
```bash
az account show --query tenantId -o tsv
```

**You now have:**  
`<TENANT_ID>` (example format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

---

### A2) Create (or locate) the App Registration

**Path:** Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**  
- **Name:** e.g., `powerbi-embed-app`  
- **Supported account types:** **Accounts in this organizational directory only (Single tenant)**  
- Click **Register**.

After creation, on the app’s **Overview** page, note:
- **Application (client) ID** → this is your `<CLIENT_ID>`
- **Directory (tenant) ID** → same value as `<TENANT_ID>`

**You now have:**  
`<CLIENT_ID>`

---

### A3) Create a Client Secret (`<CLIENT_SECRET>`)

**Path:** App registration → **Certificates & secrets** → **Client secrets** → **New client secret**  
- **Description:** e.g., `embed-secret`  
- **Expires:** choose a suitable duration (e.g., 6/12/24 months).  
- Click **Add** → **Copy the _Value_ immediately** (you cannot retrieve the Value later).

> **Important:** Do not confuse **Value** with **Secret ID**. The **Value** is what your backend uses as `<CLIENT_SECRET>`.

**You now have:**  
`<CLIENT_SECRET>` (store safely).

---

### A4) Add API Permissions for Power BI (Application permissions)

**Path:** App registration → **API permissions** → **Add a permission** → **APIs my organization uses** → search **Power BI Service**  
- **Type:** **Application permissions**  
- Select:
  - `Tenant.Read.All`
  - `Dataset.Read.All`
  - `Report.Read.All`
- Click **Add permissions** → Click **Grant admin consent** for your organization.

> These permissions are typical for read-only embedding flows that need to **read metadata** and **generate embed tokens** via backend.

---

### A5) Enable Service Principal to use Power BI (once per tenant)

**Path:** Power BI Service → **Settings (gear)** → **Admin portal** → **Tenant settings** → **Developer settings**  
- Enable **“Allow service principals to use Power BI APIs”**  
- Scope: **Enabled for specific security groups** (recommended) or **Entire organization** (less restrictive).  
- If scoping to a group, ensure the app (service principal) is **in that group**.

---

## Part B — Power BI Service: Workspace ID, Report ID, Dataset ID

> You must have access to the workspace and report. Also add the service principal as **Member** (or **Contributor/Owner**) to the **target workspace** so it can generate embed tokens.

### B1) Get Workspace ID (`<WORKSPACE_ID>`)

**Path:** Go to **https://app.powerbi.com** → **Workspaces** → open your target workspace.  
- The URL looks like:  
  `https://app.powerbi.com/groups/<WORKSPACE_ID>/list`  
- Copy the GUID after `/groups/`.

**You now have:**  
`<WORKSPACE_ID>`

---

### B2) Get Report ID (`<REPORT_ID>`)

**Path:** In the same workspace, open the **report** you plan to embed.  
- URL looks like:  
  `https://app.powerbi.com/groups/<WORKSPACE_ID>/reports/<REPORT_ID>/ReportSection`  
- Copy the GUID after `/reports/`.

**You now have:**  
`<REPORT_ID>`

---

### B3) Get Dataset ID (`<DATASET_ID>`)

**Path (recommended):** Workspace → **Datasets + dataflows** → locate your dataset → **Settings** (ellipsis `…` → **Settings**).  
- URL looks like:  
  `https://app.powerbi.com/groups/<WORKSPACE_ID>/datasets/<DATASET_ID>/details`  
- Copy the GUID after `/datasets/`.

**You now have:**  
`<DATASET_ID>`

> **Tip:** Many reports are connected to a dataset with the same name in the workspace. Confirm the dataset backing your report from the **Report** → **Settings** page if unsure.

---

## (Optional) Quick Sanity Check

Set values as environment variables and test a minimal flow:

```bash
export TENANT_ID="<TENANT_ID>"
export CLIENT_ID="<CLIENT_ID>"
export CLIENT_SECRET="<CLIENT_SECRET>"
export WORKSPACE_ID="<WORKSPACE_ID>"
export REPORT_ID="<REPORT_ID>"
export DATASET_ID="<DATASET_ID>"

# Get AAD token
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token"   -H "Content-Type: application/x-www-form-urlencoded"   -d "client_id=$CLIENT_ID"   -d "client_secret=$CLIENT_SECRET"   -d "grant_type=client_credentials"   -d "scope=https://analysis.windows.net/powerbi/api/.default" | jq -r .access_token)

# Get report metadata (embedUrl)
curl -s -H "Authorization: Bearer $TOKEN"   "https://api.powerbi.com/v1.0/myorg/groups/$WORKSPACE_ID/reports/$REPORT_ID" | jq .

# Generate embed token
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"   "https://api.powerbi.com/v1.0/myorg/groups/$WORKSPACE_ID/reports/$REPORT_ID/GenerateToken"   -d "{"accessLevel":"View","datasets":[{"id":"$DATASET_ID"}]}" | jq .
```

> If the embed token call fails with a permissions error, double‑check that:
> - The **service principal** is **Member (or higher)** on the workspace.
> - **Tenant settings** allow service principals to use Power BI APIs.
> - API permissions for the app registration include the **Power BI Service Application permissions** listed above and **admin consent** has been granted.

---

## Copy/Paste Variables Block (for your backend `.env` or script)

```bash
TENANT_ID="<TENANT_ID>"
CLIENT_ID="<CLIENT_ID>"
CLIENT_SECRET="<CLIENT_SECRET>"
WORKSPACE_ID="<WORKSPACE_ID>"
REPORT_ID="<REPORT_ID>"
DATASET_ID="<DATASET_ID>"
```

> Store `<CLIENT_SECRET>` in a secure store (Key Vault, password manager). Avoid committing secrets to source control.

---

## Vertical Flow Diagram (Azure → Power BI)

The diagram below summarizes the sequence and where each value comes from.
