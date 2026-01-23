/***********************
 * Utils (anti-crash)
 ***********************/
const $ = (id) => document.getElementById(id);
const on = (el, evt, fn) => { if (el) el.addEventListener(evt, fn); };
const setText = (el, txt) => { if (el) el.textContent = txt; };
const toggleHidden = (el, hidden) => { if (el) el.classList.toggle("hidden", hidden); };

function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function toISODate(d) {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function parseNumber(v) {
  const cleaned = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function hasValue(str) {
  return String(str ?? "").trim().length > 0;
}
function fmtMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtDate(d) {
  return new Intl.DateTimeFormat("es-US", { year:"numeric", month:"short", day:"2-digit" }).format(d);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (day > lastDay) d.setDate(lastDay);
  return d;
}
function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
function clampDayOfMonth(year, monthIndex, day) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, day), last);
}
function makeMonthlyDateNear(year, monthIndex, monthDay) {
  const d = clampDayOfMonth(year, monthIndex, monthDay);
  return startOfDay(new Date(year, monthIndex, d));
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/***********************
 * Firebase Config (TU PROYECTO)
 ***********************/
const firebaseConfig = {
  apiKey: "AIzaSyATpb8_S2JhY1T2Lb8lzn3_544C7Kqd4OI",
  authDomain: "misfinanzas-618f2.firebaseapp.com",
  projectId: "misfinanzas-618f2",
  storageBucket: "misfinanzas-618f2.firebasestorage.app",
  messagingSenderId: "998483559442",
  appId: "1:998483559442:web:435dced19e19a884b984cb",
  measurementId: "G-ZBVLVMQKDJ"
};

// Si Firebase scripts no cargaron, muestro error visible
if (!window.firebase) {
  const msg = $("authMsg");
  if (msg) msg.textContent = "ERROR: Firebase no cargó. Revisa que index.html tenga los 3 scripts de Firebase antes de app.js.";
  throw new Error("Firebase not loaded");
}

// Init Firebase (evita doble init)
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/***********************
 * Constants
 ***********************/
const BILL_FREQ = [
  { id: "monthly",  label: "Mensual",      type: "months", step: 1 },
  { id: "weekly",   label: "Semanal",      type: "days",   step: 7 },
  { id: "q15",      label: "Cada 15 días", type: "days",   step: 15 },
  { id: "yearly",   label: "Anual",        type: "years",  step: 1 },
];

const PAY_TYPES = {
  weekly:   { label: "Semanal",          mode: "days",   step: 7 },
  "15days": { label: "Cada 15 días",     mode: "days",   step: 15 },
  biweekly: { label: "Quincenal (14)",   mode: "days",   step: 14 },
  monthly:  { label: "Mensual",          mode: "months", step: 1 },
};

/***********************
 * Elements
 ***********************/
const els = {
  authView: $("authView"),
  profileView: $("profileView"),
  appView: $("appView"),

  authEmail: $("authEmail"),
  authPass: $("authPass"),
  btnTogglePass: $("btnTogglePass"),
  btnLogin: $("btnLogin"),
  btnSignup: $("btnSignup"),
  authMsg: $("authMsg"),
  btnLogout: $("btnLogout"),

  profilesList: $("profilesList"),
  btnRefreshProfiles: $("btnRefreshProfiles"),
  newProfileName: $("newProfileName"),
  newPayType: $("newPayType"),
  newLastPayDate: $("newLastPayDate"),
  newMonthDayWrap: $("newMonthDayWrap"),
  newMonthDay: $("newMonthDay"),
  btnCreateProfile: $("btnCreateProfile"),
  profilesMsg: $("profilesMsg"),

  whoTitle: $("whoTitle"),
  btnBackProfiles: $("btnBackProfiles"),

  btnCalc: $("btnCalc"),
  btnExport: $("btnExport"),
  importFile: $("importFile"),
  btnResetProfile: $("btnResetProfile"),

  payType: $("payType"),
  lastPayDate: $("lastPayDate"),
  monthDayWrap: $("monthDayWrap"),
  monthDay: $("monthDay"),
  nextPayDate: $("nextPayDate"),

  urgent: $("urgent"),
  nextSave: $("nextSave"),
  free: $("free"),

  payRows: $("payRows"),

  btnAddExpense: $("btnAddExpense"),
  rows: $("rows"),
  plan: $("plan"),
  cloudMsg: $("cloudMsg"),
};

let currentUser = null;
let currentProfileId = null;
let state = null;

/***********************
 * Views
 ***********************/
function show(view) {
  toggleHidden(els.authView, view !== "auth");
  toggleHidden(els.profileView, view !== "profiles");
  toggleHidden(els.appView, view !== "app");
  toggleHidden(els.btnLogout, view === "auth");
}

/***********************
 * Firestore paths
 ***********************/
function profilesColRef(uid) {
  return db.collection("users").doc(uid).collection("profiles");
}
function profileDocRef(uid, profileId) {
  return profilesColRef(uid).doc(profileId);
}

/***********************
 * Default data
 ***********************/
function defaultExpensesList() {
  return [
    { id: uid(), name: "Renta",         amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Auto",          amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Seguro Auto",   amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Seguro Medico", amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Telefonos",     amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Colegio Mia",   amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Mercado",       amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Ahinoa",        amount: "", freqId: "monthly", dueDate: "" },
    { id: uid(), name: "Mama",          amount: "", freqId: "monthly", dueDate: "" },
  ];
}

function defaultProfileState(profileId, displayName, payType="15days", lastPayDate="2026-01-09", monthDay=9) {
  return {
    profileId,
    displayName: displayName || "Perfil",
    paySchedule: { type: payType, monthDay: Number(monthDay) || 1 },
    lastPayDate: lastPayDate || "",
    paychecks: {}, // {"YYYY-MM-DD": "1200"}
    expenses: defaultExpensesList(),
    updatedAt: new Date().toISOString(),
  };
}

/***********************
 * Salary schedule
 ***********************/
function computeNextPayDateBySchedule(schedule, lastPayDateStr) {
  const today = startOfDay(new Date());
  const payType = schedule?.type || "15days";
  const def = PAY_TYPES[payType] || PAY_TYPES["15days"];

  if (def.mode === "days") {
    if (!lastPayDateStr) return null;
    let d = startOfDay(new Date(lastPayDateStr));
    if (Number.isNaN(d.getTime())) return null;
    for (let i=0; i<800; i++) {
      if (d >= today) return d;
      d = startOfDay(addDays(d, def.step));
    }
    return d;
  }

  const monthDay = Number(schedule?.monthDay) || (lastPayDateStr ? new Date(lastPayDateStr).getDate() : 1);
  const now = new Date();
  const cur = makeMonthlyDateNear(now.getFullYear(), now.getMonth(), monthDay);
  if (cur >= today) return cur;
  return startOfDay(addMonths(cur, 1));
}

function generatePayDates(schedule, lastPayDateStr, count = 8) {
  const out = [];
  const next = computeNextPayDateBySchedule(schedule, lastPayDateStr);
  if (!next) return out;

  const payType = schedule?.type || "15days";
  const def = PAY_TYPES[payType] || PAY_TYPES["15days"];

  let d = startOfDay(next);
  for (let i=0; i<count; i++) {
    out.push(startOfDay(d));
    d = def.mode === "days" ? startOfDay(addDays(d, def.step)) : startOfDay(addMonths(d, def.step));
  }
  return out;
}

/***********************
 * Bills schedule
 ***********************/
function advanceDueDate(dueDateStr, freqId, refDate) {
  let due = startOfDay(new Date(dueDateStr));
  if (Number.isNaN(due.getTime())) return null;

  const f = BILL_FREQ.find(x => x.id === freqId) || BILL_FREQ[0];
  for (let i=0; i<80; i++) {
    if (due >= refDate) return due;
    if (f.type === "days") due = startOfDay(addDays(due, f.step));
    if (f.type === "months") due = startOfDay(addMonths(due, f.step));
    if (f.type === "years") due = startOfDay(addYears(due, f.step));
  }
  return due;
}

/***********************
 * Cloud load/save
 ***********************/
async function listProfilesFromCloud(uid) {
  const snap = await profilesColRef(uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function ensureDefaultProfiles(uid) {
  const existing = await listProfilesFromCloud(uid);
  if (existing.length > 0) return;

  await profileDocRef(uid, "noel").set(defaultProfileState("noel", "Noel", "15days", "2026-01-09", 9), { merge: true });
  await profileDocRef(uid, "jenniffer").set(defaultProfileState("jenniffer", "Jenniffer", "weekly", "", 1), { merge: true });
}

async function loadProfile(uid, profileId) {
  const ref = profileDocRef(uid, profileId);
  const snap = await ref.get();

  if (!snap.exists) {
    const fresh = defaultProfileState(profileId, profileId);
    await ref.set(fresh, { merge: true });
    return fresh;
  }

  const data = snap.data() || {};
  const schedule = data.paySchedule || { type: data.payType || "15days", monthDay: data.monthDay || 1 };

  return {
    profileId,
    displayName: data.displayName ?? profileId,
    paySchedule: { type: schedule.type || "15days", monthDay: Number(schedule.monthDay) || 1 },
    lastPayDate: data.lastPayDate ?? "",
    paychecks: (data.paychecks && typeof data.paychecks === "object") ? data.paychecks : {},
    expenses: Array.isArray(data.expenses) ? data.expenses.map(e => ({
      id: e.id || uid(),
      name: e.name ?? "",
      amount: e.amount ?? "",
      freqId: BILL_FREQ.some(f => f.id === e.freqId) ? e.freqId : "monthly",
      dueDate: e.dueDate ?? "",
    })) : defaultExpensesList(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

let saveTimer = null;
function saveToCloudDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      if (!currentUser || !currentProfileId || !state) return;
      state.updatedAt = new Date().toISOString();
      await profileDocRef(currentUser.uid, currentProfileId).set(state, { merge: true });
      setText(els.cloudMsg, `Guardado en la nube: ${new Date().toLocaleTimeString()}`);
    } catch {
      setText(els.cloudMsg, "No pude guardar (revisa Rules / dominio / login).");
    }
  }, 250);
}

/***********************
 * Calculations
 ***********************/
function compute(state) {
  const today = startOfDay(new Date());
  const nextPay = computeNextPayDateBySchedule(state.paySchedule, state.lastPayDate);
  const payDates = generatePayDates(state.paySchedule, state.lastPayDate, 8);

  const expenses = state.expenses.map(e => {
    const amountNum = parseNumber(e.amount);
    const due = e.dueDate ? advanceDueDate(e.dueDate, e.freqId, today) : null;
    const valid = !!due && amountNum > 0;
    const urgent = (valid && nextPay && due < nextPay) ? amountNum : 0;
    return { ...e, amountNum, due, valid, urgent };
  });

  const perNextPay = new Map();
  let urgentTotal = 0;
  let nextSaveTotal = 0;

  if (nextPay) {
    for (const ex of expenses) {
      urgentTotal += ex.urgent;

      if (!ex.valid || ex.due < nextPay) {
        perNextPay.set(ex.id, 0);
        continue;
      }
      const count = payDates.filter(d => d <= ex.due).length;
      const n = Math.max(1, count);
      const per = ex.amountNum / n;
      perNextPay.set(ex.id, per);
      nextSaveTotal += per;
    }
  }

  const plan = [];
  if (nextPay) {
    const sim = expenses.map(ex => ({
      freqId: ex.freqId,
      amount: ex.amountNum,
      due: ex.due ? new Date(ex.due) : null,
      valid: ex.valid,
      remaining: ex.amountNum,
    }));

    for (let i=0; i<payDates.length; i++) {
      const payDay = payDates[i];
      let total = 0;

      for (const ex of sim) {
        if (!ex.valid || !ex.due) continue;

        const ref = startOfDay(payDay);
        while (ex.due <= ref) {
          ex.remaining = ex.amount;
          ex.due = advanceDueDate(toISODate(ex.due), ex.freqId, addDays(ref, 1));
          if (!ex.due) break;
        }
        if (!ex.due) continue;

        const remainingPaychecks = payDates.slice(i).filter(d => d <= ex.due).length;
        if (remainingPaychecks <= 0) continue;

        const contribution = ex.remaining / remainingPaychecks;
        ex.remaining = Math.max(0, ex.remaining - contribution);
        total += contribution;
      }

      plan.push({ date: payDay, total });
    }
  }

  let free = null;
  if (nextPay) {
    const key = toISODate(nextPay);
    const amountStr = state.paychecks?.[key];
    if (hasValue(amountStr)) free = parseNumber(amountStr) - (plan[0]?.total || 0);
  }

  return { nextPay, payDates, expenses, perNextPay, urgentTotal, nextSaveTotal, plan, free };
}

/***********************
 * UI builders
 ***********************/
function setMonthlyVisibility(selectEl, wrapEl) {
  if (!selectEl || !wrapEl) return;
  wrapEl.classList.toggle("hidden", selectEl.value !== "monthly");
}

function findRowById(container, id) {
  if (!container) return null;
  for (const ch of container.children) {
    if (ch.dataset?.id === id) return ch;
  }
  return null;
}

function createExpenseRow(expense) {
  const row = document.createElement("div");
  row.className = "trow";
  row.dataset.id = expense.id;

  row.innerHTML = `
    <div>
      <input class="name" placeholder="Nombre del gasto" />
      <div class="badges"></div>
    </div>

    <input class="amount" placeholder="Ej: 180" inputmode="decimal" />
    <select class="freq"></select>
    <input class="due" type="date" />
    <div class="right strong perPay">$0</div>
    <button class="btn danger ghost del" title="Eliminar" type="button">✕</button>
  `;

  const nameEl = row.querySelector(".name");
  const amountEl = row.querySelector(".amount");
  const freqEl = row.querySelector(".freq");
  const dueEl = row.querySelector(".due");
  const delEl = row.querySelector(".del");

  nameEl.value = expense.name ?? "";
  amountEl.value = expense.amount ?? "";
  dueEl.value = expense.dueDate ?? "";

  freqEl.innerHTML = BILL_FREQ.map(f =>
    `<option value="${f.id}" ${f.id === expense.freqId ? "selected" : ""}>${f.label}</option>`
  ).join("");

  // NO re-render mientras tecleas
  on(nameEl, "input", () => updateExpense(expense.id, { name: nameEl.value }, false));
  on(amountEl, "input", () => updateExpense(expense.id, { amount: amountEl.value }, false));

  on(freqEl, "change", () => updateExpense(expense.id, { freqId: freqEl.value }, true));
  on(dueEl, "change", () => updateExpense(expense.id, { dueDate: dueEl.value }, true));
  on(delEl, "click", () => deleteExpense(expense.id));

  return row;
}

function rebuildExpensesTable() {
  if (!els.rows) return;
  els.rows.innerHTML = "";
  for (const ex of state.expenses) els.rows.appendChild(createExpenseRow(ex));
}

function updateExpense(id, patch, fullRefresh) {
  state.expenses = state.expenses.map(e => (e.id === id ? { ...e, ...patch } : e));
  saveToCloudDebounced();
  fullRefresh ? refreshAll() : refreshCalculationsOnly();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveToCloudDebounced();
  const row = findRowById(els.rows, id);
  if (row) row.remove();
  refreshAll();
}

function rebuildPaychecksTable(plan, payDates) {
  if (!els.payRows) return;
  els.payRows.innerHTML = "";

  const mapPlan = new Map(plan.map(p => [toISODate(p.date), p.total]));

  for (const d of payDates) {
    const key = toISODate(d);
    const recommended = mapPlan.get(key) || 0;
    const amountStr = state.paychecks?.[key] ?? "";

    const row = document.createElement("div");
    row.className = "payRow";
    row.dataset.id = key;

    row.innerHTML = `
      <div class="strong">${fmtDate(d)}</div>
      <div><input class="payAmt" inputmode="decimal" placeholder="Monto" /></div>
      <div class="right strong rec">${fmtMoney(recommended)}</div>
      <div class="right strong free muted">—</div>
    `;

    const amtEl = row.querySelector(".payAmt");
    const freeEl = row.querySelector(".free");
    amtEl.value = amountStr;

    const updateFreeInline = () => {
      if (!hasValue(amtEl.value)) {
        freeEl.textContent = "—";
        freeEl.className = "right strong free muted";
        return;
      }
      const free = parseNumber(amtEl.value) - recommended;
      freeEl.textContent = fmtMoney(free);
      freeEl.className = "right strong free " + (free >= 0 ? "ok" : "bad");
    };

    on(amtEl, "input", () => {
      state.paychecks[key] = amtEl.value;
      saveToCloudDebounced();
      updateFreeInline();

      const next = computeNextPayDateBySchedule(state.paySchedule, state.lastPayDate);
      if (next && toISODate(next) === key) {
        const f = parseNumber(amtEl.value) - recommended;
        setText(els.free, hasValue(amtEl.value) ? fmtMoney(f) : "—");
        if (els.free) els.free.className = "strong " + (hasValue(amtEl.value) ? (f >= 0 ? "ok" : "bad") : "muted");
      }
    });

    updateFreeInline();
    els.payRows.appendChild(row);
  }
}

function refreshHeaderInputs() {
  setText(els.whoTitle, `Perfil: ${state.displayName}`);
  if (els.payType) els.payType.value = state.paySchedule?.type || "15days";
  if (els.lastPayDate) els.lastPayDate.value = state.lastPayDate ?? "";

  const md = Number(state.paySchedule?.monthDay) || (state.lastPayDate ? new Date(state.lastPayDate).getDate() : 1);
  if (els.monthDay) els.monthDay.value = String(md);

  setMonthlyVisibility(els.payType, els.monthDayWrap);
}

function refreshCalculationsOnly() {
  const c = compute(state);

  if (els.nextPayDate) els.nextPayDate.value = c.nextPay ? fmtDate(c.nextPay) : "— pon tu último cobro";
  setText(els.urgent, fmtMoney(c.urgentTotal));
  setText(els.nextSave, fmtMoney(c.nextSaveTotal));

  if (!c.nextPay) {
    setText(els.free, "—");
    if (els.free) els.free.className = "strong muted";
  } else {
    const key = toISODate(c.nextPay);
    const amt = state.paychecks?.[key];
    if (!hasValue(amt)) {
      setText(els.free, "—");
      if (els.free) els.free.className = "strong muted";
    } else {
      const f = parseNumber(amt) - (c.plan[0]?.total || 0);
      setText(els.free, fmtMoney(f));
      if (els.free) els.free.className = "strong " + (f >= 0 ? "ok" : "bad");
    }
  }

  // Per expense
  for (const ex of c.expenses) {
    const row = findRowById(els.rows, ex.id);
    if (!row) continue;

    const per = row.querySelector(".perPay");
    if (per) per.textContent = fmtMoney(c.perNextPay.get(ex.id) || 0);

    const badges = row.querySelector(".badges");
    if (badges) badges.innerHTML = "";

    const dueInput = row.querySelector(".due");
    if (dueInput) dueInput.classList.toggle("warn", !ex.due);

    if (ex.urgent > 0 && c.nextPay && badges) {
      const b = document.createElement("div");
      b.className = "tag";
      b.textContent = `⚠ Urgente: ${fmtMoney(ex.urgent)}`;
      badges.appendChild(b);
    }
  }

  // Plan
  if (!els.plan) return;
  if (!c.nextPay) {
    els.plan.innerHTML = `<div class="planRow"><span class="muted">Define “Último cobro” para ver el plan.</span><span class="muted">—</span></div>`;
  } else {
    els.plan.innerHTML = c.plan.map(x => `
      <div class="planRow">
        <span>${fmtDate(x.date)}</span>
        <span class="strong">${fmtMoney(x.total)}</span>
      </div>
    `).join("");
  }

  rebuildPaychecksTable(c.plan, c.payDates);
}

function refreshAll() {
  refreshHeaderInputs();
  refreshCalculationsOnly();
}

/***********************
 * Profiles
 ***********************/
function profileCardHTML(p) {
  const name = p.displayName || p.id;
  const type = p.paySchedule?.type || "15days";
  const label = PAY_TYPES[type]?.label || "Cada 15 días";
  return `
    <div class="profileCard">
      <div class="row">
        <div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="meta">${escapeHtml(label)}</div>
        </div>
        <button class="btn" data-open="${escapeHtml(p.id)}" type="button">Abrir</button>
      </div>
    </div>
  `;
}

async function refreshProfilesList() {
  if (!currentUser) return;
  setText(els.profilesMsg, "Cargando perfiles…");

  try {
    await ensureDefaultProfiles(currentUser.uid);
    const profiles = await listProfilesFromCloud(currentUser.uid);

    if (els.profilesList) {
      els.profilesList.innerHTML = profiles.map(profileCardHTML).join("");
      els.profilesList.querySelectorAll("[data-open]").forEach(btn => {
        on(btn, "click", async () => openProfile(btn.getAttribute("data-open")));
      });
    }

    setText(els.profilesMsg, profiles.length ? "" : "No hay perfiles.");
  } catch (e) {
    setText(els.profilesMsg, "No pude cargar perfiles (revisa Rules de Firestore).");
  }
}

function slugifyName(name) {
  const base = String(name || "perfil")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "perfil";
}

async function createProfile() {
  const name = (els.newProfileName?.value || "").trim();
  if (!name) {
    setText(els.profilesMsg, "Escribe un nombre para el perfil.");
    return;
  }

  const payType = els.newPayType?.value || "15days";
  const lastPay = els.newLastPayDate?.value || "";
  const md = Number(els.newMonthDay?.value) || (lastPay ? new Date(lastPay).getDate() : 1);

  const baseId = slugifyName(name);
  let profileId = baseId;

  const existing = await listProfilesFromCloud(currentUser.uid);
  const setIds = new Set(existing.map(x => x.id));
  let n = 2;
  while (setIds.has(profileId)) profileId = `${baseId}-${n++}`;

  const fresh = defaultProfileState(profileId, name, payType, lastPay, md);
  await profileDocRef(currentUser.uid, profileId).set(fresh, { merge: true });

  if (els.newProfileName) els.newProfileName.value = "";
  if (els.newLastPayDate) els.newLastPayDate.value = "";
  if (els.newMonthDay) els.newMonthDay.value = "";

  setText(els.profilesMsg, "Perfil creado ✅");
  await refreshProfilesList();
}

async function openProfile(profileId) {
  currentProfileId = profileId;
  localStorage.setItem("lastProfileId", profileId);

  setText(els.cloudMsg, "Cargando de la nube…");
  state = await loadProfile(currentUser.uid, profileId);

  rebuildExpensesTable();
  refreshAll();
  show("app");
}

/***********************
 * Events
 ***********************/
on(els.btnTogglePass, "click", () => {
  const hidden = els.authPass?.type === "password";
  if (els.authPass) els.authPass.type = hidden ? "text" : "password";
  if (els.btnTogglePass) els.btnTogglePass.textContent = hidden ? "Hide pass" : "Show pass";
});

on(els.btnSignup, "click", async () => {
  try {
    setText(els.authMsg, "Creando cuenta…");
    await auth.createUserWithEmailAndPassword((els.authEmail?.value || "").trim(), els.authPass?.value || "");
  } catch (e) {
    setText(els.authMsg, e?.message || "Error creando cuenta");
  }
});

on(els.btnLogin, "click", async () => {
  try {
    setText(els.authMsg, "Entrando…");
    await auth.signInWithEmailAndPassword((els.authEmail?.value || "").trim(), els.authPass?.value || "");
    if (els.authPass) els.authPass.type = "password";
    if (els.btnTogglePass) els.btnTogglePass.textContent = "Show pass";
  } catch (e) {
    setText(els.authMsg, e?.message || "Error entrando");
  }
});

on(els.btnLogout, "click", async () => {
  await auth.signOut();
});

on(els.btnBackProfiles, "click", () => show("profiles"));
on(els.btnRefreshProfiles, "click", () => refreshProfilesList());

on(els.newPayType, "change", () => setMonthlyVisibility(els.newPayType, els.newMonthDayWrap));
on(els.btnCreateProfile, "click", async () => {
  try {
    setText(els.profilesMsg, "Creando…");
    await createProfile();
  } catch {
    setText(els.profilesMsg, "No pude crear el perfil.");
  }
});

on(els.btnCalc, "click", () => refreshAll());

on(els.payType, "change", () => {
  if (!state) return;
  state.paySchedule.type = els.payType.value;
  setMonthlyVisibility(els.payType, els.monthDayWrap);

  if (state.paySchedule.type === "monthly") {
    const md = Number(state.paySchedule.monthDay) || (state.lastPayDate ? new Date(state.lastPayDate).getDate() : 1);
    state.paySchedule.monthDay = md;
    if (els.monthDay) els.monthDay.value = String(md);
  }

  saveToCloudDebounced();
  refreshAll();
});

on(els.lastPayDate, "change", () => {
  if (!state) return;
  state.lastPayDate = els.lastPayDate.value;

  if (state.paySchedule.type === "monthly" && state.lastPayDate) {
    state.paySchedule.monthDay = new Date(state.lastPayDate).getDate();
    if (els.monthDay) els.monthDay.value = String(state.paySchedule.monthDay);
  }

  saveToCloudDebounced();
  refreshAll();
});

on(els.monthDay, "input", () => {
  if (!state) return;
  const v = Math.max(1, Math.min(31, Number(els.monthDay.value) || 1));
  state.paySchedule.monthDay = v;
  saveToCloudDebounced();
  refreshAll();
});

on(els.btnAddExpense, "click", () => {
  if (!state) return;
  const ex = { id: uid(), name: "Nuevo gasto", amount: "", freqId: "monthly", dueDate: "" };
  state.expenses.push(ex);
  saveToCloudDebounced();
  if (els.rows) els.rows.appendChild(createExpenseRow(ex));
  refreshAll();
});

on(els.btnResetProfile, "click", async () => {
  if (!currentUser || !currentProfileId || !state) return;
  if (!confirm("¿Seguro que quieres resetear este perfil en la nube?")) return;

  const fresh = defaultProfileState(
    currentProfileId,
    state.displayName,
    state.paySchedule?.type || "15days",
    state.lastPayDate || "",
    Number(state.paySchedule?.monthDay) || 1
  );
  await profileDocRef(currentUser.uid, currentProfileId).set(fresh, { merge: false });
  state = fresh;

  rebuildExpensesTable();
  refreshAll();
  setText(els.cloudMsg, "Perfil reseteado.");
});

/***********************
 * Start
 ***********************/
auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (!user) {
    currentProfileId = null;
    state = null;
    setText(els.authMsg, "");
    show("auth");
    return;
  }

  show("profiles");
  await refreshProfilesList();

  const last = localStorage.getItem("lastProfileId");
  if (last) {
    const profiles = await listProfilesFromCloud(user.uid);
    if (profiles.some(p => p.id === last)) await openProfile(last);
  }
});
