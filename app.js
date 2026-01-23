/***********************
 * 1) PEGA TU firebaseConfig AQUÍ (SOLO EL OBJETO)
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

// Firebase init (compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/***********************
 * 2) Config App
 ***********************/
const PROFILE_META = {
  noel: { name: "Noel", intervalDays: 15, defaultLastPay: "2026-01-09" },
  jenniffer: { name: "Jenniffer", intervalDays: 7, defaultLastPay: "" },
};

const BILL_FREQ = [
  { id: "monthly",  label: "Mensual",      type: "months", step: 1 },
  { id: "weekly",   label: "Semanal",      type: "days",   step: 7 },
  { id: "q15",      label: "Cada 15 días", type: "days",   step: 15 },
  { id: "yearly",   label: "Anual",        type: "years",  step: 1 },
];

const $ = (id) => document.getElementById(id);

const els = {
  authView: $("authView"),
  profileView: $("profileView"),
  appView: $("appView"),

  authEmail: $("authEmail"),
  authPass: $("authPass"),
  btnLogin: $("btnLogin"),
  btnSignup: $("btnSignup"),
  authMsg: $("authMsg"),
  btnLogout: $("btnLogout"),

  whoTitle: $("whoTitle"),
  btnBackProfiles: $("btnBackProfiles"),

  btnCalc: $("btnCalc"),
  btnExport: $("btnExport"),
  importFile: $("importFile"),
  btnResetProfile: $("btnResetProfile"),

  payInterval: $("payInterval"),
  lastPayDate: $("lastPayDate"),
  nextPayDate: $("nextPayDate"),
  income: $("income"),

  urgent: $("urgent"),
  nextSave: $("nextSave"),
  free: $("free"),

  btnAddExpense: $("btnAddExpense"),
  rows: $("rows"),
  plan: $("plan"),
  cloudMsg: $("cloudMsg"),
};

let currentUser = null;
let currentProfileId = null;
let state = null;

/***********************
 * 3) Helpers
 ***********************/
function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
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
function computeNextPayDate(lastPayStr, intervalDays) {
  if (!lastPayStr) return null;
  let d = startOfDay(new Date(lastPayStr));
  if (Number.isNaN(d.getTime())) return null;

  const today = startOfDay(new Date());
  for (let i=0; i<500; i++) {
    if (d >= today) return d;
    d = startOfDay(addDays(d, intervalDays));
  }
  return d;
}
function generatePayDates(nextPay, intervalDays, count=8) {
  const out = [];
  let d = startOfDay(nextPay);
  for (let i=0; i<count; i++) {
    out.push(startOfDay(d));
    d = startOfDay(addDays(d, intervalDays));
  }
  return out;
}

/***********************
 * 4) Default data
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
function defaultProfileState(profileId) {
  const meta = PROFILE_META[profileId];
  return {
    profileId,
    intervalDays: meta.intervalDays,
    lastPayDate: meta.defaultLastPay,
    incomePerPay: "",
    expenses: defaultExpensesList(),
    updatedAt: new Date().toISOString(),
  };
}

/***********************
 * 5) Firestore paths
 ***********************/
function profileDocRef(uid, profileId) {
  return db.collection("users").doc(uid).collection("profiles").doc(profileId);
}

async function loadFromCloud(uid, profileId) {
  const ref = profileDocRef(uid, profileId);
  const snap = await ref.get();

  if (!snap.exists) {
    const fresh = defaultProfileState(profileId);
    await ref.set(fresh, { merge: true });
    return fresh;
  }

  const data = snap.data() || {};
  const meta = PROFILE_META[profileId];

  return {
    profileId,
    intervalDays: Number(data.intervalDays) === 7 ? 7 : 15,
    lastPayDate: data.lastPayDate ?? meta.defaultLastPay ?? "",
    incomePerPay: data.incomePerPay ?? "",
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
      els.cloudMsg.textContent = "No pude guardar (revisa Firebase/rules/dominio).";
    }
  }, 250);
}

/***********************
 * 6) Calculations
 ***********************/
function compute(state) {
  const intervalDays = Number(state.intervalDays) === 7 ? 7 : 15;
  const nextPay = computeNextPayDate(state.lastPayDate, intervalDays);
  const payDates = nextPay ? generatePayDates(nextPay, intervalDays, 8) : [];

  const today = startOfDay(new Date());
  const incomeProvided = hasValue(state.incomePerPay);
  const income = incomeProvided ? parseNumber(state.incomePerPay) : null;

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

  const free = (nextPay && incomeProvided) ? (income - nextSaveTotal) : null;

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
          ex.due = advanceDueDate(ex.due.toISOString().slice(0,10), ex.freqId, addDays(ref, 1));
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

  return { nextPay, expenses, perNextPay, urgentTotal, nextSaveTotal, free, plan, incomeProvided };
}

/***********************
 * 7) UI
 ***********************/
function show(view) {
  els.authView.classList.toggle("hidden", view !== "auth");
  els.profileView.classList.toggle("hidden", view !== "profiles");
  els.appView.classList.toggle("hidden", view !== "app");
  els.btnLogout.classList.toggle("hidden", view === "auth");
}

function findRowById(id) {
  const kids = els.rows.children;
  for (let i=0; i<kids.length; i++) {
    if (kids[i].dataset.id === id) return kids[i];
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
    <button class="btn danger ghost del" title="Eliminar">✕</button>
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

  // No re-render al teclear (soluciona el bug “no deja meter más de 1 número”)
  nameEl.addEventListener("input", () => updateExpense(expense.id, { name: nameEl.value }, false));
  amountEl.addEventListener("input", () => updateExpense(expense.id, { amount: amountEl.value }, false));

  freqEl.addEventListener("change", () => updateExpense(expense.id, { freqId: freqEl.value }, true));
  dueEl.addEventListener("change", () => updateExpense(expense.id, { dueDate: dueEl.value }, true));

  delEl.addEventListener("click", () => deleteExpense(expense.id));

  return row;
}

function rebuildExpensesTable() {
  els.rows.innerHTML = "";
  for (const ex of state.expenses) {
    els.rows.appendChild(createExpenseRow(ex));
  }
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
  const row = findRowById(id);
  if (row) row.remove();
  refreshAll();
}

function refreshHeaderInputs() {
  const meta = PROFILE_META[currentProfileId];
  els.whoTitle.textContent = `Perfil: ${meta.name}`;
  els.payInterval.value = String(state.intervalDays);
  els.lastPayDate.value = state.lastPayDate ?? "";
  els.income.value = state.incomePerPay ?? "";
}

function refreshCalculationsOnly() {
  const c = compute(state);

  els.nextPayDate.value = c.nextPay ? fmtDate(c.nextPay) : "— pon tu último cobro";
  els.urgent.textContent = fmtMoney(c.urgentTotal);
  els.nextSave.textContent = fmtMoney(c.nextSaveTotal);

  if (!c.incomeProvided) {
    els.free.textContent = "—";
    els.free.className = "strong muted";
  } else {
    els.free.textContent = fmtMoney(c.free ?? 0);
    els.free.className = "strong " + ((c.free ?? 0) >= 0 ? "ok" : "bad");
  }

  for (const ex of c.expenses) {
    const row = findRowById(ex.id);
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
}

function refreshAll() {
  refreshHeaderInputs();
  refreshCalculationsOnly();
}

async function openProfile(profileId) {
  currentProfileId = profileId;
  localStorage.setItem("lastProfile", profileId);

  els.cloudMsg.textContent = "Cargando de la nube…";
  state = await loadFromCloud(currentUser.uid, profileId);

  rebuildExpensesTable();
  refreshAll();
  show("app");
}

/***********************
 * 8) Events
 ***********************/
els.btnSignup.addEventListener("click", async () => {
  try {
    els.authMsg.textContent = "Creando cuenta…";
    await auth.createUserWithEmailAndPassword(
      els.authEmail.value.trim(),
      els.authPass.value
    );
  } catch (e) {
    els.authMsg.textContent = e?.message || "Error creando cuenta";
  }
});

els.btnLogin.addEventListener("click", async () => {
  try {
    els.authMsg.textContent = "Entrando…";
    await auth.signInWithEmailAndPassword(
      els.authEmail.value.trim(),
      els.authPass.value
    );
  } catch (e) {
    els.authMsg.textContent = e?.message || "Error entrando";
  }
});

els.btnLogout.addEventListener("click", async () => {
  await auth.signOut();
});

document.querySelectorAll(".profileBtn").forEach(btn => {
  btn.addEventListener("click", async () => {
    await openProfile(btn.dataset.profile);
  });
});

els.btnBackProfiles.addEventListener("click", () => show("profiles"));
els.btnCalc.addEventListener("click", () => refreshAll());

els.payInterval.addEventListener("change", (e) => {
  state.intervalDays = Number(e.target.value) === 7 ? 7 : 15;
  saveToCloudDebounced();
  refreshAll();
});

els.lastPayDate.addEventListener("change", (e) => {
  state.lastPayDate = e.target.value;
  saveToCloudDebounced();
  refreshAll();
});

els.income.addEventListener("input", (e) => {
  state.incomePerPay = e.target.value;
  saveToCloudDebounced();
  refreshCalculationsOnly();
});

els.btnAddExpense.addEventListener("click", () => {
  const ex = { id: uid(), name: "Nuevo gasto", amount: "", freqId: "monthly", dueDate: "" };
  state.expenses.push(ex);
  saveToCloudDebounced();
  els.rows.appendChild(createExpenseRow(ex));
  refreshAll();
});

els.btnResetProfile.addEventListener("click", async () => {
  if (!currentUser || !currentProfileId) return;
  if (!confirm("¿Seguro que quieres resetear este perfil en la nube?")) return;

  const fresh = defaultProfileState(currentProfileId);
  await profileDocRef(currentUser.uid, currentProfileId).set(fresh, { merge: false });
  state = fresh;

  rebuildExpensesTable();
  refreshAll();
  els.cloudMsg.textContent = "Perfil reseteado.";
});

// Backup export/import (opcional pero útil)
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

    state.intervalDays = Number(data.intervalDays) === 7 ? 7 : 15;
    state.lastPayDate = data.lastPayDate ?? state.lastPayDate;
    state.incomePerPay = data.incomePerPay ?? "";

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
 * 9) Start
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

  const last = localStorage.getItem("lastProfile");
  if (last === "noel" || last === "jenniffer") {
    await openProfile(last);
  }
});
