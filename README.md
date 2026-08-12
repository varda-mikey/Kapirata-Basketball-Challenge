# Kapirata Basketball Challenge

Mobile-first GitHub Pages MVP for Pirates' Cafeteria.

## Student flow
1. Name
2. UTAK receipt number
3. Required receipt photo
4. Camera permission
5. One video recording, maximum 10 seconds
6. Student marks shot as made/missed
7. Successful attempt is shown to cashier
8. Cashier validates
9. Unique ₱10 voucher is created
10. Voucher can be redeemed once

## Admin
Open `admin.html`.

The current MVP uses browser `localStorage` for testing the UI only. That means test data exists only on the device/browser where it was created.

## Production Firebase phase
Connect:
- Firebase Firestore: attempts, receipt locks, vouchers, redemption records
- Firebase Storage: receipt photos + cashier-approved successful videos
- Firebase Authentication: admin/cashier accounts
- Cloud Function or another trusted backend: PIN validation + atomic voucher issuance/redemption

### Important
The temporary cashier code `0953` exists in `app.js` only so the first UI can be tested. Do **not** use this client-side PIN check in production. Move it to a trusted backend before launch.

## Suggested Firestore collections

`attempts/{attemptId}`
- name
- receiptNumber
- receiptPhotoPath
- videoPath
- startedAt
- result
- validatedAt
- validatedBy
- voucherCode

`receipts/{normalizedReceiptNumber}`
- attemptId
- lockedAt
- status

`vouchers/{voucherCode}`
- attemptId
- amount: 10
- status: available | redeemed
- issuedAt
- redeemedAt

## Privacy
Show clear consent before collecting receipt images/video. Keep Storage private and restrict access to authorized staff. Add a retention policy for videos.

## GitHub Pages
Upload all files to a repository, then enable Pages from the repository's main branch/root.

For camera recording to work on phones, access the published HTTPS GitHub Pages URL, not a local file.
