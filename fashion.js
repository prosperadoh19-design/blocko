// "Fashion house" page style: a black-and-gold luxury brand site built from the page's blocks.
import { sectionLinks } from "./artist.js";

// prices: brands type a number; the lookbook's currency adds the symbol
export const CURRENCIES = [["NGN", "₦", "Naira"], ["USD", "$", "US dollar"], ["GBP", "£", "Pound"], ["EUR", "€", "Euro"], ["GHS", "GH₵", "Cedi"], ["KES", "KSh", "Kenyan shilling"],
  ["ZAR", "R", "Rand"], ["XOF", "CFA", "CFA franc"], ["CAD", "CA$", "Canadian dollar"], ["AED", "AED", "Dirham"]];
export function fmtPrice(price, currency) {
  const raw = String(price || "").trim();
  if (!raw) return "";
  const sym = (CURRENCIES.find(c => c[0] === (currency || "NGN")) || CURRENCIES[0])[1];
  const bare = raw.replace(/^(₦|\$|£|€|GH₵|KSh|CFA|CA\$|AED|R|NGN|USD|GBP|EUR|GHS|KES|ZAR|XOF|CAD)\s*/i, "").trim();
  if (!/^\d[\d,]*(\.\d+)?$/.test(bare)) return raw; // e.g. "From ₦50,000" or "On request" stays as typed
  const n = Number(bare.replace(/,/g, ""));
  return (sym.length > 1 && /[A-Za-z]$/.test(sym) ? sym + " " : sym) + n.toLocaleString("en", { maximumFractionDigits: 2 });
}

const FA = { Instagram: "fa-brands fa-instagram", TikTok: "fa-brands fa-tiktok", Facebook: "fa-brands fa-facebook", "X (Twitter)": "fa-brands fa-x-twitter", YouTube: "fa-brands fa-youtube",
  Pinterest: "fa-brands fa-pinterest", LinkedIn: "fa-brands fa-linkedin", WhatsApp: "fa-brands fa-whatsapp", Snapchat: "fa-brands fa-snapchat", Threads: "fa-brands fa-threads", Website: "fa-solid fa-globe" };

function loadAssets() {
  if (document.getElementById("fh-assets")) return;
  const add = (href, id) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; if (id) l.id = id; document.head.append(l); };
  add("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Montserrat:wght@200;300;400;500;600&display=swap", "fh-assets");
  if (!document.getElementById("ar-assets")) add("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css", "ar-assets");
}

export function fashionSite(d, page, preview, topBarEl, main) {
  const { h, toast, adSlot, safeUrl, platformOf, galleryEl, mount, ytId, videoModal, linkify, reportSheet, go } = d;
  loadAssets();
  const fa = cls => h("i", { class: cls, "aria-hidden": "true" });
  const B = page.blocks || [];
  const all = t => B.filter(b => b.type === t);
  const m = all("maison")[0] || {};
  const name = page.title || "Maison";
  const cover = (page.brand || {}).cover || "backgrounds/silk.jpg";
  const logo = (page.brand || {}).logo;
  const links = all("links").flatMap(b => b.items || []).map(l => ({ ...l, href: l.url && safeUrl(l.url) })).filter(l => l.href).map(l => ({ ...l, plat: l.label && FA[l.label] ? l.label : platformOf(l.href) }));
  const looks = all("lookbook").flatMap(b => (b.items || []).map(x => ({ ...x, price: fmtPrice(x.price, b.currency) }))).filter(x => x.img);
  const imgs = all("gallery").flatMap(g => g.images || []);
  const vids = all("video").flatMap(v => (v.items || []).filter(x => ytId(x.url)));
  const phone = (m.phone || "").replace(/[^\d+]/g, "");
  const wa = text => "https://wa.me/" + phone.replace(/^\+/, "") + "?text=" + encodeURIComponent(text);
  const mail = (subj, body) => "mailto:" + m.email + "?subject=" + encodeURIComponent(subj) + (body ? "&body=" + encodeURIComponent(body) : "");
  const hasForm = B.some(d.isQuestion);
  const nav = [], parts = [];
  const title = (kick, t, opts = {}) => h("div", { class: "fh-title" }, h("p", null, kick), h("h2", null, t), opts.sub ? h("span", null, opts.sub) : null);

  /* hero */
  const hero = h("section", { id: "fh-top", class: "fh-hero" },
    h("div", { class: "fh-hero-bg", style: { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } }), h("div", { class: "fh-hero-fade" }),
    h("div", { class: "fh-hero-in" },
      logo ? h("img", { class: "fh-hero-logo", src: logo, alt: name }) : null,
      m.season ? h("p", { class: "fh-season" }, m.season) : null,
      h("h1", null, m.heroTitle || name),
      page.description ? h("p", { class: "fh-sub" }, page.description) : null,
      h("div", { class: "fh-cta" },
        looks.length ? h("a", { class: "fh-btn gold", href: "#collections" }, "View collection") : null,
        (phone || m.email) ? h("a", { class: "fh-btn ghost", href: "#contact" }, "Book an appointment") : null)),
    h("a", { class: "fh-scroll", href: "#about", "aria-label": "Scroll down" }, h("span"), "Scroll"));

  /* the maison */
  const stats = (m.stats || []).filter(x => x.value);
  const paras = (m.story || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if (m.headline || paras.length || m.photo) {
    nav.push(["about", "The House"]);
    parts.push(h("section", { id: "about", class: "fh-sec" }, title("Biographical profile", "The Maison"),
      h("div", { class: "fh-profile" + (m.photo ? "" : " solo") },
        m.photo ? h("div", { class: "fh-frame" }, h("img", { src: m.photo, alt: name, loading: "lazy", draggable: false })) : null,
        h("div", { class: "fh-story" },
          m.headline ? h("h3", null, m.headline) : null,
          (m.location || m.since) ? h("p", { class: "fh-facts" }, [m.location && "Based in " + m.location, m.since && "Founded " + m.since].filter(Boolean).join("  ·  ")) : null,
          paras.map(p => h("p", null, linkify(p))),
          stats.length ? h("div", { class: "fh-stats" }, stats.map(x => h("div", null, h("div", { class: "num" }, x.value), h("div", { class: "lab" }, x.label)))) : null))));
  }

  /* press strip */
  const press = (m.press || "").split(",").map(x => x.trim()).filter(Boolean);
  if (press.length) parts.push(h("section", { class: "fh-press" }, h("p", null, "As seen in"), h("div", { class: "fh-press-row" }, press.map(x => h("span", null, x)))));

  /* lookbook */
  if (looks.length) {
    nav.push(["collections", "Collections"]);
    const cols = [...new Set(looks.map(x => (x.collection || "").trim()).filter(Boolean))];
    let cur = "all";
    const grid = h("div", { class: "fh-looks" });
    const bar = cols.length > 1 ? h("div", { class: "fh-filter" }) : null;
    const draw = () => {
      if (bar) bar.replaceChildren(...[["all", "All"], ...cols.map(c => [c, c])].map(([k, l]) => h("button", { type: "button", class: cur === k ? "on" : "", onclick: () => { cur = k; draw(); } }, l)));
      const list = looks.filter(x => cur === "all" || (x.collection || "").trim() === cur);
      grid.replaceChildren(...list.map((x, i) => h("button", { class: "fh-look", type: "button", onclick: () => lookModal(list, i) },
        h("div", { class: "fh-look-img" }, h("img", { src: x.img, alt: x.title || "Look", loading: "lazy", draggable: false }), x.collection && cols.length > 1 && cur === "all" ? h("span", { class: "fh-tag" }, x.collection) : null),
        h("div", { class: "fh-look-info" }, h("div", { class: "t" }, x.title || "Look " + (i + 1)), x.price ? h("div", { class: "p" }, x.price) : null))));
    };
    draw();
    parts.push(h("section", { id: "collections", class: "fh-sec alt" }, title("Curated lookbook", all("lookbook")[0].heading || "The collections"), bar, grid));
  }

  function lookModal(list, start) {
    let i = start;
    const box = h("div", { class: "fh-modal-card" });
    const paint = () => {
      const x = list[i];
      const ask = "Hello " + name + ", I'm interested in \"" + (x.title || "this look") + "\"" + (x.price ? " (" + x.price + ")" : "") + ". Is it available?";
      const shop = x.url && safeUrl(x.url);
      box.replaceChildren(h("div", { class: "fh-modal-img" }, h("img", { src: x.img, alt: x.title || "", draggable: false })),
        h("div", { class: "fh-modal-txt" },
          x.collection ? h("p", { class: "fh-season" }, x.collection) : null,
          h("h3", null, x.title || "Look"), x.price ? h("div", { class: "fh-price" }, x.price) : null,
          x.desc ? h("p", { class: "fh-desc" }, x.desc) : null,
          h("div", { class: "fh-modal-btns" },
            phone ? h("a", { class: "fh-btn gold", href: wa(ask), target: "_blank", rel: "noopener" }, fa("fa-brands fa-whatsapp"), " Order on WhatsApp") : null,
            m.email ? h("a", { class: "fh-btn ghost", href: mail("Enquiry: " + (x.title || "a look"), ask) }, "Ask by email") : null,
            shop ? h("a", { class: "fh-btn ghost", href: shop, target: "_blank", rel: "noopener" }, "Shop online ↗") : null,
            !phone && !m.email && !shop ? h("p", { class: "fh-desc" }, "Contact the brand to order.") : null),
          list.length > 1 ? h("div", { class: "fh-modal-nav" }, h("button", { type: "button", onclick: () => { i = (i - 1 + list.length) % list.length; paint(); } }, "‹ Previous"), h("span", null, (i + 1) + " / " + list.length), h("button", { type: "button", onclick: () => { i = (i + 1) % list.length; paint(); } }, "Next ›")) : null));
    };
    const close = () => { el.remove(); removeEventListener("keydown", key); };
    const key = e => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") { i = (i + 1) % list.length; paint(); } if (e.key === "ArrowLeft") { i = (i - 1 + list.length) % list.length; paint(); } };
    const el = h("div", { class: "fh-modal", role: "dialog", "aria-modal": "true", onclick: e => { if (e.target === el) close(); } }, h("button", { class: "fh-x", type: "button", "aria-label": "Close", onclick: close }, "✕"), box);
    paint(); document.body.append(el); addEventListener("keydown", key);
  }

  /* runway & campaign */
  if (imgs.length) {
    nav.push(["runway", "Runway"]);
    parts.push(h("section", { id: "runway", class: "fh-sec" }, title("Editorial", all("gallery")[0].heading || "Runway & campaign"), h("div", { class: "fh-gallery" }, galleryEl([{ name: "Photos", images: imgs }], null))));
  }
  if (vids.length) {
    nav.push(["films", "Films"]);
    parts.push(h("section", { id: "films", class: "fh-sec alt" }, title("Motion", all("video")[0].heading || "Fashion films"), h("div", { class: "fh-films" }, vids.map(v => h("button", { class: "fh-film", type: "button", onclick: () => videoModal(ytId(v.url)) },
      h("div", { class: "fh-film-img" }, h("img", { src: "https://i.ytimg.com/vi/" + ytId(v.url) + "/hqdefault.jpg", alt: "", loading: "lazy" }), h("span", null, "▶")),
      h("div", { class: "fh-look-info" }, v.kind ? h("p", { class: "fh-season" }, v.kind) : null, h("div", { class: "t" }, v.title || "Watch"), v.desc ? h("div", { class: "fh-desc" }, v.desc) : null))))));
  }

  /* boutiques */
  const shops = (m.boutiques || []).filter(x => x.city || x.address);
  if (shops.length) {
    nav.push(["boutiques", "Boutiques"]);
    parts.push(h("section", { id: "boutiques", class: "fh-sec" }, title("Visit us", "Boutiques"), h("div", { class: "fh-shops" }, shops.map(x => h("div", { class: "fh-shop" },
      h("h3", null, x.city || "Boutique"), x.address ? h("p", null, x.address) : null, x.hours ? h("p", { class: "fh-hours" }, x.hours) : null,
      x.address ? h("a", { class: "fh-link", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(x.address + " " + (x.city || "")), target: "_blank", rel: "noopener" }, "Get directions →") : null)))));
  }

  /* sponsored */
  parts.push(h("section", { class: "fh-ads", "aria-label": "Sponsored" }, h("p", null, "Sponsored"), h("div", { class: "fh-ads-row" }, adSlot(), adSlot())));

  /* contact */
  if (phone || m.email || hasForm) {
    nav.push(["contact", "Contact"]);
    if (hasForm) main.classList.add("fh-form");
    parts.push(h("section", { id: "contact", class: "fh-sec alt" }, title("Private appointments & orders", "Get in touch", { sub: m.appointments }),
      h("div", { class: "fh-contact" },
        phone ? h("a", { class: "fh-btn gold", href: wa("Hello " + name + ", I'd like to book an appointment."), target: "_blank", rel: "noopener" }, fa("fa-brands fa-whatsapp"), " Book on WhatsApp") : null,
        m.email ? h("a", { class: "fh-btn ghost", href: mail("Appointment request") }, fa("fa-regular fa-envelope"), " Email us") : null,
        phone ? h("a", { class: "fh-btn ghost", href: "tel:" + phone }, fa("fa-solid fa-phone"), " Call") : null),
      (m.email || phone) ? h("div", { class: "fh-contact-lines" }, m.email ? h("span", null, m.email) : null, phone ? h("span", null, m.phone) : null) : null,
      hasForm ? h("div", { class: "fh-form-wrap" }, main) : null));
  }

  /* nav, footer */
  const socials = links.slice(0, 6);
  const menu = h("div", { class: "fh-mmenu", hidden: true }, nav.map(([id, l]) => h("a", { href: "#" + id }, l)));
  const header = h("header", { class: "fh-nav" },
    h("a", { class: "fh-logo", href: "#fh-top" }, name),
    h("nav", { class: "fh-links" }, nav.map(([id, l]) => h("a", { href: "#" + id }, l))),
    h("button", { class: "fh-burger", type: "button", "aria-label": "Menu", onclick: () => { menu.hidden = !menu.hidden; } }, "☰"), menu);
  const foot = h("footer", { class: "fh-foot" },
    h("div", { class: "fh-logo" }, name),
    socials.length ? h("div", { class: "fh-soc" }, socials.map(l => h("a", { href: l.href, target: "_blank", rel: "noopener", "aria-label": l.label || l.plat }, fa(FA[l.plat] || FA.Website)))) : null,
    h("p", null, "© " + new Date().getFullYear() + " " + name.toUpperCase() + ". All rights reserved."),
    h("div", { class: "fh-made" }, h("a", { href: location.pathname + "#home" }, "Made with Blocko · Create your own free page →"),
      h("a", { href: "#terms" }, "Terms"), preview ? null : h("button", { type: "button", onclick: () => reportSheet(page.id) }, "Report")));

  const root = h("div", { class: "fh-root", oncontextmenu: e => { if (e.target.closest("img")) e.preventDefault(); } },
    topBarEl ? h("div", { class: "ar-topbar" }, topBarEl) : null,
    preview ? h("div", { class: "fh-preview" }, h("button", { type: "button", onclick: () => go("p-" + page.id) }, "← Back to editing"), h("span", null, "Preview")) : null,
    header, hero, parts, foot);
  sectionLinks(root);
  root.addEventListener("click", e => { if (e.target.closest(".fh-mmenu a")) menu.hidden = true; });
  mount(root);
  document.body.classList.add("artist-mode", "fashion-mode");
  if (main.querySelector && main.querySelector(".thanks")) setTimeout(() => document.getElementById("contact")?.scrollIntoView({ block: "start" }), 60);
}
