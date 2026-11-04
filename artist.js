// "Artist website" page style: a dark, full-width artist site built from the page's blocks.
// d = helpers handed in from app.js.
const FA = { Spotify: "fa-brands fa-spotify", "Apple Music": "fa-brands fa-apple", YouTube: "fa-brands fa-youtube", Instagram: "fa-brands fa-instagram", TikTok: "fa-brands fa-tiktok",
  "X (Twitter)": "fa-brands fa-x-twitter", Facebook: "fa-brands fa-facebook", SoundCloud: "fa-brands fa-soundcloud", Deezer: "fa-brands fa-deezer", LinkedIn: "fa-brands fa-linkedin",
  WhatsApp: "fa-brands fa-whatsapp", Snapchat: "fa-brands fa-snapchat", Threads: "fa-brands fa-threads", Bandcamp: "fa-brands fa-bandcamp", Audiomack: "fa-solid fa-headphones",
  Boomplay: "fa-solid fa-circle-play", Tidal: "fa-solid fa-water", Website: "fa-solid fa-globe" };
const ACC = ["cyan", "purple", "emerald"];

function loadAssets() {
  if (document.getElementById("ar-assets")) return;
  const add = (href, id) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; if (id) l.id = id; document.head.append(l); };
  add("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css", "ar-assets");
  add("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&family=Syne:wght@700;800&display=swap");
}

export function artistSite(d, page, preview, topBarEl, main) {
  const { h, store, toast, adSlot, safeUrl, platformOf, galleryEl, fmtTime, mount, upcoming, ytId, videoModal, linkify, reportSheet, go } = d;
  loadAssets();
  const fa = (cls, extra = "") => h("i", { class: cls + (extra ? " " + extra : ""), "aria-hidden": "true" });
  const B = page.blocks || [];
  const one = t => B.find(b => b.type === t);
  const all = t => B.filter(b => b.type === t);
  const prof = one("profile") || {};
  const name = page.title || "Artist";
  const links = all("links").flatMap(b => b.items || []).map(l => ({ ...l, href: l.url && safeUrl(l.url) })).filter(l => l.href).map(l => ({ ...l, plat: platformOf(l.href) }));
  const albums = all("album").filter(a => a.title || (a.tracks || []).some(t => t.path));
  const tours = all("tour"), videos = all("video"), galleries = all("gallery"), works = all("work");
  const hasForm = B.some(d.isQuestion);
  const cover = (page.brand || {}).cover || "backgrounds/stage.jpg";

  /* ---------- player (one for the whole page) ---------- */
  const queue = albums.flatMap(a => (a.tracks || []).filter(t => t.path).map(t => ({ ...t, album: a.title, cover: a.cover })));
  const audio = h("audio", { preload: "none" }); audio.controlsList = "nodownload noplaybackrate"; audio.disableRemotePlayback = true;
  window.__artistAudio = audio;
  const urls = {};
  let cur = -1;
  const pCover = h("div", { class: "ar-pl-cover" }), pTitle = h("b", null, queue.length ? "Press play" : "No songs yet"), pSub = h("small", null, name);
  const playIcon = fa("fa-solid fa-play");
  const playBtn = h("button", { class: "ar-pl-play", type: "button", "aria-label": "Play", onclick: () => cur < 0 ? play(0) : toggle() }, playIcon);
  const tNow = h("span", null, "0:00"), tEnd = h("span", null, "0:00");
  const BARS = 44;
  const wave = h("div", { class: "ar-wave", role: "slider", "aria-label": "Seek", tabindex: 0,
    onclick: e => { const r = wave.getBoundingClientRect(); if (audio.duration) audio.currentTime = audio.duration * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); },
    onkeydown: e => { if (!audio.duration) return; if (e.key === "ArrowRight") audio.currentTime += 5; if (e.key === "ArrowLeft") audio.currentTime -= 5; } });
  const bars = Array.from({ length: BARS }, (_, i) => { const b = h("i"); wave.append(b); return b; });
  const shapeBars = seed => { let x = 0; for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0; bars.forEach((b, i) => { x = (x * 1103515245 + 12345) >>> 0; b.style.height = (22 + (x % 70)) + "%"; b.style.animationDelay = (i % 7) * 0.12 + "s"; }); };
  shapeBars(name);
  const vol = h("input", { type: "range", min: 0, max: 100, value: 85, class: "ar-vol", "aria-label": "Volume", oninput: e => { audio.volume = e.target.value / 100; } });
  const rowsByTrack = [];
  const paint = () => {
    const on = !audio.paused;
    playIcon.className = "fa-solid " + (on ? "fa-pause" : "fa-play");
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    wave.classList.toggle("on", on);
    rowsByTrack.forEach(({ el, qi }) => { el.classList.toggle("on", qi === cur); el.classList.toggle("playing", qi === cur && on); });
    document.querySelectorAll(".ar-listen").forEach(b => b.replaceChildren(fa("fa-solid " + (on ? "fa-pause" : "fa-play")), h("span", null, on ? "Pause" : "Listen now")));
  };
  async function play(i) {
    const t = queue[i]; if (!t) return;
    document.querySelectorAll("audio").forEach(a => { if (a !== audio) a.pause(); });
    if (cur !== i) {
      cur = i; pTitle.textContent = t.title || "Track " + (i + 1); pSub.textContent = name + (t.album ? " · " + t.album : "");
      pCover.replaceChildren(t.cover ? h("img", { src: t.cover, alt: "", draggable: false }) : fa("fa-solid fa-music"));
      shapeBars(t.id || t.title);
      try { audio.src = urls[i] && urls[i].at > Date.now() - 50 * 60e3 ? urls[i].u : (urls[i] = { u: await store.audioUrl(t.path), at: Date.now() }).u; }
      catch (e) { return toast("This song can't play right now."); }
    }
    audio.play().catch(() => toast("Tap play again to start the song."));
  }
  const toggle = () => audio.paused ? audio.play().catch(() => {}) : audio.pause();
  audio.addEventListener("play", paint); audio.addEventListener("pause", paint);
  audio.addEventListener("timeupdate", () => {
    tNow.textContent = fmtTime(audio.currentTime) || "0:00"; tEnd.textContent = fmtTime(audio.duration) || "0:00";
    const f = audio.duration ? audio.currentTime / audio.duration : 0; const n = Math.round(f * BARS);
    bars.forEach((b, i) => b.classList.toggle("done", i < n));
  });
  audio.addEventListener("ended", () => cur < queue.length - 1 ? play(cur + 1) : null);
  const qIndex = (album, ti) => { let n = 0; for (const a of albums) { const ts = (a.tracks || []).filter(t => t.path); if (a === album) return n + ti; n += ts.length; } return -1; };

  /* ---------- sections ---------- */
  const sec = (id, kicker, title, kids, opts = {}) => h("section", { id, class: "ar-sec" + (opts.alt ? " alt" : "") }, h("div", { class: "ar-wrap" },
    h("div", { class: "ar-head" + (opts.center ? " center" : "") }, h("div", null, h("span", { class: "ar-kick " + (opts.kc || "cyan") }, kicker), h("h2", null, title), opts.sub ? h("p", null, opts.sub) : null), opts.side || null), kids));
  const nav = [];
  const parts = [];

  // hero
  const stream = links.filter(l => ["Spotify", "Apple Music", "Audiomack", "Boomplay", "SoundCloud", "YouTube", "Deezer", "Tidal"].includes(l.plat)).slice(0, 5);
  const hero = h("section", { id: "hero", class: "ar-hero" },
    h("div", { class: "ar-hero-bg", style: { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } }), h("div", { class: "ar-hero-fade" }), h("div", { class: "ar-grid-bg" }),
    h("div", { class: "ar-orb a" }), h("div", { class: "ar-orb b" }),
    h("div", { class: "ar-hero-in" },
      prof.badge ? h("div", { class: "ar-badge" }, h("i", { class: "dot" }), h("span", null, prof.badge)) : null,
      h("h1", { class: "ar-name" }, name),
      page.description ? h("p", { class: "ar-tag" }, page.description) : null,
      h("div", { class: "ar-cta" },
        queue.length ? h("button", { class: "ar-btn white ar-listen", type: "button", onclick: () => cur < 0 ? play(0) : toggle() }, fa("fa-solid fa-play"), h("span", null, "Listen now")) : null,
        tours.some(t => upcoming(t.items).length) ? h("a", { class: "ar-btn glass", href: "#tour" }, fa("fa-solid fa-ticket", "c-cyan"), h("span", null, "Tour dates")) : hasForm ? h("a", { class: "ar-btn glass", href: "#contact" }, fa("fa-solid fa-envelope", "c-cyan"), h("span", null, "Book me")) : null),
      stream.length ? h("div", { class: "ar-stream" }, h("span", null, "Stream everywhere:"), stream.map(l => h("a", { href: l.href, target: "_blank", rel: "noopener" }, fa(FA[l.plat] || FA.Website), h("span", null, l.label || l.plat)))) : null),
    h("a", { class: "ar-down", href: "#about", "aria-label": "Scroll down" }, fa("fa-solid fa-chevron-down")));

  // about
  if (prof.headline || prof.bio || prof.photo) {
    nav.push(["about", "About"]);
    const stats = (prof.stats || []).filter(x => x.value);
    const hl = (prof.highlights || []).filter(x => x.title);
    const genres = (prof.genres || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 3);
    const paras = (prof.bio || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    parts.push(h("section", { id: "about", class: "ar-sec alt" }, h("div", { class: "ar-wrap ar-about" },
      prof.photo ? h("div", { class: "ar-photo-card" }, h("div", { class: "ar-photo" }, h("img", { src: prof.photo, alt: name, loading: "lazy", draggable: false }), h("div", { class: "fade" }),
        genres.length ? h("div", { class: "ar-genres" }, genres.map((g, i) => h("span", { class: ACC[i % 2] }, g))) : null),
        stats.length ? h("div", { class: "ar-stats" }, stats.map((x, i) => h("div", null, h("p", { class: "k " + ACC[i % 3] }, x.label), h("p", { class: "v" }, x.value)))) : null) : null,
      h("div", { class: "ar-bio" },
        h("div", { class: "ar-pill" }, fa("fa-solid fa-user"), h("span", null, "Artist profile & bio")),
        h("h2", null, prof.headline || "About " + name),
        h("div", { class: "ar-facts" }, prof.location ? h("span", null, fa("fa-solid fa-location-dot", "c-cyan"), "Based in " + prof.location) : null,
          prof.label ? h("span", null, fa("fa-solid fa-record-vinyl", "c-purple"), "Label: " + prof.label) : null,
          prof.since ? h("span", null, fa("fa-solid fa-music", "c-emerald"), "Active since: " + prof.since) : null),
        paras.map((p, i) => h("p", { class: i ? "p2" : "p1" }, linkify(p))),
        !prof.photo && stats.length ? h("div", { class: "ar-stats flat" }, stats.map((x, i) => h("div", null, h("p", { class: "k " + ACC[i % 3] }, x.label), h("p", { class: "v" }, x.value)))) : null,
        hl.length ? h("div", { class: "ar-hl" }, hl.map((x, i) => h("div", { class: "ar-card" }, fa(["fa-solid fa-award", "fa-solid fa-compact-disc", "fa-solid fa-globe", "fa-solid fa-trophy", "fa-solid fa-star", "fa-solid fa-fire"][i], "c-" + ACC[i % 3]), h("h3", null, x.title), x.sub ? h("p", null, x.sub) : null))) : null))));
  }

  // music
  if (albums.length) {
    nav.push(["music", "Music"]);
    const grid = h("div", { class: "ar-albums" });
    const tracksBox = h("div", { class: "ar-tracks" });
    let filter = "all", open = albums.find(a => (a.tracks || []).some(t => t.path)) || albums[0];
    const kindOf = a => /album|mixtape/i.test(a.kind || "Album") ? "album" : "single";
    const drawTracks = () => {
      rowsByTrack.length = 0;
      const ts = (open.tracks || []).filter(t => t.path);
      tracksBox.replaceChildren(h("div", { class: "ar-tracks-head" }, open.cover ? h("img", { src: open.cover, alt: "", draggable: false }) : null,
        h("div", null, h("small", null, [open.year, (open.kind || "Album").toUpperCase()].filter(Boolean).join(" • ")), h("h3", null, open.title || "Untitled"),
          h("p", null, ts.length + (ts.length === 1 ? " track" : " tracks")))),
        ts.length ? h("div", { class: "ar-trk-list" }, ts.map((t, ti) => { const qi = qIndex(open, ti); const el = h("button", { class: "ar-trk", type: "button", onclick: () => cur === qi ? toggle() : play(qi) },
          h("span", { class: "n" }, h("span", { class: "num" }, ti + 1), h("span", { class: "eq" }, h("i"), h("i"), h("i"))), h("span", { class: "t" }, t.title || "Track " + (ti + 1)), h("span", { class: "d" }, fmtTime(t.dur))); rowsByTrack.push({ el, qi }); return el; }))
          : h("p", { class: "ar-muted" }, "Songs coming soon."));
      paint();
    };
    const drawGrid = () => grid.replaceChildren(...albums.filter(a => filter === "all" || kindOf(a) === filter).map((a, ai) => {
      const ts = (a.tracks || []).filter(t => t.path); const total = ts.reduce((n, t) => n + (t.dur || 0), 0);
      return h("div", { class: "ar-album" + (a === open ? " sel" : ""), role: "button", tabindex: 0, onclick: () => { open = a; drawGrid(); drawTracks(); tracksBox.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, onkeydown: e => { if (e.key === "Enter") e.currentTarget.click(); } },
        h("div", { class: "ar-album-art" }, a.cover ? h("img", { src: a.cover, alt: (a.title || "Album") + " cover", loading: "lazy", draggable: false }) : h("div", { class: "ph" }, fa("fa-solid fa-compact-disc")),
          ts.length ? h("div", { class: "ov" }, h("button", { class: "ar-round", type: "button", "aria-label": "Play " + (a.title || "album"), onclick: e => { e.stopPropagation(); open = a; drawGrid(); drawTracks(); play(qIndex(a, 0)); } }, fa("fa-solid fa-play"))) : null),
        h("span", { class: "ar-meta " + ACC[ai % 3] }, [a.year, (a.kind || "Album").toUpperCase()].filter(Boolean).join(" • ")), h("h3", null, a.title || "Untitled"),
        h("p", null, ts.length + (ts.length === 1 ? " track" : " tracks") + (total ? " • " + (ts.length === 1 ? fmtTime(total) : Math.max(1, Math.round(total / 60)) + " min") : "")));
    }));
    const tabs = albums.length > 1 ? h("div", { class: "ar-filter" }, [["all", "All"], ["album", "Albums"], ["single", "Singles & EPs"]].map(([k, l]) => h("button", { type: "button", class: k === filter ? "on" : "", onclick: e => { filter = k; e.currentTarget.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === e.currentTarget)); drawGrid(); } }, l))) : null;
    drawGrid(); drawTracks();
    parts.push(sec("music", "Discography", albums.length > 1 ? "Featured releases" : "Latest release", h("div", { class: "ar-music" }, grid, tracksBox), { side: tabs }));
  }

  // tour
  const dates = tours.flatMap(t => upcoming(t.items)).sort((a, b) => a.date.localeCompare(b.date));
  if (dates.length) {
    nav.push(["tour", "Tour"]);
    parts.push(sec("tour", "Live experience", (tours[0].heading || "Tour dates"), h("div", { class: "ar-tour" }, dates.map((t, i) => {
      const sold = t.status === "Sold out";
      return h("div", { class: "ar-date" + (sold ? " sold" : "") },
        h("div", { class: "ar-date-l" }, h("div", { class: "ar-cal " + (sold ? "grey" : ACC[(i + 1) % 3]) }, h("span", null, t.mon), h("b", null, t.day)),
          h("div", null, h("h3", null, t.city || t.venue), h("p", null, t.venue && t.city ? t.venue : "", t.status && !sold ? h("span", { class: "st " + (/fast/i.test(t.status) ? "c-emerald" : /low/i.test(t.status) ? "c-pink" : "") }, (t.venue && t.city ? " • " : "") + t.status) : null))),
        h("div", { class: "ar-date-r" }, t.timeLabel ? h("span", { class: "ar-time" }, t.timeLabel) : null,
          sold ? h("span", { class: "ar-sold" }, "Sold out") : t.href ? h("a", { class: "ar-btn grad small", href: t.href, target: "_blank", rel: "noopener" }, "Tickets") : null));
    })), { alt: true, center: true, kc: "purple", sub: "Catch the show live in a city near you." }));
  }

  // videos
  const vids = videos.flatMap(v => (v.items || []).filter(x => ytId(x.url)));
  if (vids.length) {
    nav.push(["videos", "Videos"]);
    const ch = videos.map(v => v.channel && safeUrl(v.channel)).find(Boolean);
    parts.push(sec("videos", "Visual experience", videos[0].heading || "Official videos", h("div", { class: "ar-videos" }, vids.map((v, i) => h("div", { class: "ar-video" },
      h("button", { class: "ar-video-art", type: "button", "aria-label": "Play " + (v.title || "video"), onclick: () => { audio.pause(); videoModal(ytId(v.url)); } },
        h("img", { src: "https://i.ytimg.com/vi/" + ytId(v.url) + "/hqdefault.jpg", alt: "", loading: "lazy" }), h("span", { class: "ar-round big " + (i % 2 ? "cyan" : "") }, fa("fa-solid fa-play"))),
      h("div", { class: "ar-video-txt" }, h("span", { class: "ar-meta " + ["cyan", "purple"][i % 2] }, v.kind || "Official music video"), h("h3", null, v.title || "Watch"), v.desc ? h("p", null, v.desc) : null)))),
      { kc: "pink", side: ch ? h("a", { class: "ar-sub", href: ch, target: "_blank", rel: "noopener" }, h("span", null, "Subscribe on YouTube"), fa("fa-solid fa-arrow-up-right-from-square")) : null }));
  }

  // photos
  const imgs = galleries.flatMap(g => g.images || []);
  if (imgs.length) { nav.push(["photos", "Photos"]); parts.push(sec("photos", "Gallery", galleries[0].heading || "Photos", h("div", { class: "ar-gallery" }, galleryEl([{ name: "Photos", images: imgs }], null)), { alt: true, kc: "purple" })); }

  // work & credits
  const wk = works.flatMap(w => (w.items || []).filter(x => x.title || x.org));
  if (wk.length) {
    nav.push(["work", "Credits"]);
    parts.push(sec("work", "Experience", works[0].heading || "Work & credits", h("div", { class: "ar-work" }, wk.map((w, i) => { const href = w.url && safeUrl(w.url); return h("div", { class: "ar-wk" },
      w.img ? h("img", { class: "ar-wk-logo", src: w.img, alt: "", loading: "lazy" }) : h("div", { class: "ar-wk-logo mono " + ACC[i % 3] }, fa("fa-solid fa-music")),
      h("div", { class: "ar-wk-b" }, h("h3", null, w.title || w.org), w.title && w.org ? h("p", { class: "org" }, w.org) : null, w.date ? h("p", { class: "date" }, w.date) : null, w.desc ? h("p", { class: "desc" }, w.desc) : null,
        href ? h("a", { class: "ar-wk-link", href, target: "_blank", rel: "noopener" }, "View", fa("fa-solid fa-arrow-up-right-from-square")) : null)); })), { kc: "emerald" }));
  }

  // sponsored (keeps Blocko free)
  parts.push(h("section", { class: "ar-sec ar-ads", "aria-label": "Sponsored" }, h("div", { class: "ar-wrap" }, h("span", { class: "ar-kick" }, "Sponsored"), h("div", { class: "ar-ads-row" }, adSlot(), adSlot()))));

  // contact
  if (hasForm || prof.bookingEmail || prof.pressEmail) {
    nav.push(["contact", "Contact"]);
    const card = (icon, k, v, c) => h("a", { class: "ar-contact", href: "mailto:" + v }, h("span", { class: "ic " + c }, fa(icon)), h("span", null, h("small", null, k), h("b", null, v)));
    main.classList.add("ar-form");
    parts.push(h("section", { id: "contact", class: "ar-sec alt" }, h("div", { class: "ar-wrap ar-contact-grid" },
      h("div", { class: "ar-contact-l" }, h("span", { class: "ar-kick cyan" }, "Get in touch"), h("h2", null, "Management & booking"),
        h("p", { class: "ar-muted" }, "For show bookings, press, brand collaborations or features, send a message or email the team directly."),
        prof.bookingEmail ? card("fa-solid fa-envelope", "Booking management", prof.bookingEmail, "purple") : null,
        prof.pressEmail ? card("fa-solid fa-newspaper", "Press & PR", prof.pressEmail, "cyan") : null),
      hasForm ? h("div", { class: "ar-contact-r" }, h("div", { class: "ar-form-card" }, h("h3", null, "Send a direct message"), main)) : null)));
  }

  // nav + footer
  const socials = links.slice(0, 6);
  const menu = h("div", { class: "ar-mmenu", hidden: true }, nav.map(([id, l]) => h("a", { href: "#" + id, onclick: () => { menu.hidden = true; } }, l)),
    h("div", { class: "ar-mmenu-foot" }, h("div", { class: "ar-soc" }, socials.map(l => h("a", { href: l.href, target: "_blank", rel: "noopener", "aria-label": l.label || l.plat }, fa(FA[l.plat] || FA.Website))))));
  const ctaT = dates.some(t => t.href) ? ["#tour", "Get tickets"] : hasForm ? ["#contact", "Book now"] : null;
  const navEl = h("nav", { class: "ar-nav" }, h("div", { class: "ar-wrap ar-nav-in" },
    h("a", { class: "ar-logo", href: "#hero" }, h("span", null, name), h("i")),
    h("div", { class: "ar-links" }, nav.map(([id, l]) => h("a", { href: "#" + id }, l))),
    h("div", { class: "ar-nav-r" }, h("div", { class: "ar-soc" }, socials.slice(0, 3).map(l => h("a", { href: l.href, target: "_blank", rel: "noopener", "aria-label": l.label || l.plat }, fa(FA[l.plat] || FA.Website)))),
      ctaT ? h("a", { class: "ar-btn grad small", href: ctaT[0] }, ctaT[1]) : null),
    h("button", { class: "ar-burger", type: "button", "aria-label": "Menu", onclick: () => { menu.hidden = !menu.hidden; } }, "☰")), menu);
  const foot = h("footer", { class: "ar-foot" }, h("div", { class: "ar-wrap ar-foot-in" },
    h("div", null, h("b", null, name), h("span", null, "© " + new Date().getFullYear() + " All rights reserved.")),
    h("div", { class: "ar-soc big" }, socials.map(l => h("a", { href: l.href, target: "_blank", rel: "noopener", "aria-label": l.label || l.plat }, fa(FA[l.plat] || FA.Website))))),
    h("div", { class: "ar-wrap ar-made" }, h("a", { href: location.pathname + "#home" }, "Made with Blocko · Create your own free page →"),
      h("span", null, h("a", { href: "#terms" }, "Terms"), preview ? null : h("button", { type: "button", onclick: () => reportSheet(page.id) }, "Report"))));
  const player = queue.length ? h("div", { class: "ar-player" }, h("div", { class: "ar-wrap ar-pl-in" },
    h("div", { class: "ar-pl-meta" }, pCover, h("div", null, pTitle, pSub)),
    h("div", { class: "ar-pl-mid" }, h("div", { class: "ar-pl-btns" },
      h("button", { type: "button", "aria-label": "Previous song", onclick: () => play(Math.max(0, cur - 1)) }, fa("fa-solid fa-backward-step")), playBtn,
      h("button", { type: "button", "aria-label": "Next song", onclick: () => play(cur < 0 ? 0 : Math.min(queue.length - 1, cur + 1)) }, fa("fa-solid fa-forward-step"))),
      h("div", { class: "ar-pl-seek" }, tNow, wave, tEnd)),
    h("div", { class: "ar-pl-x" }, fa("fa-solid fa-volume-high"), vol)), audio) : null;
  pCover.replaceChildren(queue[0] && queue[0].cover ? h("img", { src: queue[0].cover, alt: "", draggable: false }) : fa("fa-solid fa-music"));
  if (queue[0]) { pTitle.textContent = queue[0].title || "Track 1"; pSub.textContent = name; }

  const root = h("div", { class: "ar-root" + (player ? " has-player" : ""), oncontextmenu: e => { if (e.target.closest("img,audio,.ar-player,.ar-tracks")) e.preventDefault(); } },
    topBarEl ? h("div", { class: "ar-topbar" }, topBarEl) : null,
    preview ? h("div", { class: "ar-preview" }, h("button", { type: "button", onclick: () => go("p-" + page.id) }, "← Back to editing"), h("span", null, "Preview")) : null,
    navEl, hero, parts, foot, player);
  mount(root);
  document.body.classList.add("artist-mode");
  document.documentElement.style.scrollBehavior = "smooth";
  if (main.querySelector && main.querySelector(".thanks")) setTimeout(() => document.getElementById("contact")?.scrollIntoView({ block: "start" }), 60);
  paint();
}
