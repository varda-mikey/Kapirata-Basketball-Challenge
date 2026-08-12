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


const $ =
  (id) =>
    document.getElementById(
      id
    );


let attempts = [];


/* =====================================
   LOAD DATA
===================================== */

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
        (document) => {

          return {

            id:
              document.id,

            ...document.data()

          };

        }
      );


    $("statusBox").textContent =
      `Connected • ${attempts.length} attempt(s) loaded`;


    render();

  }

  catch (error) {

    console.error(
      error
    );


    /*
      If orderBy fails because
      of older documents without
      createdAt, retry without
      ordering.
    */

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
          (document) => {

            return {

              id:
                document.id,

              ...document.data()

            };

          }
        );


      attempts.sort(
        (
          a,
          b
        ) => {

          return (
            getMillis(
              b.createdAt
            )
            -
            getMillis(
              a.createdAt
            )
          );

        }
      );


      $("statusBox").textContent =
        `Connected • ${attempts.length} attempt(s) loaded`;


      render();

    }

    catch (
      fallbackError
    ) {

      console.error(
        fallbackError
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


/* =====================================
   RENDER
===================================== */

function render() {

  renderStats();


  const search =
    $("search")
      .value
      .trim()
      .toLowerCase();


  const filter =
    $("filter")
      .value;


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


        const matchesSearch =
          !search ||
          haystack.includes(
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


/* =====================================
   SUMMARY COUNTS
===================================== */

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


/* =====================================
   FILTER
===================================== */

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


/* =====================================
   DESKTOP TABLE
===================================== */

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

              <small>
                ${escapeHtml(
                  attempt.receiptFileName ||
                  "No receipt filename"
                )}
              </small>

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

              ${mediaSummary(
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


/* =====================================
   MOBILE CARDS
===================================== */

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

              <strong>
                Receipt File
              </strong>

              <small>
                ${escapeHtml(
                  attempt.receiptFileName ||
                  "Not recorded"
                )}
              </small>


              <strong>
                Successful Video
              </strong>

              <small>
                ${escapeHtml(
                  attempt.successfulVideoFileName ||
                  "No successful video"
                )}
              </small>

            </div>

          </article>
        `;

      }
    ).join("");

}


/* =====================================
   MEDIA
===================================== */

function mediaSummary(
  attempt
) {

  const receipt =
    attempt.receiptFileName
      ? `
        <div class="media-item">
          <span>
            📷
          </span>

          <small>
            ${escapeHtml(
              attempt.receiptFileName
            )}
          </small>
        </div>
      `
      :
      `
        <div class="media-item muted">
          No receipt file
        </div>
      `;


  const video =
    attempt.successfulVideoFileName
      ? `
        <div class="media-item">
          <span>
            🎥
          </span>

          <small>
            ${escapeHtml(
              attempt.successfulVideoFileName
            )}
          </small>
        </div>
      `
      :
      `
        <div class="media-item muted">
          No successful video
        </div>
      `;


  return (
    receipt +
    video
  );

}


/* =====================================
   BADGES
===================================== */

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


/* =====================================
   DATE HELPERS
===================================== */

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


/* =====================================
   OTHER HELPERS
===================================== */

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


/* =====================================
   EVENTS
===================================== */

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


/* =====================================
   START
===================================== */

loadAttempts();
