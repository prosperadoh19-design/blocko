// Data layer. Two interchangeable stores with the same methods:
//  - DemoStore keeps everything in this browser (no account needed).
//  - CloudStore uses Supabase so forms can be filled by anyone, and teams share workspaces.

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
}));
export { uuid };

const PUBLIC_FIELDS = ["id", "title", "description", "emoji", "color", "brand", "access", "one_per_person", "blocks", "published", "accepting", "thank_you", "created_at", "updated_at"];
const SAVE_FIELDS = [...PUBLIC_FIELDS, "workspace_id"];
const pick = (p, keys) => Object.fromEntries(keys.filter(k => k in p).map(k => [k, p[k]]));
const safeName = n => String(n || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);
const readDataUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Couldn't read that file.")); r.readAsDataURL(file); });
export const TERMS_VERSION = "2026-11-03";
export const LIMITS = { image: 5 * 1024 * 1024, file: 10 * 1024 * 1024 };

/* ------------------------------------------------------------------ demo */
class DemoStore {
  constructor() {
    this.mode = "demo"; this.key = "blocko.demo.v1"; this.data = this.load();
    this.data.workspace ||= { id: "demo", name: "My workspace" };
    this.data.invites ||= []; this.data.alerts ||= {}; this.data.secrets ||= {};
    this.respondent = null; this.pendingCode = null;
    this.ws = this.data.workspace; this.workspaces = [this.ws]; this.role = "owner";
  }
  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || { pages: {}, responses: {} }; }
    catch (e) { return { pages: {}, responses: {} }; }
  }
  persist() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { throw new Error("This device's demo storage is full. Delete some pages or images."); }
  }
  async init() {}
  async getUser() { return { id: "demo", email: "you@demo" }; }
  async termsAccepted() { return !!(this.data.terms && this.data.terms.version === TERMS_VERSION); }
  async acceptTerms() { this.data.terms = { version: TERMS_VERSION, at: new Date().toISOString() }; this.persist(); }
  async reportForm(pageId, reason, details, email) { (this.data.reports ||= []).push({ page_id: pageId, reason, details, email, at: new Date().toISOString() }); this.persist(); }
  onAuth() {}
  async signIn() { return {}; }
  async signUp() { return {}; }
  async signOut() {}
  /* workspaces */
  async switchWorkspace() {}
  async createWorkspace() { throw new Error("Workspaces for teams need the app to be online."); }
  async renameWorkspace(name) { this.ws.name = name; this.persist(); }
  async listMembers() { return [{ user_id: "demo", email: "you (this device)", role: "owner" }]; }
  async listInvites() { return this.data.invites; }
  async invite(email, role) { this.data.invites.push({ id: uuid(), email, role, created_at: new Date().toISOString() }); this.persist(); }
  async cancelInvite(id) { this.data.invites = this.data.invites.filter(i => i.id !== id); this.persist(); }
  async removeMember() {}
  async setRole() {}
  /* pages */
  async listPages() {
    return Object.values(this.data.pages)
      .map(p => ({ ...p, response_count: Object.values(this.data.responses).filter(r => r.page_id === p.id).length }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async getPage(id) { return this.data.pages[id] ? structuredClone(this.data.pages[id]) : null; }
  async getPublicPage(id) { const p = this.data.pages[id]; return p && p.published ? structuredClone(p) : null; }
  async savePage(page) {
    const now = new Date().toISOString();
    const before = this.data.pages[page.id];
    const p = { ...pick(page, SAVE_FIELDS), workspace_id: "demo", updated_at: now, created_at: (before && before.created_at) || page.created_at || now };
    if (before) { p.published = before.published; p.accepting = before.accepting; }
    this.data.pages[p.id] = p;
    try { this.persist(); } catch (e) { if (before) this.data.pages[p.id] = before; else delete this.data.pages[p.id]; throw e; }
    return p;
  }
  async setPublished(id, published, accepting) {
    const p = this.data.pages[id]; if (!p) throw new Error("Page not found");
    p.published = published; p.accepting = accepting; p.updated_at = new Date().toISOString(); this.persist(); return p;
  }
  async deletePage(id) {
    delete this.data.pages[id]; delete this.data.alerts[id];
    for (const [k, r] of Object.entries(this.data.responses)) if (r.page_id === id) delete this.data.responses[k];
    this.persist();
  }
  async getAlerts(id) { return this.data.alerts[id] || ""; }
  async setAlerts(id, emails) { this.data.alerts[id] = emails; this.persist(); }
  /* responses */
  /* who can fill in a form */
  async getAccessCode(id) { return this.data.secrets[id] || ""; }
  async setAccessCode(id, code) { this.data.secrets[id] = code; this.persist(); }
  async checkCode(id, code) { const c = this.data.secrets[id] || ""; return !!c && c.trim().toLowerCase() === String(code).trim().toLowerCase(); }
  async sendCode(email, pageId) { this.pendingCode = { email: email.toLowerCase(), code: String(Math.floor(100000 + Math.random() * 900000)) }; return { demoCode: this.pendingCode.code }; }
  async verifyCode(email, code) {
    if (!this.pendingCode || this.pendingCode.email !== email.toLowerCase() || this.pendingCode.code !== String(code).trim()) throw new Error("That code isn't right. Check the latest one and try again.");
    this.respondent = { email: this.pendingCode.email }; this.pendingCode = null;
  }
  async respondentEmail() { return this.respondent ? this.respondent.email : null; }
  async forgetRespondent() { this.respondent = null; }
  async submitResponse(pageId, answers, opts = {}) {
    const p = this.data.pages[pageId];
    if (!p || !p.published || !p.accepting) throw new Error("This form isn't accepting responses.");
    if ((p.access === "code" || p.access === "both") && !(await this.checkCode(pageId, opts.code))) throw new Error("That access code is not right.");
    if ((p.access === "email" || p.access === "both") && !this.respondent) throw new Error("Please verify your email first.");
    const email = this.respondent ? this.respondent.email : null;
    if (p.one_per_person && email && Object.values(this.data.responses).some(r => r.page_id === pageId && r.respondent_email === email)) throw new Error("You have already filled in this form.");
    const r = { id: uuid(), page_id: pageId, answers, respondent_email: email, created_at: new Date().toISOString() };
    this.data.responses[r.id] = r;
    try { this.persist(); } catch (e) { delete this.data.responses[r.id]; throw e; }
    return r;
  }
  async listResponses(pageId) {
    return Object.values(this.data.responses).filter(r => r.page_id === pageId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async deleteResponse(id) { delete this.data.responses[id]; this.persist(); }
  /* files: kept inside this browser as data, so keep them small */
  async uploadMedia(file) {
    if (file.size > 1.5 * 1024 * 1024) throw new Error("In demo mode pictures must be under 1.5 MB. Bigger ones work once the app is online.");
    return readDataUrl(file);
  }
  async uploadSubmission(pageId, file) {
    if (file.size > 1024 * 1024) throw new Error(`In demo mode attached files must be under 1 MB (${file.name} is bigger). Bigger ones work once the app is online.`);
    return { path: await readDataUrl(file), name: file.name, size: file.size, type: file.type };
  }
  async fileUrl(path) { return path; }
}

/* ----------------------------------------------------------------- cloud */
class CloudStore {
  constructor(client) { this.mode = "cloud"; this.sb = client; this.ws = null; this.workspaces = []; this.role = "editor"; this.user = null; }
  check({ data, error }) { if (error) throw new Error(friendly(error.message)); return data; }
  async init() {
    this.user = await this.getUser(); if (!this.user) return;
    this.workspaces = this.check(await this.sb.rpc("bootstrap")) || [];
    let saved = null; try { saved = localStorage.getItem("blocko.ws"); } catch (e) {}
    this.ws = this.workspaces.find(w => w.id === saved) || this.workspaces[0] || null;
    await this.loadRole();
  }
  async loadRole() {
    if (!this.ws || !this.user) return;
    const m = this.check(await this.sb.from("members").select("role").eq("workspace_id", this.ws.id).eq("user_id", this.user.id).maybeSingle());
    this.role = m ? m.role : "editor";
  }
  async getUser() { const { data } = await this.sb.auth.getUser(); return data.user || null; }
  onAuth(cb) { this.sb.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null)); }
  async signIn(email, password) { return this.check(await this.sb.auth.signInWithPassword({ email, password })); }
  async termsAccepted() {
    const u = await this.getUser(); return !!(u && u.user_metadata && u.user_metadata.terms_version === TERMS_VERSION);
  }
  async acceptTerms() {
    const at = new Date().toISOString();
    this.check(await this.sb.auth.updateUser({ data: { terms_version: TERMS_VERSION, terms_accepted_at: at } }));
    await this.sb.from("terms_acceptances").insert({ version: TERMS_VERSION }); // audit trail; ignore if it already exists
  }
  async reportForm(pageId, reason, details, email) {
    this.check(await this.sb.from("reports").insert({ page_id: pageId, reason, details: (details || "").slice(0, 2000), reporter_email: email || null }));
  }
  async signUp(email, password) {
    const data = this.check(await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname, data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } } }));
    return { needsConfirm: !data.session };
  }
  async signOut() { await this.sb.auth.signOut(); try { localStorage.removeItem("blocko.ws"); } catch (e) {} }
  /* workspaces */
  async switchWorkspace(id) {
    this.ws = this.workspaces.find(w => w.id === id) || this.ws;
    try { localStorage.setItem("blocko.ws", this.ws.id); } catch (e) {}
    await this.loadRole();
  }
  async createWorkspace(name) {
    const w = this.check(await this.sb.rpc("create_workspace", { ws_name: name }));
    this.workspaces.push(w); await this.switchWorkspace(w.id); return w;
  }
  async renameWorkspace(name) { this.check(await this.sb.from("workspaces").update({ name }).eq("id", this.ws.id)); this.ws.name = name; }
  async listMembers() { return this.check(await this.sb.from("members").select("*").eq("workspace_id", this.ws.id).order("created_at")); }
  async listInvites() { return this.check(await this.sb.from("invites").select("*").eq("workspace_id", this.ws.id).order("created_at")); }
  async invite(email, role) { this.check(await this.sb.from("invites").insert({ workspace_id: this.ws.id, email: email.toLowerCase(), role })); }
  async cancelInvite(id) { this.check(await this.sb.from("invites").delete().eq("id", id)); }
  async removeMember(userId) { this.check(await this.sb.from("members").delete().eq("workspace_id", this.ws.id).eq("user_id", userId)); }
  async setRole(userId, role) { this.check(await this.sb.from("members").update({ role }).eq("workspace_id", this.ws.id).eq("user_id", userId)); }
  /* pages */
  async listPages() {
    if (!this.ws) return [];
    const rows = this.check(await this.sb.from("pages").select("*, responses(count)").eq("workspace_id", this.ws.id).order("updated_at", { ascending: false }));
    return rows.map(r => ({ ...r, response_count: (r.responses && r.responses[0] && r.responses[0].count) || 0 }));
  }
  async getPage(id) { return this.check(await this.sb.from("pages").select("*").eq("id", id).maybeSingle()); }
  async getPublicPage(id) { return this.check(await this.sb.from("pages").select(PUBLIC_FIELDS.join(",")).eq("id", id).eq("published", true).maybeSingle()); }
  async savePage(page) {
    const body = { ...pick(page, SAVE_FIELDS), workspace_id: page.workspace_id || this.ws.id, updated_at: new Date().toISOString() };
    delete body.created_at;
    if (page.created_at) {
      // existing page: update its content only; published/accepting change only through setPublished
      delete body.published; delete body.accepting; delete body.id;
      return this.check(await this.sb.from("pages").update(body).eq("id", page.id).select().single());
    }
    return this.check(await this.sb.from("pages").insert(body).select().single());
  }
  async setPublished(id, published, accepting) {
    return this.check(await this.sb.from("pages").update({ published, accepting, updated_at: new Date().toISOString() }).eq("id", id).select("id,published,accepting").single());
  }
  async deletePage(id) { this.check(await this.sb.from("pages").delete().eq("id", id)); }
  async getAlerts(id) { const r = this.check(await this.sb.from("page_alerts").select("emails").eq("page_id", id).maybeSingle()); return r ? r.emails : ""; }
  async setAlerts(id, emails) { this.check(await this.sb.from("page_alerts").upsert({ page_id: id, emails })); }
  /* responses */
  async submitResponse(pageId, answers, opts = {}) {
    if (opts.code != null) { this.check(await this.sb.rpc("submit_with_code", { p_page: pageId, p_answers: answers, p_code: opts.code })); return; }
    // no .select() here: people filling the form are not allowed to read responses back
    this.check(await this.sb.from("responses").insert({ page_id: pageId, answers }));
  }
  /* who can fill in a form */
  async getAccessCode(id) { const r = this.check(await this.sb.from("page_secrets").select("access_code").eq("page_id", id).maybeSingle()); return r ? r.access_code : ""; }
  async setAccessCode(id, code) { this.check(await this.sb.from("page_secrets").upsert({ page_id: id, access_code: code })); }
  async checkCode(id, code) { return !!this.check(await this.sb.rpc("check_access_code", { p_page: id, p_code: code })); }
  async sendCode(email, pageId) { this.check(await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname + (pageId ? "?form=" + pageId : "") } })); return { link: true }; }
  async verifyCode(email, token) { this.check(await this.sb.auth.verifyOtp({ email, token: String(token).trim(), type: "email" })); }
  async respondentEmail() { const u = await this.getUser(); return u ? u.email : null; }
  async forgetRespondent() { await this.sb.auth.signOut(); }
  async listResponses(pageId) { return this.check(await this.sb.from("responses").select("*").eq("page_id", pageId).order("created_at", { ascending: false })); }
  async deleteResponse(id) { this.check(await this.sb.from("responses").delete().eq("id", id)); }
  /* files */
  async uploadMedia(file) {
    if (file.size > LIMITS.image) throw new Error("Pictures must be under 5 MB.");
    const path = `${this.ws.id}/${uuid()}-${safeName(file.name)}`;
    this.check(await this.sb.storage.from("media").upload(path, file, { contentType: file.type }));
    return this.sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  }
  async uploadSubmission(pageId, file) {
    if (file.size > LIMITS.file) throw new Error("Files must be under 10 MB.");
    const path = `${pageId}/${uuid()}-${safeName(file.name)}`;
    this.check(await this.sb.storage.from("submissions").upload(path, file, { contentType: file.type || "application/octet-stream" }));
    return { path, name: file.name, size: file.size, type: file.type };
  }
  async fileUrl(path) { return this.check(await this.sb.storage.from("submissions").createSignedUrl(path, 3600, { download: true })).signedUrl; }
}

function friendly(msg) {
  if (/Invalid login/i.test(msg)) return "That email and password don't match. Check them and try again.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link.";
  if (/already registered/i.test(msg)) return "There's already an account with this email. Sign in instead.";
  if (/Password should be/i.test(msg)) return "Use a password with at least 6 characters.";
  if (/duplicate key.*invites/i.test(msg)) return "That person is already invited.";
  if (/row-level security/i.test(msg)) return "You don't have permission to do that.";
  if (/Token has expired|otp.*(invalid|expired)|invalid.*token/i.test(msg)) return "That code isn't right or has expired. Ask for a new one.";
  if (/rate limit|security purposes.*seconds/i.test(msg)) return "Please wait a minute before asking for another code.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return "That file is too big.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Can't reach the server. Check your internet connection.";
  return msg;
}

export async function createStore() {
  const cfg = window.BLOCKO_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    return new CloudStore(createClient(cfg.supabaseUrl, cfg.supabaseAnonKey));
  }
  return new DemoStore();
}
