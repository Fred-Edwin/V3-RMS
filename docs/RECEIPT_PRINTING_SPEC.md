# Receipt & Bill Printing — Feature Specification

**Version:** 2.0
**Date:** 2026-03-11
**Approach:** DB Queue + Polling + Flutter Android App

---

## 1. Overview

Enable staff to print **two types of thermal printouts** for orders:

1. **Bill** — Printed **before payment**. Handed to the customer so they can see what they owe. 1 copy.
2. **Receipt** — Printed **after payment is confirmed**. 2 copies: one for the customer, one for the accountant/house records.

The system uses a lightweight Flutter Android app ("Wendo Printer") installed on each branch's work phone (already Bluetooth-paired to a thermal printer). The web app creates print jobs in the database; the Flutter app polls for pending jobs and sends ESC/POS commands to the printer.

### Architecture

```
Waiter/Manager (browser, any device)
  → taps "Print Bill" (before payment)
  → POST /api/v1/print-jobs  { orderId, receiptType: "BILL" }
  → Backend creates PrintJob (status: PENDING, copies: 1)

Waiter/Manager (browser, any device)
  → taps "Print Receipt" (after payment confirmed)
  → POST /api/v1/print-jobs  { orderId, receiptType: "RECEIPT" }
  → Backend creates PrintJob (status: PENDING, copies: 2)

Flutter App (work phone, polling every 3–5s)
  → GET /api/v1/print-station/jobs?status=PENDING
  → Receives pending jobs with receiptType + copies
  → Generates ESC/POS commands (format differs by type)
  → Prints `copies` times
  → PATCH /api/v1/print-station/jobs/:id  { status: COMPLETED }
```

### Bill vs Receipt — Key Differences

| Aspect | Bill | Receipt |
|---|---|---|
| When printed | Before payment | After payment confirmed |
| Copies | 1 | 2 (customer + accountant) |
| Header label | `BILL` | `RECEIPT` |
| Payment info shown | No | Yes (method + timestamp) |
| "Paid" line | No | Yes |
| Footer message | "Please proceed to pay" | "Thank you for visiting Wendo!" |
| Validation | Order must exist | Order must have `paymentMethod` set |

---

## 2. Data Model

### Enum: `PrintJobStatus`

```prisma
enum PrintJobStatus {
  PENDING
  PRINTING
  COMPLETED
  FAILED
}
```

### Enum: `ReceiptType`

```prisma
enum ReceiptType {
  BILL
  RECEIPT
}
```

### Model: `PrintJob`

```prisma
model PrintJob {
  id              String         @id @default(uuid())
  organizationId  String         @map("organization_id")
  orderId         String         @map("order_id")
  receiptType     ReceiptType    @default(RECEIPT) @map("receipt_type")
  copies          Int            @default(1)
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

### Model: `PrintStation`

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

The `receiptData` JSON is an **immutable snapshot** captured at the moment the print job is created. This means:
- Even if order items are later modified, the printout reflects what was captured
- Reprinting re-uses the same snapshot — no re-querying needed
- Bills and receipts share the same base shape; payment fields are only present on receipts

```json
{
  "receiptType": "RECEIPT",
  "branchName": "King'ong'o",
  "branchPhone": "0707 242 987",
  "orderNumber": "WCB-0042",
  "dailyNumber": 42,
  "orderDate": "08/03/2026",
  "orderTime": "14:32",
  "orderType": "DINE_IN",
  "tableNumber": "T5",
  "waiterName": "Jane Wanjiku",
  "waiterFirstName": "Jane",
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

**Field presence by type:**

| Field | BILL | RECEIPT |
|---|---|---|
| receiptType | `"BILL"` | `"RECEIPT"` |
| branchName, branchPhone | Yes | Yes |
| orderNumber, dailyNumber | Yes | Yes |
| orderDate, orderTime | Yes | Yes |
| orderType, tableNumber | Yes | Yes |
| waiterName, waiterFirstName | Yes | Yes |
| items[], subtotal, deliveryFee, total | Yes | Yes |
| paymentMethod | **Absent** | Yes |
| paidAt | **Absent** | Yes |

---

## 4. API Endpoints

### 4.1 Print Jobs (Web App → Backend)

#### `POST /api/v1/print-jobs`

**Access:** 🔑 WAITER, MANAGER, DIRECTOR, ADMIN
Creates a print job for a given order.

**Request Body:**
```json
{
  "orderId": "uuid",
  "receiptType": "BILL"
}
```

`receiptType` is optional; defaults to `"RECEIPT"` if omitted (backward compatibility).

**Validation Rules:**
- Order must exist and belong to the user's branch
- If `receiptType` is `"RECEIPT"`: order must have `paymentMethod` set (must be paid)
- If `receiptType` is `"BILL"`: no payment required — order just needs to exist

**Idempotency:** If a PENDING or PRINTING job of the same `receiptType` already exists for this order, the existing job is returned instead of creating a duplicate. This prevents double-printing if the waiter taps the button twice quickly. Reprinting after completion creates a new job (intentional).

**Copies logic (set by backend, not client):**
- `BILL` → `copies: 1`
- `RECEIPT` → `copies: 2`

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderId": "uuid",
    "receiptType": "BILL",
    "copies": 1,
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
status      (optional) — filter by status: PENDING, PRINTING, COMPLETED, FAILED
receiptType (optional) — filter by type: BILL, RECEIPT
page        (optional, default 1)
perPage     (optional, default 20)
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
      "receiptType": "BILL",
      "copies": 1,
      "status": "PENDING",
      "receiptData": { ... },
      "createdAt": "2026-03-08T14:32:00Z"
    }
  ]
}
```

The Flutter app reads `receiptType` to determine the print layout (BILL vs RECEIPT header/footer) and `copies` to know how many times to send the ESC/POS payload to the printer.

---

#### `PATCH /api/v1/print-station/jobs/:id`

**Access:** 🖨️ Print Station Token
Updates a print job's status after printing.

**Request Body (success):**
```json
{
  "status": "COMPLETED",
  "printedAt": "2026-03-08T14:32:05Z"
}
```

**Request Body (failure):**
```json
{
  "status": "FAILED",
  "failureReason": "Printer disconnected"
}
```

---

#### `POST /api/v1/print-station/heartbeat`

**Access:** 🖨️ Print Station Token
Updates `lastSeenAt` on the print station record. Called by the Flutter app every 30 seconds **on its own independent timer** (not tied to the polling loop). Allows the web dashboard to show whether the printer is online.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "stationId": "uuid",
    "branchName": "King'ong'o",
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

**Note:** Token is shown once on creation. It is stored hashed (SHA-256) in the DB. If lost, the manager must create a new station.

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

Middleware: `authenticatePrintStation`

- Reads `Authorization: Bearer pst_...` header
- Hashes the token with SHA-256, looks up in `print_stations` table by `tokenHash`
- Rejects with `401` if not found or `isActive: false`
- Attaches `req.printStation = { id, organizationId }` to the request

This is separate from the existing JWT `authenticate` middleware. Print station routes use this instead.

---

## 6. Flutter App Specification ("Wendo Printer")

### 6.1 App Structure

```
lib/
  main.dart
  config/
    app_config.dart          — API URL, poll interval, constants
  models/
    print_job.dart           — PrintJob model (includes receiptType, copies)
    receipt_data.dart        — ReceiptData model
  services/
    api_service.dart         — HTTP calls to backend
    bluetooth_service.dart   — Bluetooth printer connection
    printer_service.dart     — ESC/POS command generation (BILL vs RECEIPT)
    polling_service.dart     — Background poll loop (3–5s)
    heartbeat_service.dart   — Independent heartbeat loop (30s)
  screens/
    setup_screen.dart        — QR scan or manual token entry
    printer_discovery.dart   — Bluetooth device list
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
  mobile_scanner: ^5.x          # QR code scanner for setup
```

### 6.3 Core Flow

#### 6.3.1 Setup (One Time)

```
App Starts
  → Load saved config (API URL, token, printer MAC) from SharedPreferences
  → If no config → show SetupScreen
    → Option A: "Scan QR Code" — camera opens, scans QR from web dashboard
      → Extracts { url, token, name }
      → Calls POST /print-station/heartbeat to verify token
      → On success → saves to SharedPreferences → navigates to PrinterDiscovery
      → On failure → shows "Invalid token" error
    → Option B: Manual entry — text fields for API URL + token
      → Same verification + save flow
  → If config but no saved printer → show PrinterDiscoveryScreen
  → If full config → show HomeScreen
```

#### 6.3.2 Normal Operation (Two Independent Loops)

```
POLLING LOOP (every 3–5 seconds):
  1. GET /print-station/jobs?status=PENDING
  2. If jobs returned AND printer is connected:
     a. For each job:
        i.   Read receiptType and copies from job
        ii.  Generate ESC/POS commands from receiptData (BILL or RECEIPT layout)
        iii. Send bytes to Bluetooth printer × copies times
        iv.  PATCH job status → COMPLETED with printedAt timestamp
        v.   On Bluetooth send error → PATCH job status → FAILED with reason
     b. If JSON parse error on a job → skip that job, mark it FAILED, continue to next
  3. If jobs returned AND printer is NOT connected:
     a. Leave jobs as PENDING (do NOT mark FAILED — they'll print when reconnected)
     b. Show notification: "X print jobs waiting — printer disconnected"

HEARTBEAT LOOP (every 30 seconds, independent timer):
  1. POST /print-station/heartbeat
  2. On success → update local branch name from response
  3. On 401 → show "Invalid token — re-scan QR code" and navigate to setup
  4. On network error → show "No connection" indicator, keep retrying

IMPORTANT: These two loops run independently.
  - The heartbeat must NOT depend on the polling loop succeeding
  - The polling loop must NOT wait for the heartbeat
  - Both must survive app backgrounding (foreground service)
```

#### 6.3.3 Bluetooth Reconnection (Independent)

```
Bluetooth Reconnection Loop (runs independently):
  → On app start → auto-connect to saved printer MAC address
    → If found → connect silently
    → If not found after 10s → show "Printer not found" with Reconnect button
  → If printer disconnects mid-session:
    → Update UI to "Disconnected"
    → Attempt reconnect every 15 seconds (up to 10 retries)
    → If reconnected → resume printing pending jobs automatically
    → If all retries fail → stop retrying, show "Tap to reconnect" button
```

### 6.4 Bluetooth Discovery Details

**Permissions required (Android):**
- `BLUETOOTH`, `BLUETOOTH_ADMIN` (Android < 12)
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (Android 12+)
- `ACCESS_FINE_LOCATION` (required for Bluetooth scan on Android)

**Discovery strategy:**
1. First, check OS-level paired devices (`getBondedDevices()`) — the work phone likely already has the printer paired at OS level. Show these at the top of the list labeled "Paired Devices."
2. Then scan for new nearby devices and show them below, labeled "Available Devices."
3. In most cases, the user will see their printer immediately in the "Paired" section without waiting for a scan.

**Identifying printers vs other devices:**
- Filter by Bluetooth device class if available (Major class: `Imaging`, Minor class: `Printer`)
- If class info unavailable (common with cheap thermal printers), show all devices — user picks the right one
- Common generic printer names to look for: `RPP02N`, `MTP-II`, `POS-58`, `POS-80`, `BlueTooth Printer`, `Gprinter`, `XPrinter`

### 6.5 Screens

**Setup Screen (first launch or token invalidated):**
- Large "Scan QR Code" button (preferred path — opens camera)
- Expandable "Manual Entry" section with:
  - Text field: API Base URL
  - Text field: Print Station Token
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
- Recent print log (last 20 jobs, scrollable) — shows receipt type (BILL/RECEIPT), order number, time, status
- "Test Print" button — prints a test receipt
- Settings gear icon → re-enter API URL / token

### 6.6 Connection Status UI

| State | Indicator | Trigger |
|---|---|---|
| Online | Green dot | Heartbeat fired within last 60s (backend tracks `lastSeenAt`) |
| Offline | Red dot | No heartbeat for >60s, or Bluetooth disconnected |
| Invalid Token | Red dot + error banner | 401 response on heartbeat or poll → prompt re-scan |
| No Connection | Yellow dot | Network error on API calls → keep retrying |

---

## 7. Flutter App Design System

The Wendo Printer app must feel like it belongs to the same brand family as the Wendo RMS web app. It is a utility — staff interact with it during setup and when troubleshooting. The rest of the time it runs silently. The design should be calm, warm, and confident — not flashy.

### 7.1 Design Philosophy

This is a background utility app, not a consumer product. Design priorities:

1. **Status at a glance** — The home screen's primary job is to answer one question: "Is the printer working?" That answer must be visible in under 1 second.
2. **Minimal interaction** — After setup, staff should rarely need to touch the app. Every screen must work with zero scrolling where possible.
3. **Brand coherence** — Same warm palette and typefaces as the web app. The app should feel like it was built by the same team.
4. **Clarity under stress** — When something goes wrong (printer disconnected, token invalid), the error must be unmistakable and the fix obvious.

### 7.2 Colour Palette

Derived directly from the Wendo RMS design system. Flutter `Color` values:

```dart
// ─── Primary ─────────────────────────────────────────────
static const espresso      = Color(0xFF2C1810); // Primary actions, app bar
static const espressoLight = Color(0xFF4A2C1A); // Button hover/press
static const crema         = Color(0xFFF5F0E8); // Page background
static const parchment     = Color(0xFFEDE7DC); // Card background, inputs

// ─── Accent ──────────────────────────────────────────────
static const amber         = Color(0xFFC4862A); // Highlights, focus rings
static const amberLight    = Color(0xFFF0C97A); // Badge backgrounds

// ─── Neutrals ────────────────────────────────────────────
static const stone900      = Color(0xFF1C1917); // Primary text
static const stone700      = Color(0xFF44403C); // Secondary text
static const stone500      = Color(0xFF78716C); // Muted text, timestamps
static const stone300      = Color(0xFFD6D3D1); // Dividers, borders
static const stone200      = Color(0xFFE8E5E1); // Input borders
static const stone100      = Color(0xFFF4F2EF); // Hover backgrounds

// ─── Status ──────────────────────────────────────────────
// Connected / Success
static const successBg     = Color(0xFFEDFAF1);
static const successText   = Color(0xFF1A6B3C);
static const successBorder = Color(0xFF86EFAC);

// Disconnected / Error
static const errorBg       = Color(0xFFFEF2F2);
static const errorText     = Color(0xFF991B1B);
static const errorBorder   = Color(0xFFFCA5A5);

// Warning / No Connection
static const warningBg     = Color(0xFFFFFBEB);
static const warningText   = Color(0xFF92400E);
static const warningBorder = Color(0xFFFCD34D);

// Pending (jobs waiting)
static const pendingBg     = Color(0xFFFDF3DC);
static const pendingText   = Color(0xFF92650A);
static const pendingBorder = Color(0xFFF0D080);
```

**Rules:**
- Page backgrounds are always `crema` — never pure white or grey
- Cards sit on `parchment` or white with warm-toned `shadow-sm`
- `espresso` is reserved for the app bar, primary buttons, and key action elements — never as a large background fill
- Status colours are only used in their designated contexts (connected = success green, disconnected = error red, etc.)
- Never use pure `#000000` or `#FFFFFF` — always use the warm equivalents (`stone900`, `crema`)

### 7.3 Typography

**Display & Headings: Cormorant Garamond**
Used only for the app name on the setup screen and the branch name on the home screen. Gives brand warmth without overuse.

**Body & UI: Jost**
All buttons, labels, status text, log entries, input fields. Clean geometric sans-serif that matches the web app.

Google Fonts packages: `google_fonts: ^6.x`

```dart
// ─── Type Scale ──────────────────────────────────────────
// Display (Cormorant Garamond) — brand moments only
displayLg:   24sp, weight 500, letterSpacing -0.5
displayMd:   20sp, weight 500, letterSpacing -0.3

// Headings (Jost)
headingLg:   20sp, weight 600, letterSpacing -0.3
headingMd:   18sp, weight 600, letterSpacing 0
headingSm:   16sp, weight 600, letterSpacing 0

// Body (Jost)
bodyLg:      16sp, weight 400, lineHeight 1.5
bodyMd:      15sp, weight 400, lineHeight 1.5
bodySm:      14sp, weight 400, lineHeight 1.4

// Labels (Jost)
labelLg:     14sp, weight 500, letterSpacing 0.1
labelMd:     13sp, weight 500, letterSpacing 0.1
labelSm:     12sp, weight 500, letterSpacing 0.2

// Caption (Jost)
caption:     12sp, weight 400, letterSpacing 0.1
```

### 7.4 Spacing & Layout

Base unit: **4dp**. All spacing is a multiple of this.

```
space-1    4dp     — tight gaps (icon to text)
space-2    8dp     — compact spacing
space-3    12dp    — small gaps within cards
space-4    16dp    — standard padding
space-5    20dp    — comfortable padding
space-6    24dp    — card internal padding
space-8    32dp    — section spacing
space-10   40dp    — generous separation
```

**Screen padding:** 20dp horizontal on all screens.
**Minimum touch target:** 48dp × 48dp (Material guidelines).
**Card padding:** 20dp all sides.

### 7.5 Elevation & Shadows

Warm-toned shadows matching the web app. Flutter `BoxShadow` values:

```dart
// Elevation 1 — subtle lift (cards on crema background)
shadowSm: BoxShadow(
  color: Color(0x0F2C1810), // espresso at 6% opacity
  offset: Offset(0, 1),
  blurRadius: 3,
)

// Elevation 2 — standard card
shadowMd: BoxShadow(
  color: Color(0x122C1810), // espresso at 7%
  offset: Offset(0, 4),
  blurRadius: 6,
)

// Elevation 3 — raised element (dialogs)
shadowLg: BoxShadow(
  color: Color(0x142C1810), // espresso at 8%
  offset: Offset(0, 10),
  blurRadius: 15,
)
```

### 7.6 Border Radius

```dart
radiusSm:    4.0   // Input fields, small badges
radiusMd:    8.0   // Buttons, cards, standard rounding
radiusLg:   12.0   // Dialogs, bottom sheets
radiusXl:   16.0   // Large feature cards
radiusFull: 9999.0 // Status dots, pill badges
```

### 7.7 Component Specs

#### App Bar
```
Background:   espresso (#2C1810)
Title:        Jost, headingMd, crema (#F5F0E8), weight 600
Height:       56dp
Icon colour:  crema
Elevation:    0 (flat, no shadow — the colour itself provides separation)
```

#### Primary Button
```
Background:   espresso (#2C1810)
Text:         crema (#F5F0E8), Jost labelLg, weight 500
Height:       48dp
Padding:      0 24dp
Border radius: radiusMd (8dp)
Press:        espressoLight (#4A2C1A)
Disabled:     stone200 background, stone500 text
Loading:      crema spinner (16dp) replacing text, background stays espresso
```

#### Secondary Button
```
Background:   transparent
Text:         espresso (#2C1810), Jost labelLg
Border:       1.5dp solid espresso
Height:       48dp
Padding:      0 24dp
Border radius: radiusMd
Press:        stone100 background
```

#### Ghost Button
```
Background:   transparent
Text:         stone700, Jost labelMd
Height:       40dp
Press:        stone100 background
```

#### Text Input
```
Background:   parchment (#EDE7DC)
Border:       1.5dp solid stone200
Border radius: radiusSm (4dp)
Height:       48dp
Padding:      0 16dp
Text:         Jost bodyMd, stone900
Label:        Jost labelSm, stone700, 8dp above input
Placeholder:  stone500
Focus:        border → espresso, amber focus ring (3dp, 35% opacity)
Error:        border → errorBorder, helper text in errorText below
```

#### Status Indicator Dot
```
Size:         12dp
Border radius: radiusFull (circle)
Connected:    successText (#1A6B3C), solid fill
Disconnected: errorText (#991B1B), solid fill
Connecting:   warningText (#92400E), pulsing animation (0.8s ease-in-out infinite)
```

#### Status Banner (top of home screen)
```
// Connected
Background:   successBg (#EDFAF1)
Border:       1dp solid successBorder (#86EFAC)
Border radius: radiusMd
Text:         successText, Jost labelLg
Icon:         check-circle, 20dp, successText

// Disconnected
Background:   errorBg (#FEF2F2)
Border:       1dp solid errorBorder (#FCA5A5)
Text:         errorText, Jost labelLg
Icon:         alert-circle, 20dp, errorText

// No Connection
Background:   warningBg (#FFFBEB)
Border:       1dp solid warningBorder (#FCD34D)
Text:         warningText, Jost labelLg
Icon:         wifi-off, 20dp, warningText
```

#### Print Log Item (list tile)
```
Background:   white (or crema if on parchment surface)
Border-bottom: 1dp solid stone200
Padding:      16dp vertical, 20dp horizontal
Left:         receipt type badge (pill, radiusFull)
              BILL → pendingBg + pendingText
              RECEIPT → successBg + successText
Centre:       Order number (Jost bodySm, stone900) + timestamp (caption, stone500)
Right:        Status icon
              COMPLETED → check icon, successText
              FAILED → x icon, errorText
              PENDING → clock icon, stone500
```

#### QR Scanner Overlay (setup screen)
```
Background:   camera preview fills screen
Overlay:      semi-transparent espresso at 70% (#2C1810 B3)
Scan window:  280dp × 280dp, centred, radiusLg corners
Border:       2dp solid amber (#C4862A)
Corner marks: 4 corner brackets, amber, 3dp thick, 40dp long
Instruction:  "Scan the QR code from the web dashboard"
              Jost bodyMd, crema, centred below scan window
Cancel:       Ghost button, crema text, bottom safe area
```

### 7.8 Screen Layouts

#### Setup Screen
```
Background:   crema
Top section (40% of screen):
  - Wendo logo (56dp height, centred)
  - "Wendo Printer" — Cormorant Garamond displayLg, espresso, centred
  - "Connect your branch printer" — Jost bodyMd, stone500, centred

Middle section:
  - "Scan QR Code" button — Primary, full-width, 48dp height
    Icon: qr-code, 20dp, left of text
  - 24dp gap
  - Divider with "or" label (stone500, centred on stone300 line)
  - 24dp gap

Expandable "Manual Setup" section:
  - Collapsed by default, tap to expand
  - Chevron icon rotates on expand
  - API URL text input
  - Station Token text input
  - "Test Connection" — Secondary button, full-width
  - "Save & Continue" — Primary button, full-width (disabled until test passes)

Bottom safe area: 20dp padding
```

#### Printer Discovery Screen
```
Background:   crema
App bar:      espresso, title "Select Printer"

Body:
  - "Scan for Printers" — Primary button, full-width, top
  - 24dp gap
  - Section: "Paired Devices" — labelSm, stone500, uppercase, tracking 0.1
    - List of device cards (parchment background, radiusMd, shadowSm)
      - Device name: Jost headingSm, stone900
      - MAC address: Jost caption, stone500
      - Type badge: pill, "Classic" or "BLE", stone100 bg + stone700 text
      - Tap target: entire card
  - Section: "Available Devices" — same label style
    - Same card style, but with RSSI signal bars icon (stone500)
  - Scanning state: inline spinner (espresso, 24dp) + "Scanning..." label

Empty state (no devices found):
  - Icon: bluetooth-off, 48dp, stone300
  - "No printers found" — headingSm, stone700
  - "Make sure your printer is turned on and in range" — bodySm, stone500
  - "Scan Again" — Secondary button
```

#### Home Screen
```
Background:   crema
App bar:      espresso
  Left: printer icon (crema)
  Title: "Wendo Printer" (crema)
  Right: settings gear icon button (crema)

Status banner (full-width, 20dp horizontal margin, 16dp from top):
  - Connected / Disconnected / No Connection variant (see component spec above)

Info card (parchment, shadowSm, radiusMd, 20dp padding, 16dp below banner):
  - Row 1: "Branch" label (labelSm, stone500) + branch name (headingSm, stone900)
  - Row 2: "Printer" label + printer name + MAC address (bodySm, stone700)
  - Row 3: "Last Print" label + timestamp (bodySm, stone500)
  - If disconnected: "Reconnect Printer" — Secondary button, full-width, 16dp top margin

Pending jobs indicator (only shown when jobs > 0 and printer disconnected):
  - Card with pendingBg, pendingBorder, radiusMd
  - Icon: printer-alert, 20dp, pendingText
  - "3 print jobs waiting" — labelLg, pendingText
  - 12dp below info card

Print log section (takes remaining space):
  - Section header: "Recent Activity" — labelSm, stone500, uppercase
  - Scrollable list of PrintLogItem tiles (see component spec)
  - Empty state: "No print activity yet" — bodySm, stone500, centred

Bottom action bar (white, border-top 1dp stone200, 16dp padding + safe area):
  - "Test Print" — Ghost button, left
  - "Change Printer" — Ghost button, right
```

### 7.9 Animations & Transitions

Keep animations minimal and purposeful — this is a utility app.

```
// Page transitions
Navigation push:  Slide in from right, 250ms, Curves.easeInOut
Navigation pop:   Slide out to right, 200ms, Curves.easeIn

// Status changes
Status dot pulse:     scale 1.0 → 1.2 → 1.0, 800ms, ease-in-out (connecting state only)
Status banner swap:   Crossfade, 200ms
Print log new entry:  Slide in from top + fade, 300ms, Curves.easeOut

// Buttons
Press:            Scale 0.97, 100ms
Release:          Scale 1.0, 100ms

// QR scanner
Corner brackets:  Subtle pulse, scale 1.0 → 1.02 → 1.0, 2s infinite (draws eye to scan area)
```

### 7.10 Iconography

Use **Lucide Icons** (consistent with the web app's icon set). Flutter package: `lucide_icons: ^0.x`

Key icons used in the app:
```
Home screen:      printer, settings, wifi, wifi-off, bluetooth, bluetooth-off
Status:           check-circle, alert-circle, clock, x-circle
Print log:        receipt, file-text (bill), check, x
Setup:            qr-code, keyboard (manual entry), test-tube (test connection)
Discovery:        bluetooth-searching, signal, signal-low, signal-zero
Actions:          refresh-cw (reconnect), plus (test print), chevron-down (expand)
```

Icon sizes:
- App bar icons: 24dp
- Status banner icon: 20dp
- List item icons: 18dp
- Empty state illustration icon: 48dp
- Button inline icons: 20dp

### 7.11 Dark Mode

**Not supported in V1.** The app uses the warm light theme exclusively. Dark mode is deferred because:
- The app runs on a dedicated work phone, not a personal device
- Brand consistency requires the warm crema/parchment backgrounds
- Engineering time is better spent on reliability than theme variants

If dark mode is added later, it should use:
- Background: `#1C1917` (stone900)
- Surface: `#292524` (warm dark grey)
- Text: `#F5F0E8` (crema)
- Espresso buttons become `amber` (#C4862A) for contrast

### 7.12 Persistent Notification (Foreground Service)

The Android notification shown while the app runs in the background:

```
Small icon:    Printer icon (white silhouette, follows Android notification icon rules)
Title:         "Wendo Printer"
Body:          "Connected and listening" (when connected)
               "Printer disconnected — X jobs waiting" (when disconnected)
               "No network connection" (when offline)
Colour:        espresso (#2C1810) — Android notification accent colour
Priority:      Low (persistent, not intrusive)
Channel:       "printer_status" — user can silence but not dismiss
```

---

## 8. Print Formats (ESC/POS)

**Paper width: 80mm = 48 characters per line**

### 7.1 Bill Format (Pre-Payment)

```
================================================
          WENDO COFFEE BISTRO
            King'ong'o
         Tel: 0707 242 987
================================================
                  BILL
------------------------------------------------
Order #42                           DINE IN
Date: 08/03/2026                      14:32
Table: T5
Server: Jane
------------------------------------------------
ITEM                        QTY       AMOUNT
------------------------------------------------
Cappuccino                    2       600.00
Club Sandwich                 1       450.00
Sparkling Water               1       150.00
------------------------------------------------
Subtotal                            1,200.00
================================================
TOTAL                      KES    1,200.00
================================================

       Please present this bill
           to settle payment.

        Thank you for dining
          at Wendo Bistro!
================================================
          [QR CODE - centered]
       Scan to visit wendoz.co.ke
================================================
```

### 7.2 Receipt Format (Post-Payment, Printed 2×)

```
================================================
          WENDO COFFEE BISTRO
            King'ong'o
         Tel: 0707 242 987
================================================
                RECEIPT
------------------------------------------------
Order #42                           DINE IN
Date: 08/03/2026                      14:32
Table: T5
Server: Jane
------------------------------------------------
ITEM                        QTY       AMOUNT
------------------------------------------------
Cappuccino                    2       600.00
Club Sandwich                 1       450.00
Sparkling Water               1       150.00
------------------------------------------------
Subtotal                            1,200.00
Delivery Fee                            0.00
================================================
TOTAL                      KES    1,200.00
================================================
Paid: Cash
------------------------------------------------

       Thank you for visiting Wendo!
        We'll see you again soon.

================================================
          [QR CODE - centered]
       Scan to visit wendoz.co.ke
================================================
```

**Note on 2-copy receipts:** The Flutter app prints the same receipt layout twice in sequence (with a paper cut between copies). No "COPY 1" / "COPY 2" label is needed — both copies are identical. One is handed to the customer, one is kept by the cashier/accountant.

### 7.3 Delivery Order Bill (No Table Number)

```
================================================
          WENDO COFFEE BISTRO
            King'ong'o
         Tel: 0707 242 987
================================================
                  BILL
------------------------------------------------
Order #7                           DELIVERY
Date: 08/03/2026                      09:15
Server: John
------------------------------------------------
ITEM                        QTY       AMOUNT
------------------------------------------------
Americano (Double)            1       200.00
Croissant                     2       300.00
------------------------------------------------
Subtotal                              500.00
Delivery Fee                          150.00
================================================
TOTAL                      KES      650.00
================================================

       Please present this bill
           to settle payment.

        Thank you for ordering
          from Wendo Bistro!
================================================
          [QR CODE - centered]
       Scan to visit wendoz.co.ke
================================================
```

### 7.4 Column Layout & Formatting Rules

**Column layout for items (48 chars total):**
- Item name column: 28 chars (left-aligned)
- QTY column: 6 chars (right-aligned)
- AMOUNT column: 12 chars (right-aligned)
- 2 spaces between columns

**Item name wrapping rule:**
- If name ≤ 28 chars: single line with qty + amount
- If name > 28 chars:
  - Line 1: first 28 chars, break at last word boundary, no qty/amount
  - Line 2: 2-space indent + remainder (max 26 chars) + qty + amount
  - If remainder still > 26 chars: truncate with `...`

**Order type display:** `DINE_IN` → `DINE IN`, `TAKE_AWAY` → `TAKE AWAY`, `DELIVERY` → `DELIVERY`

**Payment method display:** `MPESA` → `M-Pesa`, `CASH` → `Cash`, `CARD` → `Card`

**Delivery Fee line:** Only shown on RECEIPT type, or on BILL if the order is a DELIVERY type and deliveryFee > 0. Hidden on BILL for non-delivery orders.

**Table line:** Only shown when `tableNumber` is not null.

**Currency formatting:** All monetary values formatted as `X,XXX.00`. Decimal precision: always 2 places. Thousands separator: comma. The `KES` prefix is only on the TOTAL line.

**Branch phone numbers (derived from branch name):**
- `King'ong'o` → `0707 242 987`
- `Nyeri Town` → `0722 392 343`
- No match → omit the Tel line from header

### 7.5 ESC/POS Commands Used

- `ESC @` (0x1B 0x40) — Initialize printer
- `ESC a 1` (0x1B 0x61 0x01) — Center align
- `ESC a 0` (0x1B 0x61 0x00) — Left align
- `ESC E 1` (0x1B 0x45 0x01) — Bold on (header, TOTAL line, BILL/RECEIPT label)
- `ESC E 0` (0x1B 0x45 0x00) — Bold off
- `GS ! 0x11` (0x1D 0x21 0x11) — Double height + double width (for BILL/RECEIPT label)
- `GS ! 0x00` (0x1D 0x21 0x00) — Normal size
- `ESC d 4` (0x1B 0x64 0x04) — Feed 4 lines
- `GS ( k` — Print QR code (URL: https://www.wendoz.co.ke/, module size 4)
- `GS V 1` (0x1D 0x56 0x01) — Partial cut

**Formatting helpers required in Flutter:**
- `centerText(String text, int width)` — pad both sides with spaces
- `leftRight(String left, String right, int width)` — fill between with spaces
- `formatAmount(double amount)` — `"1,250.00"` (no currency symbol)
- `wrapItemName(String name, int maxWidth)` — split at word boundaries
- `buildBillLayout(ReceiptData data)` — assemble BILL ESC/POS bytes
- `buildReceiptLayout(ReceiptData data)` — assemble RECEIPT ESC/POS bytes

---

## 9. Frontend Changes (Wendo RMS Web App)

### 9.1 "Print Bill" Button

**Location:** Order detail view — visible once order items exist (any status except CANCELLED)

**Visibility:** Shown when the order has items and has NOT been paid yet (`order.paymentMethod` is null)

**Behavior:**
1. Tap "Print Bill"
2. Call `POST /api/v1/print-jobs` with `{ orderId, receiptType: "BILL" }`
3. Show toast: "Bill sent to printer"
4. If API returns error (e.g., no print station configured), show: "No printer configured for this branch"
5. Button remains visible for reprinting (the idempotency guard prevents duplicate PENDING jobs, but allows new jobs after the first completes)

### 9.2 "Print Receipt" Button

**Location:** Order detail view / payment confirmation screen

**Visibility:** Only shown when `order.paymentMethod` is set (order is paid)

**Behavior:**
1. Tap "Print Receipt"
2. Show a brief confirmation: "This will print 2 copies (customer + accountant). Continue?" — with "Print" and "Cancel" buttons
3. On confirm: call `POST /api/v1/print-jobs` with `{ orderId, receiptType: "RECEIPT" }`
4. Show toast: "Receipt sent to printer (2 copies)"
5. If API returns error, show: "No printer configured for this branch"
6. Button remains visible for reprinting

### 9.3 Print Station Management (Manager Settings)

**Location:** Branch settings page (manager/director/admin only)

**Features:**
- List print stations for this branch (name, status, last seen)
- "Add Print Station" button → creates station, shows a modal with:
  - A **QR code** encoding `{"url":"<NEXT_PUBLIC_API_URL>","token":"pst_...","name":"<station_name>"}` — staff scans this with the Flutter app
  - The raw token displayed below with a copy button (fallback for manual entry)
  - Warning: "This token will not be shown again"
- "Remove" button → deactivates station
- Online/offline indicator based on `lastSeenAt` (online if seen within last 60 seconds)
- Frontend dependency: `qrcode.react` for QR code rendering

### 9.4 Print Job History (Optional, Low Priority)

A simple list view in the manager dashboard showing recent print jobs:
- Receipt type badge (BILL / RECEIPT)
- Order number
- Status (PENDING / COMPLETED / FAILED)
- Time
- Requested by

Useful for debugging "did it print?" questions.

---

## 10. Security Considerations

- Print station tokens are hashed with SHA-256 before storage
- Tokens are prefixed with `pst_` to distinguish from JWTs
- Print station endpoints only return data for the station's own branch (enforced by `organizationId` from the token lookup)
- Receipt data does not contain sensitive information (no customer PII, no staff salaries)
- Print stations can be deactivated immediately from the web dashboard if a token is compromised
- Failed authentication (401) on the Flutter app immediately surfaces to the user — no silent retry with bad credentials

---

## 11. Failure Modes & Edge Cases

### 11.1 Standard Failure Modes

| Scenario | Behavior |
|---|---|
| Flutter app closed / phone off | Jobs accumulate as PENDING. Print when app reopens. |
| Printer disconnected mid-print | Job marked FAILED with reason. Auto-reconnect loop starts. Staff can reprint from web. |
| Printer disconnected, jobs arrive | Jobs stay PENDING (not FAILED). Print automatically when printer reconnects. |
| Network outage on work phone | Poll fails silently. Resumes when network returns. Jobs are safe in DB. |
| Reprint same order | Creates a new PrintJob each time (after previous one completes). Intentional — allows reprints. |
| Print station token revoked | API returns 401. App shows "Token invalid — re-scan QR code" and navigates to setup screen. |
| Waiter taps button twice quickly | Idempotency guard: if a PENDING/PRINTING job of the same type exists for that order, the existing job is returned. No duplicate print. |

### 11.2 Bluetooth Edge Cases

| Scenario | Behavior |
|---|---|
| Printer turned off during shift | Auto-reconnect retries 10 times (15s intervals). Shows "Printer offline" on Home screen. Pending jobs wait. |
| Printer out of paper | Printer may or may not report error (varies by model). If ESC/POS write succeeds but nothing prints, this is invisible to the app. Mitigation: staff sees the printer didn't print, taps the print button again. |
| Printer paired to a different phone | Bluetooth Classic only pairs to one device at a time. If someone pairs their personal phone, the work phone loses the bond. App detects disconnect → shows "Printer disconnected." Manager re-pairs from the discovery screen. |
| Multiple printers in scan range | Discovery list shows all. User must pick the correct one. Show device name + MAC to distinguish. |
| Phone Bluetooth turned off | App detects Bluetooth adapter state. Shows "Bluetooth is off — enable it in Settings" with a button to open Android Bluetooth settings. |
| Android kills foreground service (rare, aggressive OEMs) | On next app open, pending jobs are fetched and printed. Mitigation: add app to battery optimization whitelist during setup (show instructions for common OEMs: Samsung, Xiaomi, Huawei). |
| Work phone shared across shifts | No issue. The app is stateless per-user — it's tied to the branch, not a staff member. Any staff can see the print log. |

### 11.3 Data Edge Cases

| Scenario | Behavior |
|---|---|
| Order modified after bill printed | The printed bill reflects the snapshot at print time. If items changed, the waiter should print a new bill. |
| Bill printed, then order cancelled | Bill was already printed. No recall mechanism needed — staff handles this physically. |
| Very long item names (> 28 chars) | ESC/POS formatter wraps to a second line (2-space indent). If remainder still exceeds 26 chars after indent, truncate with `...`. |
| Order with 20+ items | Receipt will be long but printers handle continuous paper. No issue. |
| Stale PENDING jobs (e.g., from yesterday) | `maxAge` check: PENDING jobs older than 24 hours are auto-marked as `FAILED` with reason "Expired — not printed within 24h." This prevents the printer from spitting out yesterday's receipts when turned on in the morning. |
| Concurrent poll picks up same job on two cycles | The PATCH to PRINTING acts as a lock. If the first cycle already set it to PRINTING, the second cycle's poll won't return it (poll filters `status=PENDING`). |
| JSON parse error on a print job | App must NOT crash. Skip the bad job, mark it FAILED with reason "Invalid receipt data", log the error locally, continue processing remaining jobs. |

### 11.4 Network Edge Cases

| Scenario | Behavior |
|---|---|
| Backend down | Poll returns error. App shows "Server unreachable" indicator. Retries on next poll cycle. No jobs lost (they were never fetched). |
| Slow network (high latency) | Poll timeout set to 10 seconds. If exceeded, skip cycle and retry on next interval. |
| Token invalidated from web dashboard | App gets 401 on poll. Shows "Authentication failed — re-scan QR code" and navigates to setup screen. |

---

## 12. Background Behavior (Android)

- The app **must** use a **foreground service** to keep polling and heartbeat running when minimized
- Show a persistent notification: "Wendo Printer — Connected and listening"
- This prevents Android from killing the app
- **Battery optimization:** During setup, prompt the user to disable battery optimization for the app:
  - Samsung: Settings → Battery → App power management → add to "Unmonitored apps"
  - Xiaomi: Settings → Battery → App battery saver → No restrictions
  - Huawei: Settings → Battery → App launch → Manual → enable all toggles
  - Stock Android: Settings → Battery → Unrestricted
- This is **critical** — aggressive OEMs like Samsung, Xiaomi, and Huawei will kill foreground services otherwise

---

## 13. Implementation Status

### Phase A: Backend (Wendo RMS) — ✅ COMPLETE

All backend code is implemented:
1. Prisma schema with `PrintJob`, `PrintStation` models, `ReceiptType` + `PrintJobStatus` enums
2. Migration applied
3. Print station auth middleware (`authenticatePrintStation`)
4. Print station management endpoints (create, list, deactivate)
5. Print job endpoints (create with BILL/RECEIPT support, list, get, update status)
6. Receipt data assembly service with snapshot logic, branch phone lookup, copy count logic
7. 24-hour expiry for stale PENDING jobs
8. Idempotency guard for duplicate prevention

### Phase B: Frontend (Wendo RMS) — 🔴 NOT STARTED

1. "Print Bill" button on order detail (before payment)
2. "Print Receipt" button on order detail (after payment, with 2-copy confirmation)
3. Print station management page in branch settings (QR code, token, online/offline status)
4. Print job history view (low priority)

### Phase C: Flutter App ("Wendo Printer") — 🔴 NOT STARTED

1. Project setup + dependencies
2. Setup screen (QR scan + manual entry)
3. API service (poll + heartbeat + status update)
4. Bluetooth service (discover, connect, send bytes)
5. ESC/POS receipt + bill formatter (two layouts)
6. Home screen (status, logs, reconnect)
7. Foreground service for background polling + heartbeat
8. Test with actual thermal printer
