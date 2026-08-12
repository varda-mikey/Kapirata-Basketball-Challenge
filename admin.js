import {
  firebaseConfig
} from "./firebase-config.js";


import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const firebaseApp =
  initializeApp(
    firebaseConfig
  );


const db =
  getFirestore(
    firebaseApp
  );


const MEDIA_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbx5LzmQI9kGWfYAzUDK0v9vzaYbbt6C1dhlw5j2hK92CYyA7s7qzGui7Iq2FLIRYx0h/exec";


const $ =
  (id) =>
    document.getElementById(
      id
    );


let attempts =
  [];


/* =============================
   LOAD FIRESTORE
============================= */

async function loadAttempts() {

  $("statusBox").textContent =
    "Loading Kapirata records...";


  $("refreshBtn").disabled =
    true;


  try {

    const attemptsQuery =
      query(

        collection(
          db,
          "attempts"
        ),

        orderBy(
          "createdAt",
          "desc"
        )

      );


    const snapshot =
      await getDocs(
        attemptsQuery
      );


    attempts =
      snapshot.docs.map(
        (item) => ({

          id:
            item.id,

          ...item.data()

        })
      );


    $("statusBox").textContent =
      `Connected • ${attempts.length} attempt(s) loaded`;


    render();

  }

  catch (error) {

    console.error(
      error
    );


    try {

      const fallback =
        await getDocs(

          collection(
            db,
            "attempts"
          )

        );


      attempts =
        fallback.docs.map(
          (item) => ({

            id:
              item.id,

            ...item.data()

          })
        );


      attempts.sort(
        (a, b) =>
          getMillis(
            b.createdAt
          )
          -
          getMillis(
            a.createdAt
          )
      );


      $("statusBox").textContent =
        `Connected • ${attempts.length} attempt(s) loaded`;


      render();

    }

    catch (secondError) {

      console.error(
        secondError
      );


      $("statusBox").textContent =
        "Could not load Firebase records.";

    }

  }

  finally {

    $("refreshBtn").disabled =
      false;

  }

}


/* =============================
   RENDER
============================= */

function render() {

  renderStats();


  const search =
    $("search")
      .value
      .trim()
      .toLowerCase();


  const filter =
    $("filter").value;


  const filtered =
    attempts.filter(
      (attempt) => {

        const haystack =
          [

            attempt.name,

            attempt.receiptNumber,

            attempt.voucherCode,

            attempt.result,

            attempt.voucherStatus

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const searchOkay =
          !search ||
          haystack.includes(
            search
          );


        const filterOkay =
          matchFilter(
            attempt,
            filter
          );


        return (
          searchOkay &&
          filterOkay
        );

      }
    );


  renderTable(
    filtered
  );


  renderMobileCards(
    filtered
  );

}


/* =============================
   STATS
============================= */

function renderStats() {

  $("totalCount").textContent =
    attempts.length;


  $("approvedCount").textContent =
    attempts.filter(
      (attempt) =>
        attempt.result ===
        "approved"
    ).length;


  $("availableCount").textContent =
    attempts.filter(
      (attempt) =>
        attempt.voucherStatus ===
        "available"
    ).length;


  $("redeemedCount").textContent =
    attempts.filter(
      (attempt) =>
        attempt.voucherStatus ===
        "redeemed"
    ).length;

}


/* =============================
   FILTER
============================= */

function matchFilter(
  attempt,
  filter
) {

  if (
    filter ===
    "all"
  ) {

    return true;

  }


  if (
    [
      "available",
      "redeemed",
      "expired"
    ].includes(
      filter
    )
  ) {

    return (
      attempt.voucherStatus ===
      filter
    );

  }


  return (
    attempt.result ===
    filter
  );

}


/* =============================
   TABLE
============================= */

function renderTable(
  records
) {

  const rows =
    $("attemptRows");


  if (
    !records.length
  ) {

    rows.innerHTML =
      `
      <tr>
        <td
          colspan="6"
          class="empty"
        >
          No matching attempts.
        </td>
      </tr>
      `;

    return;

  }


  rows.innerHTML =
    records.map(
      (attempt) => {

        return `
        <tr>

          <td>

            <strong>
              ${escapeHtml(
                attempt.name ||
                "—"
              )}
            </strong>

            <small>
              ID:
              ${escapeHtml(
                shortId(
                  attempt.id
                )
              )}
            </small>

          </td>


          <td>

            <strong>
              ${escapeHtml(
                attempt.receiptNumber ||
                "—"
              )}
            </strong>

          </td>


          <td>

            ${resultBadge(
              attempt.result
            )}

          </td>


          <td>

            <strong>
              ${escapeHtml(
                attempt.voucherCode ||
                "—"
              )}
            </strong>

            ${voucherBadge(
              attempt.voucherStatus
            )}

          </td>


          <td>

            ${mediaButtons(
              attempt
            )}

          </td>


          <td>

            <strong>
              ${formatDateTime(
                attempt.createdAt
              )}
            </strong>

            <small>
              ${expiryText(
                attempt.expiresAt
              )}
            </small>

          </td>

        </tr>
        `;

      }
    ).join("");

}


/* =============================
   MOBILE
============================= */

function renderMobileCards(
  records
) {

  const container =
    $("mobileCards");


  if (
    !records.length
  ) {

    container.innerHTML =
      `
      <div class="empty-card">
        No matching attempts.
      </div>
      `;

    return;

  }


  container.innerHTML =
    records.map(
      (attempt) => {

        return `
        <article class="attempt-card">

          <div class="card-head">

            <div>

              <strong class="student-name">
                ${escapeHtml(
                  attempt.name ||
                  "—"
                )}
              </strong>

              <small>
                Receipt:
                ${escapeHtml(
                  attempt.receiptNumber ||
                  "—"
                )}
              </small>

            </div>

            ${resultBadge(
              attempt.result
            )}

          </div>


          <div class="card-grid">

            <div>

              <span>
                Voucher
              </span>

              <strong>
                ${escapeHtml(
                  attempt.voucherCode ||
                  "—"
                )}
              </strong>

              ${voucherBadge(
                attempt.voucherStatus
              )}

            </div>


            <div>

              <span>
                Date
              </span>

              <strong>
                ${formatDateTime(
                  attempt.createdAt
                )}
              </strong>

            </div>

          </div>


          <div class="media-box">

            ${mediaButtons(
              attempt
            )}

          </div>

        </article>
        `;

      }
    ).join("");

}


/* =============================
   MEDIA BUTTONS
============================= */

function mediaButtons(
  attempt
) {

  let html =
    "";


  if (
    attempt.receiptFileName
  ) {

    html += `
      <button
        class="media-open-btn receipt-open-btn"
        data-type="receipt"
        data-name="${escapeAttribute(
          attempt.receiptFileName
        )}"
        style="
          display:block;
          width:100%;
          border:0;
          text-align:center;
          padding:10px;
          margin:4px 0;
          border-radius:10px;
          background:#ffc928;
          color:#181818;
          font-weight:900;
          cursor:pointer;
        "
      >
        📷 VIEW RECEIPT
      </button>
    `;

  }

  else {

    html += `
      <small>
        No receipt photo
      </small>
    `;

  }


  if (
    attempt.successfulVideoFileName
  ) {

    html += `
      <button
        class="media-open-btn video-open-btn"
        data-type="video"
        data-name="${escapeAttribute(
          attempt.successfulVideoFileName
        )}"
        style="
          display:block;
          width:100%;
          border:0;
          text-align:center;
          padding:10px;
          margin:4px 0;
          border-radius:10px;
          background:#181818;
          color:#ffffff;
          font-weight:900;
          cursor:pointer;
        "
      >
        🎥 PLAY VIDEO
      </button>
    `;

  }

  else {

    html += `
      <small
        style="
          display:block;
          margin-top:6px;
        "
      >
        No successful video
      </small>
    `;

  }


  return html;

}


/* =============================
   MEDIA LOOKUP
============================= */

async function openMedia(
  type,
  fileName
) {

  const lookupUrl =

    MEDIA_BRIDGE_URL +

    "?action=lookup" +

    "&type=" +
    encodeURIComponent(
      type
    ) +

    "&name=" +
    encodeURIComponent(
      fileName
    );


  try {

    const response =
      await fetch(
        lookupUrl
      );


    const text =
      await response.text();


    const data =
      JSON.parse(
        text
      );


    if (
      !data.ok
    ) {

      alert(
        data.error ||
        "Media file not found."
      );

      return;

    }


    const targetUrl =
      type === "video"
        ? data.previewUrl
        : data.viewUrl;


    window.open(
      targetUrl,
      "_blank",
      "noopener,noreferrer"
    );

  }

  catch (error) {

    console.error(
      error
    );


    alert(
      "Could not open the media file."
    );

  }

}


/* =============================
   BADGES
============================= */

function resultBadge(
  result
) {

  const value =
    result ||
    "unknown";


  const labels = {

    started:
      "STARTED",

    uploading_receipt:
      "UPLOADING",

    pending_cashier:
      "PENDING CASHIER",

    approved:
      "SUCCESSFUL",

    missed:
      "MISSED",

    cashier_rejected:
      "REJECTED"

  };


  return `
    <span
      class="badge result-${escapeHtml(value)}"
    >
      ${escapeHtml(
        labels[value] ||
        value.toUpperCase()
      )}
    </span>
  `;

}


function voucherBadge(
  status
) {

  if (!status) {

    return `
      <span class="badge neutral">
        NO VOUCHER
      </span>
    `;

  }


  return `
    <span
      class="badge voucher-${escapeHtml(status)}"
    >
      ${escapeHtml(
        status.toUpperCase()
      )}
    </span>
  `;

}


/* =============================
   DATE HELPERS
============================= */

function formatDateTime(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (!date) {
    return "—";
  }


  return date.toLocaleString(
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

}


function expiryText(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (!date) {
    return "";
  }


  return (
    "Expires " +
    date.toLocaleDateString(
      "en-PH",
      {

        month:
          "short",

        day:
          "numeric",

        year:
          "numeric"

      }
    )
  );

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


  const date =
    new Date(
      value
    );


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function getMillis(
  value
) {

  const date =
    timestampToDate(
      value
    );


  return date
    ? date.getTime()
    : 0;

}


/* =============================
   HELPERS
============================= */

function shortId(
  value
) {

  return String(
    value ||
    ""
  ).slice(
    0,
    8
  );

}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (character) => {

      const map = {

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"

      };


      return map[
        character
      ];

    }
  );

}


function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}


/* =============================
   EVENTS
============================= */

$("search").addEventListener(
  "input",
  render
);


$("filter").addEventListener(
  "change",
  render
);


$("refreshBtn").addEventListener(
  "click",
  loadAttempts
);


document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        ".media-open-btn"
      );


    if (!button) {
      return;
    }


    const type =
      button.dataset.type;


    const fileName =
      button.dataset.name;


    openMedia(
      type,
      fileName
    );

  }
);


/* =============================
   START
============================= */

loadAttempts();
