# Deploying RPI Inventory as an Apps Script web app

Apps Script serves the whole app. The page calls the server through `google.script.run`, so there's no separate hosting and no backend URL to paste.

## Files in the Apps Script project
| Editor file       | Paste from   | Type          |
|-------------------|--------------|---------------|
| `Code.gs`         | `Code.gs`    | Script        |
| `index`           | `index.html` | HTML (+ → HTML) |

The HTML file must be named exactly **`index`**, because `doGet()` loads it by that name.

## First deployment
1. Open the Apps Script project that uses the sheet: Sheet → **Extensions → Apps Script**, or your existing project.
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Click **+ → HTML** and name the file `index`. Delete its default content and paste all of `index.html`.
4. Click **Save**.
5. Click **Deploy → New deployment**, then click the gear icon and choose **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone within riteproducts.com.ph
6. Click **Deploy** and approve the permissions it asks for (Spreadsheets, see your email address, and display web content).
7. Open the **Web app URL** that ends in `/exec`. The app opens straight away, already signed in as your company Google account.

## Updating later, keeping the same URL
After you edit and save, go to **Deploy → Manage deployments**. Click the pencil on your deployment, set **Version → New version**, then click **Deploy**.
(**Test deployments** gives a `/dev` URL that always runs the latest saved code. Only editors can use it.)

## Company-only access (@riteproducts.com.ph)
Two layers keep the app company-only:
1. **Deployment setting:** set **Who has access** to **Anyone within riteproducts.com.ph**. Google then blocks anyone who isn't signed in with a company Google Workspace account.
2. **Code check (`Code.gs`):** `companyOk()` reads the visitor's Google email. If it doesn't end in `@riteproducts.com.ph`, the visitor sees an "Access restricted" page, and every server call is refused.

Don't choose **Anyone** or **Anyone with Google account**. With those settings Google doesn't share the visitor's email with the script, so the code check would block everyone.

## Sign-in: company Google account, no app passwords
The app has no username/password login, sign-up, or password reset. Google identifies each user, and the server reads their email from `Session.getActiveUser()`. A web page can't fake that email.

- **Existing users:** they're matched to their row in the `accounts` tab by email, so they keep their role (admin / editor / viewer), username and history.
- **New users:** the first time someone opens the app, they're added to `accounts` as a **viewer**. An admin can promote them in **Users**.
- **Blocking someone:** set their **active** column in `accounts` to `FALSE`. They'll see "Your account is disabled." The change takes up to 2 minutes to apply.
- **Sign out / switch account:** this happens in Google, not in the app. Users switch accounts in Google, then reload the page.

### One-time cleanup of old passwords
The `accounts` tab still holds the old password salts and hashes (columns **G** and **H**). The app no longer uses them, so delete them:
1. In the Apps Script editor, choose **`wipePasswordHashes`** in the function dropdown at the top.
2. Click **Run**. The log shows how many accounts it cleared.

Run it only after the new version is deployed.

## Branches / warehouses
Each branch has its own Google Sheet with the same tabs (PRODUCTS, RR, DR, RESERVATIONS, CONSUMABLES, ASSEMBLY, TRANSFERS, PENDING APROVAL, STOCKS):

| Branch | Google Sheet | Key in `Code.gs` |
|---|---|---|
| Manila Branch | INVENTORY SYSTEM - TRADING - MANILA BRANCH (`1l2tvgEs…`) | `manila` (HOME) |
| Cebu Branch | INVENTORY SYSTEM - TRADING - CEBU BRANCH (`1E-cTYqi…`) | `cebu` |

- **Switching branches:** use the **Branch / Warehouse** selector at the top of the sidebar. Stock, transactions, approvals and downloads all apply to the selected branch only.
- **Users are shared:** the user list is the ACCOUNTS tab in the **Manila** sheet. The Cebu sheet has no ACCOUNTS tab.
- **Branch access:** admins set access on the **Users** page (Manila / Cebu / All branches). The setting is stored in ACCOUNTS column **I** (`branches`), for example `manila`, `cebu` or `manila,cebu`.
  - If the column is empty, the user gets Manila only.
  - Admins always see every branch.
  - New users start as viewers with Manila access.
- **Separate catalogs:** each branch has its own products and opening stock. Cebu started with the same 711 products and an opening stock of 0. Adding a product in one branch doesn't add it to the other.
- **Transfers (v1.4):** on the **Transfers** page, pick the receiving branch, add items and press **Transfer stock**.
  - The app writes the same transfer to both sheets' **TRANSFERS** tab: an `OUT` row in the sending branch and an `IN` row with the same id in the receiving branch.
  - The sending branch's stock goes down and the receiving branch's goes up straight away. There is no separate "receive" step.
  - If the receiving branch doesn't carry a product yet, it is added to that branch's PRODUCTS with 0 opening stock.
  - Everyone can see the page. Viewers can't create transfers. Only admins can delete one, and a delete removes it from both sheets.
  - In each STOCKS tab, columns K and L hold **Transfer in** and **Transfer out**, and **Ending** (column M) includes them.
- **Adding another branch later:**
  1. Copy a branch sheet in Drive and empty its transaction tabs, including TRANSFERS.
  2. Add a line to `BRANCHES` in `Code.gs`, for example `davao: {name: 'Davao Branch', id: '<sheet id>'}`.
  3. Redeploy.

## Notes
- The old `doPost` JSON endpoint has been removed. Everything goes through `google.script.run`.
