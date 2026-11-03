import { createStore, uuid, LIMITS } from "./store.js";

/* ============================================================ helpers */
const $app = document.getElementById("app");
const $layer = document.getElementById("layer");

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list" && k !== "type" || k === "value") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const svg = d => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.innerHTML = d; return s; };
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  download: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', install: '<path d="M12 3v12M7 10l5 5 5-5"/><rect x="3" y="17" width="18" height="4" rx="1"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', clip: '<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', chev: '<path d="m6 9 6 6 6-6"/>'
};
const icon = n => svg(I[n]);
let toastT;
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
const ago = iso => {
  if (!iso) return ""; const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 50) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.round(s / 86400) + " d ago";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const fmtDate = iso => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function autogrow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
function linkify(text) {
  const frag = document.createDocumentFragment();
  String(text || "").split(/(https?:\/\/[^\s]+)/g).forEach((part, i) => {
    frag.append(i % 2 ? h("a", { href: part, target: "_blank", rel: "noopener noreferrer" }, part) : document.createTextNode(part));
  });
  return frag;
}

/* ============================================================ content model */
const COLORS = ["#7b3ff2", "#ff5a1f", "#ff3e9a", "#1f6bff", "#00b86b", "#00a7a7", "#e0a800", "#141318"];
const EMOJIS = "📝 📋 🎉 💼 🚀 💬 ⭐ 🛒 🎟️ 📅 🍕 ❤️ 🏆 🎨 🎵 📚 💡 🧾 🏠 🧑‍💻 🤝 📣 ✈️ 🌱 ⚽ 🧪 💰 📦 🔔 ✅".split(" ");
const TYPES = {
  heading: { name: "Heading", ic: "H", c: "#141318", content: true },
  text: { name: "Text", ic: "¶", c: "#6c6977", content: true },
  divider: { name: "Divider", ic: "—", c: "#9a97a6", content: true },
  image: { name: "Image", ic: "▣", c: "#ff3e9a", content: true },
  short: { name: "Short answer", ic: "Aa", c: "#7b3ff2" },
  long: { name: "Paragraph", ic: "≡", c: "#7b3ff2" },
  email: { name: "Email", ic: "@", c: "#1f6bff" },
  phone: { name: "Phone", ic: "☎", c: "#1f6bff" },
  number: { name: "Number", ic: "#", c: "#1f6bff" },
  date: { name: "Date", ic: "31", c: "#00a7a7" },
  choice: { name: "Multiple choice", ic: "◉", c: "#ff5a1f", options: true },
  checkbox: { name: "Checkboxes", ic: "☑", c: "#ff5a1f", options: true },
  dropdown: { name: "Dropdown", ic: "▾", c: "#ff5a1f", options: true },
  rating: { name: "Rating", ic: "★", c: "#e0a800" },
  yesno: { name: "Yes / No", ic: "✓", c: "#00b86b" },
  file: { name: "File upload", ic: "⇪", c: "#141318" }
};
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
async function openFile(f) {
  try { const url = await store.fileUrl(f.path); const a = h("a", { href: url, download: f.name, target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove(); }
  catch (e) { toast(e.message); }
}
function fileChip(f) { return h("button", { class: "file-chip", onclick: () => openFile(f), title: "Download " + f.name }, icon("clip"), h("span", null, f.name), h("small", null, fmtSize(f.size || 0))); }
function pickFile(accept, onFile) { const i = h("input", { type: "file", accept }); i.onchange = () => { if (i.files[0]) onFile(i.files[0]); }; i.click(); }
const isQuestion = b => !TYPES[b.type]?.content;
const Q = (type, label, extra = {}) => ({ id: uuid(), type, label, help: "", required: false, ...(TYPES[type].options ? { options: ["Option 1", "Option 2"] } : {}), ...extra });
const C = (type, text = "") => ({ id: uuid(), type, text });

const TEMPLATES = {
  blank: { name: "Blank page", emoji: "📝", color: COLORS[0], title: "", description: "", blocks: () => [Q("short", "Your name", { required: true })] },
  contact: { name: "Contact form", emoji: "💬", color: COLORS[3], title: "Get in touch", description: "Send us a message and we'll reply within one working day.",
    blocks: () => [Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number"), Q("long", "How can we help?", { required: true })] },
  job: { name: "Job application", emoji: "💼", color: COLORS[1], title: "Join our team", description: "Tell us about yourself. It takes about 5 minutes.",
    blocks: () => [C("heading", "About you"), Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number", { required: true }),
      C("heading", "The role"), Q("dropdown", "Which role are you applying for?", { required: true, options: ["Sales", "Design", "Engineering", "Operations"] }),
      Q("choice", "Years of experience", { options: ["Less than 1", "1–3", "3–5", "5+"] }), Q("short", "Link to your CV or portfolio", { help: "Google Drive, LinkedIn or your website" }),
      Q("long", "Why do you want to work with us?"), Q("date", "Earliest start date")] },
  event: { name: "Event sign-up", emoji: "🎟️", color: COLORS[2], title: "Save your seat", description: "Register below and we'll send the details to your inbox.",
    blocks: () => [Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("number", "How many people are coming?", { help: "Including you" }),
      Q("checkbox", "Which sessions will you attend?", { options: ["Morning talks", "Lunch", "Workshops", "Evening party"] }), Q("yesno", "Any dietary needs?"), Q("long", "Anything else we should know?")] },
  feedback: { name: "Feedback survey", emoji: "⭐", color: COLORS[4], title: "How did we do?", description: "Two minutes of your time helps us get better.",
    blocks: () => [Q("rating", "How would you rate your experience?", { required: true }), Q("choice", "How did you hear about us?", { options: ["Friend", "Instagram", "Google", "Other"] }),
      Q("long", "What did you love?"), Q("long", "What should we improve?"), Q("yesno", "Would you recommend us?")] },
  order: { name: "Order form", emoji: "🛒", color: COLORS[5], title: "Place an order", description: "Choose what you'd like and we'll confirm by phone.",
    blocks: () => [Q("short", "Full name", { required: true }), Q("phone", "Phone number", { required: true }), Q("checkbox", "What would you like?", { required: true, options: ["Item A", "Item B", "Item C"] }),
      Q("number", "Quantity"), Q("choice", "Delivery or pick-up?", { options: ["Delivery", "Pick-up"] }), Q("long", "Delivery address")] }
};

/* ============================================================ app state */
let store, user = null, installEvt = null;
const go = hash => { if (location.hash === "#" + hash) route(); else location.hash = hash; };

function shell(color, barRight, ...content) {
  return [
    store.mode === "demo" ? h("div", { class: "demo-bar" }, h("b", null, "Demo mode"), " · Pages and answers stay on this device until the app goes live.") : null,
    h("header", { class: "band on-color", style: { background: color } }, h("div", { class: "wrap" }, ...content.slice(0, 1).flat(), )),
    ...content.slice(1)
  ];
}
function topBar(left, right) { return h("div", { class: "bar" }, left, h("div", { class: "spacer" }), right); }
function logo() { return h("button", { class: "logo", onclick: () => go("home"), "aria-label": "Blocko home" }, h("span", { class: "mk" }, h("i"), h("i"), h("i"), h("i")), "Blocko"); }
function mount(...nodes) { $app.replaceChildren(...nodes.flat(9).filter(Boolean)); window.scrollTo(0, 0); }

/* ============================================================ sheets */
function sheet(build) {
  const close = () => { scrim.remove(); document.removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") close(); };
  const box = h("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  const scrim = h("div", { class: "scrim", onmousedown: e => { if (e.target === scrim) close(); } }, box);
  build(box, close);
  $layer.append(scrim); document.addEventListener("keydown", esc);
  setTimeout(() => { const f = box.querySelector("input,textarea,button.brand,button.dark"); if (f) f.focus(); }, 40);
  return close;
}
function confirmSheet(title, text, okLabel, onOk) {
  sheet((b, close) => b.append(h("h2", null, title), h("p", { class: "muted", style: { margin: 0 } }, text),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: close }, "Cancel"), h("button", { class: "btn danger", onclick: async () => { close(); await onOk(); } }, okLabel))));
}
function emojiSheet(onPick) {
  sheet((b, close) => b.append(h("h2", null, "Pick an icon"),
    h("div", { class: "emoji-grid" }, EMOJIS.map(e => h("button", { onclick: () => { onPick(e); close(); } }, e)))));
}
function shareUrl(id) { return location.origin + location.pathname + "#f-" + id; }
async function shareSheet(page, onChange) {
  sheet((b, close) => {
    const link = h("input", { class: "input", readOnly: true, value: shareUrl(page.id), "aria-label": "Form link" });
    const pub = h("input", { type: "checkbox", checked: page.published });
    const acc = h("input", { type: "checkbox", checked: page.accepting });
    const qrBox = h("div", { class: "qr" });
    const drawQr = () => {
      qrBox.replaceChildren();
      if (!window.qrcode) { qrBox.hidden = true; return; }
      const q = window.qrcode(0, "M"); q.addData(shareUrl(page.id)); q.make();
      const n = q.getModuleCount(), s = 4, pad = 4, cv = h("canvas", { width: (n + pad * 2) * s, height: (n + pad * 2) * s });
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#141318";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + pad) * s, (r + pad) * s, s, s);
      qrBox.append(cv, h("div", null, h("b", null, "Scan to open"), h("div", { class: "muted", style: { fontSize: "14px" } }, "Print it on posters, flyers or a counter card. Right-click or long-press to save the image.")));
    };
    loadQr().then(drawQr);
    const sync = async () => {
      page.published = pub.checked; page.accepting = acc.checked;
      await onChange(page);
      note.textContent = page.published ? (page.accepting ? "Live. Anyone with the link can fill it in." : "Live, but closed to new answers.") : "Draft. Only you can see it.";
    };
    pub.onchange = sync; acc.onchange = sync;
    const note = h("div", { class: "muted", style: { fontSize: "14px" } }, page.published ? (page.accepting ? "Live. Anyone with the link can fill it in." : "Live, but closed to new answers.") : "Draft. Only you can see it.");
    b.append(
      h("h2", null, "Share"),
      h("div", { style: { display: "grid", gap: "12px" } },
        h("label", { class: "switch" }, pub, "Publish this page"),
        h("label", { class: "switch" }, acc, "Accept new responses"), note),
      h("div", { class: "share-link" }, link, h("button", { class: "btn dark small", onclick: async () => {
        try { await navigator.clipboard.writeText(link.value); toast("Link copied"); } catch (e) { link.select(); toast("Press Ctrl+C to copy"); }
      } }, icon("copy"), "Copy")),
      store.mode === "demo" ? h("div", { class: "muted", style: { fontSize: "14px" } }, "In demo mode this link only works on this device. Once the app is online, it works for anyone.") : null,
      qrBox,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { close(); go("f-" + page.id); } }, icon("eye"), "Open form"), h("button", { class: "btn brand", onclick: close }, "Done"))
    );
  });
}
let qrPromise;
function loadQr() {
  if (window.qrcode) return Promise.resolve();
  return qrPromise ||= new Promise(res => {
    const s = h("script", { src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" });
    s.onload = res; s.onerror = res; document.head.append(s);
  });
}

/* ============================================================ login */
function viewLogin() {
  let mode = "in";
  const email = h("input", { class: "input", type: "email", autocomplete: "email", required: true, id: "em" });
  const pw = h("input", { class: "input", type: "password", autocomplete: "current-password", required: true, minLength: 6, id: "pw" });
  const msg = h("div");
  const title = h("h2", null, "Welcome back");
  const sub = h("p", { class: "muted", style: { margin: 0 } }, "Sign in to see your pages and responses.");
  const btn = h("button", { class: "btn brand", type: "submit", style: { height: "54px" } }, "Sign in");
  const swap = h("button", { type: "button", class: "btn ghost" }, "New here? Create an account");
  swap.onclick = () => {
    mode = mode === "in" ? "up" : "in";
    title.textContent = mode === "in" ? "Welcome back" : "Create your account";
    sub.textContent = mode === "in" ? "Sign in to see your pages and responses." : "Free for individuals and teams. Takes a few seconds.";
    btn.textContent = mode === "in" ? "Sign in" : "Create account";
    swap.textContent = mode === "in" ? "New here? Create an account" : "Have an account? Sign in";
    pw.autocomplete = mode === "in" ? "current-password" : "new-password"; msg.replaceChildren();
  };
  const form = h("form", { onsubmit: async e => {
    e.preventDefault(); btn.disabled = true; msg.replaceChildren();
    try {
      if (mode === "in") { await store.signIn(email.value.trim(), pw.value); }
      else {
        const r = await store.signUp(email.value.trim(), pw.value);
        if (r.needsConfirm) { msg.replaceChildren(h("div", { class: "ok-box" }, "Check your inbox and click the link to confirm your email, then sign in.")); swap.click(); }
      }
    } catch (err) { msg.replaceChildren(h("div", { class: "err-box" }, err.message)); }
    btn.disabled = false;
  } }, title, sub, msg, h("label", { class: "field", for: "em" }, "Email", email), h("label", { class: "field", for: "pw" }, "Password", pw), btn, swap);
  const shapes = h("div", { class: "shapes" },
    h("i", { style: { width: "180px", height: "180px", background: "var(--c-orange)", right: "-30px", top: "60px", transform: "rotate(14deg)" } }),
    h("i", { style: { width: "120px", height: "120px", background: "var(--c-yellow)", right: "140px", bottom: "40px", transform: "rotate(-10deg)" } }),
    h("i", { style: { width: "90px", height: "90px", background: "var(--c-pink)", left: "40%", top: "38%", borderRadius: "50%" } }));
  mount(h("div", { class: "login" },
    h("div", { class: "login-art" }, shapes, h("div", { class: "logo", style: { position: "relative" } }, h("span", { class: "mk" }, h("i"), h("i"), h("i"), h("i")), "Blocko"),
      h("h1", null, "Pages that tell. Forms that collect.")),
    h("div", { class: "login-form" }, form)));
}

/* ============================================================ home */
async function viewHome() {
  const pages = await store.listPages();
  const right = h("div", { style: { display: "flex", gap: "4px" } },
    installEvt ? h("button", { class: "btn small light", onclick: doInstall }, icon("install"), h("span", { class: "hide-sm" }, "Install app")) : null,
    h("button", { class: "ws-btn", onclick: workspaceSheet, "aria-label": "Switch workspace" }, h("span", { class: "ws-dot" }, (store.ws ? store.ws.name : "W").trim().charAt(0).toUpperCase()), h("span", { class: "hide-sm" }, store.ws ? store.ws.name : ""), icon("chev")),
    h("button", { class: "icon-btn", "aria-label": "Team", title: "Team", onclick: teamSheet }, icon("team")),
    store.mode === "cloud" ? h("button", { class: "icon-btn", "aria-label": "Account", onclick: accountSheet }, icon("user")) : null);
  const total = pages.reduce((a, p) => a + (p.response_count || 0), 0);
  const greeting = (() => { const hr = new Date().getHours(); return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; })();
  const tplBtns = Object.entries(TEMPLATES).map(([k, t], i) => h("button", { class: "tpl" + (i === 0 ? " primary" : ""), onclick: () => newPage(k) }, h("span", { class: "e" }, i === 0 ? icon("plus") : t.emoji), t.name));
  const cards = pages.length ? pages.map(p => {
    const st = !p.published ? ["draft", "Draft"] : p.accepting ? ["live", "Live"] : ["closed", "Closed"];
    return h("div", { class: "card" },
      h("button", { class: "card-top", style: { background: p.color, textAlign: "left" }, onclick: () => go("p-" + p.id) },
        h("span", { class: "e" }, p.emoji || "📝"), h("h3", null, p.title || "Untitled page")),
      h("div", { class: "card-bot" },
        h("button", { onclick: () => go("r-" + p.id), style: { display: "flex", alignItems: "baseline", gap: "6px" }, "aria-label": "See responses" }, h("b", null, p.response_count || 0), h("span", { class: "muted" }, (p.response_count === 1 ? "response" : "responses"))),
        h("div", { class: "spacer" }), h("span", { class: "pill " + st[0] }, st[1])),
      h("button", { class: "icon-btn card-menu", "aria-label": "Page options", onclick: () => cardMenu(p) }, icon("more")));
  }) : [h("div", { class: "empty" }, h("h3", null, "Make your first page"), h("p", { class: "muted" }, "Pick a starting point above. You can change everything later."))];
  mount(shell("var(--brand)", null,
    [topBar(logo(), right), h("h1", null, greeting + "."), h("p", null, pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"} · ${total} response${total === 1 ? "" : "s"} collected` : "Make pages that tell and forms that collect."), h("div", { class: "new-row" }, tplBtns)],
    h("main", { class: "wrap" }, h("div", { class: "grid" }, cards))));
}
function cardMenu(p) {
  sheet((b, close) => b.append(h("h2", null, p.title || "Untitled page"), h("div", { class: "menu" },
    h("button", { onclick: () => { close(); go("p-" + p.id); } }, "✏️  Edit page"),
    h("button", { onclick: () => { close(); go("r-" + p.id); } }, "📊  See responses"),
    h("button", { onclick: async () => { close(); const full = await store.getPage(p.id); shareSheet(full, pg => store.savePage(pg).then(() => route())); } }, "🔗  Share"),
    h("button", { onclick: async () => { close(); const full = await store.getPage(p.id); const copy = { ...full, id: uuid(), title: (full.title || "Untitled") + " (copy)", published: false, created_at: null, blocks: full.blocks.map(x => ({ ...x, id: uuid() })) }; await store.savePage(copy); toast("Page duplicated"); route(); } }, "📄  Duplicate"),
    h("button", { class: "danger", onclick: () => { close(); confirmSheet("Delete this page?", "The page and all its responses are removed for good.", "Delete", async () => { await store.deletePage(p.id); toast("Page deleted"); route(); }); } }, "🗑️  Delete"))));
}
function workspaceSheet() {
  sheet((b, close) => {
    const list = h("div", { class: "menu" }, store.workspaces.map(w => h("button", { onclick: async () => { close(); await store.switchWorkspace(w.id); route(); } },
      h("span", { class: "ws-dot dark" }, w.name.trim().charAt(0).toUpperCase()), w.name, w.id === (store.ws && store.ws.id) ? h("span", { class: "muted", style: { marginLeft: "auto" } }, "Current") : null)));
    const name = h("input", { class: "input", placeholder: "e.g. Acme Ltd or Marketing team", maxLength: 50, id: "nws" });
    b.append(h("h2", null, "Workspaces"),
      h("p", { class: "muted", style: { margin: 0 } }, "A workspace holds pages and the people who can edit them. Use one for yourself and one for each company or team."),
      list,
      h("form", { style: { display: "grid", gap: "10px" }, onsubmit: async e => {
        e.preventDefault(); if (!name.value.trim()) return;
        try { await store.createWorkspace(name.value.trim()); close(); toast("Workspace created"); route(); } catch (err) { toast(err.message); }
      } }, h("label", { class: "field", for: "nws" }, "Create a new workspace", name), h("button", { class: "btn dark", type: "submit" }, icon("plus"), "Create workspace")));
  });
}
function teamSheet() {
  sheet(async (b, close) => {
    const owner = store.role === "owner";
    const body = h("div", { style: { display: "grid", gap: "16px" } }, h("div", { class: "muted" }, "Loading team…"));
    b.append(h("h2", null, "Team"), body);
    const draw = async () => {
      let members = [], invites = [];
      try { [members, invites] = await Promise.all([store.listMembers(), store.listInvites()]); } catch (e) { body.replaceChildren(h("div", { class: "err-box" }, e.message)); return; }
      const wsName = h("input", { class: "input", value: store.ws ? store.ws.name : "", maxLength: 50, disabled: !owner, id: "wsn", onchange: async e => {
        try { await store.renameWorkspace(e.target.value.trim() || "My workspace"); toast("Workspace renamed"); } catch (err) { toast(err.message); }
      } });
      const email = h("input", { class: "input", type: "email", placeholder: "teammate@company.com", id: "inv", required: true });
      const role = h("select", { class: "select", "aria-label": "Role" }, h("option", { value: "editor" }, "Editor: makes pages and sees responses"), h("option", { value: "owner" }, "Owner: also manages the team"));
      body.replaceChildren(
        h("label", { class: "field", for: "wsn" }, "Workspace name", wsName),
        h("div", { class: "field" }, "People", h("div", { class: "people" }, members.map(m => h("div", { class: "person" },
          h("span", { class: "ws-dot dark" }, (m.email || "?").charAt(0).toUpperCase()),
          h("div", { style: { minWidth: 0, flex: 1 } }, h("div", { class: "pe" }, m.email || "Teammate"), h("small", { class: "muted" }, m.role === "owner" ? "Owner" : "Editor")),
          owner && store.user && m.user_id !== store.user.id ? h("button", { class: "btn small", onclick: () => confirmSheet("Remove " + (m.email || "this person") + "?", "They lose access to this workspace's pages and responses.", "Remove", async () => { await store.removeMember(m.user_id); toast("Removed"); draw(); }) }, "Remove") : null)))),
        invites.length ? h("div", { class: "field" }, "Invited (waiting to sign up or sign in)", h("div", { class: "people" }, invites.map(i => h("div", { class: "person" },
          h("span", { class: "ws-dot" }, "✉"), h("div", { style: { minWidth: 0, flex: 1 } }, h("div", { class: "pe" }, i.email), h("small", { class: "muted" }, i.role === "owner" ? "Owner" : "Editor")),
          owner ? h("button", { class: "btn small", onclick: async () => { await store.cancelInvite(i.id); draw(); } }, "Cancel") : null)))) : null,
        owner ? h("form", { style: { display: "grid", gap: "10px" }, onsubmit: async e => {
          e.preventDefault(); const v = email.value.trim(); if (!v) return;
          try { await store.invite(v, role.value); toast("Invite saved"); draw(); } catch (err) { toast(err.message); }
        } }, h("label", { class: "field", for: "inv" }, "Invite someone", email), role, h("button", { class: "btn brand", type: "submit" }, icon("plus"), "Add to team"),
          h("div", { class: "muted", style: { fontSize: "14px" } }, store.mode === "demo"
            ? "Teams work once the app is online. In demo mode invites are only saved, not sent."
            : "Send them your app link. When they sign up or sign in with this email, they join this workspace automatically.")) : h("div", { class: "muted" }, "Only owners can invite people."),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: close }, "Done")));
    };
    draw();
  });
}
function accountSheet() {
  sheet((b, close) => b.append(h("h2", null, "Your account"), h("p", { class: "muted", style: { margin: 0 } }, user ? user.email : ""),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: close }, "Close"), h("button", { class: "btn dark", onclick: async () => { close(); await store.signOut(); } }, "Sign out"))));
}
async function newPage(key) {
  const t = TEMPLATES[key];
  const p = await store.savePage({ id: uuid(), title: t.title, description: t.description, emoji: t.emoji, color: t.color, blocks: t.blocks(), published: false, accepting: true, thank_you: "" });
  go("p-" + p.id);
}

/* ============================================================ editor */
async function viewEditor(id) {
  let page = await store.getPage(id);
  if (!page) { toast("That page doesn't exist anymore"); return go("home"); }
  let sel = null, saveT = null, responses = null;
  store.listResponses(id).then(r => { responses = r; countEl.textContent = r.length; }).catch(() => {});
  const state = h("span", { class: "save-state" }, "Saved");
  const save = (now) => {
    state.textContent = "Saving…"; clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try { page = { ...page, ...(await store.savePage(page)) }; state.textContent = "Saved"; }
      catch (e) { state.textContent = "Not saved"; toast(e.message); }
    }, now ? 0 : 700);
  };
  const band = h("header", { class: "band on-color", style: { background: page.color } });
  const countEl = h("span", { class: "count" }, "…");
  const title = h("textarea", { class: "title-input", rows: 1, placeholder: "Untitled page", value: page.title, "aria-label": "Page title", oninput: e => { page.title = e.target.value; autogrow(e.target); save(); } });
  const desc = h("textarea", { class: "desc-input", rows: 1, placeholder: "Add a short description", value: page.description || "", "aria-label": "Description", oninput: e => { page.description = e.target.value; autogrow(e.target); save(); } });
  const emojiBtn = h("button", { class: "emoji-btn", "aria-label": "Change icon", onclick: () => emojiSheet(e => { page.emoji = e; emojiBtn.textContent = e; save(); }) }, page.emoji || "📝");
  band.append(h("div", { class: "wrap" },
    topBar(h("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, h("button", { class: "icon-btn", "aria-label": "Back to home", onclick: () => go("home") }, icon("back")), logo()),
      h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, state,
        h("button", { class: "icon-btn", "aria-label": "Preview", title: "Preview", onclick: () => go("v-" + page.id) }, icon("eye")),
        h("button", { class: "btn small light", onclick: () => shareSheet(page, pg => { page = pg; return store.savePage(pg); }) }, icon("share"), "Share"))),
    emojiBtn, title, desc,
    h("div", { class: "tabs" }, h("button", { class: "on" }, "Build"), h("button", { onclick: () => go("r-" + page.id) }, "Responses", countEl))));

  const list = h("div", { class: "blocks" });
  const render = () => {
    list.replaceChildren(addLine(0));
    page.blocks.forEach((b, i) => { list.append(blockCard(b, i), addLine(i + 1)); });
    if (!page.blocks.length) list.append(h("div", { class: "empty" }, h("h3", null, "Empty page"), h("p", { class: "muted" }, "Add text, headings and questions with the button above.")));
  };
  const addLine = at => h("div", { class: "add-line" }, h("button", { class: "add-btn", onclick: () => palette(at) }, icon("plus"), at === page.blocks.length && at > 0 ? "Add block" : "Add"));
  function palette(at) {
    sheet((b, close) => {
      const grp = (label, keys) => [h("h4", null, label), h("div", { class: "pal-grid" }, keys.map(k => h("button", { class: "pal", onclick: () => {
        const nb = TYPES[k].content ? (k === "image" ? { id: uuid(), type: "image", url: "", caption: "" } : C(k, k === "heading" ? "Section title" : "")) : Q(k, "");
        page.blocks.splice(at, 0, nb); sel = nb.id; close(); render(); save();
        setTimeout(() => { const f = list.querySelector(".block.sel input, .block.sel textarea"); if (f) f.focus(); }, 30);
      } }, h("span", { class: "ic", style: { background: TYPES[k].c } }, TYPES[k].ic), TYPES[k].name)))];
      b.append(h("h2", null, "Add a block"), h("div", { class: "palette" },
        grp("Questions", ["short", "long", "choice", "checkbox", "dropdown", "rating", "yesno", "email", "phone", "number", "date", "file"]),
        grp("Content", ["heading", "text", "image", "divider"])));
    });
  }
  function blockCard(b, i) {
    const t = TYPES[b.type];
    const selected = sel === b.id;
    const card = h("div", { class: "block " + b.type + "-block" + (selected ? " sel" : ""), onclick: e => { if (!selected && !e.target.closest("button,input,textarea,select")) { sel = b.id; render(); } } });
    card.append(h("span", { class: "tag", style: { background: t.c } }, t.name));
    if (!selected) {
      if (b.type === "heading") card.append(h("h2", null, b.text || "Section title"));
      else if (b.type === "text") card.append(h("div", { class: "body" + (b.text ? "" : " muted") }, b.text || "Click to write some text"));
      else if (b.type === "divider") card.append(h("hr"));
      else if (b.type === "image") card.append(b.url ? h("figure", { class: "img-fig" }, h("img", { src: b.url, alt: b.caption || "" }), b.caption ? h("figcaption", null, b.caption) : null) : h("div", { class: "fake tall", style: { justifyContent: "center", alignItems: "center", paddingTop: 0 } }, icon("image"), " Click to add a picture"));
      else {
        card.append(h("div", { class: "q" }, b.label || h("span", { class: "muted" }, "Untitled question"), b.required ? h("span", { class: "req" }, "*") : null));
        if (b.help) card.append(h("div", { class: "help" }, b.help));
        if (t.options && b.type !== "dropdown") card.append(h("div", { class: "opts" }, (b.options || []).map(o => h("div", { class: "opt" }, h("i", { class: b.type === "checkbox" ? "sq" : "" }), o))));
        else if (b.type === "rating") card.append(h("div", { class: "fake", style: { fontSize: "22px", letterSpacing: "4px" } }, "★★★★★"));
        else if (b.type === "yesno") card.append(h("div", { class: "fake" }, "Yes  ·  No"));
        else card.append(h("div", { class: "fake" + (b.type === "long" ? " tall" : "") }, { dropdown: "Choose…", long: "Long answer", email: "name@example.com", phone: "Phone number", number: "0", date: "dd / mm / yyyy", short: "Short answer", file: "⇪  Upload a file (up to 10 MB)" }[b.type]));
      }
      return card;
    }
    // selected: editing controls
    const g = h("div", { class: "edit-grid" });
    if (b.type === "heading") g.append(h("input", { class: "input", value: b.text, placeholder: "Section title", "aria-label": "Heading text", style: { fontWeight: 800, fontSize: "22px" }, oninput: e => { b.text = e.target.value; save(); } }));
    else if (b.type === "text") { const ta = h("textarea", { class: "textarea", value: b.text, placeholder: "Write anything: instructions, details, terms. Links become clickable.", "aria-label": "Text", oninput: e => { b.text = e.target.value; save(); } }); g.append(ta); }
    else if (b.type === "divider") g.append(h("hr", { style: { border: 0, borderTop: "3px solid var(--line)", width: "100%" } }));
    else if (b.type === "image") {
      const prev = h("div");
      const drawPrev = () => prev.replaceChildren(b.url ? h("figure", { class: "img-fig" }, h("img", { src: b.url, alt: b.caption || "" })) : h("div", { class: "muted", style: { fontSize: "14px" } }, "No picture yet."));
      const urlIn = h("input", { class: "input", value: b.url && !b.url.startsWith("data:") ? b.url : "", placeholder: "…or paste an image link (https://…)", "aria-label": "Image link", style: { fontSize: "14px" },
        onchange: e => { const v = e.target.value.trim(); if (v && !/^https:\/\//i.test(v)) { toast("Image links must start with https://"); return; } b.url = v; drawPrev(); save(); } });
      const up = h("button", { class: "btn dark small", onclick: () => pickFile("image/*", async f => {
        if (!f.type.startsWith("image/")) return toast("Choose a picture file (JPG, PNG, GIF or WebP).");
        up.disabled = true; up.lastChild.textContent = "Uploading…";
        try { b.url = await store.uploadMedia(f); urlIn.value = ""; drawPrev(); save(); } catch (e) { toast(e.message); }
        up.disabled = false; up.lastChild.textContent = "Upload picture";
      }) }, icon("image"), h("span", null, "Upload picture"));
      drawPrev();
      g.append(prev, h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, up), urlIn,
        h("input", { class: "input", value: b.caption || "", placeholder: "Caption (optional)", "aria-label": "Caption", oninput: e => { b.caption = e.target.value; save(); } }));
    }
    else {
      g.append(h("input", { class: "input", value: b.label, placeholder: "Type your question", "aria-label": "Question", style: { fontWeight: 700 }, oninput: e => { b.label = e.target.value; save(); } }));
      g.append(h("input", { class: "input", value: b.help || "", placeholder: "Hint below the question (optional)", "aria-label": "Hint", style: { fontSize: "14px" }, oninput: e => { b.help = e.target.value; save(); } }));
      if (t.options) {
        const optsBox = h("div", { class: "edit-grid", style: { gap: "8px" } });
        const drawOpts = () => {
          optsBox.replaceChildren(...(b.options || []).map((o, oi) => h("div", { class: "opt-edit" },
            h("input", { class: "input", value: o, "aria-label": "Option " + (oi + 1), oninput: e => { b.options[oi] = e.target.value; save(); },
              onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); b.options.splice(oi + 1, 0, ""); drawOpts(); save(); optsBox.querySelectorAll("input")[oi + 1].focus(); } } }),
            h("button", { class: "icon-btn", "aria-label": "Remove option", onclick: () => { b.options.splice(oi, 1); drawOpts(); save(); } }, icon("x")))),
            h("button", { class: "add-btn", style: { justifySelf: "start" }, onclick: () => { (b.options ||= []).push("Option " + ((b.options.length || 0) + 1)); drawOpts(); save(); } }, icon("plus"), "Add option"));
        };
        drawOpts(); g.append(optsBox);
      }
    }
    card.append(g);
    const tools = h("div", { class: "block-tools" });
    if (isQuestion(b)) tools.append(h("label", { class: "switch" }, h("input", { type: "checkbox", checked: !!b.required, onchange: e => { b.required = e.target.checked; save(); } }), "Required"));
    tools.append(h("div", { class: "grow" }),
      h("button", { class: "icon-btn", "aria-label": "Move up", disabled: i === 0, onclick: () => { if (i > 0) { [page.blocks[i - 1], page.blocks[i]] = [page.blocks[i], page.blocks[i - 1]]; render(); save(); } } }, icon("up")),
      h("button", { class: "icon-btn", "aria-label": "Move down", disabled: i === page.blocks.length - 1, onclick: () => { if (i < page.blocks.length - 1) { [page.blocks[i + 1], page.blocks[i]] = [page.blocks[i], page.blocks[i + 1]]; render(); save(); } } }, icon("down")),
      h("button", { class: "icon-btn", "aria-label": "Duplicate", onclick: () => { const c = structuredClone(b); c.id = uuid(); page.blocks.splice(i + 1, 0, c); sel = c.id; render(); save(); } }, icon("copy")),
      h("button", { class: "icon-btn", "aria-label": "Delete block", style: { color: "var(--danger)" }, onclick: () => { page.blocks.splice(i, 1); sel = null; render(); save(); } }, icon("trash")),
      h("button", { class: "btn dark small", onclick: () => { sel = null; render(); } }, "Done"));
    card.append(tools);
    return card;
  }

  const colorRow = h("div", { class: "colors" }, COLORS.map(c => h("button", { class: c === page.color ? "on" : "", style: { background: c }, "aria-label": "Color " + c, onclick: e => {
    page.color = c; band.style.background = c; colorRow.querySelectorAll("button").forEach(x => x.classList.remove("on")); e.currentTarget.classList.add("on"); save();
  } })));
  const thanks = h("textarea", { class: "textarea", style: { minHeight: "80px" }, value: page.thank_you || "", placeholder: "Thanks! We got your answers.", oninput: e => { page.thank_you = e.target.value; save(); } });
  const side = h("aside", { class: "side-card" },
    h("h3", null, "Page settings"),
    h("div", { class: "field" }, "Color", colorRow),
    h("label", { class: "field" }, "Message after someone submits", thanks),
    alertsField(page),
    h("button", { class: "btn brand", onclick: () => shareSheet(page, pg => { page = pg; return store.savePage(pg); }) }, icon("share"), page.published ? "Share link" : "Publish & share"),
    h("button", { class: "btn", onclick: () => go("v-" + page.id) }, icon("eye"), "Preview"));

  render();
  mount(store.mode === "demo" ? h("div", { class: "demo-bar" }, h("b", null, "Demo mode"), " · Pages and answers stay on this device until the app goes live.") : null,
    band, h("main", { class: "wrap" }, h("div", { class: "edit-layout" }, list, side)));
  autogrow(title); autogrow(desc);
  addEventListener("pagehide", () => { if (state.textContent === "Saving…") save(true); }, { once: true });
}

function alertsField(page) {
  const inp = h("input", { class: "input", type: "text", inputMode: "email", placeholder: "you@company.com", id: "alerts", autocomplete: "off" });
  const note = h("small", { class: "muted", style: { fontWeight: 400 } }, store.mode === "demo" ? "Email alerts start working once the app is online." : "Separate several emails with commas.");
  store.getAlerts(page.id).then(v => { inp.value = v || ""; }).catch(() => {});
  let t;
  inp.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const list = inp.value.split(",").map(x => x.trim()).filter(Boolean);
      const bad = list.find(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      if (bad) { note.textContent = "Check this email: " + bad; return; }
      try {
        await store.setAlerts(page.id, list.join(", "));
        note.textContent = list.length ? "We'll email " + (list.length === 1 ? "this address" : "these addresses") + " for every new response." : "Email alerts are off.";
      } catch (e) { note.textContent = e.message; }
    }, 800);
  };
  return h("label", { class: "field", for: "alerts" }, h("span", { style: { display: "flex", gap: "6px", alignItems: "center" } }, icon("bell"), "Email me new responses"), inp, note);
}

/* ============================================================ public form */
async function viewForm(id, preview) {
  let page;
  try { page = preview ? await store.getPage(id) : await store.getPublicPage(id); } catch (e) { page = null; }
  document.documentElement.style.setProperty("--page", (page && page.color) || COLORS[0]);
  if (!page) {
    return mount(h("header", { class: "band", style: { background: "var(--c-ink)" } }, h("div", { class: "wrap" }, h("h1", null, "This form isn't available"), h("p", null, "It may be unpublished or the link may be wrong. Ask the person who sent it for a new link."))));
  }
  document.title = (page.title || "Form") + " · Blocko";
  const answers = {};
  const blockEls = {};
  const header = h("header", { class: "band on-color", style: { background: page.color } }, h("div", { class: "wrap", style: { maxWidth: "760px" } },
    preview ? topBar(h("button", { class: "btn small light", onclick: () => go("p-" + page.id) }, icon("back"), "Back to editing"), h("span", { class: "save-state" }, "Preview")) : null,
    h("div", { class: "emoji-btn", style: { background: "rgba(255,255,255,.18)" } }, page.emoji || "📝"),
    h("h1", null, page.title || "Untitled page"), page.description ? h("p", null, linkify(page.description)) : null));
  const closed = !preview && !page.accepting;
  const body = h("div", { class: "form-page" });
  page.blocks.forEach(b => {
    if (b.type === "heading") return body.append(h("div", { class: "fblock heading" }, h("h2", null, b.text)));
    if (b.type === "text") return body.append(h("div", { class: "fblock text" }, linkify(b.text)));
    if (b.type === "divider") return body.append(h("div", { class: "fblock divider" }, h("hr")));
    if (b.type === "image") return b.url ? body.append(h("figure", { class: "fblock img-fig" }, h("img", { src: b.url, alt: b.caption || "", loading: "lazy" }), b.caption ? h("figcaption", null, b.caption) : null)) : null;
    const fid = "q-" + b.id;
    const box = h("div", { class: "fblock" }, h("label", { class: "ql", for: fid }, b.label || "Untitled question", b.required ? h("span", { style: { color: "var(--danger)" } }, " *") : null),
      b.help ? h("div", { class: "help" }, b.help) : null);
    const ctrl = h("div", { class: "ctrl" });
    const set = v => { answers[b.id] = v; box.classList.remove("err"); const m = box.querySelector(".msg"); if (m) m.remove(); };
    switch (b.type) {
      case "short": case "email": case "phone": case "number": case "date":
        ctrl.append(h("input", { class: "input", id: fid, type: { short: "text", email: "email", phone: "tel", number: "number", date: "date" }[b.type], inputMode: b.type === "phone" ? "tel" : null, autocomplete: b.type === "email" ? "email" : b.type === "phone" ? "tel" : null, maxLength: 500, disabled: closed, oninput: e => set(e.target.value) })); break;
      case "long": ctrl.append(h("textarea", { class: "textarea", id: fid, maxLength: 5000, disabled: closed, oninput: e => set(e.target.value) })); break;
      case "dropdown": ctrl.append(h("select", { class: "select", id: fid, disabled: closed, onchange: e => set(e.target.value) }, h("option", { value: "" }, "Choose…"), (b.options || []).map(o => h("option", { value: o }, o)))); break;
      case "choice": (b.options || []).forEach(o => ctrl.append(h("label", { class: "choice" }, h("input", { type: "radio", name: fid, value: o, disabled: closed, onchange: () => set(o) }), o))); break;
      case "checkbox": (b.options || []).forEach(o => ctrl.append(h("label", { class: "choice" }, h("input", { type: "checkbox", value: o, disabled: closed, onchange: () => set([...ctrl.querySelectorAll("input:checked")].map(x => x.value)) }), o))); break;
      case "rating": {
        const st = h("div", { class: "stars", role: "radiogroup", "aria-label": b.label });
        for (let n = 1; n <= 5; n++) st.append(h("button", { type: "button", role: "radio", "aria-label": n + " star" + (n > 1 ? "s" : ""), disabled: closed, onclick: () => { set(n); st.querySelectorAll("button").forEach((x, k) => { x.classList.toggle("on", k < n); x.setAttribute("aria-checked", k === n - 1); }); } }, "★"));
        ctrl.append(st); break;
      }
      case "file": {
        const chosen = h("div", { class: "muted", style: { fontSize: "14px", marginTop: "8px" } }, "PDF, Word, images and more · up to 10 MB");
        const inp = h("input", { type: "file", id: fid, class: "file-in", disabled: closed, onchange: e => {
          const f = e.target.files[0];
          if (!f) { set(null); chosen.textContent = "PDF, Word, images and more · up to 10 MB"; return; }
          if (f.size > LIMITS.file) { e.target.value = ""; set(null); chosen.textContent = "That file is " + fmtSize(f.size) + ". Please choose one under 10 MB."; return; }
          set(f); chosen.textContent = "Selected: " + f.name + " (" + fmtSize(f.size) + ")";
        } });
        ctrl.append(h("label", { class: "file-drop", for: fid }, icon("clip"), h("span", null, "Choose a file")), inp, chosen); break;
      }
      case "yesno": {
        const row = h("div", { class: "yn" });
        ["Yes", "No"].forEach(v => row.append(h("button", { type: "button", disabled: closed, onclick: e => { set(v); row.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === e.currentTarget)); } }, v)));
        ctrl.append(row); break;
      }
    }
    box.append(ctrl); blockEls[b.id] = box; body.append(box);
  });
  const btn = h("button", { class: "btn", type: "submit", disabled: closed }, preview ? "Submit (disabled in preview)" : "Submit");
  const form = h("form", { novalidate: true, onsubmit: async e => {
    e.preventDefault(); if (preview) { toast("This is a preview. Publish the page to collect answers."); return; }
    let first = null;
    for (const b of page.blocks.filter(isQuestion)) {
      const v = answers[b.id], box = blockEls[b.id];
      const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
      let msg = null;
      if (b.required && empty) msg = "Please answer this question.";
      else if (!empty && b.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email, like name@example.com.";
      else if (!empty && b.type === "number" && isNaN(Number(v))) msg = "Enter a number.";
      box.classList.toggle("err", !!msg); const old = box.querySelector(".msg"); if (old) old.remove();
      if (msg) { box.append(h("div", { class: "msg" }, msg)); first ||= box; }
    }
    if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const out = { ...answers };
      for (const [k, v] of Object.entries(out)) {
        if (v instanceof File) { btn.textContent = "Uploading " + v.name + "…"; out[k] = await store.uploadSubmission(page.id, v); }
      }
      btn.textContent = "Sending…";
      await store.submitResponse(page.id, out);
      mount(header, h("div", { class: "form-page" }, h("div", { class: "fblock thanks" }, h("div", { class: "big" }, "🎉"), h("h2", null, "Sent!"),
        h("p", { class: "muted", style: { fontSize: "18px" } }, page.thank_you || "Thanks! We got your answers."),
        h("button", { class: "btn", onclick: () => route() }, "Send another response"))), madeWith());
    } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = "Submit"; }
  } }, body, h("div", { class: "form-page", style: { marginTop: 0 } }, h("div", { class: "submit-row" }, btn, closed ? h("span", { class: "muted" }, "This form is closed to new responses.") : h("span", { class: "muted", style: { fontSize: "14px" } }, "Never send passwords through forms."))));
  mount(header, form, madeWith());
}
const madeWith = () => h("div", { class: "made" }, "Made with ", h("a", { href: location.pathname + "#home" }, "Blocko"));

/* ============================================================ responses */
async function viewResponses(id) {
  const page = await store.getPage(id);
  if (!page) return go("home");
  document.documentElement.style.setProperty("--page", page.color);
  let rows = [];
  try { rows = await store.listResponses(id); } catch (e) { toast(e.message); }
  let mode = "summary";
  const qs = page.blocks.filter(isQuestion);
  const week = rows.filter(r => Date.now() - new Date(r.created_at) < 7 * 864e5).length;
  const band = h("header", { class: "band on-color", style: { background: page.color } }, h("div", { class: "wrap" },
    topBar(h("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, h("button", { class: "icon-btn", "aria-label": "Back to home", onclick: () => go("home") }, icon("back")), logo()),
      h("button", { class: "btn small light", onclick: () => shareSheet(page, pg => store.savePage(pg)) }, icon("share"), "Share")),
    h("div", { class: "emoji-btn", style: { background: "rgba(255,255,255,.18)" } }, page.emoji || "📝"),
    h("h1", null, page.title || "Untitled page"),
    h("div", { class: "tabs" }, h("button", { onclick: () => go("p-" + page.id) }, "Build"), h("button", { class: "on" }, "Responses", h("span", { class: "count" }, rows.length)))));
  const stats = h("div", { class: "stats" },
    h("div", { class: "stat" }, h("b", null, rows.length), h("span", null, "Total responses")),
    h("div", { class: "stat" }, h("b", null, week), h("span", null, "In the last 7 days")),
    h("div", { class: "stat" }, h("b", { style: { fontSize: "26px", lineHeight: "40px" } }, rows[0] ? ago(rows[0].created_at) : "—"), h("span", null, "Latest response")));
  const content = h("div");
  const seg = h("div", { class: "seg" });
  const drawSeg = () => seg.replaceChildren(...[["summary", "Summary"], ["table", "All answers"]].map(([k, l]) => h("button", { class: mode === k ? "on" : "", onclick: () => { mode = k; drawSeg(); draw(); } }, l)));
  const val = (r, b) => { const v = r.answers ? r.answers[b.id] : undefined; return Array.isArray(v) ? v.join(", ") : v == null ? "" : typeof v === "object" ? (v.name || "") : String(v); };
  const cell = (r, b) => { const v = r.answers ? r.answers[b.id] : undefined; return v && typeof v === "object" && !Array.isArray(v) && v.path ? fileChip(v) : val(r, b); };
  function draw() {
    if (!rows.length) return content.replaceChildren(h("div", { class: "empty" }, h("h3", null, "No responses yet"), h("p", { class: "muted" }, page.published ? "Share your link to start collecting answers." : "Publish your page and share the link to start collecting answers."),
      h("button", { class: "btn brand", onclick: () => shareSheet(page, pg => store.savePage(pg)) }, icon("share"), page.published ? "Share link" : "Publish & share")));
    if (mode === "summary") {
      content.replaceChildren(h("div", { class: "sum" }, qs.map(b => {
        const vals = rows.map(r => r.answers ? r.answers[b.id] : undefined).filter(v => v != null && v !== "" && !(Array.isArray(v) && !v.length));
        const card = h("div", { class: "sum-card" }, h("h3", null, b.label || "Untitled question"), h("div", { class: "sub" }, vals.length + " of " + rows.length + " answered"));
        if (["choice", "checkbox", "dropdown", "yesno", "rating"].includes(b.type)) {
          const keys = b.type === "yesno" ? ["Yes", "No"] : b.type === "rating" ? ["5", "4", "3", "2", "1"] : [...(b.options || [])];
          const counts = new Map(keys.map(k => [k, 0]));
          vals.flat().forEach(v => { const k = String(v); counts.set(k, (counts.get(k) || 0) + 1); });
          const max = Math.max(1, ...counts.values());
          if (b.type === "rating") { const avg = vals.reduce((a, v) => a + Number(v), 0) / (vals.length || 1); card.append(h("div", { class: "big-num" }, avg.toFixed(1), h("span", { class: "muted", style: { fontSize: "18px" } }, " / 5 average"))); }
          [...counts].forEach(([k, n]) => card.append(h("div", { class: "barrow" }, h("span", { class: "lbl" }, b.type === "rating" ? "★".repeat(Number(k)) : k),
            h("div", { class: "bar-track" }, h("div", { class: "bar-fill", style: { width: (n / max * 100) + "%" } })), h("span", { class: "n" }, n))));
        } else if (b.type === "number") {
          const nums = vals.map(Number).filter(n => !isNaN(n));
          const sum = nums.reduce((a, n) => a + n, 0);
          card.append(h("div", { class: "big-num" }, sum.toLocaleString(), h("span", { class: "muted", style: { fontSize: "18px" } }, " total · " + (nums.length ? (sum / nums.length).toFixed(1) : 0) + " average")));
        } else if (b.type === "file") {
          card.append(h("div", { class: "texts" }, vals.slice(0, 50).map(v => h("div", null, v && v.path ? fileChip(v) : String(v)))));
        } else {
          card.append(h("div", { class: "texts" }, vals.slice(0, 50).map(v => h("div", null, String(v)))));
        }
        return card;
      })));
    } else {
      content.replaceChildren(h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, h("th", null, "Submitted"), qs.map(b => h("th", null, b.label || "Untitled")), h("th", null, ""))),
        h("tbody", null, rows.map(r => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, fmtDate(r.created_at)), qs.map(b => h("td", null, cell(r, b))),
          h("td", null, h("button", { class: "icon-btn", "aria-label": "Delete response", onclick: () => confirmSheet("Delete this response?", "It's removed for good.", "Delete", async () => { await store.deleteResponse(r.id); rows = rows.filter(x => x.id !== r.id); draw(); toast("Response deleted"); }) }, icon("trash")))))))));
    }
  }
  function exportCsv() {
    const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
    const lines = [["Submitted", ...qs.map(b => b.label || "Untitled")].map(esc).join(",")]
      .concat(rows.map(r => [new Date(r.created_at).toISOString(), ...qs.map(b => val(r, b))].map(esc).join(",")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: (page.title || "responses").replace(/[^\w\- ]+/g, "").trim() + ".csv" });
    document.body.append(a); a.click(); a.remove();
    toast("Downloading spreadsheet (opens in Excel or Google Sheets)");
  }
  drawSeg(); draw();
  mount(store.mode === "demo" ? h("div", { class: "demo-bar" }, h("b", null, "Demo mode"), " · Pages and answers stay on this device until the app goes live.") : null,
    band, h("main", { class: "wrap" }, stats,
      h("div", { class: "r-tools" }, seg, h("div", { class: "spacer" }), rows.length ? h("button", { class: "btn small", onclick: exportCsv }, icon("download"), "Download CSV") : null),
      content));
}

/* ============================================================ router */
let routing = 0;
async function route() {
  const my = ++routing;
  $layer.replaceChildren();
  document.title = "Blocko";
  const hsh = location.hash.slice(1) || "home";
  const [kind, ...rest] = hsh.split("-"); const id = rest.join("-");
  try {
    if (kind === "f") return await viewForm(id, false);
    if (store.mode === "cloud" && !user) return viewLogin();
    if (my !== routing) return;
    if (kind === "p" && id) return await viewEditor(id);
    if (kind === "r" && id) return await viewResponses(id);
    if (kind === "v" && id) return await viewForm(id, true);
    return await viewHome();
  } catch (e) {
    console.error(e);
    mount(h("header", { class: "band", style: { background: "var(--c-ink)" } }, h("div", { class: "wrap" }, topBar(logo(), null), h("h1", null, "Something went wrong"), h("p", null, e.message || "Please try again."))));
  }
}

/* ============================================================ install */
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if ((location.hash || "#home") === "#home") route(); });
async function doInstall() {
  if (!installEvt) return;
  installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; route();
}

/* ============================================================ start */
(async function start() {
  store = await createStore();
  if (store.mode === "cloud") {
    user = await store.getUser();
    if (user) { try { await store.init(); } catch (e) { toast(e.message); } }
    store.onAuth(async u => {
      const was = !!user; user = u;
      if (was !== !!u) { if (u) { try { await store.init(); } catch (e) { toast(e.message); } } route(); }
    });
  }
  addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
