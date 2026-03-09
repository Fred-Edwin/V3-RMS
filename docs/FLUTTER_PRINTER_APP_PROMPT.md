# Wendo Print Station — Flutter App: QR Code Setup Prompt

## Context

The Wendo Print Station Flutter app is already built. It currently has a setup screen where the user manually types in the API URL and station token.

You need to **add QR code scanning** as the primary setup method. The Wendo RMS web dashboard generates a QR code when a print station is created. The Flutter app should scan that QR code to auto-configure itself — no manual typing required.

---

## What the QR Code Contains

The QR code encodes a JSON string:

```json
{
  "url": "https://api.wendo-rms.co.ke/api/v1",
  "token": "pst_a1b2c3d4e5f6...",
  "name": "Counter Printer"
}
```

---

## What to Add

### 1. New dependency

Add to `pubspec.yaml`:

```yaml
mobile_scanner: ^5.0.0   # QR / barcode scanning via camera
```

Run `flutter pub get`.

### 2. Android permission

Add to `android/app/src/main/AndroidManifest.xml` (if not already present):

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### 3. QR Scanner Screen

Create `lib/screens/qr_scanner_screen.dart`.

- Full-screen camera viewfinder using `MobileScanner`
- Overlay with a centered square scan target (semi-transparent border)
- On successful scan:
  1. Parse the JSON payload
  2. Validate it has `url`, `token`, and `name` fields — if invalid, show a snackbar "Invalid QR code. Please try again." and continue scanning
  3. Save `url` and `token` to SharedPreferences (same keys as the manual setup)
  4. Call the heartbeat endpoint to verify the token works — if it fails, show "Token rejected by server. Ask your manager to regenerate the QR code."
  5. On success: navigate to the Printer Discovery screen (or Home if a printer is already saved)
- Top app bar with a "Cancel" button (back navigation)
- Torch toggle button (flashlight on/off for dark environments)

### 4. Update Setup Screen

The existing setup screen has manual text fields for API URL and token.

- Add a prominent **"Scan QR Code"** button at the top of the screen, above the manual fields
- The button opens the `QrScannerScreen`
- Keep the manual fields as a fallback (collapse them under a "Enter manually" text button/expander)
- The screen should look like: QR button is the primary action, manual entry is secondary

### 5. Home Screen — Re-configure Option

The existing settings/gear option on the home screen that navigates back to setup should also offer "Scan New QR Code" as an option — so managers can re-pair without going through manual entry.

---

## Behaviour After Scanning

After a successful QR scan and token verification:
- Save config to SharedPreferences
- If the app already has a saved printer MAC → navigate directly to Home screen
- If no saved printer → navigate to Printer Discovery screen

The rest of the app flow is unchanged.

---

## Build & Test

```bash
flutter build apk --release
```

Manual test checklist:
- [ ] QR scanner opens from setup screen
- [ ] Valid QR code auto-fills config and verifies with heartbeat
- [ ] Invalid JSON QR shows error and continues scanning
- [ ] Failed heartbeat shows error message
- [ ] Torch toggle works
- [ ] Cancel returns to setup screen
- [ ] Manual entry still works as fallback
