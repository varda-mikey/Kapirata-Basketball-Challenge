// Kapirata Basketball Challenge - MVP
// Firebase integration points are marked below.
// Current MVP stores attempt metadata locally so UI/camera can be tested immediately.

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

let stream = null;
let recorder = null;
let chunks = [];
let videoBlob = null;
let receiptDataUrl = null;
let activeAttempt = null;
let timerHandle = null;

function showScreen(id){
  screens.forEach(s => s.classList.toggle("active", s.id === id));
  window.scrollTo(0,0);
}

document.querySelectorAll("[data-next]").forEach(btn=>{
  btn.addEventListener("click",()=>showScreen(btn.dataset.next));
});

$("receiptPhoto").addEventListener("change", (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  if(file.size > 8 * 1024 * 1024){
    $("formError").textContent = "Receipt photo is too large. Please use a photo under 8 MB.";
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    receiptDataUrl = reader.result;
    $("receiptPreview").src = receiptDataUrl;
    $("receiptPreview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

$("continueToCamera").addEventListener("click", ()=>{
  const name = $("playerName").value.trim();
  const receipt = $("receiptNumber").value.trim();
  const hasPhoto = $("receiptPhoto").files?.length > 0;
  const consent = $("consent").checked;

  if(!name || !receipt || !hasPhoto || !consent){
    $("formError").textContent = "Name, receipt number, receipt photo, and consent are required.";
    return;
  }

  // MVP duplicate receipt check on this browser.
  const usedReceipts = JSON.parse(localStorage.getItem("kapirata_used_receipts") || "[]");
  if(usedReceipts.includes(receipt.toLowerCase())){
    $("formError").textContent = "This receipt was already used on this device.";
    return;
  }

  $("formError").textContent = "";
  activeAttempt = {
    id: crypto.randomUUID(),
    name,
    receipt,
    startedAt: new Date().toISOString(),
    result: "started"
  };

  // FIREBASE TODO: create attempt and atomically lock receipt number server-side.
  showScreen("screen-camera");
});

$("enableCamera").addEventListener("click", async ()=>{
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"}},
      audio:true
    });
    $("camera").srcObject = stream;
    $("cameraMessage").classList.add("hidden");
    $("enableCamera").classList.add("hidden");
    $("startRecording").classList.remove("hidden");
  }catch(err){
    $("cameraMessage").textContent = "Camera permission was not granted. Please allow camera access in your browser settings.";
  }
});

$("startRecording").addEventListener("click", ()=>{
  if(!stream) return;
  chunks = [];
  videoBlob = null;

  const preferred = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ].find(t => MediaRecorder.isTypeSupported?.(t));

  try{
    recorder = preferred ? new MediaRecorder(stream,{mimeType:preferred}) : new MediaRecorder(stream);
  }catch{
    recorder = new MediaRecorder(stream);
  }

  recorder.ondataavailable = e => { if(e.data?.size) chunks.push(e.data); };
  recorder.onstop = ()=>{
    videoBlob = new Blob(chunks,{type:recorder.mimeType || "video/webm"});
    const url = URL.createObjectURL(videoBlob);
    $("playback").src = url;
    $("cashierPlayback").src = url;
    $("camera").classList.add("hidden");
    $("playback").classList.remove("hidden");
    $("stopRecording").classList.add("hidden");
    clearInterval(timerHandle);
    $("timer").textContent = "00:00";
    setTimeout(()=>showScreen("screen-result"), 700);
  };

  recorder.start(250);
  $("startRecording").classList.add("hidden");
  $("stopRecording").classList.remove("hidden");

  let seconds = 10;
  $("timer").textContent = "00:10";
  clearInterval(timerHandle);
  timerHandle = setInterval(()=>{
    seconds--;
    $("timer").textContent = `00:${String(seconds).padStart(2,"0")}`;
    if(seconds <= 0 && recorder?.state === "recording"){
      recorder.stop();
    }
  },1000);
});

$("stopRecording").addEventListener("click", ()=>{
  if(recorder?.state === "recording") recorder.stop();
});

$("missedShot").addEventListener("click", ()=>{
  if(activeAttempt){
    activeAttempt.result = "missed";
    finalizeReceiptUse();
    saveLocalAttempt(activeAttempt);
  }
  stopCamera();
  showScreen("screen-missed");
});

$("madeShot").addEventListener("click", ()=>{
  if(!videoBlob){
    alert("No video was recorded.");
    return;
  }
  activeAttempt.result = "pending_cashier";
  $("summaryName").textContent = activeAttempt.name;
  $("summaryReceipt").textContent = activeAttempt.receipt;
  stopCamera();
  showScreen("screen-cashier");
});

$("cashierReject").addEventListener("click", ()=>{
  activeAttempt.result = "cashier_rejected";
  finalizeReceiptUse();
  saveLocalAttempt(activeAttempt);
  alert("Attempt marked invalid.");
  resetGame();
});

$("cashierApprove").addEventListener("click", ()=>showScreen("screen-pin"));

$("verifyPin").addEventListener("click", ()=>{
  // IMPORTANT: This is a LOCAL MVP placeholder only.
  // Production PIN MUST be verified by Firebase Cloud Function / secure backend.
  const DEMO_PIN = "0953";
  if($("cashierPin").value !== DEMO_PIN){
    $("pinError").textContent = "Incorrect cashier code.";
    return;
  }

  $("pinError").textContent = "";
  const code = generateVoucherCode();
  activeAttempt.result = "approved";
  activeAttempt.validatedAt = new Date().toISOString();
  activeAttempt.voucherCode = code;
  activeAttempt.voucherStatus = "available";

  // FIREBASE TODO:
  // 1) upload receipt image to Storage
  // 2) upload successful video to Storage
  // 3) create voucher document
  // 4) save cashier validation
  // 5) mark receipt permanently used

  finalizeReceiptUse();
  saveLocalAttempt(activeAttempt);

  $("voucherCode").textContent = code;
  $("voucherStatus").textContent = "AVAILABLE";
  $("voucherStatus").className = "status available";
  showScreen("screen-voucher");
});

$("redeemVoucher").addEventListener("click", ()=>{
  if(!activeAttempt || activeAttempt.voucherStatus === "redeemed") return;
  const ok = confirm("Cashier: redeem this ₱10 voucher now? This cannot be undone.");
  if(!ok) return;
  activeAttempt.voucherStatus = "redeemed";
  activeAttempt.redeemedAt = new Date().toISOString();
  saveLocalAttempt(activeAttempt, true);

  $("voucherStatus").textContent = "REDEEMED";
  $("voucherStatus").className = "status redeemed";
  $("redeemVoucher").disabled = true;
  $("redeemVoucher").textContent = "VOUCHER USED ✓";

  // FIREBASE TODO: redeem in a server-side transaction.
});

$("newGame").addEventListener("click", resetGame);
$("closeMissed").addEventListener("click", resetGame);

function finalizeReceiptUse(){
  if(!activeAttempt?.receipt) return;
  const list = JSON.parse(localStorage.getItem("kapirata_used_receipts") || "[]");
  const key = activeAttempt.receipt.toLowerCase();
  if(!list.includes(key)) list.push(key);
  localStorage.setItem("kapirata_used_receipts", JSON.stringify(list));
}

function saveLocalAttempt(attempt, update=false){
  const rows = JSON.parse(localStorage.getItem("kapirata_attempts") || "[]");
  const idx = rows.findIndex(x => x.id === attempt.id);
  const safe = {...attempt, hasReceiptPhoto:!!receiptDataUrl, hasVideo:!!videoBlob};
  if(idx >= 0) rows[idx] = safe; else rows.push(safe);
  localStorage.setItem("kapirata_attempts", JSON.stringify(rows));
}

function generateVoucherCode(){
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const random = Math.random().toString(36).slice(2,8).toUpperCase();
  return `KPB-${date}-${random}`;
}

function stopCamera(){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
}

function resetGame(){
  stopCamera();
  activeAttempt = null;
  videoBlob = null;
  receiptDataUrl = null;
  chunks = [];
  $("playerName").value = "";
  $("receiptNumber").value = "";
  $("receiptPhoto").value = "";
  $("receiptPreview").src = "";
  $("receiptPreview").classList.add("hidden");
  $("consent").checked = false;
  $("cashierPin").value = "";
  $("camera").classList.remove("hidden");
  $("playback").classList.add("hidden");
  $("enableCamera").classList.remove("hidden");
  $("startRecording").classList.add("hidden");
  $("stopRecording").classList.add("hidden");
  $("timer").textContent = "00:10";
  $("redeemVoucher").disabled = false;
  $("redeemVoucher").textContent = "REDEEM ₱10";
  showScreen("screen-home");
}
