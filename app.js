import { createStore, uuid, LIMITS, TERMS_VERSION } from "./store.js";

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
const BACKGROUNDS = [["Sunset", "backgrounds/sunset.jpg"], ["Ocean", "backgrounds/ocean.jpg"], ["City night", "backgrounds/city.jpg"], ["Colors", "backgrounds/colors.jpg"]];
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
  file: { name: "File upload", ic: "⇪", c: "#141318" },
  imageup: { name: "Image upload", ic: "🖼", c: "#ff3e9a" },
  docup: { name: "Document upload", ic: "📄", c: "#1f6bff" },
  time: { name: "Time", ic: "◷", c: "#00a7a7" },
  datetime: { name: "Date & time", ic: "📆", c: "#00a7a7" },
  url: { name: "Website link", ic: "🔗", c: "#1f6bff" },
  address: { name: "Address", ic: "📍", c: "#7b3ff2" },
  scale: { name: "Scale", ic: "1–10", c: "#e0a800" },
  signature: { name: "Signature", ic: "✍", c: "#141318" },
  consent: { name: "Agreement", ic: "☑", c: "#00b86b" }
};
const UPLOADS = {
  file: { accept: "", hint: "Any file", ok: () => true },
  imageup: { accept: "image/*", hint: "Photos: JPG, PNG, WebP or HEIC", ok: f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name) },
  docup: { accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv", hint: "PDF, Word, Excel, PowerPoint or text", ok: f => /\.(pdf|docx?|xlsx?|pptx?|txt|rtf|odt|csv)$/i.test(f.name) }
};
const isUpload = t => t in UPLOADS;
const isFileVal = v => v && typeof v === "object" && !Array.isArray(v) && v.path;
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
async function openFile(f) {
  try { const url = await store.fileUrl(f.path); const a = h("a", { href: url, download: f.name, target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove(); }
  catch (e) { toast(e.message); }
}
function fileChip(f) {
  const isImg = /^image\//.test(f.type || "") || /\.(png|jpe?g|webp|gif|heic)$/i.test(f.name || "");
  const thumb = h("span", { class: "chip-thumb" }, icon(isImg ? "image" : "clip"));
  if (isImg) store.fileUrl(f.path).then(u => thumb.replaceChildren(h("img", { src: u, alt: "", loading: "lazy" }))).catch(() => {});
  return h("button", { class: "file-chip" + (isImg ? " img" : ""), onclick: () => openFile(f), title: "Download " + f.name }, thumb, h("span", null, f.name), h("small", null, fmtSize(f.size || 0)));
}
/* brand images: logo + background image per page */
function hexA(hex, a) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return `rgba(20,19,24,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const cssUrl = u => String(u).replace(/["\\\n]/g, c => encodeURIComponent(c));
function bandStyle(page, forCard) {
  const b = page.brand || {};
  if (!b.cover || (b.coverMode === "page" && !forCard)) return { background: b.cover && b.coverMode === "page" ? "transparent" : page.color };
  const t = b.tint == null ? 0.55 : b.tint;
  return { backgroundColor: page.color, backgroundImage: `linear-gradient(180deg, ${hexA(page.color, Math.max(0, t - 0.15))}, ${hexA(page.color, Math.min(1, t + 0.2))}), url("${cssUrl(b.cover)}")`, backgroundSize: "cover", backgroundPosition: "center" };
}
function applyBand(el, page) { el.removeAttribute("style"); Object.assign(el.style, bandStyle(page)); }
function pageBg(page) {
  const b = page.brand || {};
  if (!b.cover || b.coverMode !== "page") return null;
  const t = b.tint == null ? 0.55 : b.tint;
  return h("div", { class: "page-bg", style: { backgroundColor: page.color, backgroundImage: `linear-gradient(180deg, ${hexA(page.color, t)}, ${hexA("#141318", Math.min(1, t + 0.15))}), url("${cssUrl(b.cover)}")` } });
}
function markEl(page, cls) {
  const b = page.brand || {};
  return b.logo ? h("div", { class: (cls || "emoji-btn") + " has-logo" }, h("img", { src: b.logo, alt: (page.title || "Company") + " logo" })) : h("div", { class: cls || "emoji-btn", style: { background: "rgba(255,255,255,.18)" } }, page.emoji || "📝");
}
// shrink pictures before upload so pages load fast and fit in storage
function compressImage(file, maxDim, keepAlpha) {
  return new Promise(res => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return res(file);
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (k === 1 && file.size < 400 * 1024) { URL.revokeObjectURL(url); return res(file); }
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const type = keepAlpha ? "image/webp" : "image/jpeg";
      c.toBlob(b => res(b ? new File([b], file.name.replace(/\.\w+$/, "") + (keepAlpha ? ".webp" : ".jpg"), { type }) : file), type, 0.84);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}
function pickFile(accept, onFile) { const i = h("input", { type: "file", accept }); i.onchange = () => { if (i.files[0]) onFile(i.files[0]); }; i.click(); }
const isQuestion = b => !TYPES[b.type]?.content;
const Q = (type, label, extra = {}) => ({ id: uuid(), type, label, help: "", required: false, ...(TYPES[type].options ? { options: ["Option 1", "Option 2"] } : {}), ...extra });
const C = (type, text = "") => ({ id: uuid(), type, text });

const BG = n => ({ cover: "backgrounds/" + n + ".jpg", coverMode: "header", tint: 0.4 });
const opts = (...o) => ({ options: o });
const TEMPLATES = {
  blank: { name: "Blank page", emoji: "📝", color: COLORS[0], cat: "Start", d: "Start from nothing.", title: "", description: "", blocks: () => [Q("short", "Your name", { required: true })] },

  company: { name: "Company request", emoji: "🏢", color: COLORS[7], cat: "Business", d: "Quotes, demos and enquiries for your business.", brand: BG("sunset"),
    title: "Your company name", description: "Tell us what you need and our team will get back to you within one working day.",
    thank_you: "Thanks! Your request is in. Someone from our team will contact you within one working day.",
    blocks: () => [
      C("heading", "Your details"),
      Q("short", "Full name", { required: true }), Q("email", "Work email", { required: true }), Q("phone", "Phone number", { required: true }),
      Q("short", "Company name", { required: true }), Q("dropdown", "Company size", opts("Just me", "2–10", "11–50", "51–200", "200+")), Q("url", "Company website"),
      C("heading", "Your request"),
      Q("dropdown", "What do you need?", { required: true, ...opts("A price quote", "A product demo", "A partnership", "Customer support", "Something else") }),
      Q("long", "Tell us more", { required: true, help: "What are you trying to achieve, and by when?" }),
      Q("choice", "Budget range", opts("Under ₦500,000", "₦500,000 – ₦2,000,000", "₦2,000,000 – ₦10,000,000", "Above ₦10,000,000", "Not sure yet")),
      Q("date", "When do you want to start?"), Q("docup", "Attach a brief or document", { help: "Optional: specs, a brief, or anything that helps us understand.", multiple: true }),
      Q("choice", "Best way to reach you", opts("Phone call", "WhatsApp", "Email")),
      Q("consent", "I agree to be contacted about this request.", { required: true })] },

  contact: { name: "Contact form", emoji: "💬", color: COLORS[3], cat: "Business", d: "A simple way for anyone to reach you.", brand: BG("ocean"),
    title: "Get in touch", description: "Send us a message and we'll reply within one working day.",
    thank_you: "Message received! We'll reply within one working day.",
    blocks: () => [
      Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number"),
      Q("dropdown", "What's this about?", { required: true, ...opts("General question", "Sales", "Support", "Partnership", "Feedback", "Other") }),
      Q("short", "Subject", { required: true }), Q("long", "Your message", { required: true }),
      Q("imageup", "Add a screenshot or photo", { help: "Optional", multiple: true }),
      Q("choice", "How should we reply?", opts("Email", "Phone call", "WhatsApp"))] },

  job: { name: "Job application", emoji: "💼", color: COLORS[1], cat: "HR & team", d: "Collect CVs, details and a signed declaration.", brand: BG("city"),
    access: "email", one_per_person: true,
    title: "Join our team", description: "Thanks for your interest! This takes about 10 minutes. Have your CV ready as a PDF or Word file.",
    thank_you: "Your application has been received. We review every application and will contact shortlisted candidates within two weeks.",
    blocks: () => [
      C("heading", "Personal details"),
      Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number", { required: true }),
      Q("address", "Home address", { required: true }), Q("date", "Date of birth"),
      Q("imageup", "Passport photograph", { help: "A clear, recent photo of your face." }),
      C("heading", "The role"),
      Q("dropdown", "Position you're applying for", { required: true, ...opts("Sales Executive", "Customer Service", "Graphic Designer", "Software Engineer", "Accountant", "Operations Officer") }),
      Q("choice", "Employment type", { required: true, ...opts("Full-time", "Part-time", "Contract", "Internship") }),
      Q("choice", "Work arrangement", opts("On-site", "Remote", "Hybrid")),
      Q("number", "Expected monthly salary (₦)"), Q("date", "Earliest start date", { required: true }),
      C("heading", "Experience & education"),
      Q("choice", "Years of experience", { required: true, ...opts("Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years") }),
      Q("short", "Current or most recent employer"), Q("short", "Current job title"),
      Q("dropdown", "Highest qualification", opts("SSCE / O'Level", "OND / NCE", "HND", "Bachelor's degree", "Master's degree", "PhD", "Other")),
      Q("short", "Course of study"), Q("url", "LinkedIn or portfolio link"),
      C("heading", "Documents"),
      Q("docup", "CV / Résumé", { required: true }), Q("docup", "Cover letter", { help: "Optional" }),
      Q("docup", "Certificates", { help: "Optional: up to 5 files.", multiple: true }),
      C("heading", "A few questions"),
      Q("long", "Why do you want to work with us?", { required: true }),
      Q("long", "Tell us about an achievement you're proud of"),
      Q("choice", "How did you hear about this job?", opts("LinkedIn", "Instagram", "Jobberman", "A friend or staff member", "Our website", "Other")),
      Q("short", "Referee: name and phone number"),
      C("heading", "Declaration"),
      Q("consent", "I confirm the information I've given is true and complete.", { required: true }),
      Q("signature", "Your signature", { required: true })] },

  event: { name: "Event registration", emoji: "🎟️", color: COLORS[2], cat: "Events", d: "Tickets, sessions, dietary needs and guests.", brand: BG("colors"),
    title: "Save your seat", description: "Register below and we'll send your ticket and event details to your email.",
    thank_you: "You're registered! 🎉 Check your email for your ticket and event details.",
    blocks: () => [
      C("heading", "About you"),
      Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number", { required: true }),
      Q("short", "Organisation or company"), Q("short", "Job title"),
      C("heading", "Your ticket"),
      Q("choice", "Ticket type", { required: true, ...opts("Regular", "VIP", "Student", "Speaker / Guest") }),
      Q("number", "Number of people (including you)", { required: true }),
      Q("checkbox", "Which sessions will you attend?", opts("Opening keynote", "Morning workshops", "Lunch & networking", "Afternoon panels", "Evening party")),
      Q("time", "What time will you arrive?"),
      C("heading", "Your needs"),
      Q("checkbox", "Dietary needs", opts("None", "Vegetarian", "Vegan", "Halal", "No pork", "Nut allergy")),
      Q("long", "Any access needs we should prepare for?"),
      Q("short", "Emergency contact: name and phone"),
      Q("yesno", "Can we take photos of you at the event?"),
      Q("consent", "I agree to the event terms and code of conduct.", { required: true })] },

  feedback: { name: "Customer feedback", emoji: "⭐", color: COLORS[4], cat: "Surveys", d: "Ratings, likelihood to recommend and comments.", brand: BG("ocean"),
    title: "How did we do?", description: "Two minutes of your time helps us serve you better.",
    thank_you: "Thank you for your feedback! It really helps us improve.",
    blocks: () => [
      Q("rating", "Overall, how would you rate your experience?", { required: true }),
      Q("scale", "How likely are you to recommend us to a friend?", { required: true, max: 10, lowLabel: "Not likely", highLabel: "Very likely" }),
      Q("checkbox", "What did you use or buy?", opts("Product", "Delivery", "Customer support", "Website / app", "In-store service")),
      Q("scale", "How easy was it to get what you needed?", { max: 5, lowLabel: "Very hard", highLabel: "Very easy" }),
      Q("long", "What did you love?"), Q("long", "What should we improve?"),
      Q("imageup", "Share a photo (optional)", { help: "Of your order, a problem, or anything that helps." }),
      Q("yesno", "May we contact you about your feedback?"),
      Q("email", "Your email (if we may contact you)")] },

  order: { name: "Order form", emoji: "🛒", color: COLORS[5], cat: "Business", d: "Items, delivery, payment and proof of payment.", brand: BG("sunset"),
    title: "Place an order", description: "Choose what you'd like. We'll confirm your order and delivery by phone.",
    thank_you: "Order received! 🛍️ We'll call you shortly to confirm your order and delivery.",
    blocks: () => [
      C("heading", "Your details"),
      Q("short", "Full name", { required: true }), Q("phone", "Phone number", { required: true }), Q("email", "Email"),
      C("heading", "Your order"),
      Q("checkbox", "What would you like?", { required: true, ...opts("Item A – ₦5,000", "Item B – ₦8,500", "Item C – ₦12,000", "Gift wrapping – ₦1,000") }),
      Q("number", "Quantity", { required: true }), Q("long", "Sizes, colours or special requests"),
      C("heading", "Delivery"),
      Q("choice", "Delivery or pick-up?", { required: true, ...opts("Delivery", "Pick-up") }),
      Q("address", "Delivery address"), Q("date", "Preferred delivery date"), Q("time", "Preferred delivery time"),
      C("heading", "Payment"),
      Q("choice", "How will you pay?", { required: true, ...opts("Bank transfer", "Card / POS on delivery", "Cash on delivery") }),
      Q("imageup", "Proof of payment", { help: "If you paid by transfer, upload the receipt or screenshot." }),
      Q("consent", "I agree to the return and refund policy.", { required: true })] },

  booking: { name: "Appointment booking", emoji: "📅", color: COLORS[6], cat: "Business", d: "Let clients pick a service, date and time.", brand: BG("ocean"),
    title: "Book an appointment", description: "Pick a service and a time that suits you. We'll confirm by phone or WhatsApp.",
    thank_you: "Booking request received! We'll confirm your appointment shortly.",
    blocks: () => [
      Q("short", "Full name", { required: true }), Q("phone", "Phone / WhatsApp number", { required: true }), Q("email", "Email"),
      Q("dropdown", "Service", { required: true, ...opts("Consultation", "Follow-up visit", "Full service", "Other") }),
      Q("datetime", "Preferred date & time", { required: true }), Q("datetime", "Second choice (date & time)"),
      Q("choice", "First time with us?", opts("Yes", "No")),
      Q("long", "Anything we should know before your appointment?"),
      Q("consent", "I understand I should give 24 hours' notice to cancel.", { required: true })] },

  onboarding: { name: "Staff onboarding", emoji: "🤝", color: COLORS[0], cat: "HR & team", d: "New-hire details, documents and policy sign-off.", brand: BG("colors"),
    access: "code", accessCode: true,
    title: "Welcome to the team", description: "Please complete this before your first day. It takes about 10 minutes. Your details are only seen by HR.",
    thank_you: "All done, welcome aboard! HR will be in touch about your first day.",
    blocks: () => [
      C("heading", "Personal details"),
      Q("short", "Full name (as on your ID)", { required: true }), Q("email", "Personal email", { required: true }), Q("phone", "Phone number", { required: true }),
      Q("address", "Home address", { required: true }), Q("date", "Date of birth", { required: true }),
      Q("imageup", "Passport photograph", { required: true, help: "For your staff ID card." }),
      Q("docup", "Means of identification", { required: true, help: "National ID, driver's licence, voter's card or passport (PDF or Word scan)." }),
      C("heading", "Your role"),
      Q("dropdown", "Department", { required: true, ...opts("Sales", "Marketing", "Operations", "Finance", "Engineering", "Customer Service", "HR") }),
      Q("short", "Job title", { required: true }), Q("date", "Start date", { required: true }),
      Q("dropdown", "T-shirt size", opts("S", "M", "L", "XL", "XXL")),
      C("heading", "Emergency contact"),
      Q("short", "Contact name", { required: true }), Q("short", "Relationship", { required: true }), Q("phone", "Contact phone number", { required: true }),
      C("heading", "Documents & sign-off"),
      Q("docup", "Signed offer letter", { required: true }), Q("docup", "Certificates", { help: "Up to 5 files.", multiple: true }),
      Q("consent", "I have read and agree to the staff handbook and company policies.", { required: true }),
      Q("signature", "Your signature", { required: true })] },

  leave: { name: "Leave request", emoji: "🏖️", color: COLORS[3], cat: "HR & team", d: "Staff request time off with dates and approvals.", brand: BG("sunset"),
    access: "email",
    title: "Leave request", description: "Submit at least two weeks before your leave starts (except sick or emergency leave).",
    thank_you: "Your leave request has been sent to HR and your manager.",
    blocks: () => [
      Q("short", "Full name", { required: true }), Q("short", "Staff ID"),
      Q("dropdown", "Department", { required: true, ...opts("Sales", "Marketing", "Operations", "Finance", "Engineering", "Customer Service", "HR") }),
      Q("dropdown", "Type of leave", { required: true, ...opts("Annual leave", "Sick leave", "Maternity / paternity", "Compassionate", "Study leave", "Unpaid leave") }),
      Q("date", "First day of leave", { required: true }), Q("date", "Last day of leave", { required: true }),
      Q("number", "Number of working days", { required: true }),
      Q("long", "Reason (optional)"), Q("short", "Who will cover your work?", { required: true }),
      Q("docup", "Supporting document", { help: "E.g. a medical note, if you have one." }),
      Q("signature", "Your signature", { required: true })] },

  support: { name: "Complaint / support", emoji: "🛟", color: COLORS[1], cat: "Business", d: "Log a problem with screenshots and urgency.", brand: BG("city"),
    title: "How can we help?", description: "Tell us what went wrong. Screenshots help us fix things faster.",
    thank_you: "Thanks, we've logged your request and will reply as soon as possible.",
    blocks: () => [
      Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number"),
      Q("short", "Order or account number"),
      Q("dropdown", "What's the problem about?", { required: true, ...opts("Order / delivery", "Payment / refund", "Product quality", "Account / login", "Staff or service", "Other") }),
      Q("choice", "How urgent is it?", { required: true, ...opts("Low: whenever you can", "Medium: in the next few days", "High: as soon as possible") }),
      Q("long", "Describe what happened", { required: true }), Q("datetime", "When did it happen?"),
      Q("imageup", "Screenshots or photos", { multiple: true }), Q("docup", "Receipts or documents", { multiple: true }),
      Q("choice", "Preferred way to reach you", opts("Email", "Phone call", "WhatsApp"))] },

  survey: { name: "Staff survey", emoji: "📊", color: COLORS[4], cat: "Surveys", d: "Anonymous team pulse check with scales.", brand: BG("colors"),
    title: "Team pulse survey", description: "This survey is anonymous. Please be honest; it helps us make this a better place to work.",
    thank_you: "Thank you! Your answers are anonymous and will help us improve.",
    blocks: () => [
      Q("dropdown", "Your department", opts("Sales", "Marketing", "Operations", "Finance", "Engineering", "Customer Service", "HR", "Prefer not to say")),
      Q("scale", "How happy are you at work?", { required: true, max: 10, lowLabel: "Not happy", highLabel: "Very happy" }),
      Q("scale", "I have the tools I need to do my job well.", { max: 5, lowLabel: "Strongly disagree", highLabel: "Strongly agree" }),
      Q("scale", "My manager supports my growth.", { max: 5, lowLabel: "Strongly disagree", highLabel: "Strongly agree" }),
      Q("scale", "I understand our goals for this quarter.", { max: 5, lowLabel: "Strongly disagree", highLabel: "Strongly agree" }),
      Q("rating", "Rate communication across the team"),
      Q("long", "What's going well?"), Q("long", "What one thing should we change?")] },

  registration: { name: "Member registration", emoji: "🪪", color: COLORS[7], cat: "Events", d: "Clubs, schools, churches and associations.", brand: BG("ocean"),
    access: "email", one_per_person: true,
    title: "Become a member", description: "Fill in your details to register. Fields marked * are required.",
    thank_you: "Welcome! Your registration has been received.",
    blocks: () => [
      C("heading", "Your details"),
      Q("short", "Full name", { required: true }), Q("email", "Email", { required: true }), Q("phone", "Phone number", { required: true }),
      Q("choice", "Gender", opts("Female", "Male", "Prefer not to say")), Q("date", "Date of birth"),
      Q("address", "Home address", { required: true }), Q("short", "Occupation"),
      Q("imageup", "Passport photograph", { help: "For your membership card." }),
      C("heading", "Membership"),
      Q("choice", "Membership type", { required: true, ...opts("Regular", "Student", "Family", "Lifetime") }),
      Q("checkbox", "Areas you'd like to join", opts("Events", "Volunteering", "Media", "Welfare", "Finance")),
      Q("short", "Who referred you?"),
      Q("consent", "I agree to abide by the rules and code of conduct.", { required: true }),
      Q("signature", "Your signature")] }
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
function mount(...nodes) { document.body.classList.remove("about-mode"); $app.replaceChildren(...nodes.flat(9).filter(Boolean)); window.scrollTo(0, 0); }

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
      try {
        const r = await store.setPublished(page.id, pub.checked, acc.checked);
        page.published = r.published; page.accepting = r.accepting;
      } catch (e) { pub.checked = !!page.published; acc.checked = !!page.accepting; toast("Couldn't update: " + e.message); return; }
      if (onChange) onChange(page);
      note.textContent = page.published ? (page.accepting ? "Live. Anyone with the link can fill it in." : "Live, but closed to new answers.") : "Draft. Only you can see it.";
    };
    pub.onchange = () => {
      if (!pub.checked) return sync();
      pub.checked = false;
      sheet((b2, close2) => {
        const cb = h("input", { type: "checkbox", id: "lawful" });
        const go3 = h("button", { class: "btn brand", disabled: true, onclick: () => { close2(); pub.checked = true; sync(); toast("Published"); } }, "Publish");
        cb.onchange = () => { go3.disabled = !cb.checked; };
        b2.append(h("h2", null, "Before you publish"),
          h("p", { class: "muted", style: { margin: 0 } }, "Once published, anyone with the link can see this form and send you their information."),
          h("label", { class: "agree-row", for: "lawful" }, cb, h("span", null, "I have the right to collect this information, I'll tell people why I'm collecting it, and I'll use it only for lawful purposes. I understand I am responsible under the laws of my state and country, as set out in the ", h("a", { href: "#terms", target: "_blank" }, "Terms of Use"), ".")),
          h("div", { class: "row" }, h("button", { class: "btn", onclick: close2 }, "Cancel"), go3));
      });
    };
    acc.onchange = sync;
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
  const agree = h("input", { type: "checkbox", id: "agree" });
  const agreeRow = h("label", { class: "agree-row", for: "agree", hidden: true }, agree,
    h("span", null, "I agree to the ", h("a", { href: "#terms", target: "_blank" }, "Terms of Use"), ". I'm responsible for the information my forms collect and will follow the laws that apply to me."));
  swap.onclick = () => {
    mode = mode === "in" ? "up" : "in";
    title.textContent = mode === "in" ? "Welcome back" : "Create your account";
    sub.textContent = mode === "in" ? "Sign in to see your pages and responses." : "Free for individuals and teams. Takes a few seconds.";
    btn.textContent = mode === "in" ? "Sign in" : "Create account";
    swap.textContent = mode === "in" ? "New here? Create an account" : "Have an account? Sign in";
    pw.autocomplete = mode === "in" ? "current-password" : "new-password"; msg.replaceChildren();
    agreeRow.hidden = mode === "in";
  };
  const form = h("form", { onsubmit: async e => {
    e.preventDefault(); btn.disabled = true; msg.replaceChildren();
    try {
      if (mode === "in") { await store.signIn(email.value.trim(), pw.value); }
      else {
        if (!agree.checked) { msg.replaceChildren(h("div", { class: "err-box" }, "Please tick the box to agree to the Terms of Use.")); btn.disabled = false; return; }
        const r = await store.signUp(email.value.trim(), pw.value);
        if (r.needsConfirm) { msg.replaceChildren(h("div", { class: "ok-box" }, "Check your inbox and click the link to confirm your email, then sign in.")); swap.click(); }
      }
    } catch (err) { msg.replaceChildren(h("div", { class: "err-box" }, err.message)); }
    btn.disabled = false;
  } }, title, sub, msg, h("label", { class: "field", for: "em" }, "Email", email), h("label", { class: "field", for: "pw" }, "Password", pw), agreeRow, btn, swap);
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
    (await store.isAdmin()) ? h("button", { class: "btn small light", onclick: () => go("ads") }, "📣 Ads") : null,
    h("button", { class: "icon-btn", "aria-label": "Team", title: "Team", onclick: teamSheet }, icon("team")),
    store.mode === "cloud" ? h("button", { class: "icon-btn", "aria-label": "Account", onclick: accountSheet }, icon("user")) : null);
  const total = pages.reduce((a, p) => a + (p.response_count || 0), 0);
  const greeting = (() => { const hr = new Date().getHours(); return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; })();
  const tplBtns = [h("button", { class: "tpl primary", onclick: () => newPage("blank") }, h("span", { class: "e" }, icon("plus")), "Blank page"),
    h("button", { class: "tpl", onclick: () => document.getElementById("templates").scrollIntoView({ behavior: "smooth" }) }, h("span", { class: "e" }, "✨"), "Browse " + (Object.keys(TEMPLATES).length - 1) + " templates")];
  const cats = [...new Set(Object.values(TEMPLATES).filter(t => t.cat !== "Start").map(t => t.cat))];
  const gallery = h("section", { id: "templates", class: "tgal" }, h("h2", null, "Start from a template"),
    h("p", { class: "muted" }, "Ready-made forms with the right questions already in place. Change anything you like."),
    cats.map(c => [h("h3", null, c), h("div", { class: "tgrid" }, Object.entries(TEMPLATES).filter(([, t]) => t.cat === c).map(([k, t]) => {
      const n = t.blocks().filter(isQuestion).length;
      const lock = t.access === "email" ? "Sign-in" : t.access === "code" ? "Access code" : null;
      return h("button", { class: "tcard", onclick: () => newPage(k) },
        h("div", { class: "tcard-top", style: bandStyle({ color: t.color, brand: t.brand || {} }, true) }, h("span", { class: "e" }, t.emoji)),
        h("div", { class: "tcard-body" }, h("b", null, t.name), h("small", null, t.d), h("div", { class: "tmeta" }, h("span", null, n + " questions"), lock ? h("span", { class: "tlock" }, "🔒 " + lock) : null)));
    }))]));
  const cards = pages.length ? pages.map(p => {
    const st = !p.published ? ["draft", "Draft"] : p.accepting ? ["live", "Live"] : ["closed", "Closed"];
    return h("div", { class: "card" },
      h("button", { class: "card-top", style: { ...bandStyle(p, true), textAlign: "left" }, onclick: () => go("p-" + p.id) },
        p.brand && p.brand.logo ? h("span", { class: "card-logo" }, h("img", { src: p.brand.logo, alt: "" })) : h("span", { class: "e" }, p.emoji || "📝"), h("h3", null, p.title || "Untitled page")),
      h("div", { class: "card-bot" },
        h("button", { onclick: () => go("r-" + p.id), style: { display: "flex", alignItems: "baseline", gap: "6px" }, "aria-label": "See responses" }, h("b", null, p.response_count || 0), h("span", { class: "muted" }, (p.response_count === 1 ? "response" : "responses"))),
        h("div", { class: "spacer" }), h("span", { class: "pill " + st[0] }, st[1])),
      h("button", { class: "icon-btn card-menu", "aria-label": "Page options", onclick: () => cardMenu(p) }, icon("more")));
  }) : [h("div", { class: "empty" }, h("h3", null, "Make your first page"), h("p", { class: "muted" }, "Start with a blank page above, or pick a ready-made template below."))];
  mount(shell("var(--brand)", null,
    [topBar(logo(), right), h("h1", null, greeting + "."), h("p", null, pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"} · ${total} response${total === 1 ? "" : "s"} collected` : "Make pages that tell and forms that collect."), h("div", { class: "new-row" }, tplBtns)],
    h("main", { class: "wrap" }, h("div", { class: "grid" }, cards), gallery)));
}
function cardMenu(p) {
  sheet((b, close) => b.append(h("h2", null, p.title || "Untitled page"), h("div", { class: "menu" },
    h("button", { onclick: () => { close(); go("p-" + p.id); } }, "✏️  Edit page"),
    h("button", { onclick: () => { close(); go("r-" + p.id); } }, "📊  See responses"),
    h("button", { onclick: async () => { close(); const full = await store.getPage(p.id); shareSheet(full, () => route()); } }, "🔗  Share"),
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
  const p = await store.savePage({ id: uuid(), title: t.title, description: t.description, emoji: t.emoji, color: t.color, brand: { ...(t.brand || {}) }, blocks: t.blocks(),
    access: t.access || "open", one_per_person: !!t.one_per_person, published: false, accepting: true, thank_you: t.thank_you || "" });
  if (t.accessCode) { const al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; try { await store.setAccessCode(p.id, Array.from(crypto.getRandomValues(new Uint8Array(8)), n => al[n % al.length]).join("")); } catch (e) {} }
  if (key === "company") sessionStorage.setItem("blocko.showBrand", p.id);
  go("p-" + p.id);
}

/* ============================================================ editor */
async function viewEditor(id) {
  let page = await store.getPage(id);
  if (!page) { toast("That page doesn't exist anymore"); return go("home"); }
  let sel = null, saveT = null, responses = null;
  store.listResponses(id).then(r => { responses = r; countEl.textContent = r.length; }).catch(() => {});
  const state = h("span", { class: "save-state" }, "Saved");
  // One save at a time, always sending the latest version of the page, so an older save can never undo a newer change.
  let saving = Promise.resolve();
  const saveNow = () => {
    clearTimeout(saveT); state.textContent = "Saving…";
    saving = saving.then(async () => {
      try {
        const saved = await store.savePage(structuredClone(page));
        if (saved) { page.created_at = saved.created_at; page.updated_at = saved.updated_at; }
        state.textContent = "Saved";
      } catch (e) { state.textContent = "Not saved"; toast(e.message); throw e; }
    }).catch(() => {});
    return saving;
  };
  const save = (now) => {
    state.textContent = "Saving…"; clearTimeout(saveT);
    saveT = setTimeout(saveNow, now ? 0 : 700);
  };
  page.brand = page.brand || {};
  const band = h("header", { class: "band on-color" });
  applyBand(band, page);
  const countEl = h("span", { class: "count" }, "…");
  const lockPill = h("button", { class: "lock-pill", title: "Who can fill this in?", onclick: () => { accessBox.scrollIntoView({ behavior: "smooth", block: "center" }); accessBox.classList.add("flash"); setTimeout(() => accessBox.classList.remove("flash"), 1400); } });
  const title = h("textarea", { class: "title-input", rows: 1, placeholder: "Untitled page", value: page.title, "aria-label": "Page title", oninput: e => { page.title = e.target.value; autogrow(e.target); save(); } });
  const desc = h("textarea", { class: "desc-input", rows: 1, placeholder: "Add a short description", value: page.description || "", "aria-label": "Description", oninput: e => { page.description = e.target.value; autogrow(e.target); save(); } });
  const emojiBtn = h("button", { class: "emoji-btn", "aria-label": "Change icon or logo", onclick: () => page.brand.logo ? brandBox.scrollIntoView({ behavior: "smooth", block: "center" }) : emojiSheet(e => { page.emoji = e; drawMark(); save(); }) });
  const drawMark = () => { emojiBtn.classList.toggle("has-logo", !!page.brand.logo); emojiBtn.replaceChildren(page.brand.logo ? h("img", { src: page.brand.logo, alt: "Logo" }) : (page.emoji || "📝")); };
  drawMark();
  let bgEl = null;
  const refreshLook = () => { applyBand(band, page); drawMark(); const nb = pageBg(page); if (bgEl) bgEl.remove(); bgEl = nb; if (bgEl) document.getElementById("app").prepend(bgEl); };
  band.append(h("div", { class: "wrap" },
    topBar(h("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, h("button", { class: "icon-btn", "aria-label": "Back to home", onclick: () => go("home") }, icon("back")), logo()),
      h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, state,
        lockPill,
        h("button", { class: "icon-btn", "aria-label": "Brand images", title: "Logo & background", onclick: () => { brandBox.scrollIntoView({ behavior: "smooth", block: "center" }); brandBox.classList.add("flash"); setTimeout(() => brandBox.classList.remove("flash"), 1400); } }, icon("image")),
        h("button", { class: "icon-btn", "aria-label": "Preview", title: "Preview", onclick: () => go("v-" + page.id) }, icon("eye")),
        h("button", { class: "btn small light", onclick: () => shareSheet(page, null) }, icon("share"), "Share"))),
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
        grp("Text & numbers", ["short", "long", "email", "phone", "number", "url", "address"]),
        grp("Choices", ["choice", "checkbox", "dropdown", "yesno", "rating", "scale", "consent"]),
        grp("Dates", ["date", "time", "datetime"]),
        grp("Uploads & signature", ["imageup", "docup", "file", "signature"]),
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
        else if (b.type === "scale") card.append(h("div", { class: "fake" }, Array.from({ length: b.max || 10 }, (_, i) => i + 1).join("  ·  ")), (b.lowLabel || b.highLabel) ? h("div", { class: "help" }, (b.lowLabel || "") + " … " + (b.highLabel || "")) : null);
        else if (b.type === "consent") card.append(h("div", { class: "opts" }, h("div", { class: "opt" }, h("i", { class: "sq" }), b.label || "I agree")));
        else card.append(h("div", { class: "fake" + (b.type === "long" || b.type === "signature" || b.type === "address" ? " tall" : "") }, { dropdown: "Choose…", long: "Long answer", email: "name@example.com", phone: "Phone number", number: "0", date: "dd / mm / yyyy", time: "--:--", datetime: "dd / mm / yyyy  --:--", url: "https://…", address: "Street, city, state, country", short: "Short answer", signature: "✍  Sign here",
          file: "⇪  Upload " + (b.multiple ? "up to 5 files" : "a file") + " (up to 10 MB each)", imageup: "🖼  Upload " + (b.multiple ? "up to 5 photos" : "a photo"), docup: "📄  Upload " + (b.multiple ? "up to 5 documents" : "a document") + " (PDF, Word, Excel…)" }[b.type]));
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
        try { b.url = await store.uploadMedia(await compressImage(f, 1600, false)); urlIn.value = ""; drawPrev(); save(); } catch (e) { toast(e.message); }
        up.disabled = false; up.lastChild.textContent = "Upload picture";
      }) }, icon("image"), h("span", null, "Upload picture"));
      drawPrev();
      g.append(prev, h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, up), urlIn,
        h("input", { class: "input", value: b.caption || "", placeholder: "Caption (optional)", "aria-label": "Caption", oninput: e => { b.caption = e.target.value; save(); } }));
    }
    else {
      g.append(h("input", { class: "input", value: b.label, placeholder: b.type === "consent" ? "I agree to the terms and conditions" : "Type your question", "aria-label": b.type === "consent" ? "Agreement text" : "Question", style: { fontWeight: 700 }, oninput: e => { b.label = e.target.value; save(); } }));
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
      if (isUpload(b.type)) g.append(h("label", { class: "switch" }, h("input", { type: "checkbox", checked: !!b.multiple, onchange: e => { b.multiple = e.target.checked; save(); } }), "Allow up to 5 files"));
      if (b.type === "scale") g.append(h("div", { class: "scale-edit" },
        h("label", { class: "field" }, "From 1 to", h("select", { class: "select", onchange: e => { b.max = Number(e.target.value); save(); } }, [5, 10].map(n => h("option", { value: n, selected: (b.max || 10) === n }, n)))),
        h("label", { class: "field" }, "Label for 1", h("input", { class: "input", value: b.lowLabel || "", placeholder: "Not likely", oninput: e => { b.lowLabel = e.target.value; save(); } })),
        h("label", { class: "field" }, "Label for " + (b.max || 10), h("input", { class: "input", value: b.highLabel || "", placeholder: "Very likely", oninput: e => { b.highLabel = e.target.value; save(); } }))));
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
    page.color = c; refreshLook(); colorRow.querySelectorAll("button").forEach(x => x.classList.remove("on")); e.currentTarget.classList.add("on"); save();
  } })));
  const thanks = h("textarea", { class: "textarea", style: { minHeight: "80px" }, value: page.thank_you || "", placeholder: "Thanks! We got your answers.", oninput: e => { page.thank_you = e.target.value; save(); } });
  const brandBox = brandSettings(page, refreshLook, save);
  const accessBox = accessField(page, save, () => drawLock());
  function drawLock() {
    const a = page.access || "open";
    lockPill.className = "lock-pill" + (a === "open" ? "" : " on");
    lockPill.replaceChildren(svg(a === "open" ? '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>' : '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
      a === "open" ? "Open to anyone" : a === "email" ? "Sign-in: On" : a === "code" ? "Code: On" : "Sign-in + code");
  }
  drawLock();
  const side = h("aside", { class: "side-card" },
    h("h3", null, "Page settings"),
    h("div", { class: "field" }, "Color", colorRow),
    brandBox,
    aboutField(page, save),
    h("label", { class: "field" }, "Message after someone submits", thanks),
    accessBox,
    alertsField(page),
    h("button", { class: "btn brand", onclick: () => shareSheet(page, null) }, icon("share"), page.published ? "Share link" : "Publish & share"),
    h("button", { class: "btn", onclick: () => go("v-" + page.id) }, icon("eye"), "Preview"));

  render();
  mount(store.mode === "demo" ? h("div", { class: "demo-bar" }, h("b", null, "Demo mode"), " · Pages and answers stay on this device until the app goes live.") : null,
    band, h("main", { class: "wrap" }, h("div", { class: "edit-layout" }, list, side)));
  autogrow(title); autogrow(desc); refreshLook();
  if (sessionStorage.getItem("blocko.showBrand") === page.id) { sessionStorage.removeItem("blocko.showBrand"); setTimeout(() => { brandBox.scrollIntoView({ behavior: "smooth", block: "center" }); brandBox.classList.add("flash"); setTimeout(() => brandBox.classList.remove("flash"), 1600); }, 300); }
  addEventListener("pagehide", () => { if (state.textContent === "Saving…") save(true); }, { once: true });
}

function brandSettings(page, refresh, save) {
  const b = page.brand;
  const box = h("div", { class: "brand-box" });
  const slot = (label, key, opts) => {
    const wrap = h("div", { class: "brand-slot" });
    const draw = () => {
      const btn = h("button", { class: "btn small dark", onclick: () => pickFile("image/png,image/jpeg,image/webp,image/gif", async f => {
        if (!f.type.startsWith("image/")) return toast("Choose a picture file (JPG, PNG, WebP or GIF).");
        btn.disabled = true; btn.lastChild.textContent = "Uploading…";
        try { b[key] = await store.uploadMedia(await compressImage(f, opts.max, opts.alpha)); refresh(); save(); draw(); toast(label + " added"); }
        catch (e) { toast(e.message); btn.disabled = false; btn.lastChild.textContent = b[key] ? "Change" : "Upload"; }
      }) }, icon("image"), h("span", null, b[key] ? "Change" : "Upload"));
      wrap.replaceChildren(
        h("div", { class: "brand-thumb " + key }, b[key] ? h("img", { src: b[key], alt: "" }) : h("span", null, opts.empty)),
        h("div", { class: "brand-acts" }, h("b", null, label), h("small", { class: "muted" }, opts.hint), h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, btn,
          b[key] ? h("button", { class: "btn small", onclick: () => { delete b[key]; refresh(); save(); draw(); drawMode(); } }, "Remove") : null)));
      drawMode();
    };
    draw(); return wrap;
  };
  const modeBox = h("div");
  const drawMode = () => {
    if (!b.cover) return modeBox.replaceChildren();
    const seg = h("div", { class: "seg small" }, [["header", "Header only"], ["page", "Whole page"]].map(([k, l]) => h("button", { class: (b.coverMode || "header") === k ? "on" : "", onclick: () => { b.coverMode = k; refresh(); save(); drawMode(); } }, l)));
    const tint = h("input", { type: "range", min: 0, max: 0.9, step: 0.05, value: b.tint == null ? 0.55 : b.tint, "aria-label": "Color over the picture", oninput: e => { b.tint = Number(e.target.value); refresh(); save(); } });
    modeBox.replaceChildren(h("div", { class: "field" }, "Show the background", seg), h("label", { class: "field" }, "Page color over the picture", tint, h("small", { class: "muted", style: { fontWeight: 400 } }, "More color keeps the title easy to read.")));
  };
  const gallery = h("div", { class: "bg-gallery" });
  let coverSlot;
  const drawGallery = () => gallery.replaceChildren(h("small", { class: "muted", style: { gridColumn: "1/-1" } }, "Or pick a ready-made background:"),
    ...BACKGROUNDS.map(([name, url]) => h("button", { class: "bg-pick" + (b.cover === url ? " on" : ""), type: "button", title: name, "aria-label": "Use the " + name + " background",
      onclick: () => { b.cover = url; if (b.tint == null) b.tint = 0.35; refresh(); save(); const n = slot("Background image", "cover", coverOpts); coverSlot.replaceWith(n); coverSlot = n; drawGallery(); drawMode(); } },
      h("img", { src: url, alt: "" }), h("span", null, name))));
  const coverOpts = { max: 1800, alpha: false, hint: "A wide photo of your shop, team or product.", empty: "Photo" };
  coverSlot = slot("Background image", "cover", coverOpts);
  drawGallery();
  box.append(h("div", { class: "field" }, "Brand"),
    slot("Logo", "logo", { max: 512, alpha: true, hint: "Square or wide, PNG with see-through background looks best.", empty: "Logo" }),
    coverSlot, gallery, modeBox);
  return box;
}

/* ---- "About us" page: an optional company page shown beside the published form ---- */
function aboutField(page, save) {
  const b = page.brand;
  const box = h("div", { class: "field about-box" });
  const draw = () => {
    const a = b.about || {};
    const tick = h("label", { class: "access-opt" + (a.on ? " on" : "") }, h("input", { type: "checkbox", checked: !!a.on, onchange: e => {
      b.about = { ...(b.about || {}), on: e.target.checked }; save(); draw();
    } }), h("span", null, h("b", null, "Show an About page"), h("small", null, "People filling the form can open a page about your company: what you do, what you've achieved, how to reach you.")));
    box.replaceChildren(h("span", { style: { display: "flex", gap: "6px", alignItems: "center" } }, "🏢 About your company"), tick);
    if (!a.on) return;
    const set = (k, v) => { b.about[k] = v; save(); };
    const inp = (k, label, ph, opts = {}) => h("label", { class: "field" }, label,
      h(opts.area ? "textarea" : "input", { class: opts.area ? "textarea" : "input", value: a[k] || "", placeholder: ph, maxLength: opts.max || 120, type: opts.type || "text", style: opts.area ? { minHeight: "90px" } : null, oninput: e => set(k, e.target.value) }));
    // stats: up to 4 big numbers
    const stats = h("div", { class: "about-stats-ed" });
    const drawStats = () => {
      const list = b.about.stats || [];
      stats.replaceChildren(...list.map((st, i) => h("div", { class: "about-stat-ed" },
        h("input", { class: "input", value: st.value || "", placeholder: "500+", maxLength: 12, "aria-label": "Number", oninput: e => { st.value = e.target.value; save(); } }),
        h("input", { class: "input", value: st.label || "", placeholder: "Happy clients", maxLength: 40, "aria-label": "What it counts", oninput: e => { st.label = e.target.value; save(); } }),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Remove", onclick: () => { list.splice(i, 1); save(); drawStats(); } }, "✕"))),
        list.length < 4 ? h("button", { class: "btn small", type: "button", onclick: () => { b.about.stats = [...list, { value: "", label: "" }]; save(); drawStats(); } }, "+ Add a number") : null);
    };
    drawStats();
    // still picture
    const photo = h("div", { class: "brand-slot" });
    const drawPhoto = () => {
      const btn = h("button", { class: "btn small dark", type: "button", onclick: () => pickFile("image/png,image/jpeg,image/webp", async f => {
        btn.disabled = true; btn.textContent = "Uploading…";
        try { b.about.photo = await store.uploadMedia(await compressImage(f, 1400, false)); save(); drawPhoto(); toast("Picture added"); }
        catch (e) { toast(e.message); btn.disabled = false; btn.textContent = "Upload"; }
      }) }, b.about.photo ? "Change" : "Upload");
      photo.replaceChildren(h("div", { class: "brand-thumb cover" }, b.about.photo ? h("img", { src: b.about.photo, alt: "" }) : h("span", null, "Picture")),
        h("div", { class: "brand-acts" }, h("b", null, "Main picture"), h("small", { class: "muted" }, "Stays still. Your office, team or product."),
          h("div", { style: { display: "flex", gap: "6px" } }, btn, b.about.photo ? h("button", { class: "btn small", type: "button", onclick: () => { delete b.about.photo; save(); drawPhoto(); } }, "Remove") : null)));
    };
    drawPhoto();
    // slideshow pictures
    const slides = h("div", { class: "field" });
    const drawSlides = () => {
      const list = b.about.slides || [];
      const add = h("button", { class: "btn small dark", type: "button", onclick: () => {
        const i = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true });
        i.onchange = async () => {
          const files = [...i.files].slice(0, 10 - list.length); if (!files.length) return;
          add.disabled = true; add.textContent = "Uploading…";
          try { const urls = []; for (const f of files) urls.push(await store.uploadMedia(await compressImage(f, 1400, false)));
            b.about.slides = [...(b.about.slides || []), ...urls]; save(); toast(urls.length === 1 ? "Picture added" : urls.length + " pictures added"); }
          catch (e) { toast(e.message); }
          drawSlides();
        };
        i.click();
      } }, "+ Add pictures");
      slides.replaceChildren("Slideshow pictures",
        h("small", { class: "muted", style: { fontWeight: 400 } }, "These slide sideways on their own. Add up to 10, like past projects or events."),
        list.length ? h("div", { class: "slide-thumbs" }, list.map((u, i) => h("div", { class: "slide-thumb" }, h("img", { src: u, alt: "" }),
          h("button", { type: "button", "aria-label": "Remove picture", onclick: () => { list.splice(i, 1); b.about.slides = list; save(); drawSlides(); } }, "✕")))) : null,
        list.length < 10 ? h("div", null, add) : null);
    };
    drawSlides();
    // links
    const links = h("div", { class: "field" });
    const drawLinks = () => {
      const list = b.about.links || [];
      links.replaceChildren("Links",
        h("small", { class: "muted", style: { fontWeight: 400 } }, "Up to 5 buttons people can tap, like Instagram, your brochure or a video."),
        ...list.map((l, i) => h("div", { class: "link-ed" },
          h("input", { class: "input", value: l.label || "", placeholder: "Button text, e.g. Instagram", maxLength: 40, "aria-label": "Button text", oninput: e => { l.label = e.target.value; save(); } }),
          h("input", { class: "input", type: "url", value: l.url || "", placeholder: "https://…", maxLength: 300, "aria-label": "Link", oninput: e => { l.url = e.target.value.trim(); save(); } }),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Remove link", onclick: () => { list.splice(i, 1); save(); drawLinks(); } }, "✕"))),
        list.length < 5 ? h("button", { class: "btn small", type: "button", onclick: () => { b.about.links = [...list, { label: "", url: "" }]; save(); drawLinks(); } }, "+ Add a link") : null);
    };
    drawLinks();
    box.append(
      inp("name", "Company name", page.title || "e.g. Adoh Engineering Ltd", { max: 80 }),
      inp("tagline", "One-line summary", "e.g. Building safe roads across Lagos since 2012", { max: 120 }),
      inp("story", "What you do", "Tell people who you are, what you offer and who you serve.", { area: true, max: 1500 }),
      h("div", { class: "field" }, "Big numbers", h("small", { class: "muted", style: { fontWeight: 400 } }, "Like years in business, projects done or happy clients."), stats),
      inp("wins", "Achievements", "One per line, e.g.\nBest SME Award 2024\nCompleted the Ikeja bridge project", { area: true, max: 1200 }),
      photo, slides, links,
      inp("website", "Website", "https://", { type: "url", max: 200 }),
      inp("email", "Contact email", "hello@company.com", { type: "email", max: 120 }),
      inp("phone", "Phone or WhatsApp", "+234…", { type: "tel", max: 40 }),
      inp("address", "Address", "Office address", { max: 200 }));
  };
  draw(); return box;
}

function accessField(page, save, onChange) {
  const box = h("div", { class: "field" }, h("span", { style: { display: "flex", gap: "6px", alignItems: "center" } }, svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'), "Who can fill this in?"));
  const opts = h("div", { class: "access-opts" });
  const extra = h("div", { style: { display: "grid", gap: "10px" } });
  const flags = () => { const a = page.access || "open"; return { code: a === "code" || a === "both", email: a === "email" || a === "both" }; };
  const setFlags = f => {
    page.access = f.code && f.email ? "both" : f.code ? "code" : f.email ? "email" : "open";
    if (!f.email) page.one_per_person = false;
    save(); draw(); if (onChange) onChange();
  };
  const draw = () => {
    const f = flags(), open = !f.code && !f.email;
    const opt = (on, title, desc, onchange, disabledNote) => h("label", { class: "access-opt" + (on ? " on" : "") },
      h("input", { type: "checkbox", checked: on, onchange }), h("span", null, h("b", null, title), h("small", null, desc)));
    opts.replaceChildren(
      opt(open, "Anyone with the link", open ? "On: no sign-in or code needed." : "Off while a lock below is on. Tick to remove the locks.", e => { if (e.target.checked) setFlags({ code: false, email: false }); else { e.target.checked = true; toast("Turn on a lock below instead."); } }),
      opt(f.code, "People with an access code", "They type a code you share.", e => setFlags({ ...f, code: e.target.checked })),
      opt(f.email, "People who sign in", "A login screen: email + 6-digit code.", e => setFlags({ ...f, email: e.target.checked })),
      f.code && f.email ? h("div", { class: "access-both" }, "Both locks on: visitors sign in first, then enter the code.") : null);
    extra.replaceChildren();
    if (f.code) {
      const inp = h("input", { class: "input", id: "acode", maxLength: 20, placeholder: "e.g. STAFF2026", autocomplete: "off", style: { fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" } });
      const note = h("small", { class: "muted", style: { fontWeight: 400 } }, "Share this code only with the people who should fill in the form.");
      store.getAccessCode(page.id).then(c => { inp.value = c || ""; if (!c) note.textContent = "Set a code so people can open the form."; }).catch(() => {});
      let t; const saveCode = v => { clearTimeout(t); t = setTimeout(async () => {
        if (v && !/^[A-Za-z0-9-]{4,20}$/.test(v)) { note.textContent = "Use 4–20 letters, numbers or dashes."; return; }
        try { await store.setAccessCode(page.id, v.toUpperCase()); note.textContent = v ? "Code saved. Share it only with the people who should fill in the form." : "Set a code so people can open the form."; } catch (e) { note.textContent = e.message; }
      }, 600); };
      inp.oninput = () => saveCode(inp.value.trim());
      const gen = h("button", { class: "btn small", type: "button", onclick: () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; inp.value = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => a[n % a.length]).join(""); saveCode(inp.value); } }, "Generate");
      extra.append(h("label", { class: "field", for: "acode" }, "Access code", h("div", { style: { display: "flex", gap: "8px" } }, inp, gen), note));
    }
    if (f.email) {
      extra.append(h("label", { class: "switch" }, h("input", { type: "checkbox", checked: !!page.one_per_person, onchange: e => { page.one_per_person = e.target.checked; save(); } }), "Only one response per person"),
        h("small", { class: "muted", style: { fontWeight: 400 } }, store.mode === "demo" ? "In demo mode the code appears on screen instead of being emailed." : "Their verified email is saved with their answers."));
    }
  };
  draw(); box.append(opts, extra);
  return box;
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
  const submitOpts = {};
  const header = h("header", { class: "band on-color" + ((page.brand || {}).coverMode === "page" && (page.brand || {}).cover ? " clear" : ""), style: bandStyle(page) }, h("div", { class: "wrap", style: { maxWidth: "760px" } },
    preview ? topBar(h("button", { class: "btn small light", onclick: () => go("p-" + page.id) }, icon("back"), "Back to editing"), h("span", { class: "save-state" }, "Preview")) : null,
    markEl(page),
    h("h1", null, page.title || "Untitled page"), page.description ? h("p", null, linkify(page.description)) : null));
  const closed = !preview && !page.accepting;
  const about = aboutOn(page) ? page.brand.about : null;
  const site = (topBarEl, main) => {
    if (header.firstChild) header.firstChild.style.maxWidth = "1120px";
    const slot = h("div", { class: "site-main" }, main);
    let tab = "form";
    const show = t => { tab = t; header.hidden = t === "about"; document.body.classList.toggle("about-mode", t === "about"); slot.replaceChildren(t === "about" ? aboutPage(page, () => show("form")) : main); tabs && tabs.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.t === t)); window.scrollTo(0, 0); };
    const tabs = about ? h("div", { class: "site-tabs", role: "tablist" },
      h("button", { class: "on", "data-t": "form", role: "tab", onclick: () => show("form") }, "Form"),
      h("button", { "data-t": "about", role: "tab", onclick: () => show("about") }, "About us")) : null;
    mount(pageBg(page), topBarEl, siteNav(page, preview, tabs), header,
      h("div", { class: "site-body" }, slot, h("aside", { class: "site-ads", "aria-label": "Sponsored" }, about ? aboutTeaser(page, () => show("about")) : null, adSlot(), adSlot())),
      siteFooter(preview ? null : page.id));
  };
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
      case "short": case "email": case "phone": case "number": case "date": case "time": case "datetime": case "url":
        ctrl.append(h("input", { class: "input", id: fid, type: { short: "text", email: "email", phone: "tel", number: "number", date: "date", time: "time", datetime: "datetime-local", url: "url" }[b.type], placeholder: b.type === "url" ? "https://…" : null,
          inputMode: b.type === "phone" ? "tel" : b.type === "url" ? "url" : null, autocomplete: b.type === "email" ? "email" : b.type === "phone" ? "tel" : b.type === "url" ? "url" : null, maxLength: 500, disabled: closed,
          oninput: e => set(e.target.value), onblur: e => { if (b.type === "url" && e.target.value && !/^https?:\/\//i.test(e.target.value)) { e.target.value = "https://" + e.target.value.trim(); set(e.target.value); } } })); break;
      case "address": ctrl.append(h("textarea", { class: "textarea", id: fid, rows: 3, style: { minHeight: "90px" }, autocomplete: "street-address", placeholder: "Street, city, state, country", maxLength: 1000, disabled: closed, oninput: e => set(e.target.value) })); break;
      case "scale": {
        const max = b.max || 10, row = h("div", { class: "scale", role: "radiogroup", "aria-label": b.label });
        for (let n = 1; n <= max; n++) row.append(h("button", { type: "button", role: "radio", "aria-checked": "false", disabled: closed, onclick: e => { set(n); row.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === e.currentTarget); x.setAttribute("aria-checked", x === e.currentTarget); }); } }, n));
        ctrl.append(row);
        if (b.lowLabel || b.highLabel) ctrl.append(h("div", { class: "scale-labels" }, h("span", null, b.lowLabel || ""), h("span", null, b.highLabel || "")));
        break;
      }
      case "consent":
        box.querySelector(".ql").remove();
        ctrl.style.marginTop = "0";
        ctrl.append(h("label", { class: "choice consent" }, h("input", { type: "checkbox", id: fid, disabled: closed, onchange: e => set(e.target.checked ? "Agreed" : "") }), h("span", null, b.label || "I agree", b.required ? h("span", { style: { color: "var(--danger)" } }, " *") : null)));
        break;
      case "signature": {
        const cv = h("canvas", { class: "sig", width: 1200, height: 360, "aria-label": "Signature pad: draw your signature" });
        const ctx = cv.getContext("2d"); let drawing = false, drawn = false, last = null;
        ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#141318";
        const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
        cv.addEventListener("pointerdown", e => { if (closed) return; drawing = true; last = pt(e); cv.setPointerCapture(e.pointerId); e.preventDefault(); });
        cv.addEventListener("pointermove", e => { if (!drawing) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; drawn = true; });
        const end = () => { if (drawing && drawn) set({ __sig: cv }); drawing = false; };
        cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
        ctrl.append(cv, h("div", { class: "sig-row" }, h("span", { class: "muted" }, "Draw with your finger or mouse"), h("button", { type: "button", class: "btn small", disabled: closed, onclick: () => { ctx.clearRect(0, 0, cv.width, cv.height); drawn = false; set(null); } }, "Clear")));
        break;
      }
      case "long": ctrl.append(h("textarea", { class: "textarea", id: fid, maxLength: 5000, disabled: closed, oninput: e => set(e.target.value) })); break;
      case "dropdown": ctrl.append(h("select", { class: "select", id: fid, disabled: closed, onchange: e => set(e.target.value) }, h("option", { value: "" }, "Choose…"), (b.options || []).map(o => h("option", { value: o }, o)))); break;
      case "choice": (b.options || []).forEach(o => ctrl.append(h("label", { class: "choice" }, h("input", { type: "radio", name: fid, value: o, disabled: closed, onchange: () => set(o) }), o))); break;
      case "checkbox": (b.options || []).forEach(o => ctrl.append(h("label", { class: "choice" }, h("input", { type: "checkbox", value: o, disabled: closed, onchange: () => set([...ctrl.querySelectorAll("input:checked")].map(x => x.value)) }), o))); break;
      case "rating": {
        const st = h("div", { class: "stars", role: "radiogroup", "aria-label": b.label });
        for (let n = 1; n <= 5; n++) st.append(h("button", { type: "button", role: "radio", "aria-label": n + " star" + (n > 1 ? "s" : ""), disabled: closed, onclick: () => { set(n); st.querySelectorAll("button").forEach((x, k) => { x.classList.toggle("on", k < n); x.setAttribute("aria-checked", k === n - 1); }); } }, "★"));
        ctrl.append(st); break;
      }
      case "file": case "imageup": case "docup": {
        const U = UPLOADS[b.type], many = !!b.multiple;
        const baseHint = U.hint + " · up to 10 MB" + (many ? " each, 5 files max" : "");
        const chosen = h("div", { class: "picked" }, h("span", { class: "muted" }, baseHint));
        const inp = h("input", { type: "file", id: fid, class: "file-in", accept: U.accept || null, multiple: many, disabled: closed, onchange: e => {
          let files = [...e.target.files];
          const bad = files.find(f => !U.ok(f)); const big = files.find(f => f.size > LIMITS.file);
          if (bad) { e.target.value = ""; set(null); chosen.replaceChildren(h("span", { class: "bad" }, bad.name + " isn't allowed here. " + U.hint + " only.")); return; }
          if (big) { e.target.value = ""; set(null); chosen.replaceChildren(h("span", { class: "bad" }, big.name + " is " + fmtSize(big.size) + ". Each file must be under 10 MB.")); return; }
          if (many && files.length > 5) { files = files.slice(0, 5); toast("Only the first 5 files were kept."); }
          if (!files.length) { set(null); chosen.replaceChildren(h("span", { class: "muted" }, baseHint)); return; }
          set(many ? files : files[0]);
          chosen.replaceChildren(...files.map(f => h("span", { class: "pick" }, f.type.startsWith("image/") ? h("img", { src: URL.createObjectURL(f), alt: "" }) : icon("clip"), h("span", null, f.name), h("small", null, fmtSize(f.size)))));
        } });
        const word = b.type === "imageup" ? (many ? "Choose photos" : "Choose a photo") : b.type === "docup" ? (many ? "Choose documents" : "Choose a document") : (many ? "Choose files" : "Choose a file");
        ctrl.append(h("label", { class: "file-drop", for: fid }, icon(b.type === "imageup" ? "image" : "clip"), h("span", null, word)), inp, chosen); break;
      }
      case "yesno": {
        const row = h("div", { class: "yn" });
        ["Yes", "No"].forEach(v => row.append(h("button", { type: "button", disabled: closed, onclick: e => { set(v); row.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === e.currentTarget)); } }, v)));
        ctrl.append(row); break;
      }
    }
    box.append(ctrl); blockEls[b.id] = box; body.append(box);
    if (Object.keys(blockEls).length === 3) body.append(h("div", { class: "ad-inline" }, adSlot()));
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
      else if (!empty && b.type === "url" && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v)) msg = "Enter a full web address, like https://example.com.";
      else if (b.required && b.type === "consent" && v !== "Agreed") msg = "Please tick the box to continue.";
      box.classList.toggle("err", !!msg); const old = box.querySelector(".msg"); if (old) old.remove();
      if (msg) { box.append(h("div", { class: "msg" }, msg)); first ||= box; }
    }
    if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const out = { ...answers };
      const up = async f => { btn.textContent = "Uploading " + f.name + "…"; return store.uploadSubmission(page.id, f.type.startsWith("image/") ? await compressImage(f, 2400, false) : f); };
      for (const [k, v] of Object.entries(out)) {
        if (v instanceof File) out[k] = await up(v);
        else if (Array.isArray(v) && v.some(x => x instanceof File)) { const arr = []; for (const f of v) arr.push(await up(f)); out[k] = arr; }
        else if (v && v.__sig) {
          const blob = await new Promise(r => v.__sig.toBlob(r, "image/png"));
          out[k] = await up(new File([blob], "signature.png", { type: "image/png" }));
        }
      }
      btn.textContent = "Sending…";
      await store.submitResponse(page.id, out, submitOpts);
      site(null, h("div", { class: "form-page" }, h("div", { class: "fblock thanks" }, h("div", { class: "big" }, "🎉"), h("h2", null, "Sent!"),
        h("p", { class: "muted", style: { fontSize: "18px" } }, page.thank_you || "Thanks! We got your answers."),
        h("button", { class: "btn", onclick: () => route() }, "Send another response")), h("div", { class: "ad-inline after" }, adSlot())));
      window.scrollTo(0, 0);
    } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = "Submit"; }
  } }, body, h("div", { class: "form-page", style: { marginTop: 0 } }, h("div", { class: "submit-row" }, btn, closed ? h("span", { class: "muted" }, "This form is closed to new responses.") : h("span", { class: "muted", style: { fontSize: "14px" } }, "Never send passwords through forms."))));
  const access = page.access || "open";
  if (access === "open" || closed) {
    const pv = preview && access === "open" ? h("div", { class: "pv-bar" },
      h("span", null, "🔓 No sign-in: anyone with the link goes straight to the questions."),
      h("button", { class: "btn small light", onclick: async ev => {
        ev.currentTarget.disabled = true;
        try { await store.savePage({ ...page, access: "email" }); toast("Sign-in turned on"); route(); } catch (e) { toast(e.message); ev.currentTarget.disabled = false; }
      } }, "Require sign-in")) : null;
    return site(pv, form);
  }

  /* ---- sign-in screen: shown before the questions when the creator turned it on ---- */
  const needCode = access === "code" || access === "both", needEmail = access === "email" || access === "both";
  let codeOk = false;
  const unlock = async () => {
    const who = needEmail ? await store.respondentEmail().catch(() => null) : null;
    const bar = h("div", { class: "signed-bar" },
      who ? h("span", null, "Signed in as ", h("b", null, who)) : null,
      needCode ? h("span", null, "🔓 Access code accepted") : null,
      who ? h("button", { class: "btn small light", onclick: async () => { await store.forgetRespondent(); route(); } }, "Sign out") : null);
    site(bar, form);
  };
  const next = async () => {
    if (needEmail && !(await store.respondentEmail().catch(() => null))) return drawGate("email");
    if (needCode && !codeOk) return drawGate("code");
    return unlock();
  };
  const drawGate = async (stage) => {
  const b0 = page.brand || {};
  const art = h("aside", { class: "lg-art", style: b0.cover ? { backgroundColor: page.color, backgroundImage: `linear-gradient(160deg, ${hexA(page.color, 0.55)}, ${hexA("#141318", 0.75)}), url("${cssUrl(b0.cover)}")` } : { background: `linear-gradient(160deg, ${page.color}, ${hexA("#141318", 0.9)})` } },
    preview ? h("button", { class: "btn small light lg-back", onclick: () => go("p-" + page.id) }, icon("back"), "Back to editing") : null,
    markEl(page, "lg-mark"),
    h("div", { class: "lg-copy" }, h("h1", null, page.title || "Untitled page"), page.description ? h("p", null, linkify(page.description)) : null),
    h("div", { class: "lg-foot" }, preview ? "Preview · this is what visitors see first" : "🔒 Private form"));
  const panel = h("div", { class: "lg-panel" });
  const msg = h("div", { class: "lg-msg", role: "alert" });
  const showErr = m => { msg.textContent = m; msg.hidden = !m; };
  showErr("");
  const field = (id, label, input) => h("label", { class: "lg-field", for: id }, h("span", null, label), input);
  const primary = (text) => h("button", { class: "lg-btn", type: "submit", style: { background: page.color } }, text);
  if (needCode && needEmail) panel.append(h("div", { class: "lg-steps" },
    h("span", { class: stage === "email" ? "on" : "done" }, stage === "email" ? "1" : "✓", " Sign in"), h("i"), h("span", { class: stage === "code" ? "on" : "" }, "2", " Access code"), h("i"), h("span", null, "3", " Form")));

  if (stage === "code") {
    const inp = h("input", { class: "lg-input code-in", id: "gcode", autocomplete: "off", maxLength: 20, placeholder: "e.g. STAFF2026" });
    const go2 = primary("Continue");
    panel.append(h("div", { class: "lg-ic" }, "🔑"), h("h2", null, "Enter access code"), h("p", { class: "lg-sub" }, "This form is private. Enter the code you were given to continue."), msg,
      h("form", { class: "lg-form", onsubmit: async e => {
        e.preventDefault(); const c = inp.value.trim(); if (!c) return showErr("Type the access code first.");
        go2.disabled = true; go2.textContent = "Checking…"; showErr("");
        try {
          const ok = preview ? (await store.getAccessCode(page.id)).toLowerCase() === c.toLowerCase() : await store.checkCode(page.id, c);
          if (ok) { submitOpts.code = c; codeOk = true; return next(); }
          showErr("That code isn't right. Check it and try again.");
        } catch (err) { showErr(err.message); }
        go2.disabled = false; go2.textContent = "Continue";
      } }, field("gcode", "Access code", inp), go2),
      h("p", { class: "lg-note" }, "Don't have a code? Ask the person who shared this form."));
  } else {
    const signedIn = await store.respondentEmail().catch(() => null);
    if (signedIn) {
      panel.append(h("div", { class: "lg-ic" }, "👋"), h("h2", null, "Welcome back"), h("p", { class: "lg-sub" }, "You're signed in as ", h("b", null, signedIn), "."), msg,
        h("div", { class: "lg-form" }, h("button", { class: "lg-btn", style: { background: page.color }, onclick: next }, "Continue"),
          h("button", { class: "lg-link", onclick: async () => { await store.forgetRespondent(); route(); } }, "Not you? Use a different email")));
    } else {
      const em = h("input", { class: "lg-input", type: "email", id: "gem", autocomplete: "email", placeholder: "you@example.com" });
      const send = primary("Continue");
      const stepEmail = h("form", { class: "lg-form", onsubmit: async e => {
        e.preventDefault(); const v = em.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return showErr("Enter a valid email, like name@example.com.");
        send.disabled = true; send.textContent = "Sending code…"; showErr("");
        try { const r = await store.sendCode(v, page.id); showCode(v, r && r.demoCode, r && r.link); }
        catch (err) { showErr(err.message); }
        send.disabled = false; send.textContent = "Continue";
      } }, field("gem", "Email address", em), send);
      const head = h("div", { class: "lg-head" }, h("div", { class: "lg-ic" }, "👤"), h("h2", null, "Sign in to continue"), h("p", { class: "lg-sub" }, store.mode === "cloud" ? "Enter your email and we'll send you a sign-in link. No password needed." : "Enter your email and we'll send you a 6-digit code. No password needed."));
      const showCode = (email, demoCode, isLink) => {
        const digits = Array.from({ length: 6 }, (_, i) => h("input", { class: "otp", inputMode: "numeric", autocomplete: i ? "off" : "one-time-code", maxLength: 6, "aria-label": "Digit " + (i + 1) }));
        const ok = primary("Verify and continue");
        const val = () => digits.map(d => d.value).join("");
        digits.forEach((d, i) => {
          d.addEventListener("input", () => {
            const v = d.value.replace(/\D/g, "");
            if (v.length > 1) { v.slice(0, 6).split("").forEach((c, k) => { if (digits[k]) digits[k].value = c; }); digits[Math.min(5, v.length - 1)].focus(); }
            else { d.value = v; if (v && digits[i + 1]) digits[i + 1].focus(); }
            if (val().length === 6) ok.click();
          });
          d.addEventListener("keydown", e => { if (e.key === "Backspace" && !d.value && digits[i - 1]) digits[i - 1].focus(); });
        });
        head.replaceChildren(h("div", { class: "lg-ic" }, "✉️"), h("h2", null, "Check your email"),
          isLink ? h("p", { class: "lg-sub" }, "We sent a sign-in email to ", h("b", null, email), ". Open it and tap ", h("b", null, "Sign in"), ". This form opens, already signed in. It can take a minute; check spam too.")
            : h("p", { class: "lg-sub" }, "We sent a 6-digit code to ", h("b", null, email), ". It may take a minute; check spam too."),
          isLink ? h("p", { class: "lg-note" }, "If your email shows a 6-digit code instead, type it here:") : null,
          demoCode ? h("div", { class: "lg-demo" }, "Demo mode, no email sent. Your code is ", h("b", null, demoCode)) : null);
        const f = h("form", { class: "lg-form", onsubmit: async e => {
          e.preventDefault(); if (val().length < 6) return showErr("Enter all 6 digits.");
          ok.disabled = true; ok.textContent = "Checking…"; showErr("");
          try { await store.verifyCode(email, val()); return next(); } catch (err) { showErr(err.message); digits.forEach(d => d.value = ""); digits[0].focus(); }
          ok.disabled = false; ok.textContent = "Verify and continue";
        } }, h("div", { class: "otp-row" }, digits), ok,
          h("div", { class: "lg-row" }, h("button", { class: "lg-link", type: "button", onclick: () => route() }, "Use a different email"),
            h("button", { class: "lg-link", type: "button", onclick: async ev => { ev.target.disabled = true; try { const r = await store.sendCode(email, page.id); showCode(email, r && r.demoCode, r && r.link); toast("Sent again"); } catch (err) { showErr(err.message); ev.target.disabled = false; } } }, "Send a new code")));
        stepEmail.replaceWith(f); stepEmail.remove();
        panel.querySelectorAll(".lg-form").forEach(x => { if (x !== f) x.remove(); });
        if (!panel.contains(f)) panel.insertBefore(f, panel.querySelector(".lg-note"));
        setTimeout(() => digits[0].focus(), 40);
      };
      panel.append(head, msg, stepEmail, h("p", { class: "lg-note" }, "We only use your email to confirm it's you."));
    }
  }
  panel.append(h("div", { class: "lg-secure" }, svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'), "Secured by Blocko"));
  mount(h("div", { class: "lg-wrap" }, art, h("main", { class: "lg-main" }, panel)), siteFooter(preview ? null : page.id));
  setTimeout(() => { const f = panel.querySelector("input"); if (f) f.focus(); }, 60);
  };
  await next();
}
function aboutOn(page) { const a = (page.brand || {}).about; return !!(a && a.on && (a.story || a.tagline || (a.stats || []).some(s => s.value) || a.wins || a.photo || (a.slides || []).length || (a.links || []).length)); }
const safeUrl = u => { try { const x = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
function slideshow(urls, color) {
  const track = h("div", { class: "slides-track" }, urls.map(u => h("div", { class: "slide" }, h("img", { src: u, alt: "", loading: "lazy" }))));
  const dots = h("div", { class: "slides-dots" }, urls.map((_, i) => h("button", { "aria-label": "Picture " + (i + 1), onclick: () => goTo(i) })));
  let cur = 0, timer;
  const paint = () => [...dots.children].forEach((d, i) => { d.classList.toggle("on", i === cur); d.style.background = i === cur ? color : ""; });
  const goTo = i => { cur = (i + urls.length) % urls.length; track.scrollTo({ left: track.clientWidth * cur, behavior: "smooth" }); paint(); restart(); };
  const restart = () => { clearInterval(timer); if (urls.length > 1) timer = setInterval(() => { if (!track.isConnected) return clearInterval(timer); goTo(cur + 1); }, 3500); };
  let st; track.addEventListener("scroll", () => { clearTimeout(st); st = setTimeout(() => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== cur) { cur = i; paint(); restart(); } }, 120); });
  const arrow = (dir, label) => urls.length > 1 ? h("button", { class: "slides-arrow " + (dir < 0 ? "prev" : "next"), "aria-label": label, onclick: () => goTo(cur + dir) }, dir < 0 ? "‹" : "›") : null;
  paint(); restart();
  return h("div", { class: "slides" }, track, arrow(-1, "Previous picture"), arrow(1, "Next picture"), urls.length > 1 ? dots : null);
}
function aboutTeaser(page, open) {
  const a = page.brand.about;
  return h("div", { class: "about-teaser" }, h("small", null, "About"), h("b", null, a.name || page.title || "Us"),
    a.tagline ? h("p", null, a.tagline) : null, h("button", { class: "btn small", onclick: open }, "Learn about us →"));
}
function aboutPage(page, back) {
  const a = page.brand.about, b = page.brand;
  const stats = (a.stats || []).filter(s => s.value || s.label);
  const wins = (a.wins || "").split("\n").map(x => x.trim()).filter(Boolean);
  const web = a.website && safeUrl(a.website);
  const contacts = [
    web ? h("a", { href: web, target: "_blank", rel: "noopener" }, "🌐 ", web.replace(/^https?:\/\//, "").replace(/\/$/, "")) : null,
    a.email ? h("a", { href: "mailto:" + a.email }, "✉️ ", a.email) : null,
    a.phone ? h("a", { href: "tel:" + a.phone.replace(/[^\d+]/g, "") }, "📞 ", a.phone) : null,
    a.address ? h("span", null, "📍 ", a.address) : null].filter(Boolean);
  const linkBtns = (a.links || []).slice(0, 5).map(l => { const u = l.url && safeUrl(l.url); return u ? h("a", { class: "about-link", href: u, target: "_blank", rel: "noopener" }, h("span", null, l.label || u.replace(/^https?:\/\//, "").replace(/\/$/, "")), h("i", null, "↗")) : null; }).filter(Boolean);
  return h("article", { class: "about-page" },
    h("div", { class: "about-hero" }, b.logo ? h("img", { class: "about-logo", src: b.logo, alt: "" }) : h("span", { class: "about-emoji" }, page.emoji || "🏢"),
      h("div", null, h("small", null, "About us"), h("h2", null, a.name || page.title || "About us"), a.tagline ? h("p", null, a.tagline) : null)),
    stats.length ? h("div", { class: "about-stats" }, stats.map(s => h("div", { class: "about-stat" }, h("b", null, s.value), h("span", null, s.label)))) : null,
    a.photo ? h("img", { class: "about-photo", src: a.photo, alt: "", loading: "lazy" }) : null,
    (a.slides || []).length ? slideshow(a.slides, "#141318") : null,
    a.story ? h("section", null, h("h3", null, "What we do"), h("div", { class: "about-story" }, linkify(a.story))) : null,
    wins.length ? h("section", null, h("h3", null, "What we've achieved"), h("ul", { class: "about-wins" }, wins.map(w => h("li", null, h("span", { class: "tick" }, "✓"), w)))) : null,
    contacts.length ? h("section", null, h("h3", null, "Get in touch"), h("div", { class: "about-contacts" }, contacts)) : null,
    linkBtns.length ? h("section", null, h("h3", null, "Links"), h("div", { class: "about-links" }, linkBtns)) : null,
    h("div", { class: "about-back" }, h("button", { class: "about-backbtn", onclick: back }, "← Back to the form")));
}
function siteNav(page, preview, tabs) {
  const b = page.brand || {};
  return h("nav", { class: "site-nav" }, h("div", { class: "site-nav-in" },
    h("div", { class: "site-brand" }, b.logo ? h("img", { src: b.logo, alt: "" }) : h("span", { class: "e" }, page.emoji || "📝"), h("b", null, page.title || "Untitled page")),
    tabs,
    h("div", { class: "spacer" }),
    preview ? h("span", { class: "pill draft" }, "Preview") : null,
    h("a", { class: "btn small dark site-cta", href: location.pathname + "#home" }, "Create a free form")));
}
function siteFooter(pageId) {
  return h("footer", { class: "site-foot" }, h("div", { class: "site-foot-in" },
    h("div", { class: "foot-promo" }, h("div", { class: "logo" }, h("span", { class: "mk" }, h("i"), h("i"), h("i"), h("i")), "Blocko"),
      h("p", null, "Make pages that tell and forms that collect. Free for everyone."),
      h("a", { class: "btn small", style: { background: "#fff", borderColor: "#fff", color: "var(--ink)" }, href: location.pathname + "#home" }, "Create your own form, free →")),
    h("div", { class: "foot-links" }, h("a", { href: "#terms" }, "Terms of Use"),
      pageId ? h("button", { class: "report-link", onclick: () => reportSheet(pageId) }, "Report this form") : null,
      h("span", null, "© " + new Date().getFullYear() + " Blocko"))));
}
let adsCache = null, adTurn = 0;
const getAds = () => adsCache ||= store.listAds().then(list => list.sort(() => Math.random() - 0.5)).catch(() => []);
function adSlot() {
  const el = h("div", { class: "ad-slot" });
  getAds().then(list => el.replaceChildren(list.length ? adCard(list[adTurn++ % list.length]) : houseAd()));
  return el;
}
function adCard(ad) {
  store.adEvent(ad.id, "view");
  return h("a", { class: "ad-card", href: ad.link, target: "_blank", rel: "noopener sponsored nofollow", onclick: () => store.adEvent(ad.id, "click") },
    h("span", { class: "ad-tag" }, "Sponsored"),
    ad.image ? h("img", { src: ad.image, alt: "", loading: "lazy" }) : null,
    h("div", { class: "ad-txt" }, h("b", null, ad.title), ad.body ? h("p", null, ad.body) : null,
      h("span", { class: "ad-cta" }, (ad.cta || "Learn more") + " →"), ad.advertiser ? h("small", null, ad.advertiser) : null));
}
function houseAd() {
  const c = (window.BLOCKO_CONFIG || {}).contactEmail;
  return h("a", { class: "ad-card house", href: c ? "mailto:" + c + "?subject=Advertise%20on%20Blocko" : location.pathname + "#home", target: c ? null : "_blank" },
    h("span", { class: "ad-tag" }, "Advertise here"),
    h("div", { class: "ad-txt" }, h("b", null, "Your business could be here"), h("p", null, "Reach people filling in forms on Blocko every day."),
      h("span", { class: "ad-cta" }, (c ? "Contact us" : "Get started") + " →")));
}
const madeWith = (pageId) => h("div", { class: "made" }, "Made with ", h("a", { href: location.pathname + "#home" }, "Blocko"), " · ",
  h("a", { href: "#terms" }, "Terms"), pageId ? [" · ", h("button", { class: "report-link", onclick: () => reportSheet(pageId) }, "Report this form")] : null);
function reportSheet(pageId) {
  sheet((b, close) => {
    const reason = h("select", { class: "select", id: "rr" }, ["It's a scam or fraud", "It asks for passwords, PINs or bank details", "It pretends to be another company or person", "Harassment or threats", "Illegal goods or activity", "Something else"].map(r => h("option", { value: r }, r)));
    const details = h("textarea", { class: "textarea", id: "rd", maxLength: 2000, placeholder: "What's wrong with this form? (optional)" });
    const em = h("input", { class: "input", type: "email", id: "re", placeholder: "Your email, if we may follow up (optional)" });
    const send = h("button", { class: "btn danger", type: "submit" }, "Send report");
    b.append(h("h2", null, "Report this form"),
      h("p", { class: "muted", style: { margin: 0 } }, "If this form looks suspicious, tell us. Don't enter any more of your information into it."),
      h("form", { style: { display: "grid", gap: "12px" }, onsubmit: async e => {
        e.preventDefault(); send.disabled = true;
        try { await store.reportForm(pageId, reason.value, details.value.trim(), em.value.trim()); close(); toast("Thanks, your report has been sent."); }
        catch (err) { toast(err.message); send.disabled = false; }
      } }, h("label", { class: "field", for: "rr" }, "What's the problem?", reason), h("label", { class: "field", for: "rd" }, "Details", details), h("label", { class: "field", for: "re" }, "Email", em),
        h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: close }, "Cancel"), send)));
  });
}

/* ============================================================ responses */
async function viewResponses(id) {
  const page = await store.getPage(id);
  if (!page) return go("home");
  document.documentElement.style.setProperty("--page", page.color);
  let rows = [];
  try { rows = await store.listResponses(id); } catch (e) { toast(e.message); }
  let mode = "summary";
  const qs = page.blocks.filter(isQuestion);
  const hasEmail = rows.some(r => r.respondent_email);
  const week = rows.filter(r => Date.now() - new Date(r.created_at) < 7 * 864e5).length;
  const band = h("header", { class: "band on-color", style: bandStyle({ ...page, brand: { ...(page.brand || {}), coverMode: "header" } }) }, h("div", { class: "wrap" },
    topBar(h("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, h("button", { class: "icon-btn", "aria-label": "Back to home", onclick: () => go("home") }, icon("back")), logo()),
      h("button", { class: "btn small light", onclick: () => shareSheet(page, null) }, icon("share"), "Share")),
    markEl(page),
    h("h1", null, page.title || "Untitled page"),
    h("div", { class: "tabs" }, h("button", { onclick: () => go("p-" + page.id) }, "Build"), h("button", { class: "on" }, "Responses", h("span", { class: "count" }, rows.length)))));
  const stats = h("div", { class: "stats" },
    h("div", { class: "stat" }, h("b", null, rows.length), h("span", null, "Total responses")),
    h("div", { class: "stat" }, h("b", null, week), h("span", null, "In the last 7 days")),
    h("div", { class: "stat" }, h("b", { style: { fontSize: "26px", lineHeight: "40px" } }, rows[0] ? ago(rows[0].created_at) : "—"), h("span", null, "Latest response")));
  const content = h("div");
  const seg = h("div", { class: "seg" });
  const drawSeg = () => seg.replaceChildren(...[["summary", "Summary"], ["table", "All answers"]].map(([k, l]) => h("button", { class: mode === k ? "on" : "", onclick: () => { mode = k; drawSeg(); draw(); } }, l)));
  const one = v => isFileVal(v) ? v.name : String(v);
  const val = (r, b) => { const v = r.answers ? r.answers[b.id] : undefined; return v == null ? "" : Array.isArray(v) ? v.map(one).join(", ") : typeof v === "object" ? (v.name || "") : b.type === "datetime" ? String(v).replace("T", " ") : String(v); };
  const filesOf = v => (Array.isArray(v) ? v : [v]).filter(isFileVal);
  const cell = (r, b) => { const v = r.answers ? r.answers[b.id] : undefined; const fs = v ? filesOf(v) : []; return fs.length ? h("div", { class: "chips" }, fs.map(fileChip)) : val(r, b); };
  function draw() {
    if (!rows.length) return content.replaceChildren(h("div", { class: "empty" }, h("h3", null, "No responses yet"), h("p", { class: "muted" }, page.published ? "Share your link to start collecting answers." : "Publish your page and share the link to start collecting answers."),
      h("button", { class: "btn brand", onclick: () => shareSheet(page, null) }, icon("share"), page.published ? "Share link" : "Publish & share")));
    if (mode === "summary") {
      content.replaceChildren(h("div", { class: "sum" }, qs.map(b => {
        const vals = rows.map(r => r.answers ? r.answers[b.id] : undefined).filter(v => v != null && v !== "" && !(Array.isArray(v) && !v.length));
        const card = h("div", { class: "sum-card" }, h("h3", null, b.label || "Untitled question"), h("div", { class: "sub" }, vals.length + " of " + rows.length + " answered"));
        if (["choice", "checkbox", "dropdown", "yesno", "rating", "scale", "consent"].includes(b.type)) {
          const keys = b.type === "yesno" ? ["Yes", "No"] : b.type === "consent" ? ["Agreed"] : b.type === "rating" ? ["5", "4", "3", "2", "1"] : b.type === "scale" ? Array.from({ length: b.max || 10 }, (_, i) => String((b.max || 10) - i)) : [...(b.options || [])];
          if (b.type === "scale") { const avg = vals.reduce((a, v) => a + Number(v), 0) / (vals.length || 1); card.append(h("div", { class: "big-num" }, avg.toFixed(1), h("span", { class: "muted", style: { fontSize: "18px" } }, " / " + (b.max || 10) + " average"))); }
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
        } else if (isUpload(b.type) || b.type === "signature") {
          card.append(h("div", { class: "chips" }, vals.slice(0, 60).flatMap(filesOf).map(fileChip)));
        } else if (b.type === "file") {
          card.append(h("div", { class: "texts" }, vals.slice(0, 50).map(v => h("div", null, v && v.path ? fileChip(v) : String(v)))));
        } else {
          card.append(h("div", { class: "texts" }, vals.slice(0, 50).map(v => h("div", null, String(v)))));
        }
        return card;
      })));
    } else {
      content.replaceChildren(h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, h("th", null, "Submitted"), hasEmail ? h("th", null, "Verified email") : null, qs.map(b => h("th", null, b.label || "Untitled")), h("th", null, ""))),
        h("tbody", null, rows.map(r => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, fmtDate(r.created_at)), hasEmail ? h("td", { style: { whiteSpace: "nowrap" } }, r.respondent_email || "") : null, qs.map(b => h("td", null, cell(r, b))),
          h("td", null, h("button", { class: "icon-btn", "aria-label": "Delete response", onclick: () => confirmSheet("Delete this response?", "It's removed for good.", "Delete", async () => { await store.deleteResponse(r.id); rows = rows.filter(x => x.id !== r.id); draw(); toast("Response deleted"); }) }, icon("trash")))))))));
    }
  }
  function exportCsv() {
    const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
    const lines = [["Submitted", ...(hasEmail ? ["Verified email"] : []), ...qs.map(b => b.label || "Untitled")].map(esc).join(",")]
      .concat(rows.map(r => [new Date(r.created_at).toISOString(), ...(hasEmail ? [r.respondent_email || ""] : []), ...qs.map(b => val(r, b))].map(esc).join(",")));
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

/* ============================================================ ads manager (app owner only) */
async function viewAdsManager() {
  if (!(await store.isAdmin())) { toast("Only the Blocko owner can manage ads."); return go("home"); }
  const ads = await store.adminListAds();
  const views = ads.reduce((a, x) => a + (x.views || 0), 0), clicks = ads.reduce((a, x) => a + (x.clicks || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const running = ads.filter(a => a.active && (!a.ends_on || a.ends_on >= today)).length;
  const list = ads.length ? h("div", { class: "ads-list" }, ads.map(ad => {
    const live = ad.active && (!ad.ends_on || ad.ends_on >= today);
    return h("div", { class: "ads-row" },
      h("div", { class: "ads-prev" }, adCardStatic(ad)),
      h("div", { class: "ads-info" },
        h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, h("b", null, ad.title), h("span", { class: "pill " + (live ? "live" : "draft") }, live ? "Running" : ad.active ? "Ended" : "Paused")),
        h("div", { class: "muted", style: { fontSize: "14px" } }, (ad.advertiser ? ad.advertiser + " · " : "") + ad.link),
        h("div", { class: "ads-stats" }, h("span", null, h("b", null, (ad.views || 0).toLocaleString()), " views"), h("span", null, h("b", null, (ad.clicks || 0).toLocaleString()), " clicks"),
          h("span", null, h("b", null, ad.views ? ((ad.clicks || 0) / ad.views * 100).toFixed(1) + "%" : "—"), " click rate"), ad.ends_on ? h("span", null, "Ends " + ad.ends_on) : null),
        h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("button", { class: "btn small", onclick: () => adSheet(ad) }, "Edit"),
          h("button", { class: "btn small", onclick: async () => { await store.saveAd({ ...ad, active: !ad.active }); toast(ad.active ? "Ad paused" : "Ad running"); adsCache = null; route(); } }, ad.active ? "Pause" : "Resume"),
          h("button", { class: "btn small", style: { color: "var(--danger)" }, onclick: () => confirmSheet("Delete this ad?", "Its views and clicks are deleted too.", "Delete", async () => { await store.deleteAd(ad.id); adsCache = null; route(); }) }, "Delete"))));
  })) : h("div", { class: "empty" }, h("h3", null, "No ads yet"), h("p", { class: "muted" }, "Until you add one, published forms show an “Advertise here” box that points people to you."),
    h("button", { class: "btn brand", onclick: () => adSheet() }, icon("plus"), "Create your first ad"));
  mount(h("header", { class: "band on-color", style: { background: "var(--c-ink)" } }, h("div", { class: "wrap" },
      topBar(h("div", { style: { display: "flex", gap: "4px", alignItems: "center" } }, h("button", { class: "icon-btn", "aria-label": "Back to home", onclick: () => go("home") }, icon("back")), logo()),
        h("button", { class: "btn small light", onclick: () => adSheet() }, icon("plus"), "New ad")),
      h("h1", null, "Ads manager"), h("p", null, "Sponsored ads appear beside and below every published form. Only you can see this page."))),
    h("main", { class: "wrap" },
      h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", null, running), h("span", null, "Ads running")), h("div", { class: "stat" }, h("b", null, views.toLocaleString()), h("span", null, "Total views")),
        h("div", { class: "stat" }, h("b", null, clicks.toLocaleString()), h("span", null, "Total clicks"))),
      list, h("div", { style: { height: "60px" } })));
}
function adCardStatic(ad) {
  return h("div", { class: "ad-card", style: { pointerEvents: "none" } }, h("span", { class: "ad-tag" }, "Sponsored"),
    ad.image ? h("img", { src: ad.image, alt: "" }) : null,
    h("div", { class: "ad-txt" }, h("b", null, ad.title || "Your headline"), ad.body ? h("p", null, ad.body) : null, h("span", { class: "ad-cta" }, (ad.cta || "Learn more") + " →"), ad.advertiser ? h("small", null, ad.advertiser) : null));
}
function adSheet(existing) {
  const ad = existing ? { ...existing } : { title: "", body: "", image: "", link: "https://", cta: "Learn more", advertiser: "", active: true, ends_on: "" };
  sheet((b, close) => {
    const prev = h("div", { class: "ads-prev big" });
    const draw = () => prev.replaceChildren(adCardStatic(ad));
    const f = (id, label, el) => h("label", { class: "field", for: id }, label, el);
    const inp = (id, key, props) => h("input", { class: "input", id, value: ad[key] || "", ...props, oninput: e => { ad[key] = e.target.value; draw(); } });
    const img = h("button", { class: "btn small dark", type: "button", onclick: () => pickFile("image/png,image/jpeg,image/webp,image/gif", async file => {
      img.disabled = true; img.lastChild.textContent = "Uploading…";
      try { ad.image = await store.uploadMedia(await compressImage(file, 1200, false)); draw(); } catch (e) { toast(e.message); }
      img.disabled = false; img.lastChild.textContent = ad.image ? "Change picture" : "Upload picture";
    }) }, icon("image"), h("span", null, ad.image ? "Change picture" : "Upload picture"));
    const save = h("button", { class: "btn brand", type: "submit" }, existing ? "Save ad" : "Publish ad");
    b.append(h("h2", null, existing ? "Edit ad" : "New ad"), prev,
      h("form", { style: { display: "grid", gap: "12px" }, onsubmit: async e => {
        e.preventDefault();
        if (!ad.title.trim()) return toast("Add a headline.");
        if (!/^https:\/\/[^\s.]+\.[^\s]+$/i.test(ad.link.trim())) return toast("The link must be a full web address starting with https://");
        save.disabled = true;
        try { await store.saveAd({ ...ad, title: ad.title.trim(), link: ad.link.trim(), ends_on: ad.ends_on || null }); adsCache = null; close(); toast(existing ? "Ad saved" : "Ad is live"); route(); }
        catch (err) { toast(err.message); save.disabled = false; }
      } },
        f("ad-adv", "Advertiser (who is paying)", inp("ad-adv", "advertiser", { placeholder: "e.g. Mama Put Kitchen", maxLength: 60 })),
        f("ad-t", "Headline", inp("ad-t", "title", { placeholder: "e.g. 20% off lunch this week", maxLength: 80, required: true })),
        f("ad-b", "Short text", inp("ad-b", "body", { placeholder: "One line about the offer", maxLength: 200 })),
        h("div", { class: "field" }, "Picture (optional)", h("div", { style: { display: "flex", gap: "8px" } }, img, ad.image ? h("button", { class: "btn small", type: "button", onclick: () => { ad.image = ""; draw(); } }, "Remove") : null)),
        f("ad-l", "Link (where the ad goes)", inp("ad-l", "link", { type: "url", placeholder: "https://example.com", required: true })),
        f("ad-c", "Button text", inp("ad-c", "cta", { maxLength: 30 })),
        f("ad-e", "End date (optional)", inp("ad-e", "ends_on", { type: "date" })),
        h("label", { class: "switch" }, h("input", { type: "checkbox", checked: ad.active, onchange: e => { ad.active = e.target.checked; } }), "Show this ad now"),
        h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: close }, "Cancel"), save)));
    draw();
  });
}

/* ============================================================ terms */
function termsBody() {
  const contact = (window.BLOCKO_CONFIG || {}).contactEmail;
  const S = (t, ...kids) => h("section", null, h("h2", null, t), ...kids);
  const P = t => h("p", null, t);
  const L = items => h("ul", null, items.map(i => h("li", null, i)));
  return h("article", { class: "terms" },
    h("p", { class: "terms-date" }, "Version " + TERMS_VERSION + " · Last updated 3 November 2026"),
    P("These Terms of Use and Acceptable Use Policy are an agreement between you and Blocko. By creating an account, building a page or form, or publishing one, you agree to them. If you use Blocko for a company or organisation, you confirm you're allowed to accept these terms for it."),
    S("1. You are responsible for the information you collect",
      P("Blocko is a tool. You decide what your forms ask and what you do with the answers, so you are the one responsible for that information, not Blocko. When you collect people's information you must:"),
      L(["Have a lawful reason to collect it, and collect only what you actually need.",
        "Tell people who you are, why you're collecting their information and how you'll use it.",
        "Get consent where the law requires it, including from a parent or guardian before collecting information about children.",
        "Keep it safe, share it only where you're allowed to, and delete it when you no longer need it.",
        "Respond to people who ask to see, correct or delete their information.",
        "Follow every data protection, privacy, consumer and other law that applies to you and to the people filling in your forms, for example the Nigeria Data Protection Act 2023, the EU General Data Protection Regulation, and the laws of your state and country."])),
    S("2. What you must never use Blocko for",
      L(["Scams, fraud, fake giveaways, fake jobs or fake investment schemes.",
        "Collecting passwords, PINs, one-time codes, card numbers, CVVs or online-banking logins.",
        "Pretending to be a bank, company, government body, school or any other person or organisation.",
        "Harassing, threatening, stalking, blackmailing or tracking anyone.",
        "Collecting information about people without their knowledge, or selling it.",
        "Selling or arranging illegal goods or services, or anything else that's illegal where you or the people filling in your form are.",
        "Spreading malware, spam or misleading information."])),
    S("3. Legal consequences",
      P("If you use Blocko to collect or use people's information for illegal purposes, you alone are responsible. You may be held liable, civilly and criminally, under the laws of your state and country, and under the laws of any place where the people you collected information from live."),
      P("You agree to cover any losses, claims, fines or costs that Blocko faces because of how you used the service or broke these terms.")),
    S("4. What we can do about misuse",
      L(["Remove or unpublish forms and pages, and delete their content.",
        "Suspend or close accounts, without notice where the abuse is serious.",
        "Keep relevant records and share them with law enforcement or regulators when the law requires it or to protect people from harm."])),
    S("5. Reporting abuse",
      P("Every public form has a \u201cReport this form\u201d link at the bottom. If a form asks for passwords or bank details, pretends to be someone it isn't, or looks like a scam, please report it and don't enter any more information."),
      contact ? P("You can also email " + contact + ".") : null),
    S("6. The service",
      P("Blocko is provided \u201cas is\u201d. We work to keep it available and secure, but we can't promise it will never have errors or downtime, and we aren't responsible for losses caused by how you use it, to the extent the law allows. We may update these terms; if we make important changes we'll ask you to agree again.")));
}
function viewTerms() {
  document.title = "Terms of Use · Blocko";
  mount(h("header", { class: "band on-color", style: { background: "var(--c-ink)" } }, h("div", { class: "wrap", style: { maxWidth: "820px" } },
      topBar(h("div", { style: { display: "flex", gap: "4px", alignItems: "center" } }, h("button", { class: "icon-btn", "aria-label": "Back", onclick: () => history.length > 1 ? history.back() : go("home") }, icon("back")), logo()), null),
      h("h1", null, "Terms of Use"), h("p", null, "Including our Acceptable Use Policy. Please read them; they protect the people who fill in forms, and they protect you."))),
    h("main", { class: "wrap", style: { maxWidth: "820px" } }, h("div", { class: "terms-card" }, termsBody())));
}
function viewAgree() {
  const cb = h("input", { type: "checkbox", id: "agree2" });
  const btn = h("button", { class: "btn brand", disabled: true, style: { height: "54px" } }, "Agree and continue");
  cb.onchange = () => { btn.disabled = !cb.checked; };
  btn.onclick = async () => { btn.disabled = true; try { await store.acceptTerms(); route(); } catch (e) { toast(e.message); btn.disabled = false; } };
  mount(h("header", { class: "band on-color", style: { background: "var(--brand)" } }, h("div", { class: "wrap", style: { maxWidth: "820px" } },
      topBar(logo(), null), h("h1", null, "One quick thing"), h("p", null, "Before you build forms that collect people's information, please read and agree to our Terms of Use."))),
    h("main", { class: "wrap", style: { maxWidth: "820px" } }, h("div", { class: "terms-card" }, h("div", { class: "terms-scroll" }, termsBody()),
      h("label", { class: "agree-row big", for: "agree2" }, cb, h("span", null, "I have read and agree to the Terms of Use. I understand I'm responsible for the information my forms collect, and that I can be held legally responsible under the laws of my state and country if I use Blocko for illegal purposes.")),
      btn)));
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
    if (kind === "terms") return viewTerms();
    if (store.mode === "cloud" && !user) return viewLogin();
    if (!(await store.termsAccepted())) return viewAgree();
    if (store.mode === "cloud" && !store.ws) { await store.init(); }
    if (my !== routing) return;
    if (kind === "p" && id) return await viewEditor(id);
    if (kind === "r" && id) return await viewResponses(id);
    if (kind === "ads") return await viewAdsManager();
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
    // arrived from a sign-in email link for a form: go back to that form
    const formParam = new URLSearchParams(location.search).get("form");
    if (formParam && /^[0-9a-f-]{36}$/i.test(formParam)) history.replaceState(null, "", location.pathname + "#f-" + formParam);
    store.onAuth(async u => {
      const was = !!user; user = u;
      if (!u) store.ws = null;
      if (was !== !!u) route(); // also unlocks a form waiting for sign-in (e.g. link opened in another tab)
    });
  }
  addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
