# VendorPilot AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Strict Tenant Isolation**: Every document in `/users/{userId}`, `/sales/{saleId}`, `/expenses/{expenseId}`, and `/inventory/{productId}` is owned by a single authenticated Firebase user (`userId == request.auth.uid`). No user can read, list, create, update, or delete another user's records.
2. **PII Protection**: `/users/{userId}` stores PII (`name`, `email`, `phone`, `address`). `allow list` is completely disabled on `/users`, and `allow get` is strictly restricted to `request.auth.uid == userId`.
3. **Verified Identity for Writes**: All create, update, and delete operations require `request.auth != null && request.auth.token.email_verified == true`.
4. **Parent Profile Existence**: Creating a record in `/sales`, `/expenses`, or `/inventory` requires an existing `/users/$(request.auth.uid)` profile document to prevent orphaned business records.
5. **Immutable Ownership & Timestamps**: `userId`, document ID mirror fields (`saleId`, `expenseId`, `productId`), and `createdAt` cannot be modified after creation. `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
6. **Terminal Settlement Locking**: Once a sale in `/sales/{saleId}` has `paymentStatus == 'Paid'`, it cannot be modified back to `Pending` or `Partial`, nor can its amount be altered.
7. **Strict Schema & Bounds**: Every write validates exact required/allowed keys (`hasAll` + `hasOnly`), string `.size()` bounds, numeric bounds (`> 0` or `>= 0`), enum values, and regex ID formats (`^[a-zA-Z0-9_\-]+$`).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Target | Attack Vector | Expected Result |
|---|--------|---------------|-----------------|
| 1 | `/users/victim-uid` | Cross-tenant `get` by attacker UID | `PERMISSION_DENIED` |
| 2 | `/users` | Collection `list` scraping of user emails/phones | `PERMISSION_DENIED` |
| 3 | `/users/attacker-uid` | Create profile with shadow ghost field `isAdmin: true` | `PERMISSION_DENIED` |
| 4 | `/users/attacker-uid` | Create profile with spoofed client `createdAt` timestamp | `PERMISSION_DENIED` |
| 5 | `/sales/sale-spoof` | Create sale with `userId: "victim-uid"` (Identity Spoofing) | `PERMISSION_DENIED` |
| 6 | `/sales/sale-paid-1` | Re-open terminal `'Paid'` order back to `'Pending'` (State Shortcutting) | `PERMISSION_DENIED` |
| 7 | `/sales/sale-neg` | Create sale with negative `quantity: -5` or `totalAmount: -1000` | `PERMISSION_DENIED` |
| 8 | `/sales/bad$id!@#` | Path Variable ID Poisoning with invalid characters / >128 bytes | `PERMISSION_DENIED` |
| 9 | `/expenses/exp-1` | Update an existing immutable expense amount | `PERMISSION_DENIED` |
| 10 | `/expenses/exp-big` | Denial-of-Wallet oversized 500-char `description` string | `PERMISSION_DENIED` |
| 11 | `/inventory/prod-1` | Update inventory `userId` to transfer ownership to another account | `PERMISSION_DENIED` |
| 12 | `/inventory/prod-unverified` | Write by user with `email_verified: false` | `PERMISSION_DENIED` |
