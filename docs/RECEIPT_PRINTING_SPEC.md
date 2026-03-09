# Receipt Printing — Feature Specification

**Version:** 1.0
**Date:** 2026-03-08
**Approach:** DB Queue + Polling + Flutter Android App

---

## 1. Overview

Enable staff to print thermal receipts for paid orders. The system uses a lightweight Flutter Android app installed on each branch's "work phone" (already Bluetooth-paired to a thermal printer). The web app creates print jobs in the database; the Flutter app polls for pending jobs and sends ESC/POS commands to the printer.

### Architecture

```
Waiter/Manager (browser, any device)
  → taps "Print Receipt"
  → POST /api/v1/print-jobs  { orderId }
  → Backend creates PrintJob record (status: PENDING)

Flutter App (work phone, polling every 3s)
  → GET /api/v1/print-jobs?status=PENDING
  → Receives pending jobs
  → Generates ESC/POS commands
  → Sends via Bluetooth to thermal printer
  → PATCH /api/v1/print-jobs/:id  { status: COMPLETED }
```

---

## 2. Data Model

### New Enum: `PrintJobStatus`

```prisma
enum PrintJobStatus {
  PENDING
  PRINTING
  COMPLETED
  FAILED
}
```

### New Model: `PrintJob`

```prisma
model PrintJob {
  id              String         @id @default(uuid())
  organizationId  String         @map("organization_id")
  orderId         String         @map("order_id")
  status          PrintJobStatus @default(PENDING)
  receiptData     Json           @map("receipt_data")
  requestedById   String         @map("requested_by_id")
  printedAt       DateTime?      @map("printed_at")
  failureReason   String?        @map("failure_reason")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  organization    Organization   @relation(fields: [organizationId], references: [id])
  order           Order          @relation(fields: [orderId], references: [id])
  requestedBy     User           @relation("PrintJobRequester", fields: [requestedById], references: [id])

  @@index([organizationId, status])
  @@index([orderId])
  @@map("print_jobs")
}
```

### New Model: `PrintStation`

Represents an authenticated Flutter app instance at a branch.

```prisma
model PrintStation {
  id              String    @id @default(uuid())
  organizationId  String    @map("organization_id")
  name            String    @default("Default Printer")
  token           String    @unique
  isActive        Boolean   @default(true) @map("is_active")
  lastSeenAt      DateTime? @map("last_seen_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  organization    Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([token])
  @@map("print_stations")
}
```

### Relations to Add

On `Order`:
```prisma
printJobs  PrintJob[]
```

On `Organization`:
```prisma
printJobs     PrintJob[]
printStations PrintStation[]
```

On `User`:
```prisma
printJobsRequested  PrintJob[] @relation("PrintJobRequester")
```

---

## 3. Receipt Data Shape (JSON stored in `receiptData`)

```json
{
  "branchName": "Wendo Coffee Bistro — Kingz",
  "orderNumber": "WCB-0042",
  "dailyNumber": 42,
  "orderDate": "2026-03-08",
  "orderTime": "14:32",
  "orderType": "DINE_IN",
  "tableNumber": "T5",
  "waiterName": "Jane M.",
  "items": [
    { "name": "Cappuccino", "quantity": 2, "unitPrice": 300, "total": 600 },
    { "name": "Club Sandwich", "quantity": 1, "unitPrice": 450, "total": 450 },
    { "name": "Sparkling Water", "quantity": 1, "unitPrice": 150, "total": 150 }
  ],
  "subtotal": 1200,
  "deliveryFee": 0,
  "total": 1200,
  "paymentMethod": "CASH",
  "paidAt": "2026-03-08T14:32:00Z"
}
```

**Why store the full receipt data?** The receipt becomes an immutable snapshot. Even if order items are later modified (unlikely but possible in edge cases), the receipt reflects what was printed. Also enables reprinting without re-querying all related tables.

---

## 4. API Endpoints

### 4.1 Print Jobs (Web App → Backend)

#### `POST /api/v1/print-jobs`

**Access:** 🔑 WAITER, MANAGER, DIRECTOR, ADMIN
Creates a print job for a given order.

**Request Body:**
```json
{
  "orderId": "uuid"
}
```

**Validation Rules:**
- Order must exist and belong to the user's branch
- Order must have `paymentMethod` set (must be paid)

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderId": "uuid",
    "status": "PENDING",
    "createdAt": "2026-03-08T14:32:00Z"
  },
  "message": "Print job created"
}
```

---

#### `GET /api/v1/print-jobs`

**Access:** 🔑 MANAGER, DIRECTOR, ADMIN (web dashboard view)
Returns print jobs for the user's branch.

**Query Params:**
```
status    (optional) — filter by status: PENDING, PRINTING, COMPLETED, FAILED
page      (optional, default 1)
perPage   (optional, default 20)
```

**Response `200`:** Standard paginated list of print jobs.

---

#### `GET /api/v1/print-jobs/:id`

**Access:** 🔑 MANAGER, DIRECTOR, ADMIN
Returns a single print job with full receipt data.

---

### 4.2 Print Station Endpoints (Flutter App → Backend)

These endpoints use **print station token auth** (Bearer token), not JWT.

#### `GET /api/v1/print-station/jobs`

**Access:** 🖨️ Print Station Token
Returns PENDING print jobs for the station's branch.

**Query Params:**
```
status    (optional, default: PENDING)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "status": "PENDING",
      "receiptData": { ... },
      "createdAt": "2026-03-08T14:32:00Z"
    }
  ]
}
```

---

#### `PATCH /api/v1/print-station/jobs/:id`

**Access:** 🖨️ Print Station Token
Updates a print job's status after printing.

**Request Body:**
```json
{
  "status": "COMPLETED",
  "printedAt": "2026-03-08T14:32:05Z"
}
```

Or on failure:
```json
{
  "status": "FAILED",
  "failureReason": "Printer disconnected"
}
```

---

#### `POST /api/v1/print-station/heartbeat`

**Access:** 🖨️ Print Station Token
Updates `lastSeenAt` on the print station record. Called by the Flutter app every 30 seconds. Allows the web dashboard to show whether the printer is online.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "stationId": "uuid",
    "branchName": "Kingz",
    "lastSeenAt": "2026-03-08T14:32:00Z"
  }
}
```

---

### 4.3 Print Station Management (Web Dashboard)

#### `POST /api/v1/print-stations`

**Access:** 🔑 MANAGER, DIRECTOR, ADMIN
Creates a new print station and generates its auth token.

**Request Body:**
```json
{
  "name": "Counter Printer"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Counter Printer",
    "token": "pst_a1b2c3d4e5f6...",
    "isActive": true,
    "createdAt": "2026-03-08T14:32:00Z"
  },
  "message": "Print station created. Save the token — it will not be shown again."
}
```

**Note:** Token is shown once on creation. It is stored hashed in the DB (like a password). If lost, the manager must create a new station.

**QR Code Pairing:** The frontend renders the token + API URL as a QR code in the creation modal. The Flutter app scans this QR code to auto-configure itself — no manual typing required.

QR code payload (JSON stringified):
```json
{"url":"https://api.wendo-rms.co.ke/api/v1","token":"pst_a1b2c3d4e5f6...","name":"Counter Printer"}
```

---

#### `GET /api/v1/print-stations`

**Access:** 🔑 MANAGER, DIRECTOR, ADMIN
Lists print stations for the branch. Shows name, status, last seen time.

---

#### `DELETE /api/v1/print-stations/:id`

**Access:** 🔑 MANAGER, DIRECTOR, ADMIN
Deactivates a print station (soft delete — sets `isActive: false`).

---

## 5. Print Station Auth Middleware

New middleware: `authenticatePrintStation`

- Reads `Authorization: Bearer pst_...` header
- Hashes the token, looks up in `print_stations` table
- Rejects if not found or `isActive: false`
- Attaches `req.printStation = { id, organizationId }` to the request

This is separate from the existing JWT `authenticate` middleware. Print station routes use this instead.

---

## 6. Flutter App Specification

### 6.1 App Structure

```
lib/
  main.dart
  config/
    app_config.dart          — API URL, poll interval
  models/
    print_job.dart           — PrintJob model
    receipt_data.dart        — ReceiptData model
  services/
    api_service.dart         — HTTP calls to backend
    bluetooth_service.dart   — Bluetooth printer connection
    printer_service.dart     — ESC/POS command generation
    polling_service.dart     — Background poll loop
  screens/
    setup_screen.dart        — Enter API URL + station token
    home_screen.dart         — Printer status, connection, logs
  widgets/
    status_indicator.dart    — Online/offline dot
    print_log_item.dart      — Single log entry
```

### 6.2 Key Dependencies

```yaml
dependencies:
  flutter_blue_plus: ^1.x       # BLE support
  flutter_bluetooth_serial: ^0.x # Bluetooth Classic (SPP) support
  http: ^1.x                    # API calls
  esc_pos_utils: ^1.x           # ESC/POS command generation
  shared_preferences: ^2.x      # Persist config (API URL, token)
  provider: ^6.x                # State management
```

### 6.3 Core Flow

```
App Starts
  → Load saved config (API URL, token, printer MAC) from SharedPreferences
  → If no config → show SetupScreen
  → If config but no saved printer → show PrinterDiscoveryScreen
  → If full config → show HomeScreen
    → Auto-connect to saved printer MAC address
      → If found → connect silently
      → If not found after 10s → show "Printer not found" with Reconnect button
    → Start poll loop (every 3 seconds):
        1. GET /print-station/jobs?status=PENDING
        2. If jobs exist AND printer is connected:
           a. PATCH job status → PRINTING
           b. Generate ESC/POS commands from receiptData
           c. Send bytes to Bluetooth printer
           d. PATCH job status → COMPLETED (or FAILED on error)
        3. If jobs exist AND printer is NOT connected:
           a. Leave jobs as PENDING (don't mark FAILED — they'll print when reconnected)
           b. Show notification: "X receipts waiting — printer disconnected"
        4. POST /print-station/heartbeat (every 30s)

Bluetooth Reconnection Loop (runs independently):
  → If printer disconnects mid-session:
    → Update UI to "Disconnected"
    → Attempt reconnect every 15 seconds (up to 10 retries)
    → If reconnected → resume printing pending jobs automatically
    → If all retries fail → stop retrying, show "Tap to reconnect" button
```

### 6.3.1 Bluetooth Discovery Details

**Permissions required (Android):**
- `BLUETOOTH`, `BLUETOOTH_ADMIN` (Android < 12)
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (Android 12+)
- `ACCESS_FINE_LOCATION` (required for Bluetooth scan on Android)

**Discovery strategy:**
1. First, check OS-level paired devices (`getBondedDevices()`) — the work phone likely already has the printer paired at OS level. Show these at the top of the list labeled "Paired Devices."
2. Then scan for new nearby devices and show them below, labeled "Available Devices."
3. This means in most cases, the user will see their printer immediately in the "Paired" section without waiting for a scan.

**Identifying printers vs other devices:**
- Filter by Bluetooth device class if available (Major class: `Imaging`, Minor class: `Printer`)
- If class info unavailable (common with cheap printers), show all devices — user picks the right one
- Common generic printer names to look for: `RPP02N`, `MTP-II`, `POS-58`, `POS-80`, `BlueTooth Printer`, `Gprinter`, `XPrinter`

### 6.4 Screens

**Setup Screen (first launch):**
- Text field: API Base URL (e.g., `https://api.wendo-rms.co.ke/api/v1`)
- Text field: Print Station Token (paste from web dashboard)
- "Test Connection" button — calls heartbeat endpoint
- "Save & Continue" button → navigates to Printer Discovery

**Printer Discovery Screen:**
- "Scan for Printers" button — triggers Bluetooth scan (Classic + BLE)
- Shows a list of discovered devices:
  - Device name (e.g., `RPP02N`, `POS-58`, `BlueTooth Printer`)
  - MAC address (e.g., `00:11:22:33:44:55`)
  - Signal strength indicator (RSSI)
  - Type badge: `Classic` or `BLE`
- User taps a device → app attempts to connect
- On success → saves MAC address + device name to SharedPreferences → navigates to Home
- On failure → shows "Could not connect. Make sure the printer is on and in range." with retry option
- "Scan Again" button to refresh the list
- Scanning timeout: 10 seconds, then shows results found so far

**Home Screen:**
- Printer status: `Connected` / `Disconnected` / `Connecting...` (with colored dot)
- Printer name + MAC address (from saved Bluetooth device)
- Branch name (from heartbeat response)
- "Change Printer" button → opens Printer Discovery Screen
- "Reconnect Printer" button (shown when disconnected)
- Last print time
- Recent print log (last 20 jobs, scrollable)
- "Test Print" button — prints a test receipt
- Settings gear icon → re-enter API URL / token

### 6.5 Receipt Format (ESC/POS)

```
================================  (32 chars for 58mm, 48 for 80mm)
     WENDO COFFEE BISTRO
        Kingz Branch
================================
Order #42              DINE_IN
Table: T5
Date: 08/03/2026       14:32
Waiter: Jane M.
--------------------------------
2x Cappuccino           600.00
1x Club Sandwich        450.00
1x Sparkling Water      150.00
--------------------------------
Subtotal:             1,200.00
Total:            KES 1,200.00
--------------------------------
Paid: CASH
================================
    Thank you for visiting!
================================
```

Commands used:
- `ESC @` — Initialize printer
- `ESC a 1` — Center align (for header/footer)
- `ESC E 1` — Bold on (for totals)
- `ESC d 3` — Feed 3 lines
- `GS V 1` — Partial cut

### 6.6 Background Behavior

- The app should use a **foreground service** (Android) to keep polling when minimized
- Show a persistent notification: "Wendo Printer — Connected and listening"
- This prevents Android from killing the app
- **Battery optimization:** During setup, prompt the user to disable battery optimization for the app. Show OEM-specific instructions (Samsung: Settings → Battery → App power management → add to "Unmonitored apps"; Xiaomi: Settings → Battery → App battery saver → No restrictions). This is critical — aggressive OEMs like Samsung, Xiaomi, and Huawei will kill foreground services otherwise.

---

## 7. Frontend Changes (Wendo RMS Web App)

### 7.1 "Print Receipt" Button

**Location:** Order detail view / payment confirmation screen

**Visibility:** Only shown when `order.paymentMethod` is set (order is paid)

**Behavior:**
1. Tap "Print Receipt"
2. Call `POST /api/v1/print-jobs` with `orderId`
3. Show toast: "Receipt sent to printer"
4. If API returns error (e.g., no print station configured), show: "No printer configured for this branch"

### 7.2 Print Station Management (Manager Settings)

**Location:** Branch settings page (manager/director/admin only)

**Features:**
- List print stations for this branch (name, status, last seen)
- "Add Print Station" button → creates station, shows a modal with:
  - A **QR code** encoding `{"url":"<API_URL>","token":"pst_...","name":"<station_name>"}` — staff scans this with the Flutter app
  - The raw token displayed below with a copy button (fallback for manual entry)
  - Warning: "This token will not be shown again"
- "Remove" button → deactivates station
- Online/offline indicator based on `lastSeenAt` (online if seen within last 60 seconds)
- Frontend dependency: `qrcode.react` (or similar) for QR code rendering

### 7.3 Print Job History (Optional, Low Priority)

A simple list view in the manager dashboard showing recent print jobs (status, order number, time, requested by). Useful for debugging "did it print?" questions.

---

## 8. Security Considerations

- Print station tokens are hashed before storage (bcrypt or SHA-256 + salt)
- Tokens are prefixed with `pst_` to distinguish from JWTs
- Print station endpoints only return data for the station's own branch (enforced by `organizationId` from the token lookup)
- Receipt data does not contain sensitive information (no customer PII, no staff salaries)
- Print stations can be deactivated immediately from the web dashboard if a token is compromised

---

## 9. Failure Modes & Edge Cases

### 9.1 Standard Failure Modes

| Scenario | Behavior |
|---|---|
| Flutter app closed / phone off | Jobs accumulate as PENDING. Print when app reopens. |
| Printer disconnected mid-print | Job marked FAILED. Auto-reconnect loop starts. Job stays for manual retry. |
| Printer disconnected, jobs arrive | Jobs stay PENDING (not FAILED). Print automatically when printer reconnects. |
| Network outage on work phone | Poll fails silently. Resumes when network returns. Jobs are safe in DB. |
| Multiple print requests for same order | Each creates a separate PrintJob. No dedup (intentional — allows reprints). |
| Print station token revoked | API returns 401. App shows "Token invalid — contact manager." |

### 9.2 Bluetooth Edge Cases

| Scenario | Behavior |
|---|---|
| Printer turned off during shift | Auto-reconnect retries 10 times (15s intervals). Shows "Printer offline" on Home screen. Pending jobs wait. |
| Printer out of paper | Printer may or may not report error (varies by model). If ESC/POS write succeeds but nothing prints, this is invisible to the app. Mitigation: staff sees the printer didn't print, taps "Print Receipt" again. |
| Printer paired to a different phone | Bluetooth Classic only pairs to one device at a time. If someone pairs their personal phone, the work phone loses the bond. App detects disconnect → shows "Printer disconnected." Manager re-pairs from the discovery screen. |
| Multiple printers in scan range | Discovery list shows all. User must pick the correct one. Show device name + MAC to distinguish. |
| Phone Bluetooth turned off | App detects Bluetooth adapter state. Shows "Bluetooth is off — enable it in Settings" with a button to open Android Bluetooth settings. |
| Android kills foreground service (rare, aggressive OEMs) | On next app open, pending jobs are fetched and printed. Mitigation: add app to battery optimization whitelist during setup (show instructions for common OEMs: Samsung, Xiaomi, Huawei). |
| Work phone shared across shifts | No issue. The app is stateless per-user — it's tied to the branch, not a staff member. Any staff can see the print log. |

### 9.3 Data Edge Cases

| Scenario | Behavior |
|---|---|
| Order modified after print job created | Receipt prints the snapshot from `receiptData` (captured at print request time). This is correct — the receipt reflects what was paid. |
| Very long item names (> 32 chars for 58mm paper) | ESC/POS formatter truncates or wraps. Truncate at 24 chars for the name column to leave room for the price. |
| Order with 20+ items | Receipt will be long but printers handle continuous paper. No issue. |
| Stale PENDING jobs (e.g., from yesterday) | Add a `maxAge` check: if a PENDING job is older than 24 hours, auto-mark it as `FAILED` with reason "Expired — not printed within 24h." This prevents the printer from spitting out yesterday's receipts when turned on in the morning. |
| Concurrent poll picks up same job on two cycles | The PATCH to PRINTING acts as a lock. If the first cycle already set it to PRINTING, the second cycle's poll won't return it (poll filters `status=PENDING`). |
| Currency formatting | All monetary values formatted as `KES X,XXX.XX`. Decimal precision: always 2 places. Thousands separator: comma. |

### 9.4 Network Edge Cases

| Scenario | Behavior |
|---|---|
| Backend down | Poll returns error. App shows "Server unreachable" indicator. Retries on next poll cycle. No jobs lost (they were never fetched). |
| Slow network (high latency) | Poll timeout set to 10 seconds. If exceeded, skip cycle and retry on next interval. |
| Token expires or is rotated | App gets 401 on poll. Shows "Authentication failed — re-enter token" and navigates to setup screen. |

---

## 10. Implementation Order

### Phase A: Backend (Wendo RMS)
1. Prisma schema: add `PrintJob`, `PrintStation` models + enum
2. Migration
3. Print station auth middleware
4. Print station management endpoints (CRUD)
5. Print job endpoints (create, list, update status)
6. Receipt data assembly service (joins order + items + branch info)

### Phase B: Frontend (Wendo RMS)
1. "Print Receipt" button on order view
2. Print station management page in branch settings

### Phase C: Flutter App
1. Project setup + dependencies
2. Setup screen (API URL + token config)
3. API service (poll + heartbeat + status update)
4. Bluetooth service (discover, connect, send bytes)
5. ESC/POS receipt formatter
6. Home screen (status, logs, reconnect)
7. Foreground service for background polling
8. Test with actual thermal printer

---

## 11. Future Enhancements (Not in V1)

- Kitchen order ticket printing (separate from customer receipt)
- Auto-print on payment (toggle in branch settings)
- Multiple printers per branch (counter + kitchen)
- Daily summary printout (end of shift report)
- QR code on receipt (for digital feedback)
