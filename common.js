// CuraSight shared script: login check, top navigation, language switch, and medicine reminders (runs on every page).
(function () {
  const root = document.documentElement;
  root.classList.add("auth-pending");
  let lang = "en"; try { lang = localStorage.getItem("cs-lang") || "en"; } catch (e) {}
  root.lang = lang;
  const N = {
    en: { home: "Home", ph: "Pharmacies", sc: "Schedule", hi: "History", sv: "Savings", out: "Log out", take: "Time to take {m}" },
    hi: { home: "होम", ph: "फार्मेसी", sc: "शेड्यूल", hi: "हिस्ट्री", sv: "बचत", out: "लॉग आउट", take: "{m} लेने का समय" },
  };
  const subs = [];
  const CS = (window.CS = {
    get lang() { return lang; }, user: null, onLang: (f) => subs.push(f),
    setLang(l) { lang = l; try { localStorage.setItem("cs-lang", l); } catch (e) {} root.lang = l; nav(); subs.forEach((f) => f(l)); },
  });
  const never = () => new Promise(() => {});
  const toLogin = () => { location.replace("/auth.html"); return never(); };
  // every page waits for this: not logged in -> straight to the login page
  CS.userP = fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json()).then((x) => {
    if (!x.authenticated) return toLogin();
    CS.user = window.CS_USER = x.user; root.classList.remove("auth-pending");
    const c = document.getElementById("userChip"); if (c) c.textContent = x.user.name || x.user.email || "";
    return x.user;
  }).catch(toLogin);

  function nav() {
    const el = document.getElementById("nav"); if (!el) return;
    const page = document.body.dataset.page, s = N[lang];
    const links = [["home", "/"], ["ph", "/pharmacies.html"], ["sc", "/schedule.html"], ["hi", "/history.html"], ["sv", "/savings.html"]];
    el.className = "nav";
    el.innerHTML = `<a href="/"><img class="logo" src="logo.png" alt="CuraSight"></a><nav>${links.map(([k, u]) => `<a href="${u}"${k === page ? ' class="on" aria-current="page"' : ""}>${s[k]}</a>`).join("")}</nav>` +
      `<div class="navr"><a class="badge" id="userChip" href="/account.html" style="margin:0;text-decoration:none">${CS.user ? (CS.user.name || CS.user.email || "").replace(/[&<>"]/g, "") : ""}</a><button id="logoutBtn">${s.out}</button>` +
      `<div class="lang"><button data-l="en" aria-pressed="${lang === "en"}">English</button><button data-l="hi" aria-pressed="${lang === "hi"}">हिन्दी</button></div></div>`;
    el.querySelector(".lang").onclick = (e) => { const b = e.target.closest("button"); if (b) CS.setLang(b.dataset.l); };
    document.getElementById("logoutBtn").onclick = async () => {
      try { await fetch("/api/logout", { method: "POST", credentials: "same-origin" }); } finally { try { localStorage.removeItem("cs-sch"); } catch (e) {} location.replace("/auth.html?mode=login"); }
    };
  }
  document.addEventListener("DOMContentLoaded", nav);

  // reminders on this device: checked every 15 s while any CuraSight page is open (the schedule is saved by the Schedule page)
  let lastMin = "";
  const pad = (n) => String(n).padStart(2, "0"), iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  setInterval(() => {
    try {
      const SC = JSON.parse(localStorage.getItem("cs-sch") || "null");
      if (!SC || !SC.notify || !("Notification" in window) || Notification.permission !== "granted") return;
      if (SC.user && CS.user && SC.user !== CS.user.email) { localStorage.removeItem("cs-sch"); return; }
      const now = new Date(), hm = pad(now.getHours()) + ":" + pad(now.getMinutes()); if (hm === lastMin) return; lastMin = hm;
      const dayN = Math.floor((new Date(iso(now) + "T00:00") - new Date(SC.start + "T00:00")) / 864e5);
      SC.rows.forEach((r) => { if (r.per && dayN >= 0 && dayN < r.days && r.times.includes(hm)) new Notification("CuraSight", { body: N[lang].take.replace("{m}", r.name), tag: r.name + hm }); });
    } catch (e) {}
  }, 15000);
})();
