// common.js
// Energy compute flow + reminder on/off handlers.
// Save as frontend/common.js

// ---------- Energy form handling ----------
document.addEventListener("DOMContentLoaded", () => {
  // if page has energy form (dashboard)
  const form = document.getElementById("energyForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // collect numeric answers safely
      const data = Object.fromEntries(new FormData(form).entries());
      const safeNum = (k, def=0) => {
        const v = Number(data[k]);
        return Number.isFinite(v) ? v : def;
      };

      // simple scoring formula (you can replace with your preferred)
      const score =
        safeNum("sleep", 0) * 2 +
        safeNum("water", 0) * 2 +
        (safeNum("steps", 0) / 1000) * 3 +
        safeNum("diet", 0) * 2 +
        (6 - safeNum("stress", 1)) * 3 +
        Math.max(0, (5 - safeNum("screen", 0))) * 1 +
        safeNum("exercise", 0) / 10 +
        Math.max(0, (5 - safeNum("caffeine", 0))) * 1 +
        Math.max(0, (5 - safeNum("junk", 0))) * 1 +
        safeNum("mood", 0) * 2;

      // normalize/clamp a little and store
      const finalScore = Math.round(Math.max(0, Math.min(100, score)));
      localStorage.setItem("energyScore", String(finalScore));

      // minimal status + suggestions (card-ready)
      let status = "";
      let suggestions = [];
      if (finalScore < 30) {
        status = "Low Energy";
        suggestions = [
          "Drink a full glass of water",
          "Take a short 10-minute walk",
          "Take a 15-20 minute power nap",
        ];
      } else if (finalScore < 65) {
        status = "Moderate Energy";
        suggestions = [
          "Keep hydrated — sip water regularly",
          "Take 5-minute breaks every hour",
          "Do light stretching",
        ];
      } else {
        status = "High Energy";
        suggestions = [
          "Great job — keep your routine",
          "Consider a brief stretch to maintain energy",
        ];
      }

      localStorage.setItem("energyStatus", status);
      localStorage.setItem("energySuggestions", JSON.stringify(suggestions));

      // open suggestions page (new tab if possible)
      const newTab = window.open("suggestions.html", "_blank");
      if (!newTab) window.location.href = "suggestions.html";
      else newTab.focus();
    });
  }

  // if on suggestions page, populate the card UI
  if (window.location.pathname.endsWith("suggestions.html") || window.location.pathname.endsWith("/suggestions.html")) {
    populateSuggestionsPage();
  }

  // on every page load, auto-resume notification loop if user previously enabled reminders
  try {
    // notification.js exposes ebNotification object (see notification.js) and will handle reschedule
    if (window.ebNotification && typeof window.ebNotification.autoResume === "function") {
      window.ebNotification.autoResume();
    }
  } catch (e) {
    console.warn("Notification autoResume failed:", e);
  }
}); // DOMContentLoaded

// Populate suggestions.html cards
function populateSuggestionsPage() {
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("suggestionsList");

  if (scoreEl) scoreEl.innerText = localStorage.getItem("energyScore") || "N/A";
  if (statusEl) statusEl.innerText = localStorage.getItem("energyStatus") || "";

  if (listEl) {
    listEl.innerHTML = "";
    const suggestionsRaw = localStorage.getItem("energySuggestions");
    let suggestions = [];
    try { suggestions = suggestionsRaw ? JSON.parse(suggestionsRaw) : []; } catch (e) { suggestions = []; }
    if (!suggestions.length) {
      const li = document.createElement("li");
      li.innerText = "No suggestions available.";
      listEl.appendChild(li);
    } else {
      suggestions.forEach(s => {
        const li = document.createElement("li");
        li.innerText = s;
        listEl.appendChild(li);
      });
    }
  }

  // Attach handlers for Remind / Ignore buttons (if they exist)
  const remindBtn = document.querySelector("#remindBtn");
  const ignoreBtn = document.querySelector("#ignoreBtn");
  if (remindBtn) {
    remindBtn.addEventListener("click", async () => {
      // ask minutes
      const minutesStr = prompt("When should we remind you? Enter minutes from now (e.g. 60 for 1 hour)", "60");
      const minutes = Number(minutesStr);
      if (!minutes || minutes <= 0) { alert("Cancelled or invalid minutes"); return; }

      // request permission and schedule
      if (window.ebNotification && typeof window.ebNotification.ensurePermission === "function") {
        const perm = await window.ebNotification.ensurePermission(); // triggers browser permission prompt if needed
        if (perm === "denied") {
          alert("Notifications blocked in your browser. Reminders will not appear as system notifications.");
        }
      }

      // schedule single notification and also enable recurring reminders for this device
      const title = "EnergyBuddy Reminder";
      const body = "Time to follow your suggestion.";
      if (window.ebNotification && typeof window.ebNotification.scheduleOnce === "function") {
        window.ebNotification.scheduleOnce(title, body, minutes);
        alert("One-time reminder scheduled. You can also enable recurring reminders below.");
      } else {
        alert("Notification service not available.");
      }
    });
  }

  if (ignoreBtn) {
    ignoreBtn.addEventListener("click", () => {
      // turn off recurring reminders
      if (window.ebNotification && typeof window.ebNotification.stopRecurring === "function") {
        window.ebNotification.stopRecurring();
      }
      localStorage.setItem("eb_reminders_enabled", "false");
      alert("Reminders disabled. You can enable them later from dashboard.");
    });
  }

  // UI element for enabling recurring reminders (if present)
  const enableRecurringBtn = document.querySelector("#enableRecurringBtn");
  if (enableRecurringBtn) {
    enableRecurringBtn.addEventListener("click", async () => {
      if (window.ebNotification && typeof window.ebNotification.ensurePermission === "function") {
        const perm = await window.ebNotification.ensurePermission();
        if (perm !== "granted") {
          alert("Notifications not granted — cannot enable recurring reminders.");
          return;
        }
      }
      // start recurring (1 hour)
      if (window.ebNotification && typeof window.ebNotification.startRecurring === "function") {
        window.ebNotification.startRecurring(60); // 60 minutes interval
        localStorage.setItem("eb_reminders_enabled", "true");
        alert("Recurring reminders enabled (every 1 hour). Keep at least one tab open for them to fire.");
      }
    });
  }

  // optionally show current recurring status
  const status = localStorage.getItem("eb_reminders_enabled");
  const recurringStatusEl = document.getElementById("recurringStatus");
  if (recurringStatusEl) {
    recurringStatusEl.innerText = (status === "true") ? "Recurring reminders: ON" : "Recurring reminders: OFF";
  }
}

// small helper to go back to dashboard
function goDashboard() {
  window.location.href = "dashboard.html";
}

// export few helpers to window.ebCommon (if needed)
window.ebCommon = window.ebCommon || {};
Object.assign(window.ebCommon, {
  populateSuggestionsPage,
  goDashboard
});
// =======================
// Notification Module
// =======================
const ebNotification = {
    ensurePermission: async function() {
        if (!('Notification' in window)) {
            alert("This browser does not support notifications.");
            return 'unsupported';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }
        
        const permission = await Notification.requestPermission();
        return permission;
    },

    show: function(message) {
        new Notification("Energy Buddy Reminder", { body: message });
    },

    startRecurring: function(minutes) {
        setInterval(() => {
            this.show("Time to check your energy habits and stay mindful!");
        }, minutes * 60 * 1000);
    }
};
