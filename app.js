import {
  firebaseConfig
} from "./firebase-config.js";


import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";



/* =====================================================
   FIREBASE
===================================================== */

const firebaseApp =
  initializeApp(firebaseConfig);

const db =
  getFirestore(firebaseApp);



/* =====================================================
   SETTINGS
===================================================== */

const CASHIER_PIN =
  "0953";


const VOUCHER_AMOUNT =
  10;


const VOUCHER_VALID_DAYS =
  7;


const MEDIA_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbzeNPftGOJi_ykQmBtSZWH1ikDpycgjsXo168QmkRclgEZbmqkFMZ4-oNQwX2qPzsls/exec";



/* =====================================================
   APP STATE
===================================================== */

const $ = (id) =>
  document.getElementById(id);


const screens =
  [
    ...document.querySelectorAll(
      ".screen"
    )
  ];


let cameraStream =
  null;


let mediaRecorder =
  null;


let recordingChunks =
  [];


let localVideoBlob =
  null;


let localVideoUrl =
  null;


let receiptFile =
  null;


let receiptPreviewUrl =
  null;


let claimPhotoFile =
  null;


let claimPhotoPreviewUrl =
  null;


let activeAttempt =
  null;


let activeVoucher =
  null;


let timerHandle =
  null;



/* =====================================================
   SCREEN NAVIGATION
===================================================== */

function showScreen(id) {

  screens.forEach(
    screen => {

      screen.classList.toggle(
        "active",
        screen.id === id
      );

    }
  );


  window.scrollTo(
    0,
    0
  );

}


document
  .querySelectorAll(
    "[data-next]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showScreen(
            button.dataset.next
          );

        }
      );

    }
  );



/* =====================================================
   SAME-PHONE SAVED VOUCHER CARD
===================================================== */

function createSavedVoucherCard() {

  const home =
    $("screen-home");


  if (
    !home ||
    $("savedVoucherCard")
  ) {
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
        line-height:1.05;
      "
    >
      MAY VOUCHER KA PA!
    </strong>

    <small
      id="savedVoucherInfo"
    >
      Checking voucher...
    </small>

    <button
      id="openSavedVoucher"
      class="btn btn-dark"
      style="margin-top:14px;"
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
    event => {

      const file =
        event.target.files?.[0];


      if (!file) {
        return;
      }


      if (
        file.size >
        8 * 1024 * 1024
      ) {

        $("formError")
          .textContent =
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


      $("formError")
        .textContent =
        "";

    }
  );



/* =====================================================
   START ATTEMPT
===================================================== */

$("continueToCamera")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("playerName")
          .value
          .trim();


      const receiptNumber =
        $("receiptNumber")
          .value
          .trim();


      const consent =
        $("consent")
          .checked;


      if (
        !name ||
        !receiptNumber ||
        !receiptFile ||
        !consent
      ) {

        $("formError")
          .textContent =
          "Name, UTAK receipt number, receipt photo, and consent are required.";

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
            receiptNumber
          );


        const receiptRef =
          doc(
            db,
            "receipts",
            normalizedReceipt
          );


        const receiptSnapshot =
          await getDoc(
            receiptRef
          );


        if (
          receiptSnapshot.exists()
        ) {

          $("formError")
            .textContent =
            "This receipt was already used for Kapirata.";

          return;
        }


        const attemptId =
          crypto.randomUUID();


        activeAttempt = {

          id:
            attemptId,

          name:
            name,

          receiptNumber:
            receiptNumber,

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


        const batch =
          writeBatch(
            db
          );


        batch.set(

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
              receiptNumber,

            normalizedReceipt:
              normalizedReceipt,

            receiptFileName:
              receiptFileName,

            receiptUploadStatus:
              "uploading",

            result:
              "uploading_receipt",

            voucherStatus:
              null,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }

        );


        batch.set(

          receiptRef,

          {

            receiptNumber:
              receiptNumber,

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


        await batch.commit();


        $("formError")
          .textContent =
          "Uploading receipt photo...";


        await uploadToDrive({

          type:
            "receipt",

          file:
            receiptFile,

          fileName:
            receiptFileName

        });


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
              serverTimestamp(),

            updatedAt:
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


        activeAttempt.result =
          "started";


        $("formError")
          .textContent =
          "";


        resetCameraUI();


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
          "NEXT: SHOOT NA! 🏀";

      }

    }
  );



/* =====================================================
   HD CAMERA
   TARGET: 1280x720 / 30 FPS
===================================================== */

$("enableCamera")
  .addEventListener(
    "click",
    async () => {

      $("cameraMessage")
        .textContent =
        "Starting HD camera...";


      try {

        cameraStream =
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
                    1280
                },

                height: {
                  ideal:
                    720
                },

                frameRate: {
                  ideal:
                    30
                }

              },

              audio:
                false

            });


        $("camera")
          .srcObject =
          cameraStream;


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
          .classList
          .remove(
            "hidden"
          );


        $("cameraMessage")
          .textContent =
          "Camera permission was not granted. Allow camera access and try again.";

      }

    }
  );



/* =====================================================
   RECORD 10 SECONDS
===================================================== */

$("startRecording")
  .addEventListener(
    "click",
    () => {

      if (
        !cameraStream
      ) {

        return;
      }


      recordingChunks =
        [];


      localVideoBlob =
        null;


      cleanupLocalVideoUrl();


      const mimeType =
        chooseRecordingMimeType();


      const options = {

        videoBitsPerSecond:
          4000000

      };


      if (
        mimeType
      ) {

        options.mimeType =
          mimeType;

      }


      try {

        mediaRecorder =
          new MediaRecorder(
            cameraStream,
            options
          );

      }


      catch {

        mediaRecorder =
          new MediaRecorder(
            cameraStream
          );

      }


      mediaRecorder
        .ondataavailable =
        event => {

          if (
            event.data &&
            event.data.size > 0
          ) {

            recordingChunks.push(
              event.data
            );

          }

        };


      mediaRecorder
        .onstop =
        () => {

          clearInterval(
            timerHandle
          );


          $("timer")
            .textContent =
            "00:00";


          localVideoBlob =
            new Blob(

              recordingChunks,

              {

                type:
                  mediaRecorder.mimeType ||
                  mimeType ||
                  "video/webm"

              }

            );


          localVideoUrl =
            URL.createObjectURL(
              localVideoBlob
            );


          $("playback").src =
            localVideoUrl;


          $("cashierPlayback").src =
            localVideoUrl;


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


          stopCameraStream();


          setTimeout(
            () => {

              showScreen(
                "screen-result"
              );

            },
            350
          );

        };


      mediaRecorder.start(
        250
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


      startCountdown();

    }
  );



$("stopRecording")
  .addEventListener(
    "click",
    () => {

      stopRecordingNow();

    }
  );



/* =====================================================
   RESULT: MISSED
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


        try {

          await setDoc(

            doc(
              db,
              "attempts",
              activeAttempt.id
            ),

            {

              result:
                "missed",

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
            error
          );

        }

      }


      cleanupVideo();


      showScreen(
        "screen-missed"
      );

    }
  );



$("closeMissed")
  .addEventListener(
    "click",
    () => {

      resetGame();

      showScreen(
        "screen-home"
      );

    }
  );



/* =====================================================
   RESULT: MADE SHOT
===================================================== */

$("madeShot")
  .addEventListener(
    "click",
    async () => {

      if (
        !activeAttempt ||
        !localVideoBlob ||
        !localVideoUrl
      ) {

        alert(
          "No challenge video was recorded."
        );

        return;
      }


      activeAttempt.result =
        "pending_cashier";


      try {

        await setDoc(

          doc(
            db,
            "attempts",
            activeAttempt.id
          ),

          {

            result:
              "pending_cashier",

            cashierReviewStatus:
              "pending",

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
          error
        );

      }


      $("summaryName")
        .textContent =
        activeAttempt.name;


      $("summaryReceipt")
        .textContent =
        activeAttempt.receiptNumber;


      $("cashierPlayback")
        .src =
        localVideoUrl;


      showScreen(
        "screen-cashier"
      );

    }
  );



/* =====================================================
   CASHIER REVIEW
===================================================== */

$("cashierApprove")
  .addEventListener(
    "click",
    () => {

      $("cashierPin")
        .value =
        "";


      $("pinError")
        .textContent =
        "";


      showScreen(
        "screen-pin"
      );

    }
  );



$("cashierReject")
  .addEventListener(
    "click",
    async () => {

      if (
        !activeAttempt
      ) {
        return;
      }


      const confirmed =
        confirm(
          "Mark this attempt as INVALID?"
        );


      if (
        !confirmed
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
              "cashier_rejected",

            cashierReviewStatus:
              "rejected",

            cashierRejectedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          },

          {
            merge:
              true
          }

        );


        cleanupVideo();


        alert(
          "Attempt marked INVALID."
        );


        resetGame();


        showScreen(
          "screen-home"
        );

      }


      catch (error) {

        console.error(
          error
        );


        alert(
          "Could not update the attempt."
        );

      }

    }
  );



/* =====================================================
   CASHIER PIN / ISSUE VOUCHER
===================================================== */

$("verifyPin")
  .addEventListener(
    "click",
    async () => {

      const pin =
        $("cashierPin")
          .value
          .trim();


      if (
        pin !== CASHIER_PIN
      ) {

        $("pinError")
          .textContent =
          "Incorrect cashier PIN.";

        return;
      }


      if (
        !activeAttempt
      ) {

        $("pinError")
          .textContent =
          "Attempt information is missing.";

        return;
      }


      $("verifyPin")
        .disabled =
        true;


      $("verifyPin")
        .textContent =
        "CREATING VOUCHER...";


      $("pinError")
        .textContent =
        "";


      try {

        const attemptRef =
          doc(
            db,
            "attempts",
            activeAttempt.id
          );


        const attemptSnapshot =
          await getDoc(
            attemptRef
          );


        const existingAttempt =
          attemptSnapshot.exists()
            ? attemptSnapshot.data()
            : {};


        let voucherCode =
          existingAttempt.voucherCode ||
          null;


        let expiresAt =
          existingAttempt.expiresAt ||
          null;


        if (
          !voucherCode
        ) {

          voucherCode =
            generateVoucherCode();


          const expiryDate =
            new Date();


          expiryDate.setDate(
            expiryDate.getDate() +
            VOUCHER_VALID_DAYS
          );


          expiresAt =
            Timestamp.fromDate(
              expiryDate
            );


          const batch =
            writeBatch(
              db
            );


          batch.set(

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
                activeAttempt.receiptNumber,

              normalizedReceipt:
                activeAttempt.normalizedReceipt,

              amount:
                VOUCHER_AMOUNT,

              status:
                "available",

              issuedAt:
                serverTimestamp(),

              expiresAt:
                expiresAt,

              redeemedAt:
                null,

              claimEvidenceFileName:
                null

            }

          );


          batch.set(

            attemptRef,

            {

              result:
                "approved",

              cashierReviewStatus:
                "approved",

              cashierApprovedAt:
                serverTimestamp(),

              voucherCode:
                voucherCode,

              voucherStatus:
                "available",

              voucherAmount:
                VOUCHER_AMOUNT,

              expiresAt:
                expiresAt,

              updatedAt:
                serverTimestamp()

            },

            {
              merge:
                true
            }

          );


          batch.set(

            doc(
              db,
              "receipts",
              activeAttempt.normalizedReceipt
            ),

            {

              voucherCode:
                voucherCode,

              status:
                "voucher_issued",

              updatedAt:
                serverTimestamp()

            },

            {
              merge:
                true
            }

          );


          await batch.commit();

        }


        activeVoucher = {

          voucherCode:
            voucherCode,

          attemptId:
            activeAttempt.id,

          name:
            activeAttempt.name,

          receiptNumber:
            activeAttempt.receiptNumber,

          normalizedReceipt:
            activeAttempt.normalizedReceipt,

          status:
            "available",

          expiresAt:
            expiresAt

        };


        saveVoucherLocally(
          activeVoucher
        );


        cleanupVideo();


        displayVoucher(
          activeVoucher
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
          "Could not create voucher. Please try again.";

      }


      finally {

        $("verifyPin")
          .disabled =
          false;


        $("verifyPin")
          .textContent =
          "CONFIRM SUCCESS";

      }

    }
  );



/* =====================================================
   MY VOUCHER LOOKUP
===================================================== */

$("findVoucher")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("voucherLookupName")
          .value
          .trim();


      const receiptNumber =
        $("voucherLookupReceipt")
          .value
          .trim();


      $("voucherLookupError")
        .textContent =
        "";


      if (
        !name ||
        !receiptNumber
      ) {

        $("voucherLookupError")
          .textContent =
          "Enter your name and UTAK receipt number.";

        return;
      }


      $("findVoucher")
        .disabled =
        true;


      $("findVoucher")
        .textContent =
        "SEARCHING...";


      try {

        const voucher =
          await findVoucherByReceipt(
            name,
            receiptNumber
          );


        if (
          !voucher
        ) {

          $("voucherLookupError")
            .textContent =
            "No voucher found for that name and receipt.";

          return;
        }


        activeVoucher =
          voucher;


        saveVoucherLocally(
          voucher
        );


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


        $("voucherLookupError")
          .textContent =
          "Could not search right now. Please try again.";

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
   OPEN SAME-PHONE VOUCHER
===================================================== */

async function openSavedVoucher() {

  const saved =
    readSavedVoucher();


  if (
    !saved?.voucherCode
  ) {

    localStorage.removeItem(
      "kapirata_last_voucher"
    );


    updateSavedVoucherCard();

    return;
  }


  try {

    const snapshot =
      await getDoc(

        doc(
          db,
          "vouchers",
          saved.voucherCode
        )

      );


    if (
      !snapshot.exists()
    ) {

      localStorage.removeItem(
        "kapirata_last_voucher"
      );


      updateSavedVoucherCard();

      return;
    }


    const voucher = {

      ...snapshot.data(),

      voucherCode:
        saved.voucherCode

    };


    await refreshExpiryStatus(
      voucher
    );


    activeVoucher =
      voucher;


    saveVoucherLocally(
      voucher
    );


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


    alert(
      "Could not open the voucher right now."
    );

  }

}



/* =====================================================
   DISPLAY VOUCHER
===================================================== */

function displayVoucher(voucher) {

  $("voucherCode")
    .textContent =
    voucher.voucherCode ||
    "—";


  let status =
    voucher.status ||
    "available";


  if (
    isExpired(
      voucher.expiresAt
    ) &&
    status === "available"
  ) {

    status =
      "expired";

  }


  $("voucherStatus")
    .textContent =
    status.toUpperCase();


  $("voucherStatus")
    .className =
    `status ${status}`;


  $("voucherExpiry")
    .textContent =
    formatVoucherExpiry(
      voucher.expiresAt
    );


  if (
    status === "available"
  ) {

    $("redeemVoucher")
      .disabled =
      false;


    $("redeemVoucher")
      .textContent =
      "CLAIM / REDEEM ₱10";

  }


  else if (
    status === "redeemed"
  ) {

    $("redeemVoucher")
      .disabled =
      true;


    $("redeemVoucher")
      .textContent =
      "ALREADY REDEEMED";

  }


  else {

    $("redeemVoucher")
      .disabled =
      true;


    $("redeemVoucher")
      .textContent =
      "VOUCHER EXPIRED";

  }


  updateSavedVoucherCard();

}



/* =====================================================
   START REDEMPTION
===================================================== */

$("redeemVoucher")
  .addEventListener(
    "click",
    async () => {

      if (
        !activeVoucher
      ) {
        return;
      }


      await refreshExpiryStatus(
        activeVoucher
      );


      if (
        activeVoucher.status !==
        "available"
      ) {

        displayVoucher(
          activeVoucher
        );

        return;
      }


      claimPhotoFile =
        null;


      if (
        claimPhotoPreviewUrl
      ) {

        URL.revokeObjectURL(
          claimPhotoPreviewUrl
        );


        claimPhotoPreviewUrl =
          null;

      }


      $("claimPhoto").value =
        "";


      $("claimPhotoPreview")
        .classList
        .add(
          "hidden"
        );


      $("confirmClaimPhoto")
        .disabled =
        true;


      $("claimError")
        .textContent =
        "";


      $("claimVoucherCode")
        .textContent =
        activeVoucher.voucherCode;


      $("claimStudentName")
        .textContent =
        activeVoucher.name ||
        "—";


      $("claimReceiptNumber")
        .textContent =
        activeVoucher.receiptNumber ||
        "—";


      showScreen(
        "screen-claim-photo"
      );

    }
  );



/* =====================================================
   CLAIM EVIDENCE PHOTO
===================================================== */

$("claimPhoto")
  .addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];


      if (
        !file
      ) {

        claimPhotoFile =
          null;


        $("confirmClaimPhoto")
          .disabled =
          true;


        return;
      }


      if (
        file.size >
        8 * 1024 * 1024
      ) {

        $("claimError")
          .textContent =
          "Claim photo is too large. Please use a photo under 8 MB.";


        event.target.value =
          "";


        claimPhotoFile =
          null;


        $("confirmClaimPhoto")
          .disabled =
          true;


        return;
      }


      claimPhotoFile =
        file;


      $("claimError")
        .textContent =
        "";


      if (
        claimPhotoPreviewUrl
      ) {

        URL.revokeObjectURL(
          claimPhotoPreviewUrl
        );

      }


      claimPhotoPreviewUrl =
        URL.createObjectURL(
          file
        );


      $("claimPhotoPreview").src =
        claimPhotoPreviewUrl;


      $("claimPhotoPreview")
        .classList
        .remove(
          "hidden"
        );


      $("confirmClaimPhoto")
        .disabled =
        false;

    }
  );



/* =====================================================
   CONFIRM CLAIM + REDEEM
===================================================== */

$("confirmClaimPhoto")
  .addEventListener(
    "click",
    async () => {

      if (
        !activeVoucher ||
        !claimPhotoFile
      ) {

        $("claimError")
          .textContent =
          "Claim evidence photo is required.";

        return;
      }


      $("confirmClaimPhoto")
        .disabled =
        true;


      $("confirmClaimPhoto")
        .textContent =
        "SAVING CLAIM...";


      $("claimError")
        .textContent =
        "";


      try {

        const voucherRef =
          doc(
            db,
            "vouchers",
            activeVoucher.voucherCode
          );


        const voucherSnapshot =
          await getDoc(
            voucherRef
          );


        if (
          !voucherSnapshot.exists()
        ) {

          throw new Error(
            "Voucher not found."
          );

        }


        const currentVoucher =
          voucherSnapshot.data();


        if (
          currentVoucher.status ===
          "redeemed"
        ) {

          activeVoucher = {
            ...currentVoucher,
            voucherCode:
              activeVoucher.voucherCode
          };


          displayVoucher(
            activeVoucher
          );


          showScreen(
            "screen-voucher"
          );


          return;
        }


        if (
          isExpired(
            currentVoucher.expiresAt
          )
        ) {

          await markVoucherExpired(
            activeVoucher.voucherCode,
            currentVoucher.attemptId
          );


          activeVoucher.status =
            "expired";


          displayVoucher(
            activeVoucher
          );


          showScreen(
            "screen-voucher"
          );


          return;
        }


        const claimFileName =
          buildClaimFileName(
            activeVoucher,
            claimPhotoFile
          );


        $("claimError")
          .textContent =
          "Uploading claim evidence...";


        await uploadToDrive({

          type:
            "claim",

          file:
            claimPhotoFile,

          fileName:
            claimFileName

        });


        const redeemedDate =
          new Date();


        const redeemedTimestamp =
          Timestamp.fromDate(
            redeemedDate
          );


        const batch =
          writeBatch(
            db
          );


        batch.set(

          voucherRef,

          {

            status:
              "redeemed",

            claimEvidenceFileName:
              claimFileName,

            claimEvidenceUploadStatus:
              "sent",

            claimEvidenceUploadedAt:
              serverTimestamp(),

            redeemedAt:
              redeemedTimestamp

          },

          {
            merge:
              true
          }

        );


        if (
          currentVoucher.attemptId
        ) {

          batch.set(

            doc(
              db,
              "attempts",
              currentVoucher.attemptId
            ),

            {

              voucherStatus:
                "redeemed",

              claimEvidenceFileName:
                claimFileName,

              claimEvidenceUploadStatus:
                "sent",

              redeemedAt:
                redeemedTimestamp,

              updatedAt:
                serverTimestamp()

            },

            {
              merge:
                true
            }

          );

        }


        if (
          currentVoucher.normalizedReceipt
        ) {

          batch.set(

            doc(
              db,
              "receipts",
              currentVoucher.normalizedReceipt
            ),

            {

              status:
                "redeemed",

              voucherCode:
                activeVoucher.voucherCode,

              redeemedAt:
                redeemedTimestamp,

              updatedAt:
                serverTimestamp()

            },

            {
              merge:
                true
            }

          );

        }


        await batch.commit();


        activeVoucher = {

          ...currentVoucher,

          voucherCode:
            activeVoucher.voucherCode,

          status:
            "redeemed",

          claimEvidenceFileName:
            claimFileName,

          redeemedAt:
            redeemedTimestamp

        };


        saveVoucherLocally(
          activeVoucher
        );


        $("redeemedVoucherCode")
          .textContent =
          activeVoucher.voucherCode;


        $("redeemedAtText")
          .textContent =
          "Redeemed: " +
          redeemedDate.toLocaleString(
            "en-PH",
            {
              month:
                "short",
              day:
                "numeric",
              year:
                "numeric",
              hour:
                "numeric",
              minute:
                "2-digit"
            }
          );


        $("claimError")
          .textContent =
          "";


        updateSavedVoucherCard();


        showScreen(
          "screen-redeemed"
        );

      }


      catch (error) {

        console.error(
          error
        );


        $("claimError")
          .textContent =
          "Could not complete redemption. Please check the connection and try again.";


        $("confirmClaimPhoto")
          .disabled =
          false;

      }


      finally {

        $("confirmClaimPhoto")
          .textContent =
          "CONFIRM & REDEEM ₱10";

      }

    }
  );



$("cancelClaim")
  .addEventListener(
    "click",
    () => {

      displayVoucher(
        activeVoucher
      );


      showScreen(
        "screen-voucher"
      );

    }
  );



$("finishRedemption")
  .addEventListener(
    "click",
    () => {

      resetGame();


      showScreen(
        "screen-home"
      );

    }
  );



/* =====================================================
   HOME / NEW GAME
===================================================== */

$("newGame")
  .addEventListener(
    "click",
    () => {

      resetGame();


      showScreen(
        "screen-home"
      );

    }
  );



/* =====================================================
   FIND VOUCHER BY RECEIPT
===================================================== */

async function findVoucherByReceipt(
  name,
  receiptNumber
) {

  const normalizedReceipt =
    normalizeReceipt(
      receiptNumber
    );


  const receiptSnapshot =
    await getDoc(

      doc(
        db,
        "receipts",
        normalizedReceipt
      )

    );


  if (
    !receiptSnapshot.exists()
  ) {

    return null;
  }


  const receiptData =
    receiptSnapshot.data();


  if (
    normalizeName(
      receiptData.name
    ) !==
    normalizeName(
      name
    )
  ) {

    return null;
  }


  let voucherCode =
    receiptData.voucherCode;


  if (
    !voucherCode &&
    receiptData.attemptId
  ) {

    const attemptSnapshot =
      await getDoc(

        doc(
          db,
          "attempts",
          receiptData.attemptId
        )

      );


    if (
      attemptSnapshot.exists()
    ) {

      voucherCode =
        attemptSnapshot
          .data()
          .voucherCode;

    }

  }


  if (
    !voucherCode
  ) {

    return null;
  }


  const voucherSnapshot =
    await getDoc(

      doc(
        db,
        "vouchers",
        voucherCode
      )

    );


  if (
    !voucherSnapshot.exists()
  ) {

    return null;
  }


  const voucher = {

    ...voucherSnapshot.data(),

    voucherCode:
      voucherCode

  };


  await refreshExpiryStatus(
    voucher
  );


  return voucher;

}



/* =====================================================
   EXPIRY
===================================================== */

async function refreshExpiryStatus(
  voucher
) {

  if (
    !voucher
  ) {
    return;
  }


  if (
    voucher.status === "available" &&
    isExpired(
      voucher.expiresAt
    )
  ) {

    await markVoucherExpired(

      voucher.voucherCode,

      voucher.attemptId

    );


    voucher.status =
      "expired";


    saveVoucherLocally(
      voucher
    );

  }

}



async function markVoucherExpired(
  voucherCode,
  attemptId
) {

  const batch =
    writeBatch(
      db
    );


  batch.set(

    doc(
      db,
      "vouchers",
      voucherCode
    ),

    {

      status:
        "expired"

    },

    {
      merge:
        true
    }

  );


  if (
    attemptId
  ) {

    batch.set(

      doc(
        db,
        "attempts",
        attemptId
      ),

      {

        voucherStatus:
          "expired",

        updatedAt:
          serverTimestamp()

      },

      {
        merge:
          true
      }

    );

  }


  await batch.commit();

}



function isExpired(value) {

  const date =
    timestampToDate(
      value
    );


  if (
    !date
  ) {
    return false;
  }


  return (
    date.getTime() <
    Date.now()
  );

}



/* =====================================================
   GOOGLE DRIVE UPLOAD
===================================================== */

async function uploadToDrive({
  type,
  file,
  fileName
}) {

  const base64 =
    await fileToBase64(
      file
    );


  const payload = {

    type:
      type,

    fileName:
      fileName,

    mimeType:
      file.type ||
      "image/jpeg",

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

}



/* =====================================================
   CAMERA HELPERS
===================================================== */

function chooseRecordingMimeType() {

  const types = [

    "video/mp4",

    "video/webm;codecs=vp9",

    "video/webm;codecs=vp8",

    "video/webm"

  ];


  for (
    const type of types
  ) {

    try {

      if (
        MediaRecorder
          .isTypeSupported(
            type
          )
      ) {

        return type;

      }

    }

    catch {
      // continue
    }

  }


  return "";

}



function startCountdown() {

  clearInterval(
    timerHandle
  );


  let seconds =
    10;


  $("timer")
    .textContent =
    "00:10";


  timerHandle =
    setInterval(
      () => {

        seconds--;


        $("timer")
          .textContent =
          `00:${String(seconds).padStart(2, "0")}`;


        if (
          seconds <= 0
        ) {

          clearInterval(
            timerHandle
          );


          stopRecordingNow();

        }

      },
      1000
    );

}



function stopRecordingNow() {

  if (
    mediaRecorder &&
    mediaRecorder.state ===
      "recording"
  ) {

    mediaRecorder.stop();

  }

}



function stopCameraStream() {

  if (
    cameraStream
  ) {

    cameraStream
      .getTracks()
      .forEach(
        track => {

          track.stop();

        }
      );


    cameraStream =
      null;

  }


  $("camera")
    .srcObject =
    null;

}



function resetCameraUI() {

  stopCameraStream();


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


  $("cameraMessage")
    .classList
    .remove(
      "hidden"
    );


  $("cameraMessage")
    .textContent =
    "Allow camera access to start.";


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

}



function cleanupLocalVideoUrl() {

  if (
    localVideoUrl
  ) {

    URL.revokeObjectURL(
      localVideoUrl
    );


    localVideoUrl =
      null;

  }

}



function cleanupVideo() {

  stopCameraStream();


  clearInterval(
    timerHandle
  );


  cleanupLocalVideoUrl();


  localVideoBlob =
    null;


  recordingChunks =
    [];


  $("playback")
    .removeAttribute(
      "src"
    );


  $("cashierPlayback")
    .removeAttribute(
      "src"
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
    getImageExtension(
      file
    );


  return (

    "RECEIPT_" +

    safeFilePart(
      attempt.receiptNumber
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



function buildClaimFileName(
  voucher,
  file
) {

  const extension =
    getImageExtension(
      file
    );


  return (

    "CLAIM_" +

    safeFilePart(
      voucher.voucherCode
    ) +

    "_" +

    safeFilePart(
      voucher.receiptNumber
    ) +

    "_" +

    safeFilePart(
      voucher.name
    ) +

    "_" +

    Date.now() +

    "." +

    extension

  );

}



function getImageExtension(
  file
) {

  const type =
    String(
      file?.type ||
      ""
    ).toLowerCase();


  if (
    type.includes(
      "png"
    )
  ) {
    return "png";
  }


  if (
    type.includes(
      "webp"
    )
  ) {
    return "webp";
  }


  if (
    type.includes(
      "heic"
    ) ||
    type.includes(
      "heif"
    )
  ) {
    return "heic";
  }


  return "jpg";

}



/* =====================================================
   VOUCHER CODE
===================================================== */

function generateVoucherCode() {

  const now =
    new Date();


  const datePart =

    String(
      now.getFullYear()
    ).slice(-2) +

    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    ) +

    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  const randomPart =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();


  return (
    "KPB-" +
    datePart +
    "-" +
    randomPart
  );

}



/* =====================================================
   LOCAL STORAGE
===================================================== */

function saveVoucherLocally(
  voucher
) {

  if (
    !voucher?.voucherCode
  ) {
    return;
  }


  try {

    localStorage.setItem(

      "kapirata_last_voucher",

      JSON.stringify({

        voucherCode:
          voucher.voucherCode,

        name:
          voucher.name,

        receiptNumber:
          voucher.receiptNumber,

        status:
          voucher.status,

        expiresAt:
          serializeTimestamp(
            voucher.expiresAt
          )

      })

    );

  }

  catch (error) {

    console.error(
      error
    );

  }


  updateSavedVoucherCard();

}



function readSavedVoucher() {

  try {

    const value =
      localStorage.getItem(
        "kapirata_last_voucher"
      );


    if (
      !value
    ) {
      return null;
    }


    return JSON.parse(
      value
    );

  }

  catch {

    return null;

  }

}



function updateSavedVoucherCard() {

  const card =
    $("savedVoucherCard");


  const info =
    $("savedVoucherInfo");


  if (
    !card ||
    !info
  ) {
    return;
  }


  const saved =
    readSavedVoucher();


  if (
    !saved ||
    !saved.voucherCode ||
    saved.status === "redeemed" ||
    saved.status === "expired"
  ) {

    card.classList.add(
      "hidden"
    );


    return;
  }


  card.classList.remove(
    "hidden"
  );


  info.textContent =
    `${saved.voucherCode} • ₱${VOUCHER_AMOUNT} OFF`;

}



/* =====================================================
   RESET
===================================================== */

function resetGame() {

  cleanupVideo();


  activeAttempt =
    null;


  activeVoucher =
    null;


  receiptFile =
    null;


  claimPhotoFile =
    null;


  $("playerName").value =
    "";


  $("receiptNumber").value =
    "";


  $("consent").checked =
    false;


  $("receiptPhoto").value =
    "";


  $("claimPhoto").value =
    "";


  $("formError").textContent =
    "";


  $("claimError").textContent =
    "";


  $("pinError").textContent =
    "";


  if (
    receiptPreviewUrl
  ) {

    URL.revokeObjectURL(
      receiptPreviewUrl
    );


    receiptPreviewUrl =
      null;

  }


  if (
    claimPhotoPreviewUrl
  ) {

    URL.revokeObjectURL(
      claimPhotoPreviewUrl
    );


    claimPhotoPreviewUrl =
      null;

  }


  $("receiptPreview")
    .classList
    .add(
      "hidden"
    );


  $("claimPhotoPreview")
    .classList
    .add(
      "hidden"
    );


  resetCameraUI();


  updateSavedVoucherCard();

}



/* =====================================================
   FORMATTERS
===================================================== */

function formatVoucherExpiry(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (
    !date
  ) {

    return "Valid for 7 days only.";

  }


  return (
    "Valid until " +
    date.toLocaleString(
      "en-PH",
      {
        month:
          "short",
        day:
          "numeric",
        year:
          "numeric",
        hour:
          "numeric",
        minute:
          "2-digit"
      }
    )
  );

}



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


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date;

}



function serializeTimestamp(
  value
) {

  const date =
    timestampToDate(
      value
    );


  return date
    ? date.toISOString()
    : null;

}



/* =====================================================
   GENERAL HELPERS
===================================================== */

function normalizeReceipt(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );

}



function normalizeName(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );

}



function safeFilePart(
  value
) {

  return String(
    value || "UNKNOWN"
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(
      0,
      40
    ) || "UNKNOWN";

}



function fileToBase64(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onload =
        () => {

          const result =
            String(
              reader.result ||
              ""
            );


          const comma =
            result.indexOf(
              ","
            );


          resolve(

            comma >= 0
              ? result.slice(
                  comma + 1
                )
              : result

          );

        };


      reader.onerror =
        () => {

          reject(
            reader.error
          );

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}



/* =====================================================
   INITIAL LOAD
===================================================== */

updateSavedVoucherCard();


window.addEventListener(
  "beforeunload",
  () => {

    stopCameraStream();

    cleanupLocalVideoUrl();

  }
);
