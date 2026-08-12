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


const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);


// GOOGLE APPS SCRIPT BRIDGE
const MEDIA_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbx5LzmQI9kGWfYAzUDK0v9vzaYbbt6C1dhlw5j2hK92CYyA7s7qzGui7Iq2FLIRYx0h/exec";


const $ = (id) => document.getElementById(id);

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

        event.target.value = "";

        return;

      }


      receiptFile = file;


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
        .remove("hidden");

    }
  );



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


      const hasPhoto =
        !!receiptFile;


      const consent =
        $("consent")
          .checked;


      if (
        !name ||
        !receipt ||
        !hasPhoto ||
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

          $("formError").textContent =
            "This receipt was already used.";

          return;

        }


        activeAttempt = {

          id:
            crypto.randomUUID(),

          name:
            name,

          receipt:
            receipt,

          normalizedReceipt:
            normalizedReceipt,

          result:
            "started"

        };


        await setDoc(

          doc(
            db,
            "attempts",
            activeAttempt.id
          ),

          {

            attemptId:
              activeAttempt.id,

            name:
              name,

            receiptNumber:
              receipt,

            normalizedReceipt:
              normalizedReceipt,

            result:
              "started",

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
              activeAttempt.id,

            name:
              name,

            status:
              "locked",

            lockedAt:
              serverTimestamp()

          }

        );


        $("formError")
          .textContent =
          "Uploading receipt...";


        const receiptUpload =
          await uploadToDrive({

            type:
              "receipt",

            file:
              receiptFile,

            fileName:
              buildReceiptFileName(
                activeAttempt
              )

          });


        if (
          !receiptUpload.ok
        ) {

          throw new Error(
            receiptUpload.error ||
            "Receipt upload failed."
          );

        }


        activeAttempt.receiptFileId =
          receiptUpload.fileId;


        activeAttempt.receiptViewUrl =
          receiptUpload.viewUrl;


        activeAttempt.receiptDirectUrl =
          receiptUpload.directUrl;


        await setDoc(

          doc(
            db,
            "attempts",
            activeAttempt.id
          ),

          {

            receiptFileId:
              receiptUpload.fileId,

            receiptViewUrl:
              receiptUpload.viewUrl,

            receiptDirectUrl:
              receiptUpload.directUrl,

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

            receiptFileId:
              receiptUpload.fileId,

            receiptViewUrl:
              receiptUpload.viewUrl,

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
          "Could not save the receipt or connect to the database. Please try again.";

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
                }

              },

              audio:
                true

            });


        $("camera")
          .srcObject =
          stream;


        $("cameraMessage")
          .classList
          .add("hidden");


        $("enableCamera")
          .classList
          .add("hidden");


        $("startRecording")
          .classList
          .remove("hidden");

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



$("startRecording")
  .addEventListener(
    "click",
    () => {

      if (!stream) {
        return;
      }


      chunks = [];

      videoBlob =
        null;


      const preferred =
        [

          "video/webm;codecs=vp9,opus",

          "video/webm;codecs=vp8,opus",

          "video/webm",

          "video/mp4"

        ].find(
          (type) =>
            MediaRecorder
              .isTypeSupported?.(
                type
              )
        );


      try {

        recorder =
          preferred

            ? new MediaRecorder(
                stream,
                {
                  mimeType:
                    preferred
                }
              )

            : new MediaRecorder(
                stream
              );

      }

      catch {

        recorder =
          new MediaRecorder(
            stream
          );

      }


      recorder.ondataavailable =
        (event) => {

          if (
            event.data?.size
          ) {

            chunks.push(
              event.data
            );

          }

        };


      recorder.onstop =
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


          const url =
            URL.createObjectURL(
              videoBlob
            );


          $("playback").src =
            url;


          $("cashierPlayback").src =
            url;


          $("camera")
            .classList
            .add("hidden");


          $("playback")
            .classList
            .remove("hidden");


          $("stopRecording")
            .classList
            .add("hidden");


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
            700
          );

        };


      recorder.start(
        250
      );


      $("startRecording")
        .classList
        .add("hidden");


      $("stopRecording")
        .classList
        .remove("hidden");


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



$("cashierApprove")
  .addEventListener(
    "click",
    () => {

      showScreen(
        "screen-pin"
      );

    }
  );



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


      $("pinError")
        .textContent =
        "";


      $("verifyPin")
        .disabled =
        true;


      $("verifyPin")
        .textContent =
        "SAVING VIDEO...";


      try {

        if (
          !videoBlob
        ) {

          throw new Error(
            "Successful video is missing."
          );

        }


        const videoUpload =
          await uploadToDrive({

            type:
              "video",

            file:
              videoBlob,

            fileName:
              buildVideoFileName(
                activeAttempt,
                videoBlob
              )

          });


        if (
          !videoUpload.ok
        ) {

          throw new Error(
            videoUpload.error ||
            "Video upload failed."
          );

        }


        activeAttempt.videoFileId =
          videoUpload.fileId;


        activeAttempt.videoViewUrl =
          videoUpload.viewUrl;


        activeAttempt.videoDirectUrl =
          videoUpload.directUrl;


        const code =
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
          code;


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

            videoFileId:
              videoUpload.fileId,

            videoViewUrl:
              videoUpload.viewUrl,

            videoDirectUrl:
              videoUpload.directUrl,

            videoUploadedAt:
              serverTimestamp(),

            voucherCode:
              code,

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
            code
          ),

          {

            voucherCode:
              code,

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
            activeAttempt.normalizedReceipt
          ),

          {

            status:
              "used",

            result:
              "approved",

            voucherCode:
              code,

            updatedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        displayVoucher({

          voucherCode:
            code,

          status:
            "available",

          expiresAt:
            Timestamp.fromDate(
              expiryDate
            )

        });


        rememberVoucher(
          code
        );


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

        const normalized =
          normalizeReceipt(
            receipt
          );


        const receiptRef =
          doc(
            db,
            "receipts",
            normalized
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


        const voucher =
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


        await refreshExpiredStatus(
          voucherRef,
          voucher
        );


        const refreshed =
          await getDoc(
            voucherRef
          );


        const latestVoucher =
          refreshed.data();


        activeAttempt.voucherStatus =
          latestVoucher.status;


        displayVoucher(
          latestVoucher
        );


        rememberVoucher(
          latestVoucher.voucherCode
        );


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


        const voucher =
          voucherSnap.data();


        await refreshExpiredStatus(
          voucherRef,
          voucher
        );


        const freshSnap =
          await getDoc(
            voucherRef
          );


        const fresh =
          freshSnap.data();


        if (
          fresh.status ===
          "expired"
        ) {

          activeAttempt.voucherStatus =
            "expired";


          displayVoucher(
            fresh
          );


          alert(
            "Expired na bes. This voucher can no longer be redeemed."
          );

          return;

        }


        if (
          fresh.status ===
          "redeemed"
        ) {

          activeAttempt.voucherStatus =
            "redeemed";


          displayVoucher(
            fresh
          );


          return;

        }


        const ok =
          confirm(
            "Cashier: redeem this ₱10 voucher now? This cannot be undone."
          );


        if (!ok) {
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


        displayVoucher({

          ...fresh,

          status:
            "redeemed"

        });

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


  const response =
    await fetch(
      MEDIA_BRIDGE_URL,
      {

        method:
          "POST",

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


  const text =
    await response.text();


  let result;


  try {

    result =
      JSON.parse(
        text
      );

  }

  catch {

    throw new Error(
      "Invalid response from media bridge."
    );

  }


  return result;

}



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



function buildReceiptFileName(
  attempt
) {

  const extension =
    getFileExtension(
      receiptFile?.name
    ) ||
    mimeExtension(
      receiptFile?.type
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
    Date.now() +
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
    Date.now() +
    "." +
    extension
  );

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
      50
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
  mimeType
) {

  const mime =
    String(
      mimeType ||
      ""
    ).toLowerCase();


  if (
    mime.includes(
      "mp4"
    )
  ) {

    return "mp4";

  }


  if (
    mime.includes(
      "webm"
    )
  ) {

    return "webm";

  }


  if (
    mime.includes(
      "jpeg"
    )
  ) {

    return "jpg";

  }


  if (
    mime.includes(
      "png"
    )
  ) {

    return "png";

  }


  if (
    mime.includes(
      "heic"
    )
  ) {

    return "heic";

  }


  return "";

}



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

  }

}



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
      `Valid until ${formatDate(expiry)}`;

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



function timestampToDate(
  value
) {

  if (!value) {
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



function rememberVoucher(
  code
) {

  if (
    code
  ) {

    localStorage.setItem(
      "kapirata_last_voucher",
      code
    );

  }

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



function stopCamera() {

  if (
    stream
  ) {

    stream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );


    stream =
      null;

  }

}



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
    .add("hidden");


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


  $("camera")
    .classList
    .remove("hidden");


  $("playback")
    .classList
    .add("hidden");


  $("enableCamera")
    .classList
    .remove("hidden");


  $("startRecording")
    .classList
    .add("hidden");


  $("stopRecording")
    .classList
    .add("hidden");


  $("timer")
    .textContent =
    "00:10";


  $("redeemVoucher")
    .disabled =
    false;


  $("redeemVoucher")
    .textContent =
    "REDEEM ₱10";


  $("formError")
    .textContent =
    "";


  showScreen(
    "screen-home"
  );

}
