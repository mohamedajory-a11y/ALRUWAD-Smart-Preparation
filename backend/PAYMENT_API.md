# Bank-transfer subscription flow — implementation contract

**Status:** Schema committed, not deployed. No payments are accepted by the current APK. Do not display a real bank account until the merchant account and recipient are verified.

## POST /api/payment-requests
Authorization: Bearer user access token (validated server-side).
Body: `{"plan_id":"basic","payer_note":"optional","transfer_reference":"optional"}`
Backend:
1. Read active plan from database; derive price on server, never accept client-supplied amount.
2. Apply rate limit and create request with `user_id` from verified token and `status=pending`.
3. Return `id,reference,amount_lyd,status` and **verified merchant payment instructions** configured server-side.
4. No subscription is activated here. Receipts are untrusted claims.

## GET /api/payment-requests
Return only the caller's requests, using verified identity and ownership checks.

## POST /api/admin/payment-requests/:id/approve
Requires separate verified admin authorization and MFA. Admin must independently confirm incoming transfer in merchant bank statement, exact amount and recipient. Do not trust receipt screenshot.
Single DB transaction: lock pending request, verify exact plan amount, change status to approved, insert subscription, append audit event. Reject duplicates/idempotently report already approved. Client cannot call privileged database directly.

## POST /api/admin/payment-requests/:id/reject
Requires admin authorization, reason, atomic pending→rejected transition and audit.

## Security and operations
- Service keys only in backend secrets, never in Android assets or GitHub.
- Set request rate limits and audit access to bank payment metadata.
- Never reuse a personal salary account as a merchant account without bank approval; use a verified receiving account owned by the selling entity.
- Confirm applicable consumer protection, tax, privacy, and Google Play billing policies before selling in-app digital subscriptions.
- Plan prices are proposed only (basic 30 LYD / 30 generations, pro 50 LYD / 100 generations monthly) and require approval.
- Implement server-enforced generation quotas separately; a database subscription alone is not an AI gateway.

## Acceptance tests before launch
1. Unauthenticated request rejected.
2. User A cannot see user B payment requests.
3. User cannot approve their own payment or modify amount/status.
4. Invalid or inactive plan rejected.
5. Duplicate approval does not extend subscription twice.
6. Concurrent approvals yield one subscription and one audit entry.
7. Incorrect bank amount is rejected.
8. Admin rejection does not activate subscription.
9. Expired subscriptions cannot generate new lessons.
10. Refund/reversal policy and audit are handled explicitly.
