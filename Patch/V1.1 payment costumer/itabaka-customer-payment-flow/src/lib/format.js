export const formatRupiah = (value) => new Intl.NumberFormat("id-ID", {
  style:"currency", currency:"IDR", maximumFractionDigits:0
}).format(Number(value || 0));

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

export const formatDate = (value) => new Intl.DateTimeFormat("id-ID", {
  dateStyle:"long", timeZone:"Asia/Jakarta"
}).format(new Date(value));
