import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =====================================================
   FIREBASE
===================================================== */

const firebaseApp =
  initializeApp(firebaseConfig);

const db =
  getFirestore(firebaseApp);


/* =====================================================
   GOOGLE DRIVE MEDIA BRIDGE
===================================================== */

const MEDIA_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbx5LzmQI9kGWfYAzUDK0v9vzaYbbt6C1dhlw5j2hK92CYyA7s7qzGui7Iq2FLIRYx0h/exec";


/* =====================================================
   APP STATE
===================================================== */

const $ = (id) =>
  document.getElementById(id);

const screens =
  [...document.querySelectorAll(".screen")];

let stream = null;
let recorder = null;
let chunks = [];

let videoBlob = null;

let receiptFile = null;
let receiptPreviewUrl = null;

let activeAttempt = null;

let timerHandle = null;


/* =====================================================
   SCREEN NAVIGATION
===================================================== */

function showScreen(id) {

  screens.forEach((screen) => {

    screen.classList.toggle(
      "active",
      screen.id === id
    );

  });

  window.scrollTo(0, 0);

}


document
  .querySelectorAll("[data-next]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        showScreen(
          button.dataset.next
        );

      }
    );

  });


/* =====================================================
   AUTO ADD SAVED VOUCHER CARD
===================================================== */

function createSavedVoucherCard() {

  if (
    document.getElementById(
      "savedVoucherCard"
    )
  ) {
    return;
  }


  const home =
    document.getElementById(
      "screen-home"
    );


  if (!home) {
    return;
  }


  const playButton =
    home.querySelector(
      '[data-next="screen-form"]'
    );


  const card =
    document.createElement(
      "div"
    );


  card.id =
    "savedVoucherCard";


  card.className =
    "reward-card hidden";


  card.innerHTML = `
    <span>
      🎟️ UY BES!
    </span>

    <strong
      style="
        font-size:28px;
        margin-top:5px;
      "
    >
      MAY ₱10 VOUCHER KA PA!
    </strong>

    <small
      id="savedVoucherInfo"
      style="
        margin-top:8px;
      "
    >
      Checking voucher...
    </small>

    <button
      id="openSavedVoucher"
      class="btn btn-dark"
      style="
        margin-top:14px;
      "
    >
      OPEN MY VOUCHER
    </button>
  `;


  if (playButton) {

    home.insertBefore(
      card,
      playButton
    );

  }

  else {

    home.appendChild(
      card
    );

  }


  $("openSavedVoucher")
    .addEventListener(
      "click",
      openSavedVoucher
    );

}


createSavedVoucherCard();


/* =====================================================
   RECEIPT PHOTO
===================================================== */

$("receiptPhoto")
  .addEventListener(
    "change",
    (event) => {

      const file =
        event.target.files?.[0];


      if (!file) {
        return;
      }


      if (
        file.size >
        8 * 1024 * 1024
      ) {

        $("formError").textContent =
          "Receipt photo is too large. Please use a photo under 8 MB.";

        event.target.value =
          "";

        return;

      }


      receiptFile =
        file;


      if (
        receiptPreviewUrl
      ) {

        URL.revokeObjectURL(
          receiptPreviewUrl
        );

      }


      receiptPreviewUrl =
        URL.createObjectURL(
          file
        );


      $("receiptPreview").src =
        receiptPreviewUrl;


      $("receiptPreview")
        .classList
        .remove(
          "hidden"
        );

    }
  );


/* =====================================================
   START GAME
===================================================== */

$("continueToCamera")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("playerName")
          .value
          .trim();


      const receipt =
        $("receiptNumber")
          .value
          .trim();


      const consent =
        $("consent")
          .checked;


      if (
        !name ||
        !receipt ||
        !receiptFile ||
        !consent
      ) {

        $("formError").textContent =
          "Name, receipt number, receipt photo, and consent are required.";

        return;

      }


      $("continueToCamera")
        .disabled =
        true;


      $("continueToCamera")
        .textContent =
        "CHECKING RECEIPT...";


      $("formError")
        .textContent =
        "";


      try {

        const normalizedReceipt =
          normalizeReceipt(
            receipt
          );


        const receiptRef =
          doc(
            db,
            "receipts",
            normalizedReceipt
          );


        const receiptSnap =
          await getDoc(
            receiptRef
          );


        if (
          receiptSnap.exists()
        ) {

          $("formError")
            .textContent =
            "This receipt was already used.";

          return;

        }


        const attemptId =
          crypto.randomUUID();


        activeAttempt = {

          id:
            attemptId,

          name:
            name,

          receipt:
            receipt,

          normalizedReceipt:
            normalizedReceipt,

          result:
            "uploading_receipt"

        };


        const receiptFileName =
          buildReceiptFileName(
            activeAttempt,
            receiptFile
          );


        activeAttempt
          .receiptFileName =
          receiptFileName;


        await setDoc(

          doc(
            db,
            "attempts",
            attemptId
          ),

          {

            attemptId:
              attemptId,

            name:
              name,

            receiptNumber:
              receipt,

            normalizedReceipt:
              normalizedReceipt,

            receiptFileName:
              receiptFileName,

            result:
              "uploading_receipt",

            createdAt:
              serverTimestamp()

          }

        );


        await setDoc(

          receiptRef,

          {

            receiptNumber:
              receipt,

            normalizedReceipt:
              normalizedReceipt,

            attemptId:
              attemptId,

            name:
              name,

            receiptFileName:
              receiptFileName,

            status:
              "locked",

            lockedAt:
              serverTimestamp()

          }

        );


        $("formError")
          .textContent =
          "Uploading receipt...";


        await uploadToDrive({

          type:
            "receipt",

          file:
            receiptFile,

          fileName:
            receiptFileName

        });


        activeAttempt.result =
          "started";


        await setDoc(

          doc(
            db,
            "attempts",
            attemptId
          ),

          {

            result:
              "started",

            receiptUploadStatus:
              "sent",

            receiptUploadedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        await setDoc(

          receiptRef,

          {

            uploadStatus:
              "sent",

            updatedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        $("formError")
          .textContent =
          "";


        showScreen(
          "screen-camera"
        );

      }

      catch (error) {

        console.error(
          error
        );


        $("formError")
          .textContent =
          "Could not start the game. Please check your connection and try again.";

      }

      finally {

        $("continueToCamera")
          .disabled =
          false;


        $("continueToCamera")
          .textContent =
          "GAME NA BES!";

      }

    }
  );


/* =====================================================
   CAMERA
   LOW-SIZE RECORDING MODE
===================================================== */

$("enableCamera")
  .addEventListener(
    "click",
    async () => {

      try {

        stream =
          await navigator
            .mediaDevices
            .getUserMedia({

              video: {

                facingMode: {
                  ideal:
                    "environment"
                },

                width: {
                  ideal:
                    480
                },

                height: {
                  ideal:
                    270
                },

                frameRate: {
                  ideal:
                    12,

                  max:
                    15
                }

              },

              audio:
                false

            });


        $("camera")
          .srcObject =
          stream;


        $("cameraMessage")
          .classList
          .add(
            "hidden"
          );


        $("enableCamera")
          .classList
          .add(
            "hidden"
          );


        $("startRecording")
          .classList
          .remove(
            "hidden"
          );

      }

      catch (error) {

        console.error(
          error
        );


        $("cameraMessage")
          .textContent =
          "Camera permission was not granted. Please allow camera access in your browser settings.";

      }

    }
  );


/* =====================================================
   RECORD
===================================================== */

$("startRecording")
  .addEventListener(
    "click",
    () => {

      if (!stream) {
        return;
      }


      chunks =
        [];


      videoBlob =
        null;


      const preferredTypes =
        [

          "video/webm;codecs=vp8",

          "video/webm",

          "video/mp4"

        ];


      const preferred =
        preferredTypes.find(
          (type) => {

            try {

              return MediaRecorder
                .isTypeSupported(
                  type
                );

            }

            catch {

              return false;

            }

          }
        );


      const options = {

        videoBitsPerSecond:
          250000

      };


      if (
        preferred
      ) {

        options.mimeType =
          preferred;

      }


      try {

        recorder =
          new MediaRecorder(
            stream,
            options
          );

      }

      catch {

        recorder =
          new MediaRecorder(
            stream
          );

      }


      recorder
        .ondataavailable =
        (event) => {

          if (
            event.data &&
            event.data.size > 0
          ) {

            chunks.push(
              event.data
            );

          }

        };


      recorder
        .onstop =
        () => {

          videoBlob =
            new Blob(
              chunks,
              {

                type:
                  recorder.mimeType ||
                  "video/webm"

              }
            );


          console.log(
            "Video size:",
            (
              videoBlob.size /
              1024
            ).toFixed(1),
            "KB"
          );


          const videoUrl =
            URL.createObjectURL(
              videoBlob
            );


          $("playback")
            .src =
            videoUrl;


          $("cashierPlayback")
            .src =
            videoUrl;


          $("camera")
            .classList
            .add(
              "hidden"
            );


          $("playback")
            .classList
            .remove(
              "hidden"
            );


          $("stopRecording")
            .classList
            .add(
              "hidden"
            );


          clearInterval(
            timerHandle
          );


          $("timer")
            .textContent =
            "00:00";


          setTimeout(
            () => {

              showScreen(
                "screen-result"
              );

            },
            500
          );

        };


      recorder.start(
        500
      );


      $("startRecording")
        .classList
        .add(
          "hidden"
        );


      $("stopRecording")
        .classList
        .remove(
          "hidden"
        );


      let seconds =
        10;


      $("timer")
        .textContent =
        "00:10";


      clearInterval(
        timerHandle
      );


      timerHandle =
        setInterval(
          () => {

            seconds--;


            $("timer")
              .textContent =
              `00:${String(seconds).padStart(2, "0")}`;


            if (
              seconds <= 0 &&
              recorder?.state ===
                "recording"
            ) {

              recorder.stop();

            }

          },
          1000
        );

    }
  );


$("stopRecording")
  .addEventListener(
    "click",
    () => {

      if (
        recorder?.state ===
        "recording"
      ) {

        recorder.stop();

      }

    }
  );


/* =====================================================
   MISSED
===================================================== */

$("missedShot")
  .addEventListener(
    "click",
    async () => {

      if (
        activeAttempt
      ) {

        activeAttempt.result =
          "missed";


        await updateAttemptResult(
          "missed"
        );

      }


      stopCamera();


      showScreen(
        "screen-missed"
      );

    }
  );


/* =====================================================
   STUDENT MADE SHOT
===================================================== */

$("madeShot")
  .addEventListener(
    "click",
    async () => {

      if (
        !videoBlob
      ) {

        alert(
          "No video was recorded."
        );

        return;

      }


      activeAttempt.result =
        "pending_cashier";


      await updateAttemptResult(
        "pending_cashier"
      );


      $("summaryName")
        .textContent =
        activeAttempt.name;


      $("summaryReceipt")
        .textContent =
        activeAttempt.receipt;


      stopCamera();


      showScreen(
        "screen-cashier"
      );

    }
  );


/* =====================================================
   CASHIER REJECT
===================================================== */

$("cashierReject")
  .addEventListener(
    "click",
    async () => {

      activeAttempt.result =
        "cashier_rejected";


      await updateAttemptResult(
        "cashier_rejected"
      );


      alert(
        "Attempt marked invalid."
      );


      resetGame();

    }
  );


/* =====================================================
   CASHIER APPROVE
===================================================== */

$("cashierApprove")
  .addEventListener(
    "click",
    () => {

      showScreen(
        "screen-pin"
      );

    }
  );


/* =====================================================
   CASHIER PIN
   SAVE SUCCESS VIDEO
   CREATE 7-DAY VOUCHER
===================================================== */

$("verifyPin")
  .addEventListener(
    "click",
    async () => {

      const DEMO_PIN =
        "0953";


      if (
        $("cashierPin").value !==
        DEMO_PIN
      ) {

        $("pinError")
          .textContent =
          "Incorrect cashier code.";

        return;

      }


      if (
        !videoBlob
      ) {

        $("pinError")
          .textContent =
          "Successful video is missing.";

        return;

      }


      $("pinError")
        .textContent =
        "";


      $("verifyPin")
        .disabled =
        true;


      const sizeKB =
        Math.round(
          videoBlob.size /
          1024
        );


      $("verifyPin")
        .textContent =
        `SAVING VIDEO (${sizeKB} KB)...`;


      try {

        const videoFileName =
          buildVideoFileName(
            activeAttempt,
            videoBlob
          );


        activeAttempt
          .videoFileName =
          videoFileName;


        await uploadToDrive({

          type:
            "video",

          file:
            videoBlob,

          fileName:
            videoFileName

        });


        $("verifyPin")
          .textContent =
          "CREATING VOUCHER...";


        const voucherCode =
          generateVoucherCode();


        const issuedDate =
          new Date();


        const expiryDate =
          new Date(
            issuedDate
          );


        expiryDate.setDate(
          expiryDate.getDate() +
          7
        );


        activeAttempt.result =
          "approved";


        activeAttempt.voucherCode =
          voucherCode;


        activeAttempt.voucherStatus =
          "available";


        activeAttempt.expiresAt =
          expiryDate;


        await setDoc(

          doc(
            db,
            "attempts",
            activeAttempt.id
          ),

          {

            result:
              "approved",

            successfulVideoFileName:
              videoFileName,

            successfulVideoSizeKB:
              sizeKB,

            videoUploadStatus:
              "sent",

            videoUploadedAt:
              serverTimestamp(),

            voucherCode:
              voucherCode,

            voucherStatus:
              "available",

            validatedAt:
              serverTimestamp(),

            expiresAt:
              Timestamp.fromDate(
                expiryDate
              )

          },

          {
            merge:
              true
          }

        );


        await setDoc(

          doc(
            db,
            "vouchers",
            voucherCode
          ),

          {

            voucherCode:
              voucherCode,

            attemptId:
              activeAttempt.id,

            name:
              activeAttempt.name,

            receiptNumber:
              activeAttempt.receipt,

            normalizedReceipt:
              activeAttempt.normalizedReceipt,

            amount:
              10,

            status:
              "available",

            issuedAt:
              serverTimestamp(),

            expiresAt:
              Timestamp.fromDate(
                expiryDate
              )

          }

        );


        await setDoc(

          doc(
            db,
            "receipts",
            activeAttempt
              .normalizedReceipt
          ),

          {

            status:
              "used",

            result:
              "approved",

            voucherCode:
              voucherCode,

            updatedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        activeAttempt
          .voucherStatus =
          "available";


        displayVoucher({

          voucherCode:
            voucherCode,

          status:
            "available",

          expiresAt:
            Timestamp.fromDate(
              expiryDate
            )

        });


        rememberVoucher(
          voucherCode
        );


        await checkSavedVoucher();


        showScreen(
          "screen-voucher"
        );

      }

      catch (error) {

        console.error(
          error
        );


        $("pinError")
          .textContent =
          "Could not save successful video or create voucher. Please try again.";

      }

      finally {

        $("verifyPin")
          .disabled =
          false;


        $("verifyPin")
          .textContent =
          "CONFIRM";

      }

    }
  );


/* =====================================================
   MY VOUCHER — NAME + RECEIPT
===================================================== */

$("findVoucher")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("voucherLookupName")
          .value
          .trim();


      const receipt =
        $("voucherLookupReceipt")
          .value
          .trim();


      if (
        !name ||
        !receipt
      ) {

        $("voucherLookupError")
          .textContent =
          "Please enter your name and receipt number.";

        return;

      }


      $("findVoucher")
        .disabled =
        true;


      $("findVoucher")
        .textContent =
        "SEARCHING...";


      $("voucherLookupError")
        .textContent =
        "";


      try {

        const normalizedReceipt =
          normalizeReceipt(
            receipt
          );


        const receiptRef =
          doc(
            db,
            "receipts",
            normalizedReceipt
          );


        const receiptSnap =
          await getDoc(
            receiptRef
          );


        if (
          !receiptSnap.exists()
        ) {

          $("voucherLookupError")
            .textContent =
            "Walang voucher na nakita bes. Check your receipt number.";

          return;

        }


        const receiptData =
          receiptSnap.data();


        if (
          !receiptData.voucherCode
        ) {

          $("voucherLookupError")
            .textContent =
            "This receipt has no winning voucher.";

          return;

        }


        const voucherRef =
          doc(
            db,
            "vouchers",
            receiptData.voucherCode
          );


        const voucherSnap =
          await getDoc(
            voucherRef
          );


        if (
          !voucherSnap.exists()
        ) {

          $("voucherLookupError")
            .textContent =
            "Voucher record not found.";

          return;

        }


        let voucher =
          voucherSnap.data();


        if (
          String(
            voucher.name ||
            ""
          )
            .trim()
            .toLowerCase()
          !==
          name
            .trim()
            .toLowerCase()
        ) {

          $("voucherLookupError")
            .textContent =
            "Name does not match this receipt.";

          return;

        }


        await refreshExpiredStatus(
          voucherRef,
          voucher
        );


        const refreshed =
          await getDoc(
            voucherRef
          );


        voucher =
          refreshed.data();


        activeAttempt = {

          id:
            voucher.attemptId,

          name:
            voucher.name,

          receipt:
            voucher.receiptNumber,

          normalizedReceipt:
            voucher.normalizedReceipt,

          voucherCode:
            voucher.voucherCode,

          voucherStatus:
            voucher.status,

          expiresAt:
            voucher.expiresAt

        };


        displayVoucher(
          voucher
        );


        if (
          voucher.status ===
          "available"
        ) {

          rememberVoucher(
            voucher.voucherCode
          );

        }

        else {

          clearSavedVoucher();

        }


        await checkSavedVoucher();


        showScreen(
          "screen-voucher"
        );

      }

      catch (error) {

        console.error(
          error
        );


        $("voucherLookupError")
          .textContent =
          "Could not retrieve your voucher. Please try again.";

      }

      finally {

        $("findVoucher")
          .disabled =
          false;


        $("findVoucher")
          .textContent =
          "FIND MY VOUCHER";

      }

    }
  );


/* =====================================================
   SAME-PHONE SAVED VOUCHER
===================================================== */

async function checkSavedVoucher() {

  const card =
    $("savedVoucherCard");


  if (!card) {
    return;
  }


  const savedCode =
    localStorage.getItem(
      "kapirata_last_voucher"
    );


  if (
    !savedCode
  ) {

    card.classList
      .add(
        "hidden"
      );

    return;

  }


  try {

    const voucherRef =
      doc(
        db,
        "vouchers",
        savedCode
      );


    const voucherSnap =
      await getDoc(
        voucherRef
      );


    if (
      !voucherSnap.exists()
    ) {

      clearSavedVoucher();

      return;

    }


    let voucher =
      voucherSnap.data();


    await refreshExpiredStatus(
      voucherRef,
      voucher
    );


    const refreshed =
      await getDoc(
        voucherRef
      );


    voucher =
      refreshed.data();


    if (
      voucher.status !==
      "available"
    ) {

      clearSavedVoucher();

      return;

    }


    const expiry =
      timestampToDate(
        voucher.expiresAt
      );


    $("savedVoucherInfo")
      .textContent =
      expiry
        ? `₱10 OFF • Valid until ${formatDate(expiry)}`
        : "₱10 OFF • Available";


    card
      .classList
      .remove(
        "hidden"
      );

  }

  catch (error) {

    console.error(
      "Saved voucher check failed:",
      error
    );

  }

}


async function openSavedVoucher() {

  const code =
    localStorage.getItem(
      "kapirata_last_voucher"
    );


  if (!code) {
    return;
  }


  try {

    const voucherRef =
      doc(
        db,
        "vouchers",
        code
      );


    const voucherSnap =
      await getDoc(
        voucherRef
      );


    if (
      !voucherSnap.exists()
    ) {

      clearSavedVoucher();

      return;

    }


    let voucher =
      voucherSnap.data();


    await refreshExpiredStatus(
      voucherRef,
      voucher
    );


    const refreshed =
      await getDoc(
        voucherRef
      );


    voucher =
      refreshed.data();


    activeAttempt = {

      id:
        voucher.attemptId,

      name:
        voucher.name,

      receipt:
        voucher.receiptNumber,

      normalizedReceipt:
        voucher.normalizedReceipt,

      voucherCode:
        voucher.voucherCode,

      voucherStatus:
        voucher.status,

      expiresAt:
        voucher.expiresAt

    };


    if (
      voucher.status !==
      "available"
    ) {

      clearSavedVoucher();

    }


    displayVoucher(
      voucher
    );


    showScreen(
      "screen-voucher"
    );

  }

  catch (error) {

    console.error(
      error
    );

  }

}


/* =====================================================
   REDEEM VOUCHER
===================================================== */

$("redeemVoucher")
  .addEventListener(
    "click",
    async () => {

      if (
        !activeAttempt ||
        activeAttempt.voucherStatus ===
          "redeemed" ||
        activeAttempt.voucherStatus ===
          "expired"
      ) {

        return;

      }


      const voucherRef =
        doc(
          db,
          "vouchers",
          activeAttempt.voucherCode
        );


      try {

        const voucherSnap =
          await getDoc(
            voucherRef
          );


        if (
          !voucherSnap.exists()
        ) {

          alert(
            "Voucher not found."
          );

          return;

        }


        let voucher =
          voucherSnap.data();


        await refreshExpiredStatus(
          voucherRef,
          voucher
        );


        const freshSnap =
          await getDoc(
            voucherRef
          );


        voucher =
          freshSnap.data();


        if (
          voucher.status ===
          "expired"
        ) {

          activeAttempt.voucherStatus =
            "expired";


          clearSavedVoucher();


          displayVoucher(
            voucher
          );

          return;

        }


        if (
          voucher.status ===
          "redeemed"
        ) {

          activeAttempt.voucherStatus =
            "redeemed";


          clearSavedVoucher();


          displayVoucher(
            voucher
          );

          return;

        }


        const confirmRedeem =
          confirm(
            "Cashier: redeem this ₱10 voucher now? This cannot be undone."
          );


        if (
          !confirmRedeem
        ) {

          return;

        }


        await setDoc(

          voucherRef,

          {

            status:
              "redeemed",

            redeemedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        if (
          activeAttempt.id
        ) {

          await setDoc(

            doc(
              db,
              "attempts",
              activeAttempt.id
            ),

            {

              voucherStatus:
                "redeemed",

              redeemedAt:
                serverTimestamp()

            },

            {
              merge:
                true
            }

          );

        }


        activeAttempt.voucherStatus =
          "redeemed";


        clearSavedVoucher();


        displayVoucher({

          ...voucher,

          status:
            "redeemed"

        });


        await checkSavedVoucher();

      }

      catch (error) {

        console.error(
          error
        );


        alert(
          "Could not redeem voucher. Please try again."
        );

      }

    }
  );


/* =====================================================
   GOOGLE DRIVE UPLOAD
===================================================== */

async function uploadToDrive({
  type,
  file,
  fileName
}) {

  const base64 =
    await blobToBase64(
      file
    );


  const payload = {

    type:
      type,

    fileName:
      fileName,

    mimeType:
      file.type ||
      "application/octet-stream",

    base64:
      base64

  };


  await fetch(
    MEDIA_BRIDGE_URL,
    {

      method:
        "POST",

      mode:
        "no-cors",

      headers: {

        "Content-Type":
          "text/plain;charset=utf-8"

      },

      body:
        JSON.stringify(
          payload
        )

    }
  );


  return true;

}


/* =====================================================
   FILE TO BASE64
===================================================== */

function blobToBase64(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onloadend =
        () => {

          const result =
            String(
              reader.result
            );


          const base64 =
            result.includes(",")

              ? result.split(",")[1]

              : result;


          resolve(
            base64
          );

        };


      reader.onerror =
        reject;


      reader.readAsDataURL(
        blob
      );

    }
  );

}


/* =====================================================
   FILE NAMES
===================================================== */

function buildReceiptFileName(
  attempt,
  file
) {

  const extension =
    getFileExtension(
      file?.name
    ) ||

    mimeExtension(
      file?.type
    ) ||

    "jpg";


  return (

    "RECEIPT_" +

    safeFilePart(
      attempt.receipt
    ) +

    "_" +

    safeFilePart(
      attempt.name
    ) +

    "_" +

    safeFilePart(
      attempt.id
    ) +

    "." +

    extension

  );

}


function buildVideoFileName(
  attempt,
  blob
) {

  const extension =
    mimeExtension(
      blob.type
    ) ||
    "webm";


  return (

    "SUCCESS_" +

    safeFilePart(
      attempt.receipt
    ) +

    "_" +

    safeFilePart(
      attempt.name
    ) +

    "_" +

    safeFilePart(
      attempt.id
    ) +

    "." +

    extension

  );

}


/* =====================================================
   ATTEMPT STATUS
===================================================== */

async function updateAttemptResult(
  result
) {

  if (
    !activeAttempt
  ) {

    return;

  }


  try {

    await setDoc(

      doc(
        db,
        "attempts",
        activeAttempt.id
      ),

      {

        result:
          result,

        updatedAt:
          serverTimestamp()

      },

      {
        merge:
          true
      }

    );


    await setDoc(

      doc(
        db,
        "receipts",
        activeAttempt.normalizedReceipt
      ),

      {

        status:
          "used",

        result:
          result,

        updatedAt:
          serverTimestamp()

      },

      {
        merge:
          true
      }

    );

  }

  catch (error) {

    console.error(
      "Failed to update attempt:",
      error
    );

  }

}


/* =====================================================
   7-DAY EXPIRY
===================================================== */

async function refreshExpiredStatus(
  voucherRef,
  voucher
) {

  if (
    !voucher ||
    voucher.status !==
      "available"
  ) {

    return;

  }


  const expiry =
    timestampToDate(
      voucher.expiresAt
    );


  if (
    expiry &&
    new Date() > expiry
  ) {

    await setDoc(

      voucherRef,

      {

        status:
          "expired",

        expiredAt:
          serverTimestamp()

      },

      {
        merge:
          true
      }

    );


    if (
      voucher.voucherCode ===
      localStorage.getItem(
        "kapirata_last_voucher"
      )
    ) {

      clearSavedVoucher();

    }

  }

}


/* =====================================================
   DISPLAY VOUCHER
===================================================== */

function displayVoucher(
  voucher
) {

  $("voucherCode")
    .textContent =
    voucher.voucherCode ||
    "—";


  const expiry =
    timestampToDate(
      voucher.expiresAt
    );


  if (
    expiry
  ) {

    $("voucherExpiry")
      .textContent =
      `Valid until ${formatDate(expiry)} • 7 days only`;

  }

  else {

    $("voucherExpiry")
      .textContent =
      "Valid for 7 days only.";

  }


  if (
    voucher.status ===
    "redeemed"
  ) {

    $("voucherStatus")
      .textContent =
      "REDEEMED";


    $("voucherStatus")
      .className =
      "status redeemed";


    $("redeemVoucher")
      .disabled =
      true;


    $("redeemVoucher")
      .textContent =
      "USED NA BES ✓";


    return;

  }


  if (
    voucher.status ===
    "expired"
  ) {

    $("voucherStatus")
      .textContent =
      "EXPIRED";


    $("voucherStatus")
      .className =
      "status redeemed";


    $("redeemVoucher")
      .disabled =
      true;


    $("redeemVoucher")
      .textContent =
      "EXPIRED NA BES 😭";


    return;

  }


  $("voucherStatus")
    .textContent =
    "AVAILABLE";


  $("voucherStatus")
    .className =
    "status available";


  $("redeemVoucher")
    .disabled =
    false;


  $("redeemVoucher")
    .textContent =
    "REDEEM ₱10";

}


/* =====================================================
   SAVED VOUCHER
===================================================== */

function rememberVoucher(
  code
) {

  if (
    !code
  ) {

    return;

  }


  localStorage.setItem(
    "kapirata_last_voucher",
    code
  );

}


function clearSavedVoucher() {

  localStorage.removeItem(
    "kapirata_last_voucher"
  );


  const card =
    $("savedVoucherCard");


  if (
    card
  ) {

    card
      .classList
      .add(
        "hidden"
      );

  }

}


/* =====================================================
   HELPERS
===================================================== */

function timestampToDate(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  if (
    typeof value.toDate ===
    "function"
  ) {

    return value.toDate();

  }


  if (
    value.seconds
  ) {

    return new Date(
      value.seconds *
      1000
    );

  }


  return new Date(
    value
  );

}


function formatDate(
  date
) {

  return date
    .toLocaleDateString(
      "en-PH",
      {

        year:
          "numeric",

        month:
          "short",

        day:
          "numeric"

      }
    );

}


function normalizeReceipt(
  value
) {

  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      "_"
    );

}


function generateVoucherCode() {

  const date =
    new Date();


  const dateCode =

    `${String(date.getFullYear()).slice(-2)}` +

    `${String(date.getMonth() + 1).padStart(2, "0")}` +

    `${String(date.getDate()).padStart(2, "0")}`;


  const random =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();


  return `KPB-${dateCode}-${random}`;

}


function safeFilePart(
  value
) {

  return String(
    value ||
    "unknown"
  )

    .trim()

    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )

    .slice(
      0,
      70
    );

}


function getFileExtension(
  name
) {

  if (
    !name ||
    !name.includes(".")
  ) {

    return "";

  }


  return name
    .split(".")
    .pop()
    .toLowerCase();

}


function mimeExtension(
  mime
) {

  const value =
    String(
      mime ||
      ""
    ).toLowerCase();


  if (
    value.includes(
      "mp4"
    )
  ) {

    return "mp4";

  }


  if (
    value.includes(
      "webm"
    )
  ) {

    return "webm";

  }


  if (
    value.includes(
      "jpeg"
    )
  ) {

    return "jpg";

  }


  if (
    value.includes(
      "png"
    )
  ) {

    return "png";

  }


  if (
    value.includes(
      "heic"
    )
  ) {

    return "heic";

  }


  return "";

}


/* =====================================================
   CAMERA CLEANUP
===================================================== */

function stopCamera() {

  if (
    !stream
  ) {

    return;

  }


  stream
    .getTracks()
    .forEach(
      (track) =>
        track.stop()
    );


  stream =
    null;

}


/* =====================================================
   RESET
===================================================== */

$("newGame")
  .addEventListener(
    "click",
    resetGame
  );


$("closeMissed")
  .addEventListener(
    "click",
    resetGame
  );


function resetGame() {

  stopCamera();


  activeAttempt =
    null;


  videoBlob =
    null;


  receiptFile =
    null;


  chunks =
    [];


  if (
    receiptPreviewUrl
  ) {

    URL.revokeObjectURL(
      receiptPreviewUrl
    );


    receiptPreviewUrl =
      null;

  }


  $("playerName")
    .value =
    "";


  $("receiptNumber")
    .value =
    "";


  $("receiptPhoto")
    .value =
    "";


  $("receiptPreview")
    .src =
    "";


  $("receiptPreview")
    .classList
    .add(
      "hidden"
    );


  $("consent")
    .checked =
    false;


  $("cashierPin")
    .value =
    "";


  $("voucherLookupName")
    .value =
    "";


  $("voucherLookupReceipt")
    .value =
    "";


  $("voucherLookupError")
    .textContent =
    "";


  $("formError")
    .textContent =
    "";


  $("camera")
    .classList
    .remove(
      "hidden"
    );


  $("playback")
    .classList
    .add(
      "hidden"
    );


  $("enableCamera")
    .classList
    .remove(
      "hidden"
    );


  $("startRecording")
    .classList
    .add(
      "hidden"
    );


  $("stopRecording")
    .classList
    .add(
      "hidden"
    );


  $("timer")
    .textContent =
    "00:10";


  $("redeemVoucher")
    .disabled =
    false;


  $("redeemVoucher")
    .textContent =
    "REDEEM ₱10";


  showScreen(
    "screen-home"
  );


  checkSavedVoucher();

}


/* =====================================================
   INITIAL CHECK
===================================================== */

checkSavedVoucher();
