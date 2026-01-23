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
  weekly:   { label: "Semanal",          mode: "days",  step: 7 },
  "15days": { label: "Cada 15 días",     mode: "days",  step: 15 },
  biweekly: { label: "Quincenal (14)",   mode: "days",  step: 14 },
  monthly:  { label: "Mensual",          mode: "months", step: 1 },
};

const $ = (id) => document.getElementById(id);

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
 * Helpers
 ***********************/
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
 * Salary schedule logic
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

  // monthly
  const monthDay = Number(schedule?.monthDay) || (lastPayDateStr ? new Date(lastPayDateStr).getDate() : 1);
  const now = new Date();
  const cur = makeMonthlyDateNear(now.getFullYear(), now.getMonth(), monthDay);
  if (cur >= today) return cur;
  const nxt = addMonths(cur, 1);
  return startOfDay(nxt);
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
    if (def.mode === "days") d = startOfDay(addDays(d, def.step));
    else d = startOfDay(addMonths(d, def.step));
  }
  return out;
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

function defaultProfileState(profileId, displayName, payType = "15days", lastPayDate = "2026-01-09", monthDay = 9) {
  return {
    profileId,
    displayName: displayName || "Perfil",
    paySchedule: { type: payType, monthDay: monthDay || 1 },
    lastPayDate: lastPayDate || "",
    paychecks: {}, // {"YYYY-MM-DD": "1200"}
    expenses: defaultExpensesList(),
    updatedAt: new Date().toISOString(),
  };
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
 * Cloud load/save
 ***********************/
async function listProfilesFromCloud(uid) {
  const snap = await profilesColRef(uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function ensureDefaultProfiles(uid) {
  const existing = await listProfilesFromCloud(uid);
  if (existing.length > 0) return;

  const noel = defaultProfileState("noel", "Noel", "15days", "2026-01-09", 9);
  const jen  = defaultProfileState("jenniffer", "Jenniffer", "weekly", "", 1);

  await profileDocRef(uid, "noel").set(noel, { merge: true });
  await profileDocRef(uid, "jenniffer").set(jen, { merge: true });
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
  // Normaliza campos por si faltan
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
      els.cloudMsg.textContent = `Guardado en la nube: ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      els.cloudMsg.textContent = "No pude guardar (revisa Rules / dominio / login).";
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

  // Apartar en el próximo cobro por gasto
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

  // Plan por cada cobro (8)
  const plan = [];
  if (nextPay) {
    const sim = expenses.map(ex => ({
      id: ex.id,
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

  // Libre del próximo cobro (si hay monto)
  let free = null;
  if (nextPay) {
    const key = toISODate(nextPay);
    const amountStr = state.paychecks?.[key];
    if (hasValue(amountStr)) free = parseNumber(amountStr) - (plan[0]?.total || 0);
  }

  return { nextPay, payDates, expenses, perNextPay, urgentTotal, nextSaveTotal, plan, free };
}

/***********************
 * UI helpers
 ***********************/
function show(view) {
  els.authView.classList.toggle("hidden", view !== "auth");
  els.profileView.classList.toggle("hidden", view !== "profiles");
  els.appView.classList.toggle("hidden", view !== "app");
  els.btnLogout.classList.toggle("hidden", view === "auth");
}

function setMonthlyVisibility(selectEl, wrapEl) {
  const isMonthly = selectEl.value === "monthly";
  wrapEl.classList.toggle("hidden", !isMonthly);
}

function findRowById(container, id) {
  const kids = container.children;
  for (let i=0; i<kids.length; i++) {
    if (kids[i].dataset.id === id) return kids[i];
  }
  return null;
}

/***********************
 * Expenses UI
 ***********************/
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

  // NO re-render mientras escribes (corrige bug de 1 número)
  nameEl.addEventListener("input", () => updateExpense(expense.id, { name: nameEl.value }, false));
  amountEl.addEventListener("input", () => updateExpense(expense.id, { amount: amountEl.value }, false));

  freqEl.addEventListener("change", () => updateExpense(expense.id, { freqId: freqEl.value }, true));
  dueEl.addEventListener("change", () => updateExpense(expense.id, { dueDate: dueEl.value }, true));

  delEl.addEventListener("click", () => deleteExpense(expense.id));

  return row;
}

function rebuildExpensesTable() {
  els.rows.innerHTML = "";
  for (const ex of state.expenses) els.rows.appendChild(createExpenseRow(ex));
}

function updateExpense(id, patch, fullRefresh) {
  state.expenses = state.expenses.map(e => (e.id === id ? { ...e, ...patch } : e));
  saveToCloudDebounced();
  if (fullRefresh) refreshAll();
  else refreshCalculationsOnly();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveToCloudDebounced();
  const row = findRowById(els.rows, id);
  if (row) row.remove();
  refreshAll();
}

/***********************
 * Paychecks UI (monto por cobro)
 ***********************/
function rebuildPaychecksTable(plan, payDates) {
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

    function updateFreeInline() {
      if (!hasValue(amtEl.value)) {
        freeEl.textContent = "—";
        freeEl.className = "right strong free muted";
        return;
      }
      const free = parseNumber(amtEl.value) - recommended;
      freeEl.textContent = fmtMoney(free);
      freeEl.className = "right strong free " + (free >= 0 ? "ok" : "bad");
    }

    // Guardar en la nube SIN re-render mientras tecleas
    amtEl.addEventListener("input", () => {
      state.paychecks[key] = amtEl.value;
      saveToCloudDebounced();
      updateFreeInline();

      // Si este key es el próximo cobro, actualiza la tarjeta "Libre"
      const next = computeNextPayDateBySchedule(state.paySchedule, state.lastPayDate);
      if (next && toISODate(next) === key) {
        const free = parseNumber(amtEl.value) - recommended;
        els.free.textContent = hasValue(amtEl.value) ? fmtMoney(free) : "—";
        els.free.className = "strong " + (hasValue(amtEl.value) ? (free >= 0 ? "ok" : "bad") : "muted");
      }
    });

    updateFreeInline();
    els.payRows.appendChild(row);
  }
}

/***********************
 * Refresh / render
 ***********************/
function refreshHeaderInputs() {
  els.whoTitle.textContent = `Perfil: ${state.displayName}`;

  els.payType.value = state.paySchedule?.type || "15days";
  els.lastPayDate.value = state.lastPayDate ?? "";

  const md = Number(state.paySchedule?.monthDay) || (state.lastPayDate ? new Date(state.lastPayDate).getDate() : 1);
  els.monthDay.value = String(md);

  setMonthlyVisibility(els.payType, els.monthDayWrap);
}

function refreshCalculationsOnly() {
  const c = compute(state);

  els.nextPayDate.value = c.nextPay ? fmtDate(c.nextPay) : "— pon tu último cobro";
  els.urgent.textContent = fmtMoney(c.urgentTotal);
  els.nextSave.textContent = fmtMoney(c.nextSaveTotal);

  if (!c.nextPay) {
    els.free.textContent = "—";
    els.free.className = "strong muted";
  } else {
    const key = toISODate(c.nextPay);
    const amt = state.paychecks?.[key];
    if (!hasValue(amt)) {
      els.free.textContent = "—";
      els.free.className = "strong muted";
    } else {
      const free = parseNumber(amt) - (c.plan[0]?.total || 0);
      els.free.textContent = fmtMoney(free);
      els.free.className = "strong " + (free >= 0 ? "ok" : "bad");
    }
  }

  // Per expense: apartar próximo cobro
  for (const ex of c.expenses) {
    const row = findRowById(els.rows, ex.id);
    if (!row) continue;

    row.querySelector(".perPay").textContent = fmtMoney(c.perNextPay.get(ex.id) || 0);

    const badges = row.querySelector(".badges");
    badges.innerHTML = "";

    const dueInput = row.querySelector(".due");
    if (!ex.due) dueInput.classList.add("warn");
    else dueInput.classList.remove("warn");

    if (ex.urgent > 0 && c.nextPay) {
      const b = document.createElement("div");
      b.className = "tag";
      b.textContent = `⚠ Urgente: ${fmtMoney(ex.urgent)}`;
      badges.appendChild(b);
    }
  }

  // Plan list
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

  // Paychecks table
  rebuildPaychecksTable(c.plan, c.payDates);
}

function refreshAll() {
  refreshHeaderInputs();
  refreshCalculationsOnly();
}

/***********************
 * Profiles UI
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
          <div class="meta">${label}</div>
        </div>
        <button class="btn" data-open="${p.id}" type="button">Abrir</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function refreshProfilesList() {
  if (!currentUser) return;
  els.profilesMsg.textContent = "Cargando perfiles…";

  await ensureDefaultProfiles(currentUser.uid);
  const profiles = await listProfilesFromCloud(currentUser.uid);

  els.profilesList.innerHTML = profiles.map(profileCardHTML).join("");

  // bind open buttons
  els.profilesList.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await openProfile(btn.getAttribute("data-open"));
    });
  });

  els.profilesMsg.textContent = profiles.length ? "" : "No hay perfiles.";
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
  const name = els.newProfileName.value.trim();
  if (!name) {
    els.profilesMsg.textContent = "Escribe un nombre para el perfil.";
    return;
  }

  const payType = els.newPayType.value;
  const lastPay = els.newLastPayDate.value || "";
  const md = Number(els.newMonthDay.value) || (lastPay ? new Date(lastPay).getDate() : 1);

  const baseId = slugifyName(name);
  let profileId = baseId;

  // Evita choque de ids
  const existing = await listProfilesFromCloud(currentUser.uid);
  const setIds = new Set(existing.map(x => x.id));
  let n = 2;
  while (setIds.has(profileId)) {
    profileId = `${baseId}-${n++}`;
  }

  const fresh = defaultProfileState(profileId, name, payType, lastPay, md);
  await profileDocRef(currentUser.uid, profileId).set(fresh, { merge: true });

  els.newProfileName.value = "";
  els.newLastPayDate.value = "";
  els.newMonthDay.value = "";
  els.profilesMsg.textContent = "Perfil creado ✅";
  await refreshProfilesList();
}

/***********************
 * Open profile
 ***********************/
async function openProfile(profileId) {
  currentProfileId = profileId;
  localStorage.setItem("lastProfileId", profileId);

  els.cloudMsg.textContent = "Cargando de la nube…";
  state = await loadProfile(currentUser.uid, profileId);

  rebuildExpensesTable();
  refreshAll();
  show("app");
}

/***********************
 * Events
 ***********************/
// Show pass / hide pass
if (els.btnTogglePass) {
  els.btnTogglePass.addEventListener("click", () => {
    const hidden = els.authPass.type === "password";
    els.authPass.type = hidden ? "text" : "password";
    els.btnTogglePass.textContent = hidden ? "Hide pass" : "Show pass";
  });
}

// Auth
els.btnSignup.addEventListener("click", async () => {
  try {
    els.authMsg.textContent = "Creando cuenta…";
    await auth.createUserWithEmailAndPassword(els.authEmail.value.trim(), els.authPass.value);
  } catch (e) {
    els.authMsg.textContent = e?.message || "Error creando cuenta";
  }
});

els.btnLogin.addEventListener("click", async () => {
  try {
    els.authMsg.textContent = "Entrando…";
    await auth.signInWithEmailAndPassword(els.authEmail.value.trim(), els.authPass.value);
    // vuelve a ocultar
    els.authPass.type = "password";
    if (els.btnTogglePass) els.btnTogglePass.textContent = "Show pass";
  } catch (e) {
    els.authMsg.textContent = e?.message || "Error entrando";
  }
});

els.btnLogout.addEventListener("click", async () => {
  await auth.signOut();
});

// Profiles
els.btnBackProfiles.addEventListener("click", () => show("profiles"));
els.btnRefreshProfiles.addEventListener("click", () => refreshProfilesList());

els.newPayType.addEventListener("change", () => {
  setMonthlyVisibility(els.newPayType, els.newMonthDayWrap);
});

els.btnCreateProfile.addEventListener("click", async () => {
  try {
    els.profilesMsg.textContent = "Creando…";
    await createProfile();
  } catch (e) {
    els.profilesMsg.textContent = e?.message || "No pude crear el perfil.";
  }
});

// App
els.btnCalc.addEventListener("click", () => refreshAll());

els.payType.addEventListener("change", () => {
  state.paySchedule.type = els.payType.value;
  setMonthlyVisibility(els.payType, els.monthDayWrap);

  if (state.paySchedule.type === "monthly") {
    const md = Number(state.paySchedule.monthDay) || (state.lastPayDate ? new Date(state.lastPayDate).getDate() : 1);
    state.paySchedule.monthDay = md;
    els.monthDay.value = String(md);
  }

  saveToCloudDebounced();
  refreshAll();
});

els.lastPayDate.addEventListener("change", () => {
  state.lastPayDate = els.lastPayDate.value;

  // si es mensual y no hay monthDay, lo toma de la fecha
  if (state.paySchedule.type === "monthly" && state.lastPayDate) {
    state.paySchedule.monthDay = new Date(state.lastPayDate).getDate();
    els.monthDay.value = String(state.paySchedule.monthDay);
  }

  saveToCloudDebounced();
  refreshAll();
});

els.monthDay.addEventListener("input", () => {
  if (!state) return;
  const v = Math.max(1, Math.min(31, Number(els.monthDay.value) || 1));
  state.paySchedule.monthDay = v;
  saveToCloudDebounced();
  refreshAll();
});

// Expenses
els.btnAddExpense.addEventListener("click", () => {
  const ex = { id: uid(), name: "Nuevo gasto", amount: "", freqId: "monthly", dueDate: "" };
  state.expenses.push(ex);
  saveToCloudDebounced();
  els.rows.appendChild(createExpenseRow(ex));
  refreshAll();
});

// Reset profile
els.btnResetProfile.addEventListener("click", async () => {
  if (!currentUser || !currentProfileId) return;
  if (!confirm("¿Seguro que quieres resetear este perfil en la nube?")) return;

  const name = state.displayName;
  const type = state.paySchedule?.type || "15days";
  const lastPay = state.lastPayDate || "";
  const md = Number(state.paySchedule?.monthDay) || 1;

  const fresh = defaultProfileState(currentProfileId, name, type, lastPay, md);
  await profileDocRef(currentUser.uid, currentProfileId).set(fresh, { merge: false });
  state = fresh;

  rebuildExpensesTable();
  refreshAll();
  els.cloudMsg.textContent = "Perfil reseteado.";
});

// Export/Import
els.btnExport.addEventListener("click", () => {
  const payload = { ...state, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas-${currentProfileId}-backup.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

els.importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // merge seguro
    state.displayName = data.displayName ?? state.displayName;
    state.paySchedule = data.paySchedule ?? state.paySchedule;
    state.lastPayDate = data.lastPayDate ?? state.lastPayDate;
    state.paychecks = (data.paychecks && typeof data.paychecks === "object") ? data.paychecks : state.paychecks;

    if (Array.isArray(data.expenses)) {
      state.expenses = data.expenses.map(x => ({
        id: x.id || uid(),
        name: x.name ?? "",
        amount: x.amount ?? "",
        freqId: BILL_FREQ.some(f => f.id === x.freqId) ? x.freqId : "monthly",
        dueDate: x.dueDate ?? "",
      }));
    }

    saveToCloudDebounced();
    rebuildExpensesTable();
    refreshAll();
    els.cloudMsg.textContent = "Importado y guardando en la nube…";
  } catch {
    alert("Archivo inválido.");
  } finally {
    e.target.value = "";
  }
});

/***********************
 * Start
 ***********************/
auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (!user) {
    currentProfileId = null;
    state = null;
    els.authMsg.textContent = "";
    show("auth");
    return;
  }

  show("profiles");
  await refreshProfilesList();

  const last = localStorage.getItem("lastProfileId");
  if (last) {
    // abre si existe
    const profiles = await listProfilesFromCloud(user.uid);
    if (profiles.some(p => p.id === last)) {
      await openProfile(last);
    }
  }
});
