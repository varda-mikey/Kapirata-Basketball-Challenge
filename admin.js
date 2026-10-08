import {decodeVideo} from "./video-store.js";
import {
  firebaseConfig
} from "./firebase-config.js";


import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =====================================================
   FIREBASE
===================================================== */

const firebaseApp =
  initializeApp(firebaseConfig);


const db =
  getFirestore(firebaseApp);


/* =====================================================
   MEDIA BRIDGE
===================================================== */

const MEDIA_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbyxbrnQz6GQhfQYu59gtmf0HdOBKqkJXn-dDodVxzCyEayncs7YhfdraxrHmw1PElZm/exec";


/* =====================================================
   STATE
===================================================== */

const $ = (id) =>
  document.getElementById(id);


let attempts =
  [];


/* =====================================================
   LOAD ATTEMPTS
===================================================== */

let stopWatchingAttempts = null;

function loadAttempts() {
  if (stopWatchingAttempts) stopWatchingAttempts();
  $("statusBox").textContent = "Loading Kapirata records...";
  $("refreshBtn").disabled = true;
  stopWatchingAttempts = onSnapshot(collection(db, "attempts"), snapshot => {
    attempts = snapshot.docs.map(item => ({id: item.id, ...item.data()}));
    attempts.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
    $("statusBox").textContent = `Connected • ${attempts.length} attempt(s) • Videos update automatically`;
    $("refreshBtn").disabled = false;
    render();
  }, error => {
    console.error(error);
    $("statusBox").textContent = error.code === 'permission-denied'
      ? 'Firebase access blocked. Check the Firestore Rules, then tap Refresh.'
      : 'Could not load records. Check the connection, then tap Refresh.';
    $("refreshBtn").disabled = false;
  });
}


/* =====================================================
   RENDER
===================================================== */

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
      attempt => {

        const searchableText =
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


        const matchesSearch =
          !search ||
          searchableText.includes(
            search
          );


        const matchesFilter =
          matchFilter(
            attempt,
            filter
          );


        return (
          matchesSearch &&
          matchesFilter
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


/* =====================================================
   SUMMARY STATS
===================================================== */

function renderStats() {

  $("totalCount")
    .textContent =
    attempts.length;


  $("approvedCount")
    .textContent =
    attempts.filter(
      attempt =>
        attempt.result ===
        "approved"
    ).length;


  $("availableCount")
    .textContent =
    attempts.filter(
      attempt =>
        attempt.voucherStatus ===
        "available"
    ).length;


  $("redeemedCount")
    .textContent =
    attempts.filter(
      attempt =>
        attempt.voucherStatus ===
        "redeemed"
    ).length;


  $("expiredCount").textContent = attempts.filter(attempt => attempt.voucherStatus === 'expired').length;

}


/* =====================================================
   FILTER
===================================================== */

function matchFilter(
  attempt,
  filter
) {

  if (
    filter === "all"
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


/* =====================================================
   DESKTOP TABLE
===================================================== */

function renderTable(
  records
) {

  const rows =
    $("attemptRows");


  if (
    !records.length
  ) {

    rows.innerHTML = `
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
      attempt => `
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

            ${receiptUploadLabel(
              attempt
            )}

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

            ${expirySmall(
              attempt.expiresAt
            )}

          </td>


          <td>
            ${evidenceButtons(
              attempt
            )}
          </td>


          <td>

            <strong>
              ${formatDateTime(
                attempt.createdAt
              )}
            </strong>

            ${redeemedSmall(
              attempt.redeemedAt
            )}

          </td>

        </tr>
      `
    ).join("");

}


/* =====================================================
   MOBILE CARDS
===================================================== */

function renderMobileCards(
  records
) {

  const container =
    $("mobileCards");


  if (
    !records.length
  ) {

    container.innerHTML = `
      <div class="empty-card">
        No matching attempts.
      </div>
    `;

    return;

  }


  container.innerHTML =
    records.map(
      attempt => `
        <article
          class="attempt-card"
        >

          <div class="card-head">

            <div>

              <strong
                class="student-name"
              >
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


          <div
            class="media-box"
          >

            ${evidenceButtons(
              attempt
            )}

          </div>

        </article>
      `
    ).join("");

}


/* =====================================================
   EVIDENCE BUTTONS
===================================================== */

function evidenceButtons(
  attempt
) {

  let html =
    "";


  if (
    attempt.receiptFileName
  ) {

    html += `
      <a
        href="${escapeAttribute(
          buildViewerUrl(
            "receipt",
            attempt.receiptFileName
          )
        )}"
        target="_blank"
        rel="noopener noreferrer"
        style="
          display:block;
          text-align:center;
          padding:11px;
          margin:4px 0;
          border-radius:10px;
          background:#ffc928;
          color:#171717;
          text-decoration:none;
          font-weight:900;
        "
      >
        📷 VIEW RECEIPT
      </a>
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
    attempt.claimEvidenceFileName
  ) {

    html += `
      <a
        href="${escapeAttribute(
          buildViewerUrl(
            "claim",
            attempt.claimEvidenceFileName
          )
        )}"
        target="_blank"
        rel="noopener noreferrer"
        style="
          display:block;
          text-align:center;
          padding:11px;
          margin:6px 0 4px;
          border-radius:10px;
          background:#1f9d55;
          color:white;
          text-decoration:none;
          font-weight:900;
        "
      >
        ✅ VIEW CLAIM PHOTO
      </a>
    `;

  }

  else {

    html += `
      <small
        style="
          display:block;
          margin-top:7px;
        "
      >
        ${
          attempt.voucherStatus ===
          "redeemed"
            ? (attempt.claimProofRequired === false ? "✓ Claim recorded — no photo required" : "Claim photo missing")
            : "Not claimed yet"
        }
      </small>
    `;

  }


  if (attempt.videoUploadStatus === 'saved' && attempt.videoBase64) {
    html += `<button class="btn dark" type="button" data-watch-video="${escapeAttribute(attempt.id)}" style="width:100%;margin:6px 0">🎥 WATCH VIDEO · ${Number(attempt.videoDurationSeconds || 5).toFixed(1)}s</button>`;
    html += `<small>Video saved · ${Math.round(Number(attempt.videoBytes || 0) / 1024)} KB</small>`;
  } else {
    html += '<small style="display:block;margin-top:7px">No saved video (older or incomplete attempt)</small>';
  }

  return html;

}


/* =====================================================
   MEDIA VIEW URL
===================================================== */

function buildViewerUrl(
  type,
  fileName
) {

  return (
    MEDIA_BRIDGE_URL +
    "?action=viewer" +
    "&type=" +
    encodeURIComponent(
      type
    ) +
    "&name=" +
    encodeURIComponent(
      fileName
    )
  );

}


/* =====================================================
   RESULT BADGE
===================================================== */

function resultBadge(
  result
) {

  const value =
    result ||
    "unknown";


  const labels = {

    uploading_receipt:
      "UPLOADING RECEIPT",

    started:
      "STARTED",

    pending_cashier:
      "PENDING CASHIER",

    approved:
      "SUCCESSFUL",

    missed:
      "MISSED",

    cashier_rejected:
      "INVALID"

  };


  return `
    <span
      class="badge result-${escapeHtml(
        value
      )}"
    >
      ${escapeHtml(
        labels[value] ||
        value
          .replace(
            /_/g,
            " "
          )
          .toUpperCase()
      )}
    </span>
  `;

}


/* =====================================================
   VOUCHER BADGE
===================================================== */

function voucherBadge(
  status
) {

  if (
    !status
  ) {

    return `
      <span
        class="badge neutral"
      >
        NO VOUCHER
      </span>
    `;

  }


  return `
    <span
      class="badge voucher-${escapeHtml(
        status
      )}"
    >
      ${escapeHtml(
        status.toUpperCase()
      )}
    </span>
  `;

}


/* =====================================================
   SMALL LABELS
===================================================== */

function receiptUploadLabel(
  attempt
) {

  if (
    attempt.receiptUploadStatus ===
    "sent"
  ) {

    return `
      <small>
        Receipt saved
      </small>
    `;

  }


  if (
    attempt.receiptUploadStatus
  ) {

    return `
      <small>
        ${escapeHtml(
          attempt.receiptUploadStatus
        )}
      </small>
    `;

  }


  return "";

}


function expirySmall(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (
    !date
  ) {
    return "";
  }


  return `
    <small>
      Expires:
      ${escapeHtml(
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
      )}
    </small>
  `;

}


function redeemedSmall(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (
    !date
  ) {
    return "";
  }


  return `
    <small>
      Redeemed:
      ${escapeHtml(
        date.toLocaleString(
          "en-PH",
          {
            month:
              "short",
            day:
              "numeric",
            hour:
              "numeric",
            minute:
              "2-digit"
          }
        )
      )}
    </small>
  `;

}


/* =====================================================
   DATES
===================================================== */

function formatDateTime(
  value
) {

  const date =
    timestampToDate(
      value
    );


  if (
    !date
  ) {
    return "—";
  }


  return date
    .toLocaleString(
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


/* =====================================================
   HELPERS
===================================================== */

function shortId(
  value
) {

  return String(
    value || ""
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
    character => {

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


/* =====================================================
   EVENTS
===================================================== */

$("search")
  .addEventListener(
    "input",
    render
  );


$("filter")
  .addEventListener(
    "change",
    render
  );


$("refreshBtn")
  .addEventListener(
    "click",
    loadAttempts
  );


/* =====================================================
   START
===================================================== */

loadAttempts();


let adminVideoUrl = null;
function closeVideoReview() {
  const player = $("adminVideoPlayer");
  player.pause();
  player.removeAttribute('src');
  player.load();
  if (adminVideoUrl) URL.revokeObjectURL(adminVideoUrl);
  adminVideoUrl = null;
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-watch-video]');
  if (!button) return;
  const attempt = attempts.find(item => item.id === button.dataset.watchVideo);
  if (!attempt || !attempt.videoBase64) return;
  closeVideoReview();
  try {
    adminVideoUrl = URL.createObjectURL(decodeVideo(attempt.videoBase64, attempt.videoMimeType));
    $("adminVideoPlayer").src = adminVideoUrl;
    $("adminVideoTitle").textContent = (attempt.name || 'Student') + ' • Receipt ' + (attempt.receiptNumber || '—');
    $("adminVideoDownload").href = adminVideoUrl;
    $("adminVideoDownload").download = 'KAPIRATA_' + attempt.id + (String(attempt.videoMimeType).includes('mp4') ? '.mp4' : '.webm');
    $("videoReview").showModal();
  } catch (error) {
    console.error(error);
    alert('Could not open this video. Refresh the records and try again.');
  }
});
$("closeVideoReview").addEventListener('click', () => $("videoReview").close());
$("videoReview").addEventListener('close', closeVideoReview);
