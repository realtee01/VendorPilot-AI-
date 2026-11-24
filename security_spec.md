# VendorPilot AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants (All 6 Collections)
1. **Default-Deny Safety Net**: Every path outside `/users`, `/businesses`, `/sales`, `/expenses`, `/products`, and `/customers` is denied for all reads and writes.
2. **Unauthenticated Block**: Unauthenticated requests (`request.auth == null`) cannot read or write any document across any collection.
3. **Verified Email Gate**: All writes (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
4. **Strict Multi-Tenant Ownership**:
   - `/users/{userId}` and `/businesses/{businessId}` allow `get`, `create`, `update` only when `request.auth.uid == pathId` and `data.userId == request.auth.uid`. `list` and `delete` are explicitly denied.
   - `/sales/{saleId}`, `/expenses/{expenseId}`, `/products/{productId}`, and `/customers/{customerId}` enforce `resource.data.userId == request.auth.uid` on `get`, `list`, `update`, and `delete`, and `incoming().userId == request.auth.uid` on `create`.
5. **Anti-Update-Gap & Immutable Keys**:
   - Every `create` and `update` calls its standalone `isValid[Entity](incoming())` helper enforcing `hasAll` + `hasOnly` (blocking shadow/ghost fields), types, numeric bounds, enums, regex ID guards (`^[a-zA-Z0-9_-]+$`), and string `.size()` limits.
   - Every `update` locks immutable keys (`userId`, `businessId`, entity ID, `createdAt`), requires `incoming().updatedAt == request.time`, and restricts mutable fields via `affectedKeys().hasOnly(...)`.
6. **Financial Consistency & Stock Deduction Safety**:
   - Sales enforce strict paymentStatus/amountPaid invariants (`Paid` -> `amountPaid == totalAmount`, `Pending` -> `0`, `Partial` -> `0 < amountPaid < totalAmount`) and `stockDeductedQty >= 0 && stockDeductedQty <= quantity`.
   - Products enforce `sellingPrice > 0`, `costPrice >= 0`, `quantity >= 0`, `lowStockThreshold >= 0`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read** (`GET /businesses/uid_a` with `auth: null`) -> DENIED.
2. **PII Cross-Tenant Read** (`GET /users/uid_victim` as `uid_attacker`) -> DENIED.
3. **Users/Businesses Collection Scraping** (`LIST /users` or `LIST /businesses` as signed-in user) -> DENIED (`allow list: if false`).
4. **Shadow Field Injection** (`CREATE /businesses/uid_a` with ghost key `isAdmin: true`) -> DENIED (`hasOnly`).
5. **Client Timestamp Forgery** (`CREATE /sales/sale_1` with backdated `createdAt != request.time`) -> DENIED.
6. **Cross-Tenant Identity Spoofing** (`CREATE /sales/sale_1` with `userId: "uid_victim"` while authenticated as `uid_attacker`) -> DENIED.
7. **Payment Invariant Bypass** (`CREATE /sales/sale_1` with `paymentStatus: "Paid"` and `amountPaid: 0`) -> DENIED.
8. **Duplicate/Negative Stock Deduction Tampering** (`UPDATE /sales/sale_1` setting `stockDeductedQty: -5`) -> DENIED.
9. **Path Variable ID Poisoning** (`CREATE /products/../../admin$bad` with invalid regex/oversized ID) -> DENIED (`isValidId`).
10. **Ownership Hijacking on Update** (`UPDATE /expenses/exp_1` changing `userId` to another UID) -> DENIED (`incoming().userId == existing().userId`).
11. **Value Poisoning / Oversized Payload** (`CREATE /customers/cust_1` with `name` > 140 chars or `totalSpent: -100`) -> DENIED.
12. **Unverified Email Write** (`CREATE /products/prod_1` with `email_verified: false`) -> DENIED (`isVerifiedUser()`).
