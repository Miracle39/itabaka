import "./admin.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
const $ = (selector) => document.querySelector(selector);
let members = [];
let editingId = null;

function message(text, type = "") {
  const el = $("#pageMessage");
  if (!el) return;
  el.innerHTML = `<div class="admin-message ${type}">${escapeHtml(text)}</div>`;
}

function normalizePlate(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function formatDiscount(member) {
  return member.discount_type === "PERCENT"
    ? `${Number(member.discount_value)}%`
    : formatRupiah(member.discount_value);
}

function navLink(href, label, active = false) {
  return `<a class="nav-link ${active ? "active" : ""}" href="${href}">${label}</a>`;
}

function shell(session) {
  app.innerHTML = `
    <style>
      .promo-admin-grid{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.6fr);gap:22px;align-items:start}
      .promo-admin-card{background:#fff;border:1px solid #e6e6e6;border-radius:18px;padding:22px;box-shadow:0 8px 25px rgba(0,0,0,.035)}
      .promo-admin-card h2{margin:0 0 7px}
      .promo-admin-card .muted{margin-top:0}
      .promo-admin-form{display:grid;gap:14px}
      .promo-admin-form label{display:grid;gap:7px;font-weight:650;font-size:13px}
      .promo-admin-form input,.promo-admin-form select{width:100%;min-height:43px;border:1px solid #d8d8d8;border-radius:10px;padding:10px 12px;font:inherit;background:#fff}
      .promo-admin-form .form-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:4px}
      .promo-admin-table-wrap{overflow:auto}
      .promo-admin-table{width:100%;border-collapse:collapse;min-width:720px}
      .promo-admin-table th,.promo-admin-table td{padding:12px 10px;text-align:left;border-bottom:1px solid #eee;font-size:13px;vertical-align:middle}
      .promo-admin-table th{color:#777;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
      .promo-admin-table .actions{display:flex;gap:6px;flex-wrap:wrap}
      .promo-admin-table .actions button{font-size:11px;padding:7px 9px}
      .promo-state{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}
      .promo-state.used{background:#fff2d8;color:#865400}.promo-state.ready{background:#e8f7ed;color:#176534}.promo-state.off{background:#eee;color:#666}
      .promo-modal-backdrop{position:fixed;inset:0;background:rgba(15,15,15,.48);display:grid;place-items:center;padding:18px;z-index:10000}
      .promo-modal{width:min(430px,100%);background:#fff;border-radius:18px;padding:23px;box-shadow:0 25px 80px rgba(0,0,0,.2)}
      .promo-modal h3{margin:0 0 9px}.promo-modal p{color:#666;line-height:1.55}.promo-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}
      @media(max-width:950px){.promo-admin-grid{grid-template-columns:1fr}}
    </style>
    <div class="admin-app">
      <header class="admin-header"><div class="header-inner">
        <a class="brand-link" href="/admin.html"><strong>CIRCLE ITABAKA</strong><span>Admin Panel</span></a>
        <nav class="main-nav">
          ${navLink("/admin.html","Produk")}
          ${navLink("/admin-all-orders.html","Semua Order")}
          ${navLink("/admin-orders.html","Merchandise")}
          ${navLink("/admin-apparel.html","Kaos / Jaket")}
          ${navLink("/admin-promos.html","Promo Member",true)}
          ${navLink("/admin-settings.html","Pengaturan")}
        </nav>
        <div class="header-actions"><span class="user-name">${escapeHtml(session.profile.display_name || session.user.email)}</span><a class="btn ghost" href="/" target="_blank" rel="noreferrer">Customer</a><button class="btn ghost" id="logout" type="button">Keluar</button></div>
      </div></header>
      <main class="admin-main">
        <div id="pageMessage"></div>
        <section class="page-title-row"><div><div class="kicker">MEMBER & DISKON</div><h1>Promo Member</h1><p class="muted">Kelola kode promo berdasarkan nomor polisi kendaraan. Setiap kode hanya dapat dipakai satu kali sebelum direset admin.</p></div></section>
        <div class="promo-admin-grid">
          <section class="promo-admin-card">
            <h2 id="promoFormTitle">Tambah Member</h2>
            <p class="muted small">Contoh kode: D 1234 ABC. Kode akan disimpan dalam huruf kapital.</p>
            <form id="promoForm" class="promo-admin-form">
              <label>Nama Member<input id="memberName" maxlength="120" required placeholder="Nama member"></label>
              <label>Nomor Polisi / Kode Promo<input id="plateCode" maxlength="20" required placeholder="D 1234 ABC"></label>
              <label>Jenis Diskon<select id="discountType"><option value="PERCENT">Persentase (%)</option><option value="FIXED">Nominal Rupiah (Rp)</option></select></label>
              <label>Nilai Diskon<input id="discountValue" type="number" min="1" step="1" required placeholder="Contoh: 10 atau 15000"></label>
              <label>Status<select id="memberActive"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
              <div class="form-actions"><button class="btn primary" type="submit" id="saveMember">Simpan Member</button><button class="btn ghost" type="button" id="cancelEdit" hidden>Batal Edit</button></div>
            </form>
          </section>
          <section class="promo-admin-card">
            <div class="page-title-row"><div><h2>Daftar Member</h2><p class="muted small">Pantau status penggunaan dan kelola kode promo.</p></div><button class="btn ghost" id="refreshMembers" type="button">Muat Ulang</button></div>
            <div class="promo-admin-table-wrap" id="memberTable"><p class="muted">Memuat data member...</p></div>
          </section>
        </div>
      </main>
    </div>
    <div id="promoModalRoot"></div>`;

  $("#logout").onclick = async () => { await supabase.auth.signOut(); loginView(); };
  $("#promoForm").onsubmit = saveMember;
  $("#cancelEdit").onclick = resetForm;
  $("#refreshMembers").onclick = loadMembers;
  $("#discountType").onchange = updateDiscountHint;
  updateDiscountHint();
}

function updateDiscountHint() {
  const type = $("#discountType")?.value;
  const input = $("#discountValue");
  if (!input) return;
  input.max = type === "PERCENT" ? "100" : "999999999";
  input.placeholder = type === "PERCENT" ? "1–99" : "Contoh: 15000";
}

function loginView(error = "") {
  app.innerHTML = `<div class="login-screen"><section class="login-card"><div class="brand-lockup"><strong>CIRCLE ITABAKA</strong><span>Admin Panel</span></div><h1>Masuk Admin</h1><p class="muted">Kelola kode promo member.</p><div id="loginError">${error ? `<div class="admin-message error">${escapeHtml(error)}</div>` : ""}</div><form id="loginForm" class="stack"><label>Email<input id="loginEmail" type="email" autocomplete="email" required></label><label>Password<input id="loginPassword" type="password" autocomplete="current-password" required></label><button class="btn primary full" type="submit">Masuk</button></form></section></div>`;
  $("#loginForm").onsubmit = login;
}

async function login(event) {
  event.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({ email: $("#loginEmail").value.trim(), password: $("#loginPassword").value });
  if (error) loginView(error.message); else boot();
}

async function getAdminSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles").select("id,role,display_name").eq("id",user.id).single();
  if (error || profile?.role !== "admin") { await supabase.auth.signOut(); return null; }
  return { user, profile };
}

async function loadMembers() {
  $("#memberTable").innerHTML = `<p class="muted">Memuat data member...</p>`;
  const { data, error } = await supabase.from("promo_members").select("id,plate_code,member_name,discount_type,discount_value,is_active,is_used,used_order_id,used_at,created_at").order("created_at",{ascending:false});
  if (error) { message(`Gagal memuat member: ${error.message}`,"error"); $("#memberTable").innerHTML = ""; return; }
  members = data || [];
  renderMembers();
}

function renderMembers() {
  $("#memberTable").innerHTML = members.length ? `<table class="promo-admin-table"><thead><tr><th>Member / Kode</th><th>Diskon</th><th>Status</th><th>Terpakai</th><th>Aksi</th></tr></thead><tbody>${members.map(m => {
    const status = !m.is_active ? `<span class="promo-state off">Nonaktif</span>` : m.is_used ? `<span class="promo-state used">Sudah dipakai</span>` : `<span class="promo-state ready">Tersedia</span>`;
    return `<tr><td><strong>${escapeHtml(m.member_name)}</strong><br><code>${escapeHtml(m.plate_code)}</code></td><td>${escapeHtml(formatDiscount(m))}</td><td>${status}</td><td>${m.used_at ? escapeHtml(formatDate(m.used_at)) : "-"}</td><td><div class="actions"><button class="btn ghost" data-edit="${m.id}" type="button">Edit</button><button class="btn ghost" data-toggle="${m.id}" type="button">${m.is_active ? "Nonaktifkan" : "Aktifkan"}</button>${m.is_used ? `<button class="btn ghost" data-reset="${m.id}" type="button">Reset Pakai</button>` : ""}<button class="btn ghost" data-delete="${m.id}" type="button">Hapus</button></div></td></tr>`;
  }).join("")}</tbody></table>` : `<p class="muted">Belum ada member promo. Tambahkan member melalui formulir di samping.</p>`;
  $("#memberTable").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editMember(b.dataset.edit));
  $("#memberTable").querySelectorAll("[data-toggle]").forEach(b => b.onclick = () => toggleMember(b.dataset.toggle));
  $("#memberTable").querySelectorAll("[data-reset]").forEach(b => b.onclick = () => resetUsage(b.dataset.reset));
  $("#memberTable").querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteMember(b.dataset.delete));
}

function editMember(id) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  editingId = id;
  $("#promoFormTitle").textContent = "Edit Member";
  $("#memberName").value = m.member_name;
  $("#plateCode").value = m.plate_code;
  $("#discountType").value = m.discount_type;
  $("#discountValue").value = m.discount_value;
  $("#memberActive").value = String(m.is_active);
  $("#cancelEdit").hidden = false;
  updateDiscountHint();
  window.scrollTo({top:0,behavior:"smooth"});
}

function resetForm() {
  editingId = null;
  $("#promoForm").reset();
  $("#promoFormTitle").textContent = "Tambah Member";
  $("#cancelEdit").hidden = true;
  updateDiscountHint();
}

async function saveMember(event) {
  event.preventDefault();
  const member_name = $("#memberName").value.trim();
  const plate_code = normalizePlate($("#plateCode").value);
  const discount_type = $("#discountType").value;
  const discount_value = Number($("#discountValue").value);
  const is_active = $("#memberActive").value === "true";
  if (!member_name || !plate_code) return message("Nama dan nomor polisi wajib diisi.","error");
  if (!/^[A-Z0-9][A-Z0-9 -]{1,18}[A-Z0-9]$/.test(plate_code)) return message("Format nomor polisi tidak valid. Contoh: D 1234 ABC.","error");
  if (!Number.isInteger(discount_value) || discount_value <= 0 || (discount_type === "PERCENT" && discount_value > 99)) return message(discount_type === "PERCENT" ? "Diskon persen harus 1 sampai 99." : "Nominal diskon harus bilangan bulat lebih dari 0.","error");
  const values = { member_name, plate_code, discount_type, discount_value, is_active, updated_at: new Date().toISOString() };
  const query = editingId
    ? supabase.from("promo_members").update(values).eq("id",editingId)
    : supabase.from("promo_members").insert(values);
  const { error } = await query;
  if (error) return message(`Gagal menyimpan member: ${error.message}`,"error");
  message(editingId ? "Data member berhasil diperbarui." : "Member promo berhasil ditambahkan.","success");
  resetForm();
  await loadMembers();
}

function confirmDialog(title, body, confirmLabel = "Lanjutkan") {
  return new Promise(resolve => {
    const root = $("#promoModalRoot");
    root.innerHTML = `<div class="promo-modal-backdrop"><section class="promo-modal" role="dialog" aria-modal="true"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><div class="promo-modal-actions"><button class="btn ghost" id="promoCancel" type="button">Batal</button><button class="btn primary" id="promoConfirm" type="button">${escapeHtml(confirmLabel)}</button></div></section></div>`;
    const finish = value => { root.replaceChildren(); resolve(value); };
    $("#promoCancel").onclick = () => finish(false);
    $("#promoConfirm").onclick = () => finish(true);
    root.querySelector(".promo-modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("promo-modal-backdrop")) finish(false); });
  });
}

async function toggleMember(id) {
  const m = members.find(x => x.id === id); if (!m) return;
  const next = !m.is_active;
  if (!await confirmDialog(next ? "Aktifkan kode promo?" : "Nonaktifkan kode promo?",`${m.plate_code} akan ${next ? "diaktifkan" : "dinonaktifkan"}.`)) return;
  const { error } = await supabase.from("promo_members").update({is_active:next,updated_at:new Date().toISOString()}).eq("id",id);
  if (error) return message(`Gagal mengubah status: ${error.message}`,"error");
  message("Status member berhasil diperbarui.","success"); await loadMembers();
}

async function resetUsage(id) {
  const m = members.find(x => x.id === id); if (!m) return;
  if (!await confirmDialog("Reset penggunaan promo?",`Kode ${m.plate_code} akan dapat digunakan kembali satu kali.` ,"Reset Kode")) return;
  const { error } = await supabase.from("promo_members").update({is_used:false,used_order_id:null,used_at:null,updated_at:new Date().toISOString()}).eq("id",id);
  if (error) return message(`Gagal reset promo: ${error.message}`,"error");
  message("Penggunaan promo berhasil direset.","success"); await loadMembers();
}

async function deleteMember(id) {
  const m = members.find(x => x.id === id); if (!m) return;
  if (!await confirmDialog("Hapus member promo?",`Data ${m.member_name} (${m.plate_code}) akan dihapus. Riwayat kode pada invoice lama tetap tersimpan.`,"Hapus Member")) return;
  const { error } = await supabase.from("promo_members").delete().eq("id",id);
  if (error) return message(`Gagal menghapus member: ${error.message}`,"error");
  message("Member promo berhasil dihapus.","success"); await loadMembers();
}

async function boot() {
  const session = await getAdminSession();
  if (!session) return loginView();
  shell(session);
  await loadMembers();
}

supabase.auth.onAuthStateChange(() => { boot(); });
boot();
