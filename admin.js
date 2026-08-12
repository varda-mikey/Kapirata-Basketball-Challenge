const rowsEl = document.getElementById("rows");
const searchEl = document.getElementById("search");
const filterEl = document.getElementById("filter");

function getRows(){
  return JSON.parse(localStorage.getItem("kapirata_attempts") || "[]").reverse();
}

function render(){
  const rows = getRows();
  document.getElementById("totalCount").textContent = rows.length;
  document.getElementById("approvedCount").textContent = rows.filter(x=>x.result==="approved").length;
  document.getElementById("redeemedCount").textContent = rows.filter(x=>x.voucherStatus==="redeemed").length;

  const q = searchEl.value.trim().toLowerCase();
  const f = filterEl.value;

  const filtered = rows.filter(x=>{
    const hay = `${x.name||""} ${x.receipt||""} ${x.voucherCode||""}`.toLowerCase();
    const searchOk = !q || hay.includes(q);
    const filterOk =
      f==="all" ||
      (f==="redeemed" ? x.voucherStatus==="redeemed" : x.result===f);
    return searchOk && filterOk;
  });

  if(!filtered.length){
    rowsEl.innerHTML = `<div class="empty">No matching attempts yet.</div>`;
    return;
  }

  rowsEl.innerHTML = filtered.map(x=>`
    <article class="row">
      <div><strong>${escapeHtml(x.name||"—")}</strong><small>${new Date(x.startedAt).toLocaleString()}</small></div>
      <div><strong>${escapeHtml(x.receipt||"—")}</strong><small>Receipt #</small></div>
      <div><span class="badge">${escapeHtml(x.result||"—")}</span><small>${x.hasVideo?"Video recorded":"No saved video"}</small></div>
      <div><strong>${escapeHtml(x.voucherCode||"—")}</strong><small>${escapeHtml(x.voucherStatus||"No voucher")}</small></div>
    </article>
  `).join("");
}

function escapeHtml(v){
  return String(v).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

searchEl.addEventListener("input",render);
filterEl.addEventListener("change",render);
render();
