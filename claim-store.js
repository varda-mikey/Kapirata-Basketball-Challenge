// Recheck availability at commit time so simultaneous claims cannot both win.
export async function commitClaim({db, runTransaction, doc, voucherRef, redeemedAt, serverTimestamp, isExpired}) {
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(voucherRef);
    if (!snapshot.exists()) throw new Error('Voucher not found.');
    const voucher = snapshot.data();
    if (voucher.status !== 'available') throw new Error('This voucher is no longer available. Open your voucher again to check its status.');
    if (isExpired(voucher.expiresAt)) throw new Error('This voucher has expired.');
    transaction.set(voucherRef, {
      status: 'redeemed', claimProofRequired: false, redeemedAt, updatedAt: serverTimestamp()
    }, {merge:true});
    if (voucher.attemptId) transaction.set(doc(db, 'attempts', voucher.attemptId), {
      voucherStatus:'redeemed', claimProofRequired:false, redeemedAt, updatedAt:serverTimestamp()
    }, {merge:true});
    if (voucher.normalizedReceipt) transaction.set(doc(db, 'receipts', voucher.normalizedReceipt), {
      status:'redeemed', voucherCode:voucherRef.id, redeemedAt, updatedAt:serverTimestamp()
    }, {merge:true});
    return voucher;
  });
}
