# RPI Inventory System — Trading

A web-based stock inventory system for **Rite Products, Inc.** trading warehouses. It runs as a **Google Apps Script web app** and uses **Google Sheets** as its database, with one sheet per branch.

**Version:** 1.4 · **Branches:** Manila, Cebu

## Features

- **Stock overview:** live ending balance per product, calculated as opening stock + received − delivered − reserved − consumed ± assembled/disassembled + transferred in − transferred out. It also shows low-stock, out-of-stock and negative-stock alerts, brand filter and search, and a CSV download.
- **Transactions:**
  - Received (RR)
  - Deliveries (DR)
  - Reservations (borrowing slips)
  - Consumables (by project / JO)
  - Assembled / Disassembled items
- **Transfers between branches:** send stock from Manila to Cebu or back. The **Transfers** tab shows what each branch sent out and what it received. Every role can see it; editors and admins can create transfers, and only admins can delete them.
- **Multi-branch:** a **Branch / Warehouse** switcher. Each branch keeps its own catalog, stock and transactions in its own Google Sheet.
- **Roles:**
  - **Admin:** full access and user management.
  - **Editor:** can encode transactions; edits and deletions need admin approval.
  - **Viewer:** read-only.
- **Approvals:** a queue where admins review edits and deletions made by editors.
- **Per-user branch access:** admins choose which branches each user can open.
- **CSV import:** templates for bulk-loading products and transactions.
- **Light and dark theme, phone-friendly layout,** and an auto-refresh every 30 seconds.

## Sign-in and security

- **No passwords:** users are identified by their **company Google account**, read on the server from `Session.getActiveUser()`.
- **Company accounts only:**
  - The deployment is limited to **Anyone within riteproducts.com.ph**.
  - The server also refuses any account outside the company domain.
- **New users** are added automatically as **viewers** on their first visit.
- **Blocking a user:** set their `active` cell to `FALSE` in the ACCOUNTS tab.

## Files

| File | Purpose |
|---|---|
| `Code.gs` | Apps Script server: serves the page, checks access, and reads/writes the branch sheets |
| `index.html` | The whole web app (HTML, CSS and JavaScript in one file), loaded by `doGet()` |
| `DEPLOY.md` | Step-by-step deployment and maintenance guide |

## Google Sheets layout

Each branch spreadsheet has these tabs:

| Tab | Contents |
|---|---|
| `PRODUCTS` | brand, code, unit, opening stock, low-stock alert |
| `RR` / `DR` / `RESERVATIONS` / `CONSUMABLES` | transaction lines (one row per item) |
| `ASSEMBLY` | assembled / disassembled ledger (item and component rows) |
| `TRANSFERS` | branch-to-branch transfers: an `OUT` row in the sending branch and a matching `IN` row in the receiving branch |
| `PENDING APROVAL` | editor change requests awaiting admin approval |
| `STOCKS` | formula view of the stock balance (read-only) |
| `ACCOUNTS` | user list: **Manila sheet only**, shared by all branches |

Branch sheet IDs are set in the `BRANCHES` object at the top of `Code.gs`.

## Quick deploy

1. In Google Apps Script, paste `Code.gs` into the project's `Code.gs` file.
2. Create an HTML file named **`index`** and paste `index.html` into it.
3. Click **Deploy → New deployment → Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone within riteproducts.com.ph
4. Open the `/exec` URL.

To update later, use **Manage deployments → Edit → New version**, so the URL stays the same.

See [DEPLOY.md](DEPLOY.md) for full details, including adding a new branch.
