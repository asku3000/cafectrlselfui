import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api` || "http://localhost:8080/api";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("gb_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function formatApiError(err) {
  // Check common backend keys: detail, message, or error
  const data = err?.response?.data;
  const detail = data?.detail || data?.message || data?.error || data;

  if (detail == null) return err?.message || "Something went wrong";
  
  if (typeof detail === "string") return detail;
  
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
      
  if (detail && typeof detail.msg === "string") return detail.msg;
  
  return String(detail);
}

export function fmtMoney(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Membership money: the backend stores integer paise. Never do float math on these. ---

// Formats integer paise as rupees, e.g. 12345 -> "₹123.45"
export function fmtPaise(paise) {
  const p = Math.trunc(Number(paise || 0));
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  const rupees = Math.floor(abs / 100).toLocaleString("en-IN");
  return `${sign}₹${rupees}.${String(abs % 100).padStart(2, "0")}`;
}

// Parses a decimal string with up to 2 places into an integer scaled by 100, without float error.
// "123.4" -> 12340, "0.1" -> 10, "12" -> 1200. Used for rupees -> paise and percent -> basis points.
// Returns null for empty or invalid input (including more than 2 decimal places).
export function parseHundredths(input) {
  const s = String(input ?? "").trim();
  const m = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] === undefined || m[3] === ""))) return null;
  const whole = Number(m[2] || "0");
  const frac = Number((m[3] || "").padEnd(2, "0"));
  const v = whole * 100 + frac;
  return m[1] ? -v : v;
}

// Integer scaled by 100 -> plain decimal string for inputs, e.g. 12340 -> "123.40", 1200 -> "12"
export function hundredthsToInput(v) {
  if (v == null) return "";
  const n = Math.trunc(Number(v));
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const frac = abs % 100;
  return `${sign}${Math.floor(abs / 100)}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
}

// "2026-12-01" (a Java LocalDate) -> "1 Dec 2026", parsed as a local date (no timezone shift)
export function fmtDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = String(isoDate).substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

// Today's local date as "YYYY-MM-DD" (for <input type="date"> and LocalDate fields)
export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Adds days to a "YYYY-MM-DD" date string
export function addDaysISO(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Idempotency key for one user action (one dialog open). crypto.randomUUID needs https/localhost, so fall back.
export function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function minutesBetween(a, b) {
  return Math.max(0, Math.floor((new Date(b) - new Date(a)) / 60000));
}

export function fmtDuration(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


// Helper to get local timezone offset string (e.g., "+05:30" for IST)
const getTzOffsetString = () => {
  const offset = new Date().getTimezoneOffset(); // IST gives -330
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hh = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const mm = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`; // Returns "+05:30"
};

// Extracts the exact literal time and formats it for your HTML Date Picker
export const toLocalInput = (input) => {
  if (!input) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } 
  
  // If it's a string from Java ("2026-06-13T13:16:00"), just chop to 16 chars
  if (typeof input === "string") {
    return input.substring(0, 16);
  } 
  
  if (input instanceof Date) {
    const yyyy = input.getFullYear();
    const mm = String(input.getMonth() + 1).padStart(2, '0');
    const dd = String(input.getDate()).padStart(2, '0');
    const hh = String(input.getHours()).padStart(2, '0');
    const min = String(input.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  return "";
};

export const fromLocalInput = (input) => {
  if (!input) return null;

  // 1. If it's a string, clean it manually
  if (typeof input === "string") {
    // If it comes from HTML picker, it looks like "2026-06-13T13:13"
    // Just append :00
    if (input.length === 16) return `${input}:00`;
    
    // If it has a Z or milliseconds (e.g., 2026-06-13T07:43:00.000Z)
    // Strip everything after the seconds (first 19 chars)
    return input.substring(0, 19); 
  }

  // 2. If it is a Date object (Safety fallback)
  if (input instanceof Date) {
     const pad = (n) => String(n).padStart(2, '0');
     return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}T${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
  }

  return input;
};