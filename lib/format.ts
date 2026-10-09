// Deterministic (UTC) so the server and the browser render the same text
export const fmtDate = (iso: string | null) =>
  iso ? `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC` : 'Never';
export const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '–';
export const fmtMoney = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    n,
  );
export const fmtBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
