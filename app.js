/* ========= Config ========= */
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
  profileView: $("profileView"),
  appView: $("appView"),

  whoTitle: $("whoTitle"),
  btnSwitchProfile: $("btnSwitchProfile"),

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
  saveMsg: $("saveMsg"),
};

let currentProfileId = null;
let state = null;

/* ========= Utils ========= */
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

/* Próximo cobro = el primero >= hoy, avanzando por intervalos desde último cobro */
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

/* ========= Storage ========= */
function storageKey(profileId) {
  return `finanzas_web_${profileId}_v1`;
}

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

function defaultState(profileId) {
  const meta = PROFILE_META[profileId];
  return {
    profileId,
    intervalDays: meta.intervalDays,
    lastPayDate: meta.defaultLastPay,
    incomePerPay: "", // opcional
    expenses: defaultExpensesList(),
    updatedAt: new Date().toISOString(),
  };
}

function loadState(profileId) {
  const raw = localStorage.getItem(storageKey(profileId));
  if (!raw) return defaultState(profileId);

  try {
    const data = JSON.parse(raw);
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
  } catch {
    return defaultState(profileId);
  }
}

let saveTimer = null;
function saveStateDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!currentProfileId || !state) return;
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(currentProfileId), JSON.stringify(state));
    els.saveMsg.textContent = `Guardado: ${new Date().toLocaleTimeString()}`;
  }, 150);
}

/* ========= Calculations ========= */
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

  // “Apartar en próximo cobro” por gasto
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

  // Plan 8 cobros (estimado)
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

/* ========= UI ========= */
function showProfilePicker() {
  els.profileView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  els.btnSwitchProfile.classList.add("hidden");
}

function showApp() {
  els.profileView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.btnSwitchProfile.classList.remove("hidden");
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

  // NO re-render al teclear (para evitar el bug de “no deja escribir más de 1 número”)
  nameEl.addEventListener("input", () => updateExpense(expense.id, { name: nameEl.value }, false));
  amountEl.addEventListener("input", () => updateExpense(expense.id, { amount: amountEl.value }, false));

  // estos sí refrescan todo
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
  saveStateDebounced();
  if (fullRefresh) refreshAll();
  else refreshCalculationsOnly();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveStateDebounced();
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

/* ========= Profile flow ========= */
function openProfile(profileId) {
  currentProfileId = profileId;
  localStorage.setItem("finanzas_last_profile", profileId);

  state = loadState(profileId);

  // si no tiene fecha aún, usa default del perfil (si existe)
  const meta = PROFILE_META[profileId];
  if (!state.lastPayDate && meta.defaultLastPay) state.lastPayDate = meta.defaultLastPay;
  if (!state.intervalDays) state.intervalDays = meta.intervalDays;

  rebuildExpensesTable();
  refreshAll();
  showApp();
}

/* ========= Events ========= */
document.querySelectorAll(".profileBtn").forEach(btn => {
  btn.addEventListener("click", () => openProfile(btn.dataset.profile));
});

els.btnSwitchProfile.addEventListener("click", () => {
  showProfilePicker();
});

els.btnCalc.addEventListener("click", () => refreshAll());

els.payInterval.addEventListener("change", (e) => {
  state.intervalDays = Number(e.target.value) === 7 ? 7 : 15;
  saveStateDebounced();
  refreshAll();
});

els.lastPayDate.addEventListener("change", (e) => {
  state.lastPayDate = e.target.value;
  saveStateDebounced();
  refreshAll();
});

els.income.addEventListener("input", (e) => {
  state.incomePerPay = e.target.value; // opcional
  saveStateDebounced();
  refreshCalculationsOnly();
});

els.btnAddExpense.addEventListener("click", () => {
  const ex = { id: uid(), name: "Nuevo gasto", amount: "", freqId: "monthly", dueDate: "" };
  state.expenses.push(ex);
  saveStateDebounced();
  els.rows.appendChild(createExpenseRow(ex));
  refreshAll();
});

els.btnResetProfile.addEventListener("click", () => {
  if (!currentProfileId) return;
  localStorage.removeItem(storageKey(currentProfileId));
  state = defaultState(currentProfileId);
  rebuildExpensesTable();
  refreshAll();
});

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

    saveStateDebounced();
    rebuildExpensesTable();
    refreshAll();
  } catch {
    alert("Archivo inválido. Usa un JSON exportado por esta app.");
  } finally {
    e.target.value = "";
  }
});

/* ========= Start ========= */
(function init(){
  // si ya eligió perfil antes, entra directo
  const last = localStorage.getItem("finanzas_last_profile");
  if (last === "noel" || last === "jenniffer") {
    openProfile(last);
  } else {
    showProfilePicker();
  }
})();
