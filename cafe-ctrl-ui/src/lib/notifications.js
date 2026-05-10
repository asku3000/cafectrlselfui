// Sound + Browser notifications helpers
let _audioCtx = null;

export function ensureMutedFlag() {
  return localStorage.getItem("gb_muted") === "1";
}

export function setMuted(v) {
  localStorage.setItem("gb_muted", v ? "1" : "0");
}

export function playChime() {
  if (ensureMutedFlag()) return;
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const now = ctx.currentTime;
    const tones = [
      { f: 880, t: 0 },
      { f: 1320, t: 0.18 },
    ];
    tones.forEach(({ f, t }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.4, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.4);
      o.start(now + t);
      o.stop(now + t + 0.45);
    });
  } catch {}
}

export async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  return await Notification.requestPermission();
}

export function pushNotify(title, body) {
  if (ensureMutedFlag()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
}
