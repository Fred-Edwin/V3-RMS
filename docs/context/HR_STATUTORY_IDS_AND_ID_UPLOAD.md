# HR — SHIF/NHIF + NSSF Numbers & National ID Front/Back Upload

**Status:** Planned, not started
**Requested by:** Client HR, relayed 2026-08-06
**Builds on:** `HR_PROFILE_OVERHAUL.md` (complete 2026-07-14)

---

## 1. What the client asked for

1. Staff should be able to enter their **NHIF number** and **NSSF number** on their
   own profile page — free-text alphanumeric, same behaviour as the existing KRA PIN.
   These are two distinct numbers, not one.
2. Staff should be able to upload a copy of their **national ID, front and back**, as
   two separately identifiable slots (today both land as a generic `ID_COPY`).

## 2. Decisions taken (confirmed with owner 2026-08-06)

| # | Decision | Rationale |
|---|---|---|
| D-1 | Label the health field **"SHIF / NHIF Number"**, stored as `shifNhifNumber` | NHIF was replaced by SHIF (SHA) in Oct 2024, but staff still quote old NHIF numbers. One field, both names on the label — avoids a rename migration later. |
| D-2 | NSSF number is a **separate field** (`nssfNumber`) | Two distinct statutory numbers per the client. |
| D-3 | Both numbers appear **everywhere KRA PIN appears** | Explicit client instruction. See §4 for the full enumerated surface list. |
| D-4 | Add `NATIONAL_ID_FRONT` / `NATIONAL_ID_BACK` to `HrDocumentType`; keep `ID_COPY` for legacy rows | Structured type is what lets HR verify file completeness at a glance. A relabel-only approach cannot. |
| D-5 | Re-upload of an ID side **replaces** (deletes old row + Cloudinary asset); all other types stay append-only | Client asked for overwrite. Scoped to the two ID types only — staff legitimately hold multiple certificates. |
| D-6 | Replace never deletes a document linked to a disciplinary record or leave request | Reuses the existing case-evidence guard in `deleteHrDocument`. |

### Note on existing `nssfTier1` / `nssfTier2`

`Payslip.nssfTier1` / `nssfTier2` (schema.prisma:1312-1313) are **deduction amounts**,
entirely unrelated to the NSSF member number added here. Do not conflate them.

---

## 3. Schema changes

`EmployeeProfile` (schema.prisma:1117) — two new nullable columns, placed beside `kraPIN`:

```prisma
  kraPIN             String?         @map("kra_pin")
  shifNhifNumber     String?         @map("shif_nhif_number")   // NEW
  nssfNumber         String?         @map("nssf_number")        // NEW
```

`HrDocumentType` enum (schema.prisma:1377) — two new values appended:

```prisma
enum HrDocumentType {
  CONTRACT
  ID_COPY              // retained: legacy rows uploaded before front/back split
  NATIONAL_ID_FRONT    // NEW
  NATIONAL_ID_BACK     // NEW
  CERTIFICATE
  ...
}
```

Single additive migration. No backfill: existing `ID_COPY` rows stay as-is and continue
to render. Enum values are appended, never reordered.

---

## 4. The "everywhere KRA PIN is" surface (D-3)

Enumerated from `grep -rn "kraPIN"`. Every site below takes both new fields.

### Backend
| File | Change |
|---|---|
| `repositories/hr-repository.ts:47,65` | Add both fields to the two profile-input interfaces |
| `validators/hr-schemas.ts:40,64,74` | Add to `updateEmployeeProfileSchema`, `selfServiceProfileSchema` (`.strict()` — omitting here makes self-service saves **fail**, not silently drop), `updatePaymentDetailsSchema` |
| `validators/hr-schemas.ts:122` | Add two enum values to `uploadHrDocumentSchema` |
| `utils/hr-constants.ts` | Add both ID types to `SELF_UPLOADABLE_DOCUMENT_TYPES` |
| `repositories/payslip-repository.ts:15,28` | Add to both `select` blocks so the payslip PDF can render them |

### Frontend — types
| File | Change |
|---|---|
| `types/hr.ts:66,132,346` | Add to all three profile-shaped interfaces |
| `types/hr.ts:142` | Add both ID types to `SELF_UPLOADABLE_DOCUMENT_TYPES` (mirrors backend) |
| `types/payslip.ts:11,16` | Add to the employee-profile shape |
| `services/payslipService.ts:74` | Add to the inline response type |

### Frontend — payroll sheet (editable)
| File | Change |
|---|---|
| `app/app/hr/payroll/sheet-config.tsx:9` | Extend `StaffDetailField` union with both keys |
| `app/app/hr/payroll/sheet-config.tsx:340` | Two more `staffDetailColumn(...)` entries in the Staff Details band |
| `app/app/hr/payroll/payroll-sheet.ts:31,163,189` | Add to row type, empty row, and the profile→row mapper |
| `lib/payroll-staff-details.ts:12,18,41` | Add to `StaffDetailSource`, `StaffDetailPatch`, `buildStaffDetailPatch` — all fields save together so one edit can't drop another |

### Frontend — exports
| File | Change |
|---|---|
| `lib/payroll-csv.ts:147,252` | Add two columns to the **full register** header + row, after `KRA PIN` |
| `lib/payroll-csv.ts:83,116` | **Bank file — see warning below** |
| `lib/payroll-xlsx.ts:59,198` | Add two `COLUMNS` entries after `KRA PIN` (+ matching row values). `COL_COUNT` and `MONEY_KEYS` derive automatically; new columns are non-money so subtotal logic is unaffected. |

> **⚠️ Bank file is a positionally-parsed format.** `BANK_HEADER`
> (`payroll-csv.ts:83`) is consumed by the bank, which reads columns by position.
> Inserting statutory numbers there could break their import. **Recommendation:
> leave the bank file unchanged** and add the two numbers only to the full register
> and XLSX. This is the one place I'd deliberately not apply D-3 literally — flag to
> HR for confirmation before shipping. If HR confirms the bank accepts extra columns,
> it's a two-line change.

### Frontend — profile & HR views
| File | Change |
|---|---|
| `app/app/profile/page.tsx:39-60` | Add both to `EmployeeDetailsForm`, `emptyDetailsForm`, `detailsFormFrom` |
| `app/app/profile/page.tsx:200` | Include both in the self-service save payload |
| `app/app/profile/page.tsx:468` | Two `<Input>`s in "Banking & Statutory", after KRA PIN |
| `app/app/profile/page.tsx:32` | Add front/back labels to `SELF_DOC_TYPE_LABELS` |
| `app/app/hr/staff/[userId]/page.tsx:487` | Two `<InfoRow>`s after the KRA PIN row |

---

## 5. Replace-on-re-upload (D-5, D-6)

Implemented in the service layer, not the controller — the delete and create must be
one transaction so a failure can't leave the profile with zero ID images.

New behaviour in the upload path (`hr-controller.ts:344` → `hr-service.ts`):

1. After `authorizeDocumentUpload` succeeds, if `documentType` is `NATIONAL_ID_FRONT`
   or `NATIONAL_ID_BACK`, look for an existing document of that exact type on the profile.
2. If one exists **and** has no `disciplinaryRecordId` / `leaveRequestId` (D-6), delete
   the row and best-effort-destroy its Cloudinary asset — mirroring `deleteHrDocument`'s
   existing `destroyUploadedFile(...).catch(...)` contract.
3. If the existing document *is* case-linked, keep it and append instead (do not fail the
   upload — the staff member has done nothing wrong).
4. Create the new row.

Ordering: upload the new file to Cloudinary **first**, then swap inside a transaction, so
a failed upload leaves the old image intact.

Best encapsulated as `hrRepository.replaceHrDocument(...)` wrapping steps 2–4 in
`prisma.$transaction`, keeping the controller thin per CODING_STANDARDS.

---

## 6. Tests

- `validators/hr-schemas.test.ts` — both fields accepted on all three profile schemas;
  `selfServiceProfileSchema.strict()` still rejects HR-only keys; new enum values parse.
- `lib/payroll-staff-details.test.ts` — `buildStaffDetailPatch` carries both new fields;
  empty string → `null`.
- `lib/payroll-csv.test.ts` / `payroll-xlsx.test.ts` — register/XLSX header and row
  widths stay aligned; bank file byte-for-byte unchanged (guards the ⚠️ above).
- New service test — replace deletes the prior same-side document; does **not** touch the
  other side; does **not** delete a case-linked document; `CERTIFICATE` still appends.

---

## 7. Build order

Strictly sequential; each step compiles before the next.

1. Schema + migration (`npx prisma migrate dev --name add_statutory_ids_and_id_sides`)
2. Backend: repo interfaces → validators → constants → payslip select
3. Backend: replace-on-re-upload service + repo transaction
4. Backend tests; `pnpm build && pnpm test`
5. Frontend: types (`hr.ts`, `payslip.ts`, `payslipService.ts`)
6. Frontend: profile page (inputs + doc labels) and HR staff-detail rows
7. Frontend: payroll sheet (config, row mapper, staff-details lib)
8. Frontend: exports (register CSV + XLSX; bank file untouched pending HR)
9. Frontend tests; `pnpm build`

Per repo convention: stop dev servers before build/typecheck, restart after.

---

## 8. Open item for HR

**Bank file columns** (§4 warning) — confirm whether the bank's import tolerates two extra
columns. Default position: leave the bank file unchanged. Everything else in this plan is
decided and ready to build.
