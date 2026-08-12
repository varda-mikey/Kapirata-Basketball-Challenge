import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

let stream = null;
let recorder = null;
let chunks = [];
let videoBlob = null;
let receiptDataUrl = null;
let activeAttempt = null;
let timerHandle = null;

function showScreen(id) {
  screens.forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.next));
});

$("receiptPhoto").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    $("formError").textContent =
      "Receipt photo is too large. Please use a photo under 8 MB.";
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

$("continueToCamera").addEventListener("click", async () => {
  const name = $("playerName").value.trim();
  const receipt = $("receiptNumber").value.trim();
  const hasPhoto = $("receiptPhoto").files?.length > 0;
  const consent = $("consent").checked;

  if (!name || !receipt || !hasPhoto || !consent) {
    $("formError").textContent =
      "Name, receipt number, receipt photo, and consent are required.";
    return;
  }

  $("continueToCamera").disabled = true;
  $("continueToCamera").textContent = "CHECKING RECEIPT...";

  try {
    const normalizedReceipt = normalizeReceipt(receipt);

    const receiptRef = doc(db, "receipts", normalizedReceipt);
    const receiptSnap = await getDoc(receiptRef);

    if (receiptSnap.exists()) {
      $("formError").textContent = "This receipt was already used.";
      return;
    }

    activeAttempt = {
      id: crypto.randomUUID(),
      name,
      receipt,
      normalizedReceipt,
      result: "started"
    };

    await setDoc(doc(db, "attempts", activeAttempt.id), {
      attemptId: activeAttempt.id,
      name: name,
      receiptNumber: receipt,
      normalizedReceipt: normalizedReceipt,
      result: "started",
      createdAt: serverTimestamp()
    });

    await setDoc(receiptRef, {
      receiptNumber: receipt,
      normalizedReceipt: normalizedReceipt,
      attemptId: activeAttempt.id,
      status: "locked",
      lockedAt: serverTimestamp()
    });

    $("formError").textContent = "";
    showScreen("screen-camera");
  } catch (err) {
    console.error(err);

    $("formError").textContent =
      "Could not connect to the database. Please try again.";
  } finally {
    $("continueToCamera").disabled = false;
    $("continueToCamera").textContent = "GAME NA BES!";
  }
});

$("enableCamera").addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: true
    });

    $("camera").srcObject = stream;

    $("cameraMessage").classList.add("hidden");
    $("enableCamera").classList.add("hidden");
    $("startRecording").classList.remove("hidden");
  } catch (err) {
    $("cameraMessage").textContent =
      "Camera permission was not granted. Please allow camera access in your browser settings.";
  }
});

$("startRecording").addEventListener("click", () => {
  if (!stream) return;

  chunks = [];
  videoBlob = null;

  const preferred = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ].find((type) => MediaRecorder.isTypeSupported?.(type));

  try {
    recorder = preferred
      ? new MediaRecorder(stream, {
          mimeType: preferred
        })
      : new MediaRecorder(stream);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  recorder.ondataavailable = (e) => {
    if (e.data?.size) {
      chunks.push(e.data);
    }
  };

  recorder.onstop = () => {
    videoBlob = new Blob(chunks, {
      type: recorder.mimeType || "video/webm"
    });

    const url = URL.createObjectURL(videoBlob);

    $("playback").src = url;
    $("cashierPlayback").src = url;

    $("camera").classList.add("hidden");
    $("playback").classList.remove("hidden");
    $("stopRecording").classList.add("hidden");

    clearInterval(timerHandle);

    $("timer").textContent = "00:00";

    setTimeout(() => {
      showScreen("screen-result");
    }, 700);
  };

  recorder.start(250);

  $("startRecording").classList.add("hidden");
  $("stopRecording").classList.remove("hidden");

  let seconds = 10;

  $("timer").textContent = "00:10";

  clearInterval(timerHandle);

  timerHandle = setInterval(() => {
    seconds--;

    $("timer").textContent =
      `00:${String(seconds).padStart(2, "0")}`;

    if (seconds <= 0 && recorder?.state === "recording") {
      recorder.stop();
    }
  }, 1000);
});

$("stopRecording").addEventListener("click", () => {
  if (recorder?.state === "recording") {
    recorder.stop();
  }
});

$("missedShot").addEventListener("click", async () => {
  if (activeAttempt) {
    activeAttempt.result = "missed";
    await updateAttemptResult("missed");
  }

  stopCamera();
  showScreen("screen-missed");
});

$("madeShot").addEventListener("click", async () => {
  if (!videoBlob) {
    alert("No video was recorded.");
    return;
  }

  activeAttempt.result = "pending_cashier";

  await updateAttemptResult("pending_cashier");

  $("summaryName").textContent = activeAttempt.name;
  $("summaryReceipt").textContent = activeAttempt.receipt;

  stopCamera();

  showScreen("screen-cashier");
});

$("cashierReject").addEventListener("click", async () => {
  activeAttempt.result = "cashier_rejected";

  await updateAttemptResult("cashier_rejected");

  alert("Attempt marked invalid.");

  resetGame();
});

$("cashierApprove").addEventListener("click", () => {
  showScreen("screen-pin");
});

$("verifyPin").addEventListener("click", async () => {
  const DEMO_PIN = "0953";

  if ($("cashierPin").value !== DEMO_PIN) {
    $("pinError").textContent = "Incorrect cashier code.";
    return;
  }

  $("pinError").textContent = "";

  $("verifyPin").disabled = true;
  $("verifyPin").textContent = "CREATING VOUCHER...";

  try {
    const code = generateVoucherCode();

    activeAttempt.result = "approved";
    activeAttempt.voucherCode = code;
    activeAttempt.voucherStatus = "available";

    await setDoc(
      doc(db, "attempts", activeAttempt.id),
      {
        result: "approved",
        voucherCode: code,
        voucherStatus: "available",
        validatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    await setDoc(doc(db, "vouchers", code), {
      voucherCode: code,
      attemptId: activeAttempt.id,
      name: activeAttempt.name,
      receiptNumber: activeAttempt.receipt,
      amount: 10,
      status: "available",
      issuedAt: serverTimestamp()
    });

    await setDoc(
      doc(db, "receipts", activeAttempt.normalizedReceipt),
      {
        status: "used",
        result: "approved",
        voucherCode: code,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    $("voucherCode").textContent = code;

    $("voucherStatus").textContent = "AVAILABLE";
    $("voucherStatus").className = "status available";

    showScreen("screen-voucher");
  } catch (err) {
    console.error(err);

    $("pinError").textContent =
      "Could not create voucher. Please try again.";
  } finally {
    $("verifyPin").disabled = false;
    $("verifyPin").textContent = "CONFIRM";
  }
});

$("redeemVoucher").addEventListener("click", async () => {
  if (
    !activeAttempt ||
    activeAttempt.voucherStatus === "redeemed"
  ) {
    return;
  }

  const ok = confirm(
    "Cashier: redeem this ₱10 voucher now? This cannot be undone."
  );

  if (!ok) return;

  try {
    await setDoc(
      doc(db, "vouchers", activeAttempt.voucherCode),
      {
        status: "redeemed",
        redeemedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    await setDoc(
      doc(db, "attempts", activeAttempt.id),
      {
        voucherStatus: "redeemed",
        redeemedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    activeAttempt.voucherStatus = "redeemed";

    $("voucherStatus").textContent = "REDEEMED";
    $("voucherStatus").className = "status redeemed";

    $("redeemVoucher").disabled = true;
    $("redeemVoucher").textContent = "VOUCHER USED ✓";
  } catch (err) {
    console.error(err);

    alert(
      "Could not redeem voucher. Please try again."
    );
  }
});

$("newGame").addEventListener("click", resetGame);

$("closeMissed").addEventListener("click", resetGame);

async function updateAttemptResult(result) {
  if (!activeAttempt) return;

  try {
    await setDoc(
      doc(db, "attempts", activeAttempt.id),
      {
        result: result,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    await setDoc(
      doc(db, "receipts", activeAttempt.normalizedReceipt),
      {
        status: "used",
        result: result,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );
  } catch (err) {
    console.error("Failed to update attempt:", err);
  }
}

function normalizeReceipt(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

function generateVoucherCode() {
  const d = new Date();

  const date =
    `${String(d.getFullYear()).slice(-2)}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;

  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `KPB-${date}-${random}`;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });

    stream = null;
  }
}

function resetGame() {
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
