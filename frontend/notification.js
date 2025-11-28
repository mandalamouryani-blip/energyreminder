// notification.js
// Simple browser-notification utilities with scheduling + cancel + recurring.
// Saves pending notifications in localStorage at key 'eb_pending_notifications'.
// Exposes window.ebNotification API.

(function () {
  const STORAGE_KEY = "eb_pending_notifications";
  const REMINDERS_ENABLED_KEY = "eb_reminders_enabled";
  let recurringIntervalId = null;

  // request permission (user gesture recommended)
  async function ensurePermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const p = await Notification.requestPermission();
      return p; // 'granted' | 'denied' | 'default'
    } catch (e) {
      console.warn("Notification permission request failed", e);
      return "default";
    }
  }

  // immediate show
  function showNotification(title, body, opts = {}) {
    if (!("Notification" in window)) {
      console.log("Notifications unsupported:", title, body);
      return false;
    }
    if (Notification.permission !== "granted") {
      console.log("Notification permission not granted:", Notification.permission);
      return false;
    }
    try {
      const n = new Notification(title, Object.assign({ body }, opts));
      n.onclick = () => window.focus();
      return true;
    } catch (err) {
      console.error("showNotification error", err);
      return false;
    }
  }

  // internal storage helpers
  function getStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveStored(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  // schedule a one-time notification (minutesFromNow)
  function scheduleOnce(title, body, minutesFromNow = 60) {
    const id = "n-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,6);
    const when = Date.now() + Math.max(0, Math.floor(minutesFromNow * 60 * 1000));
    const list = getStored();
    list.push({ id, title, body, when, fired: false });
    saveStored(list);
    const delay = Math.max(50, when - Date.now());
    setTimeout(() => triggerById(id), delay);
    // dispatch an event for UI
    window.dispatchEvent(new CustomEvent("eb:scheduled", { detail: { id, when } }));
    return { ok: true, id, when };
  }

  // internal trigger by id
  function triggerById(id) {
    const list = getStored();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return;
    const item = list[idx];
    if (item.fired) return;
    if (Notification.permission === "granted") {
      showNotification(item.title, item.body);
    } else {
      console.log("[Reminder] ", item.title, item.body);
    }
    list[idx].fired = true;
    saveStored(list);
    window.dispatchEvent(new CustomEvent("eb:notification-fired", { detail: item }));
  }

  // reschedule all pending on load
  function reschedulePending() {
    const list = getStored();
    const now = Date.now();
    list.forEach(item => {
      if (!item.fired) {
        const delay = Math.max(50, item.when - now);
        setTimeout(() => triggerById(item.id), delay);
      }
    });
  }

  // cancel a pending by id
  function cancel(id) {
    const list = getStored();
    const filtered = list.filter(x => x.id !== id);
    saveStored(filtered);
    window.dispatchEvent(new CustomEvent("eb:notification-cancelled", { detail: { id } }));
    return { ok: true, id };
  }

  // clear all pending
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("eb:notification-cleared"));
  }

  // recurring notifications while tab open
  function startRecurring(intervalMinutes = 60) {
    stopRecurring();
    const title = "EnergyBuddy — recurring reminder";
    const body = "Time to hydrate or take a short break.";

    // show one immediately if permission granted
    if (Notification.permission === "granted") {
      showNotification(title, body);
    }

    recurringIntervalId = setInterval(() => {
      showNotification(title, body);
    }, Math.max(1000, intervalMinutes * 60 * 1000));

    localStorage.setItem(REMINDERS_ENABLED_KEY, "true");
    window.dispatchEvent(new CustomEvent("eb:recurring-started", { detail: { intervalMinutes } }));
  }

  function stopRecurring() {
    if (recurringIntervalId) {
      clearInterval(recurringIntervalId);
      recurringIntervalId = null;
    }
    localStorage.setItem(REMINDERS_ENABLED_KEY, "false");
    window.dispatchEvent(new CustomEvent("eb:recurring-stopped"));
  }

  // auto resume if user enabled recurring or pending stored
  function autoResume() {
    try {
      const enabled = localStorage.getItem(REMINDERS_ENABLED_KEY);
      if (enabled === "true") {
        if (Notification.permission === "granted") {
          startRecurring(60);
        }
      }
      // reschedule one-time ones too
      reschedulePending();
    } catch (e) {
      console.warn("autoResume error", e);
    }
  }

  // expose API
  window.ebNotification = {
    ensurePermission,
    showNotification,
    scheduleOnce,
    cancel,
    clearAll,
    reschedulePending,
    startRecurring,
    stopRecurring,
    autoResume
  };

  // run reschedule on load
  try { reschedulePending(); } catch (e) { /* ignore */ }
})();
