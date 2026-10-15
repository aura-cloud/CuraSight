// CuraSight backend: POST /api/decode  (prescription text -> medicines, alternatives, totals, flags)
// Run: set MONGO_URI, then `npm start`, open http://localhost:3000
const { norm, findAlternatives } = require("./seed.js");
const { reference } = require("./reference.js");
const crypto = require("crypto");
const { parseSchedule } = require("./schedule.js");

const lev = (a, b) => { const m = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t } }
  return m[b.length]; };
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
const PREFIX = /^\W*(?:\d+\W+)?(?:rx\W*)?(tab|tablet|cap|capsule|syp|syrup|susp|inj|oint|cream|gel|drops)\b\.?\s*/i;
const HINT = { tab: "tablet", tablet: "tablet", cap: "capsule", capsule: "capsule", syp: "syrup", syrup: "syrup", susp: "suspension", inj: "injection", oint: "ointment", cream: "cream", gel: "gel", drops: "drops" };

// One prescription line -> words to match + form hint + whether it looks like a medicine line
function parseLine(line) {
  const m = line.match(PREFIX);
  const body = (m ? line.replace(PREFIX, "") : line.replace(/^\W*\d+\W+/, "")).split(/\s[-–—]\s|,/)[0];
  return { words: norm(body).split(" ").filter(Boolean), hint: m ? HINT[m[1].toLowerCase()] : "", isMed: !!m };
}

// Fuzzy-rank candidate products for a parsed line
function rank(cands, words, hint) {
  const qNum = /^\d+$/.test(words[1] || "") ? words[1] : null;
  let best = null;
  for (const c of cands) {
    const cw = c.nameCore.split(" ");
    let s = 0;
    for (let k = 1; k <= Math.min(3, words.length, cw.length); k++)
      s = Math.max(s, sim(words.slice(0, k).join(" "), cw.slice(0, k).join(" ")));
    if (qNum && /^\d+$/.test(cw[1] || "") && cw[1] !== qNum) s -= 0.3;
    const score = s + (c.discontinued ? 0 : 0.02) + (hint && c.dosageForm === hint ? 0.02 : 0) - c.nameCore.length * 0.0005;
    if (!best || score > best.score) best = { c, score, raw: s };
  }
  return best && best.raw >= 0.8 ? best.c : null;
}

async function findMedicine(col, p) {
  const proj = { projection: { name: 1, nameCore: 1, productId: 1, price: 1, unitPrice: 1, packSize: 1, packaging: 1, manufacturer: 1, dosageForm: 1, discontinued: 1, therapeuticClass: 1, ingredients: 1, compKey: 1 } };
  for (const pre of [p.words[0].slice(0, 3), p.words[0].slice(0, 1)]) {
    const cands = await col.find({ nameCore: { $regex: "^" + pre } }, proj).limit(pre.length > 1 ? 2000 : 8000).toArray();
    const hit = rank(cands, p.words, p.hint);
    if (hit) return hit;
  }
  return null;
}

// ---- Plain-language explanation: cached AI text, keyed by ingredients + form (no patient data is ever sent)
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
async function explain(expCol, m) {
  const ref = reference(m);                         // free built-in reference list first
  if (ref && ref.complete) return ref;
  if (!expCol || !m.compKey) return ref;
  const key = m.compKey + "|" + m.dosageForm;
  const hit = await expCol.findOne({ key });
  if (hit) return { en: hit.en, hi: hit.hi, source: "ai" };
  if (!process.env.ANTHROPIC_API_KEY) return ref;
  const ing = m.ingredients.map((i) => i.name + (i.strength ? " " + i.strength : "")).join(" + ");
  const prompt = `You write short plain-language medicine information for patients in India.
Medicine: ${ing} (${m.dosageForm}).
Write 2 to 4 short sentences, in simple words a Class 8 student understands, covering: what this kind of medicine is generally used for, how it is generally taken (for example with food), and one or two common precautions.
Rules: no dose numbers, no brand names, do not diagnose, never tell the person to start, stop or change a medicine, and say so if you are not sure.
Return ONLY JSON: {"en":"...","hi":"..."} where hi is the same text in simple Hindi (Devanagari).`;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) throw new Error("API " + r.status);
    const j = await r.json();
    const o = JSON.parse(j.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim());
    if (!o.en || !o.hi) throw new Error("bad format");
    const doc = { key, en: String(o.en).slice(0, 900), hi: String(o.hi).slice(0, 1200), model: MODEL, source: "ai", createdAt: new Date() };
    await expCol.updateOne({ key }, { $set: doc }, { upsert: true });
    return { en: doc.en, hi: doc.hi, source: "ai" };
  } catch (e) { console.error("explain failed:", String(e.message).slice(0, 120)); return ref; }
  finally { clearTimeout(timer); }
}

async function decode(col, text, expCol) {
  const found = [], unmatched = [], seen = new Set();
  for (const line of text.split("\n").filter((l) => l.trim())) {
    const p = parseLine(line);
    if (!p.words.length) continue;
    const med = await findMedicine(col, p);
    if (med) { if (!seen.has(med.productId)) { seen.add(med.productId); med._line = line; found.push(med); } }
    else if (p.isMed) unmatched.push(line.replace(/^\s*\d+[.)]\s*/, "").trim());
  }
  let brand = 0, cheap = 0;
  const medicines = [];
  for (const m of found) {
    const rawAlts = m.compKey ? await findAlternatives(col, m, 25) : [];
    const seenA = new Set(), alts = [];   // the dataset has repeated listings: keep one per name + maker + pack
    for (const a of rawAlts) { const k = [a.name, a.manufacturer, a.packaging].join("|").toLowerCase(); if (!seenA.has(k)) { seenA.add(k); alts.push(a); } if (alts.length === 5) break; }
    brand += m.price;
    cheap += Math.min(m.price, alts[0] ? alts[0].unitPrice * m.packSize : m.price);
    const ing = m.ingredients.map((i) => i.name + (i.strength ? ` (${i.strength})` : "")).join(" + ");
    medicines.push({
      name: m.name, price: m.price, packaging: m.packaging, manufacturer: m.manufacturer, form: m.dosageForm,
      therapeuticClass: m.therapeuticClass, discontinued: m.discontinued, ingredients: ing, schedule: parseSchedule(m._line),
      alternatives: alts.map((a) => { const pp = +(a.unitPrice * m.packSize).toFixed(2);
        return { name: a.name, manufacturer: a.manufacturer, packaging: a.packaging, price: pp, savePct: Math.round((1 - pp / m.price) * 100) }; }),
    });
  }
  const memo = new Map();   // same composition in one prescription -> one lookup
  const exps = await Promise.all(found.map((m) => { const k = m.compKey + "|" + m.dosageForm; if (!memo.has(k)) memo.set(k, explain(expCol, m)); return memo.get(k); }));
  medicines.forEach((md, i) => { md.explanation = exps[i]; });
  const flags = [];
  if (found.length >= 5) flags.push({ k: "many", n: found.length });
  const groups = {};
  found.forEach((m) => { if (m.therapeuticClass && m.therapeuticClass !== "other") (groups[m.therapeuticClass] ??= []).push(m.name); });
  Object.entries(groups).forEach(([g, a]) => { if (a.length > 1) flags.push({ k: "group", names: a, g }); });
  const byIng = {};
  found.forEach((m) => m.ingredients.forEach((i) => (byIng[i.name.toLowerCase()] ??= new Set()).add(m.name)));
  Object.entries(byIng).forEach(([i, s]) => { if (s.size > 1) flags.push({ k: "ing", names: [...s], i }); });
  return { medicines, unmatched, flags, totals: { brand: +brand.toFixed(2), cheapest: +cheap.toFixed(2), saving: +(brand - cheap).toFixed(2) } };
}

// ---- Pharmacies near the user: OpenStreetMap (Overpass) + Nominatim. Free, no API key. Locations are never stored.
const UA = "CuraSight/1.2 (student project)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const pcache = new Map(), hits = new Map();
const rate = (ip) => { const n = (hits.get(ip) || []).filter((t) => Date.now() - t < 6e4); n.push(Date.now()); hits.set(ip, n); return n.length <= 20; };
const hav = (a, b, c, d) => { const x = Math.PI / 180, p = Math.sin(((c - a) * x) / 2) ** 2 + Math.cos(a * x) * Math.cos(c * x) * Math.sin(((d - b) * x) / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(p)); };
async function getJSON(url, opt, ms = 18000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { ...opt, signal: ctl.signal }); if (!r.ok) throw new Error(url + " " + r.status); return await r.json(); } finally { clearTimeout(t); }
}
const shape = (id, g, la, lo, extra = {}) => {   // one tidy record from OpenStreetMap tags
  const name = g.name || g["name:en"] || g.brand || "", phone = String(g.phone || g["contact:phone"] || "").split(";")[0].trim();
  return { id, name, lat: la, lon: lo, phone, tel: phone.replace(/[^\d+]/g, ""), hours: String(g.opening_hours || "").slice(0, 80),
    addr: extra.addr || [[g["addr:housenumber"], g["addr:street"]].filter(Boolean).join(" "), g["addr:suburb"], g["addr:city"]].filter(Boolean).join(", "),
    jan: /jan\s*aushadhi|janaushadhi|pmbjp|pmbi/i.test([name, g.brand, g.operator].join(" ")) };
};
async function viaOverpass(lat, lon, rad) {
  const q = `[out:json][timeout:15];nwr["amenity"="pharmacy"](around:${rad},${lat},${lon});out center tags 120;`;
  for (const ep of OVERPASS) {
    try {
      const j = await getJSON(ep, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
      return j.elements.map((e) => { const la = e.lat ?? (e.center && e.center.lat), lo = e.lon ?? (e.center && e.center.lon); return la == null || lo == null ? null : shape(e.type + e.id, e.tags || {}, la, lo); }).filter(Boolean);
    } catch (e) { console.error("overpass failed:", ep, String(e.message).slice(0, 150)); }
  }
  return null;
}
async function viaNominatim(lat, lon, rad) {   // backup source when every Overpass server is down
  const dLa = rad / 111320, dLo = rad / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&q=pharmacy&limit=40&bounded=1&addressdetails=1&extratags=1&viewbox=" + [lon - dLo, lat + dLa, lon + dLo, lat - dLa].join(",");
  try {
    const j = await getJSON(url, { headers: { "User-Agent": UA } }, 12000);
    return j.map((r) => { const a = r.address || {}, x = r.extratags || {};
      return shape("nm" + r.place_id, { name: r.name, phone: x.phone, "contact:phone": x["contact:phone"], opening_hours: x.opening_hours, operator: x.operator, brand: x.brand }, +r.lat, +r.lon,
        { addr: [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(", ") }); });
  } catch (e) { console.error("nominatim backup failed:", String(e.message).slice(0, 150)); return null; }
}
async function pharmacies(lat, lon, rad) {
  const key = [lat.toFixed(3), lon.toFixed(3), rad].join("|"); let c = pcache.get(key);
  if (!c || Date.now() - c.t > 6e5) {
    const list = (await viaOverpass(lat, lon, rad)) || (await viaNominatim(lat, lon, rad));
    if (list) { if (pcache.size > 200) pcache.clear(); pcache.set(key, c = { t: Date.now(), list }); }
    else if (!c) { const e = new Error("map service unavailable"); e.busy = true; throw e; }   // else: show the last results we had
  }
  return c.list.map((p) => ({ ...p, dist: Math.round(hav(lat, lon, p.lat, p.lon)) })).sort((a, b) => a.dist - b.dist).slice(0, 30);
}

const SESSION_DAYS = 7;
const sessionCookie = "cs_session";
function cleanEmail(v){return String(v||"").trim().toLowerCase().slice(0,160)}
function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){return {salt,hash:crypto.scryptSync(String(password),salt,64).toString("hex")}}
function verifyPassword(password,salt,expected){const actual=crypto.scryptSync(String(password),salt,64),target=Buffer.from(expected,"hex");return target.length===actual.length&&crypto.timingSafeEqual(actual,target)}
function makeSession(){return crypto.randomBytes(32).toString("hex")}
function cookieOptions(maxAge){return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==="production"?"; Secure":""}`}
function setSession(res,token){res.setHeader("Set-Cookie",`${sessionCookie}=${token}; ${cookieOptions(SESSION_DAYS*86400)}`)}
function clearSession(res){res.setHeader("Set-Cookie",`${sessionCookie}=; ${cookieOptions(0)}`)}
function getSessionToken(req){const raw=String(req.headers.cookie||"");const hit=raw.split(";").map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+"="));return hit?decodeURIComponent(hit.slice(sessionCookie.length+1)):""}
async function currentUser(req,users){const token=getSessionToken(req);if(!token)return null;return users.findOne({sessionToken:token,sessionExpiresAt:{$gt:new Date()}})}
function publicUser(u){return {id:String(u._id),name:u.name,email:u.email,createdAt:u.createdAt}}
async function requireAuth(req,res,users){const user=await currentUser(req,users);if(!user){res.status(401).json({error:"Authentication required"});return null}return user}

// password checks on the account page: 5 wrong tries per 15 minutes per user
const pwFails = new Map();
const pwLocked = (id) => { const f = pwFails.get(id); return !!f && f.n >= 5 && Date.now() - f.t < 9e5; };
const pwFail = (id) => { const f = pwFails.get(id); pwFails.set(id, f && Date.now() - f.t < 9e5 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

async function start() {
  const express = require("express");
  const { MongoClient } = require("mongodb");
  if (!process.env.MONGO_URI) return console.error("Set MONGO_URI first.");
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db("curasight");
  const col = db.collection("medicines");
  const exp = db.collection("explanations");
  const users = db.collection("users");
  const history = db.collection("history");
  await exp.createIndex({ key: 1 }, { unique: true });
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ sessionToken: 1 }, { sparse: true });
  await history.createIndex({ userId: 1, createdAt: -1 });
  const app = express();
  app.use(express.json({ limit: "200kb" }));
  app.use(express.static(__dirname + "/public", { etag: false, lastModified: false, setHeaders: (r) => r.setHeader("Cache-Control", "no-store") }));
  app.get("/api/me", async (req,res)=>{const user=await currentUser(req,users);res.json({authenticated:!!user,user:user?publicUser(user):null})});
  app.post("/api/signup", async (req,res)=>{try{const name=String(req.body.name||"").trim().slice(0,80),email=cleanEmail(req.body.email),password=String(req.body.password||"");if(name.length<2)return res.status(400).json({error:"Enter your name."});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});if(password.length<8)return res.status(400).json({error:"Password must be at least 8 characters."});if(await users.findOne({email}))return res.status(409).json({error:"An account with this email already exists."});const {salt,hash}=hashPassword(password),token=makeSession(),user={name,email,passwordSalt:salt,passwordHash:hash,sessionToken:token,sessionExpiresAt:new Date(Date.now()+SESSION_DAYS*86400000),createdAt:new Date()};const result=await users.insertOne(user);user._id=result.insertedId;setSession(res,token);res.status(201).json({user:publicUser(user)})}catch(e){if(e&&e.code===11000)return res.status(409).json({error:"An account with this email already exists."});console.error(e);res.status(500).json({error:"Could not create account."})}});
  app.post("/api/login", async (req,res)=>{try{const email=cleanEmail(req.body.email),password=String(req.body.password||""),user=await users.findOne({email});if(!user||!verifyPassword(password,user.passwordSalt,user.passwordHash))return res.status(401).json({error:"Incorrect email or password."});const token=makeSession();await users.updateOne({_id:user._id},{$set:{sessionToken:token,sessionExpiresAt:new Date(Date.now()+SESSION_DAYS*86400000)}});user.sessionToken=token;setSession(res,token);res.json({user:publicUser(user)})}catch(e){console.error(e);res.status(500).json({error:"Could not sign in."})}});
  app.post("/api/logout", async (req,res)=>{const token=getSessionToken(req);if(token)await users.updateOne({sessionToken:token},{$unset:{sessionToken:"",sessionExpiresAt:""}});clearSession(res);res.json({ok:true})});
  app.get("/api/history", async (req,res)=>{const user=await requireAuth(req,res,users);if(!user)return;const rows=await history.find({userId:user._id}).sort({createdAt:-1}).limit(50).toArray();res.json(rows.map(h=>({id:String(h._id),createdAt:h.createdAt,medicineCount:h.medicineCount,brandTotal:h.brandTotal,saving:h.saving,unmatched:h.unmatched||[],medicines:h.medicines||[]}))) });
  app.get("/api/history/:id", async (req,res)=>{const user=await requireAuth(req,res,users);if(!user)return;const {ObjectId}=require("mongodb");if(!ObjectId.isValid(req.params.id))return res.status(400).json({error:"Invalid history id."});const row=await history.findOne({_id:new ObjectId(req.params.id),userId:user._id});if(!row)return res.status(404).json({error:"History entry not found."});res.json(row)});
  app.delete("/api/history/:id", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;const {ObjectId}=require("mongodb");if(!ObjectId.isValid(req.params.id))return res.status(400).json({error:"Invalid history id."});await history.deleteOne({_id:new ObjectId(req.params.id),userId:user._id});res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:"Could not delete."})}});
  app.delete("/api/history", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;await history.deleteMany({userId:user._id});res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:"Could not delete."})}});
  // savings across all of this user's decoded prescriptions
  app.get("/api/stats", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;
    const rows=await history.find({userId:user._id},{projection:{createdAt:1,brandTotal:1,saving:1,medicineCount:1,"result.medicines.name":1,"result.medicines.price":1,"result.medicines.alternatives":1}}).sort({createdAt:-1}).limit(300).toArray();
    let brand=0,saving=0,meds=0;const months={},top={};
    for(const h of rows){brand+=h.brandTotal||0;saving+=h.saving||0;meds+=h.medicineCount||0;
      const k=new Date(h.createdAt).toISOString().slice(0,7),m=months[k]??={month:k,count:0,brand:0,saving:0};m.count++;m.brand+=h.brandTotal||0;m.saving+=h.saving||0;
      for(const d of (h.result&&h.result.medicines)||[]){const a=d.alternatives&&d.alternatives[0];if(!a||!(a.price<d.price))continue;const sv=+(d.price-a.price).toFixed(2);
        if(!top[d.name]||sv>top[d.name].save)top[d.name]={name:d.name,price:d.price,alt:a.name,altPrice:a.price,save:sv,savePct:a.savePct}}}
    res.json({count:rows.length,medicines:meds,brand:+brand.toFixed(2),saving:+saving.toFixed(2),pct:brand?Math.round(saving/brand*100):0,
      series:Object.values(months).sort((a,b)=>a.month<b.month?-1:1).slice(-12).map(m=>({...m,brand:+m.brand.toFixed(2),saving:+m.saving.toFixed(2)})),
      top:Object.values(top).sort((a,b)=>b.save-a.save).slice(0,8)})}catch(e){console.error(e);res.status(500).json({error:"Could not load savings."})}});

  // account: change name, change password (signs out other devices), delete account with all history
  app.post("/api/account/name", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;const name=String(req.body.name||"").trim().slice(0,80);
    if(name.length<2)return res.status(400).json({error:"Enter your name.",code:"bad_name"});await users.updateOne({_id:user._id},{$set:{name}});res.json({user:publicUser({...user,name})})}catch(e){console.error(e);res.status(500).json({error:"Could not save."})}});
  app.post("/api/account/password", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;const id=String(user._id),cur=String(req.body.current||""),next=String(req.body.next||"");
    if(pwLocked(id))return res.status(429).json({error:"Too many wrong attempts. Try again later.",code:"too_many"});
    if(!verifyPassword(cur,user.passwordSalt,user.passwordHash)){pwFail(id);return res.status(401).json({error:"Current password is incorrect.",code:"bad_current"})}
    if(next.length<8)return res.status(400).json({error:"Password must be at least 8 characters.",code:"short_pw"});
    if(next===cur)return res.status(400).json({error:"Choose a different password.",code:"same_pw"});
    const {salt,hash}=hashPassword(next),token=makeSession();
    await users.updateOne({_id:user._id},{$set:{passwordSalt:salt,passwordHash:hash,sessionToken:token,sessionExpiresAt:new Date(Date.now()+SESSION_DAYS*86400000)}});setSession(res,token);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:"Could not change password."})}});
  app.delete("/api/account", async (req,res)=>{try{const user=await requireAuth(req,res,users);if(!user)return;const id=String(user._id);
    if(pwLocked(id))return res.status(429).json({error:"Too many wrong attempts. Try again later.",code:"too_many"});
    if(!verifyPassword(String(req.body.password||""),user.passwordSalt,user.passwordHash)){pwFail(id);return res.status(401).json({error:"Password is incorrect.",code:"bad_current"})}
    await history.deleteMany({userId:user._id});await users.deleteOne({_id:user._id});clearSession(res);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:"Could not delete account."})}});
  app.get("/api/health", async (_q, r) => r.json({ medicines: await col.estimatedDocumentCount() }));
  app.get("/api/suggest", async (q, r) => {
    const user = await requireAuth(q, r, users);
    if (!user) return;
    const s = norm(String(q.query.q || "")).slice(0, 30);
    if (s.length < 2) return r.json([]);
    const rows = await col.find({ nameCore: { $regex: "^" + s }, discontinued: false },
      { projection: { name: 1, nameCore: 1, manufacturer: 1, packaging: 1, dosageForm: 1 } }).limit(60).toArray();
    rows.sort((a, b) => a.nameCore.length - b.nameCore.length);
    r.json(rows.slice(0, 8).map((m) => ({ name: m.name, manufacturer: m.manufacturer, packaging: m.packaging, form: m.dosageForm })));
  });
  app.post("/api/decode", async (q, r) => {
    const user = await requireAuth(q, r, users);
    if (!user) return;
    try {
      const t=String(q.body.text||"").slice(0,5000);
      if(!t.trim())return r.status(400).json({error:"No text"});
      const result=await decode(col,t,exp);
      const ins=await history.insertOne({userId:user._id,createdAt:new Date(),text:t,medicineCount:result.medicines.length,brandTotal:result.totals.brand,saving:result.totals.saving,unmatched:result.unmatched,medicines:result.medicines.map(m=>({name:m.name,price:m.price,ingredients:m.ingredients,manufacturer:m.manufacturer,form:m.form,therapeuticClass:m.therapeuticClass})),result});
      result.historyId=String(ins.insertedId);
      r.json(result);
    } catch(e){console.error(e);r.status(500).json({error:"Server error"});}
  });
  // pharmacy routes: logged-in users only, 20 requests per minute per IP
  const guard = (fn) => async (req, res) => {
    try {
      const user = await requireAuth(req, res, users); if (!user) return;
      if (!rate(req.ip)) return res.status(429).json({ error: "Too many requests. Try again in a minute." });
      await fn(req, res, user);
    } catch (e) { if (e.busy) return res.status(502).json({ error: "busy" }); console.error(e); res.status(500).json({ error: "Something went wrong." }); }
  };
  app.get("/api/pharmacies", guard(async (req, res) => {
    const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon), rad = Math.min(10000, Math.max(1000, parseInt(req.query.r) || 3000));
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return res.status(400).json({ error: "Invalid location." });
    res.json(await pharmacies(lat, lon, rad));
  }));
  app.get("/api/geocode", guard(async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 100); if (q.length < 2) return res.status(400).json({ error: "Enter a place name." });
    const j = await getJSON("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }, 10000);
    if (!j.length) return res.status(404).json({ error: "not_found" });
    res.json({ lat: +j[0].lat, lon: +j[0].lon, name: String(j[0].display_name).split(",").slice(0, 2).join(",").trim() });
  }));
  app.listen(process.env.PORT || 3000, () => console.log("CuraSight running at http://localhost:3000"));
}
if (require.main === module) start();
module.exports = { parseLine, rank, decode, explain };
