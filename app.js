/***********************
 * Anti-crash helpers
 ***********************/
const $ = (id) => document.getElementById(id);
const on = (el, evt, fn) => el && el.addEventListener(evt, fn);
const setText = (el, txt) => el && (el.textContent = txt);
const toggleHidden = (el, hidden) => el && el.classList.toggle("hidden", hidden);

function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}
function parseNumber(v) {
  const cleaned = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function hasValue(v){ return String(v ?? "").trim().length > 0; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function toDateAtLocalMidnight(dateStr){
  // dateStr: YYYY-MM-DD
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1, 0,0,0,0);
}
function isoDateFromDate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function monthIndexFromDate(d){ return d.getMonth(); } // 0..11
function monthName(i){
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][i] || "";
}

/***********************
 * Firebase
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

if (!window.firebase) {
  const msg = $("authMsg");
  if (msg) msg.textContent = "ERROR: Firebase no cargó. Revisa scripts en index.html.";
  throw new Error("Firebase not loaded");
}
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const TS = firebase.firestore.Timestamp;

/***********************
 * Elements
 ***********************/
const els = {
  // Views
  authView: $("authView"),
  profileView: $("profileView"),
  appView: $("appView"),

  // Auth
  authEmail: $("authEmail"),
  authPass: $("authPass"),
  btnTogglePass: $("btnTogglePass"),
  btnLogin: $("btnLogin"),
  btnSignup: $("btnSignup"),
  authMsg: $("authMsg"),
  btnLogout: $("btnLogout"),

  // Profiles
  profilesList: $("profilesList"),
  btnRefreshProfiles: $("btnRefreshProfiles"),
  newProfileName: $("newProfileName"),
  newCurrency: $("newCurrency"),
  newPayMode: $("newPayMode"),
  newPayDayWrap: $("newPayDayWrap"),
  newPayDay: $("newPayDay"),
  btnCreateProfile: $("btnCreateProfile"),
  profilesMsg: $("profilesMsg"),

  // App header
  whoTitle: $("whoTitle"),
  btnBackProfiles: $("btnBackProfiles"),
  btnExport: $("btnExport"),
  importFile: $("importFile"),
  btnResetYear: $("btnResetYear"),
  cloudMsg: $("cloudMsg"),

  // Settings
  profileName: $("profileName"),
  currency: $("currency"),
  yearSelect: $("yearSelect"),
  payMode: $("payMode"),
  payDayWrap: $("payDayWrap"),
  payDay: $("payDay"),

  // Monthly panel
  monthlyPanel: $("monthlyPanel"),
  monthlyGrid: $("monthlyGrid"),
  btnSaveMonthly: $("btnSaveMonthly"),
  monthlyMsg: $("monthlyMsg"),

  // Dashboard
  sumIncome: $("sumIncome"),
  sumExpense: $("sumExpense"),
  sumNet: $("sumNet"),
  lineChart: $("lineChart"),
  donutChart: $("donutChart"),

  // Income
  incomeDate: $("incomeDate"),
  incomeAmount: $("incomeAmount"),
  incomeNote: $("incomeNote"),
  btnAddIncome: $("btnAddIncome"),
  incomeRows: $("incomeRows"),

  // Fixed templates
  fixedName: $("fixedName"),
  fixedCategory: $("fixedCategory"),
  fixedAmount: $("fixedAmount"),
  fixedDay: $("fixedDay"),
  btnAddFixed: $("btnAddFixed"),
  btnApplyFixedYear: $("btnApplyFixedYear"),
  fixedRows: $("fixedRows"),

  // Expense
  expDate: $("expDate"),
  expName: $("expName"),
  expCategory: $("expCategory"),
  expAmount: $("expAmount"),
  btnAddExpense: $("btnAddExpense"),
  expenseRows: $("expenseRows"),
};

/***********************
 * State
 ***********************/
let currentUser = null;
let currentProfileId = null;

let meta = null;            // profile doc
let incomes = [];           // year incomes (from snapshot)
let expenses = [];          // year expenses (from snapshot)
let fixedTemplates = [];    // templates (from snapshot)

let unsubIncome = null;
let unsubExpense = null;
let unsubFixed = null;

let lineChart = null;
let donutChart = null;

/***********************
 * Firestore paths
 ***********************/
function profileRef(uid, pid){ return db.collection("users").doc(uid).collection("profiles").doc(pid); }
function incomesCol(uid, pid){ return profileRef(uid,pid).collection("incomes"); }
function expensesCol(uid, pid){ return profileRef(uid,pid).collection("expenses"); }
function fixedCol(uid, pid){ return profileRef(uid,pid).collection("fixed"); }

function show(view){
  toggleHidden(els.authView, view !== "auth");
  toggleHidden(els.profileView, view !== "profiles");
  toggleHidden(els.appView, view !== "app");
  toggleHidden(els.btnLogout, view === "auth");
}

function fmtMoneyByCurrency(n){
  const c = meta?.currency || "USD";
  const v = Number.isFinite(n) ? n : 0;
  try {
    return v.toLocaleString(undefined, { style:"currency", currency: c });
  } catch {
    return `${c} ${v.toFixed(2)}`;
  }
}

function nowYear(){
  return new Date().getFullYear();
}

function yearRangeTs(year){
  const start = new Date(year,0,1,0,0,0,0);
  const end = new Date(year+1,0,1,0,0,0,0);
  return { start: TS.fromDate(start), end: TS.fromDate(end) };
}

function setCloudMsg(txt){
  setText(els.cloudMsg, txt || "");
}

/***********************
 * Default profiles
 ***********************/
async function ensureDefaultProfiles(uid){
  const snap = await db.collection("users").doc(uid).collection("profiles").get();
  if (!snap.empty) return;

  await profileRef(uid,"noel").set({
    displayName: "Noel",
    currency: "USD",
    payMode: "manual",     // manual incomes
    payDay: 15,            // for monthly mode if ever used
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge:true });

  await profileRef(uid,"jenniffer").set({
    displayName: "Jenniffer",
    currency: "USD",
    payMode: "manual",
    payDay: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge:true });
}

async function listProfiles(uid){
  const snap = await db.collection("users").doc(uid).collection("profiles").get();
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

function profileCardHTML(p){
  const name = p.displayName || p.id;
  const cur = p.currency || "USD";
  const mode = p.payMode === "monthly" ? "Mensual" : "Manual";
  return `
    <div class="profileCard">
      <div class="row">
        <div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="meta">${escapeHtml(mode)} · ${escapeHtml(cur)}</div>
        </div>
        <button class="btn" data-open="${escapeHtml(p.id)}" type="button">Abrir</button>
      </div>
    </div>
  `;
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function refreshProfilesUI(){
  if (!currentUser) return;
  setText(els.profilesMsg, "Cargando perfiles…");
  await ensureDefaultProfiles(currentUser.uid);
  const profiles = await listProfiles(currentUser.uid);

  els.profilesList.innerHTML = profiles.map(profileCardHTML).join("");
  els.profilesList.querySelectorAll("[data-open]").forEach(btn => {
    on(btn,"click", async () => openProfile(btn.getAttribute("data-open")));
  });

  setText(els.profilesMsg, "");
}

function slugifyName(name){
  const base = String(name||"perfil").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
  return base || "perfil";
}

async function createProfile(){
  const name = (els.newProfileName.value || "").trim();
  if (!name) { setText(els.profilesMsg, "Escribe un nombre."); return; }

  const currency = els.newCurrency.value || "USD";
  const payMode = els.newPayMode.value || "manual";
  const payDay = clamp(Number(els.newPayDay.value || 15), 1, 31);

  const baseId = slugifyName(name);
  let pid = baseId;

  const existing = await listProfiles(currentUser.uid);
  const ids = new Set(existing.map(x => x.id));
  let n=2;
  while(ids.has(pid)) pid = `${baseId}-${n++}`;

  await profileRef(currentUser.uid, pid).set({
    displayName: name,
    currency,
    payMode,
    payDay,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge:true });

  els.newProfileName.value = "";
  els.newPayDay.value = "";
  setText(els.profilesMsg, "Perfil creado ✅");
  await refreshProfilesUI();
}

/***********************
 * Year select
 ***********************/
function buildYearSelect(){
  const y = nowYear();
  const years = [y-2, y-1, y, y+1].sort((a,b)=>b-a); // show recent
  els.yearSelect.innerHTML = years.map(v => `<option value="${v}">${v}</option>`).join("");
  els.yearSelect.value = String(y);
}

/***********************
 * Realtime listeners
 ***********************/
function stopListeners(){
  if (unsubIncome) unsubIncome();
  if (unsubExpense) unsubExpense();
  if (unsubFixed) unsubFixed();
  unsubIncome = unsubExpense = unsubFixed = null;
}

function startYearListeners(year){
  stopListeners();
  incomes = [];
  expenses = [];
  fixedTemplates = [];

  const { start, end } = yearRangeTs(year);

  // incomes for year
  unsubIncome = incomesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs")
    .startAt(start)
    .endBefore(end)
    .onSnapshot((snap) => {
      incomes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderAll();
    });

  // expenses for year
  unsubExpense = expensesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs")
    .startAt(start)
    .endBefore(end)
    .onSnapshot((snap) => {
      expenses = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderAll();
    });

  // fixed templates (no year filter)
  unsubFixed = fixedCol(currentUser.uid, currentProfileId)
    .orderBy("name")
    .onSnapshot((snap) => {
      fixedTemplates = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderFixedList();
    });
}

/***********************
 * Charts
 ***********************/
function ensureCharts(){
  if (!els.lineChart || !els.donutChart) return;

  const months = Array.from({length:12}, (_,i)=>monthName(i));

  if (!lineChart) {
    lineChart = new Chart(els.lineChart, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          { label: "Ingresos", data: new Array(12).fill(0), tension: 0.25 },
          { label: "Gastos", data: new Array(12).fill(0), tension: 0.25 },
          { label: "Libre", data: new Array(12).fill(0), tension: 0.25 },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { ticks: { callback: (v)=>v } } }
      }
    });
  }

  if (!donutChart) {
    donutChart = new Chart(els.donutChart, {
      type: "doughnut",
      data: { labels: [], datasets: [{ label:"Gastos", data: [] }] },
      options: {
        responsive: true,
        plugins: { legend: { display: true } }
      }
    });
  }
}

function updateCharts(){
  ensureCharts();
  if (!lineChart || !donutChart) return;

  const byMonthIncome = new Array(12).fill(0);
  const byMonthExpense = new Array(12).fill(0);

  for (const it of incomes) {
    const d = it.dateTs?.toDate ? it.dateTs.toDate() : toDateAtLocalMidnight(it.dateStr);
    byMonthIncome[monthIndexFromDate(d)] += Number(it.amount || 0);
  }
  for (const it of expenses) {
    const d = it.dateTs?.toDate ? it.dateTs.toDate() : toDateAtLocalMidnight(it.dateStr);
    byMonthExpense[monthIndexFromDate(d)] += Number(it.amount || 0);
  }
  const byMonthNet = byMonthIncome.map((v,i)=>v - byMonthExpense[i]);

  lineChart.data.datasets[0].data = byMonthIncome;
  lineChart.data.datasets[1].data = byMonthExpense;
  lineChart.data.datasets[2].data = byMonthNet;
  lineChart.update();

  const catMap = new Map();
  for (const it of expenses) {
    const cat = String(it.category || "Sin categoría").trim() || "Sin categoría";
    catMap.set(cat, (catMap.get(cat)||0) + Number(it.amount||0));
  }
  const labels = Array.from(catMap.keys());
  const data = labels.map(k => catMap.get(k));

  donutChart.data.labels = labels;
  donutChart.data.datasets[0].data = data;
  donutChart.update();
}

/***********************
 * Render lists + dashboard
 ***********************/
function renderDashboard(){
  const sumInc = incomes.reduce((a,b)=>a + Number(b.amount||0), 0);
  const sumExp = expenses.reduce((a,b)=>a + Number(b.amount||0), 0);
  const net = sumInc - sumExp;

  setText(els.sumIncome, fmtMoneyByCurrency(sumInc));
  setText(els.sumExpense, fmtMoneyByCurrency(sumExp));
  setText(els.sumNet, fmtMoneyByCurrency(net));

  if (els.sumNet) els.sumNet.className = "strong " + (net >= 0 ? "ok" : "bad");
}

function renderIncomeList(){
  if (!els.incomeRows) return;
  els.incomeRows.innerHTML = "";

  const sorted = [...incomes].sort((a,b)=>{
    const ad = a.dateTs?.toMillis?.() ?? 0;
    const bd = b.dateTs?.toMillis?.() ?? 0;
    return bd - ad;
  });

  for (const it of sorted) {
    const d = it.dateTs?.toDate ? it.dateTs.toDate() : toDateAtLocalMidnight(it.dateStr);
    const row = document.createElement("div");
    row.className = "trow listRowIncome";
    row.dataset.id = it.id;

    row.innerHTML = `
      <div>${isoDateFromDate(d)}</div>
      <div class="muted">${escapeHtml(it.note || "")}</div>
      <div class="right strong">${fmtMoneyByCurrency(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;

    const del = row.querySelector(".del");
    on(del,"click", async () => {
      await incomesCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });

    els.incomeRows.appendChild(row);
  }
}

function renderExpenseList(){
  if (!els.expenseRows) return;
  els.expenseRows.innerHTML = "";

  const sorted = [...expenses].sort((a,b)=>{
    const ad = a.dateTs?.toMillis?.() ?? 0;
    const bd = b.dateTs?.toMillis?.() ?? 0;
    return bd - ad;
  });

  for (const it of sorted) {
    const d = it.dateTs?.toDate ? it.dateTs.toDate() : toDateAtLocalMidnight(it.dateStr);
    const row = document.createElement("div");
    row.className = "trow listRowExpense";
    row.dataset.id = it.id;

    row.innerHTML = `
      <div>${isoDateFromDate(d)}</div>
      <div>${escapeHtml(it.name || "")}</div>
      <div class="muted">${escapeHtml(it.category || "Sin categoría")}</div>
      <div class="right strong">${fmtMoneyByCurrency(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;

    const del = row.querySelector(".del");
    on(del,"click", async () => {
      await expensesCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });

    els.expenseRows.appendChild(row);
  }
}

function renderFixedList(){
  if (!els.fixedRows) return;
  els.fixedRows.innerHTML = "";

  const sorted = [...fixedTemplates].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

  for (const it of sorted) {
    const row = document.createElement("div");
    row.className = "trow listRowFixed";
    row.dataset.id = it.id;

    row.innerHTML = `
      <div>${escapeHtml(it.name || "")}</div>
      <div class="muted">${escapeHtml(it.category || "Sin categoría")}</div>
      <div>${Number(it.day || 1)}</div>
      <div class="right strong">${fmtMoneyByCurrency(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;

    const del = row.querySelector(".del");
    on(del,"click", async () => {
      await fixedCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });

    els.fixedRows.appendChild(row);
  }
}

function renderMonthlyPanel(){
  const isMonthly = meta?.payMode === "monthly";
  toggleHidden(els.monthlyPanel, !isMonthly);
  toggleHidden(els.payDayWrap, !isMonthly);

  if (!isMonthly) return;

  // build grid inputs 12 months
  const year = Number(els.yearSelect.value || nowYear());
  const payDay = clamp(Number(meta?.payDay || 15), 1, 31);

  els.monthlyGrid.innerHTML = "";
  for (let m=1; m<=12; m++){
    const id = `m-${year}-${String(m).padStart(2,"0")}`;
    const existing = incomes.find(x => x.id === id); // deterministic id
    const val = existing?.amount ? String(existing.amount) : "";

    const cell = document.createElement("div");
    cell.className = "monthCell";
    cell.innerHTML = `
      <div class="mTitle">${monthName(m-1)} ${year} (día ${payDay})</div>
      <input data-mid="${id}" inputmode="decimal" placeholder="Monto" value="${escapeHtml(val)}"/>
    `;
    els.monthlyGrid.appendChild(cell);
  }
}

function renderAll(){
  if (!meta) return;
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderMonthlyPanel();
  updateCharts();
}

/***********************
 * Profile open/load
 ***********************/
async function openProfile(profileId){
  currentProfileId = profileId;
  localStorage.setItem("lastProfileId", profileId);

  setCloudMsg("Cargando…");

  const snap = await profileRef(currentUser.uid, profileId).get();
  meta = snap.data() || {};

  // defaults if missing
  meta.displayName = meta.displayName || profileId;
  meta.currency = meta.currency || "USD";
  meta.payMode = meta.payMode || "manual";
  meta.payDay = clamp(Number(meta.payDay || 15), 1, 31);

  // UI populate
  setText(els.whoTitle, `Perfil: ${meta.displayName}`);
  els.profileName.value = meta.displayName;
  els.currency.value = meta.currency;
  els.payMode.value = meta.payMode;
  els.payDay.value = String(meta.payDay);

  buildYearSelect();

  show("app");
  setCloudMsg("Listo ✅");

  startYearListeners(Number(els.yearSelect.value || nowYear()));
  renderFixedList();
  renderMonthlyPanel();
}

/***********************
 * Write meta updates
 ***********************/
let saveMetaTimer = null;
function saveMetaDebounced(){
  clearTimeout(saveMetaTimer);
  saveMetaTimer = setTimeout(async ()=>{
    if (!currentUser || !currentProfileId || !meta) return;
    meta.updatedAt = new Date().toISOString();
    await profileRef(currentUser.uid, currentProfileId).set(meta, { merge:true });
    setCloudMsg(`Guardado: ${new Date().toLocaleTimeString()}`);
  }, 250);
}

/***********************
 * Actions: add income/expense/fixed
 ***********************/
async function addIncome(){
  const dateStr = els.incomeDate.value;
  const amount = parseNumber(els.incomeAmount.value);
  const note = (els.incomeNote.value || "").trim();

  if (!dateStr) { alert("Pon la fecha del ingreso."); return; }
  if (amount <= 0) { alert("Pon un monto válido."); return; }

  const dt = toDateAtLocalMidnight(dateStr);
  await incomesCol(currentUser.uid, currentProfileId).add({
    dateStr,
    dateTs: TS.fromDate(dt),
    amount,
    note,
    createdAt: new Date().toISOString(),
  });

  els.incomeAmount.value = "";
  els.incomeNote.value = "";
}

async function addExpense(){
  const dateStr = els.expDate.value;
  const name = (els.expName.value || "").trim();
  const category = (els.expCategory.value || "").trim() || "Sin categoría";
  const amount = parseNumber(els.expAmount.value);

  if (!dateStr) { alert("Pon la fecha del gasto."); return; }
  if (!name) { alert("Pon el nombre del gasto."); return; }
  if (amount <= 0) { alert("Pon un monto válido."); return; }

  const dt = toDateAtLocalMidnight(dateStr);
  await expensesCol(currentUser.uid, currentProfileId).add({
    dateStr,
    dateTs: TS.fromDate(dt),
    name,
    category,
    amount,
    createdAt: new Date().toISOString(),
  });

  els.expName.value = "";
  els.expAmount.value = "";
}

async function addFixedTemplate(){
  const name = (els.fixedName.value || "").trim();
  const category = (els.fixedCategory.value || "").trim() || "Sin categoría";
  const amount = parseNumber(els.fixedAmount.value);
  const day = clamp(Number(els.fixedDay.value || 1), 1, 31);

  if (!name) { alert("Pon el nombre del fijo."); return; }
  if (amount <= 0) { alert("Pon un monto válido."); return; }

  await fixedCol(currentUser.uid, currentProfileId).add({
    name, category, amount, day,
    createdAt: new Date().toISOString(),
  });

  els.fixedName.value = "";
  els.fixedAmount.value = "";
}

async function applyFixedToYear(){
  const year = Number(els.yearSelect.value || nowYear());
  if (!confirm(`Esto creará/actualizará gastos fijos para ${year}. ¿Continuar?`)) return;

  for (const t of fixedTemplates) {
    const day = clamp(Number(t.day || 1), 1, 31);
    for (let m=1; m<=12; m++) {
      const id = `fx-${t.id}-${year}-${String(m).padStart(2,"0")}`;
      const dt = new Date(year, m-1, clamp(day,1,31), 0,0,0,0);
      const dateStr = isoDateFromDate(dt);

      // determinístico (si ya existe lo actualiza)
      await expensesCol(currentUser.uid, currentProfileId).doc(id).set({
        dateStr,
        dateTs: TS.fromDate(dt),
        name: t.name,
        category: t.category || "Sin categoría",
        amount: Number(t.amount || 0),
        source: "fixedTemplate",
        templateId: t.id,
        createdAt: new Date().toISOString(),
      }, { merge:true });
    }
  }
  alert("Listo ✅ Fijos aplicados al año.");
}

async function saveMonthlySalaries(){
  const year = Number(els.yearSelect.value || nowYear());
  const payDay = clamp(Number(meta.payDay || 15), 1, 31);

  const inputs = els.monthlyGrid.querySelectorAll("input[data-mid]");
  let saved = 0, removed = 0;

  for (const inp of inputs) {
    const id = inp.getAttribute("data-mid"); // m-YYYY-MM
    const amount = parseNumber(inp.value);

    const parts = id.split("-");
    const y = Number(parts[1]);
    const m = Number(parts[2]);

    const dt = new Date(y, m-1, clamp(payDay,1,31), 0,0,0,0);
    const dateStr = isoDateFromDate(dt);

    const ref = incomesCol(currentUser.uid, currentProfileId).doc(id);

    if (amount > 0) {
      await ref.set({
        dateStr,
        dateTs: TS.fromDate(dt),
        amount,
        note: "Salario mensual",
        source: "monthlyPlan",
        createdAt: new Date().toISOString(),
      }, { merge:true });
      saved++;
    } else {
      // si está vacío, intenta borrar si existía
      try { await ref.delete(); removed++; } catch {}
    }
  }

  setText(els.monthlyMsg, `Guardado ✅ (${saved} meses).`);
}

/***********************
 * Export/Import
 ***********************/
async function exportAll(){
  const year = Number(els.yearSelect.value || nowYear());
  const payload = {
    exportedAt: new Date().toISOString(),
    profileId: currentProfileId,
    meta,
    year,
    incomes,
    expenses,
    fixedTemplates
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `misfinanzas-${currentProfileId}-${year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importAll(file){
  const txt = await file.text();
  const data = JSON.parse(txt);

  if (!data?.meta || !data?.year) { alert("Archivo inválido."); return; }

  // meta
  meta = { ...meta, ...data.meta };
  await profileRef(currentUser.uid, currentProfileId).set(meta, { merge:true });

  // fixed templates: import as new docs (simple)
  if (Array.isArray(data.fixedTemplates)) {
    for (const t of data.fixedTemplates) {
      await fixedCol(currentUser.uid, currentProfileId).add({
        name: t.name || "Fijo",
        category: t.category || "Sin categoría",
        amount: Number(t.amount || 0),
        day: clamp(Number(t.day || 1), 1, 31),
        createdAt: new Date().toISOString(),
      });
    }
  }

  // incomes & expenses import to selected year only:
  // (para no mezclar años accidentalmente)
  const year = Number(els.yearSelect.value || nowYear());
  const { start, end } = yearRangeTs(year);
  const startMs = start.toMillis();
  const endMs = end.toMillis();

  if (Array.isArray(data.incomes)) {
    for (const it of data.incomes) {
      const d = it.dateTs?.seconds ? new Date(it.dateTs.seconds*1000) : toDateAtLocalMidnight(it.dateStr);
      const ms = d.getTime();
      if (ms < startMs || ms >= endMs) continue;
      await incomesCol(currentUser.uid, currentProfileId).add({
        dateStr: isoDateFromDate(d),
        dateTs: TS.fromDate(d),
        amount: Number(it.amount || 0),
        note: it.note || "",
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (Array.isArray(data.expenses)) {
    for (const it of data.expenses) {
      const d = it.dateTs?.seconds ? new Date(it.dateTs.seconds*1000) : toDateAtLocalMidnight(it.dateStr);
      const ms = d.getTime();
      if (ms < startMs || ms >= endMs) continue;
      await expensesCol(currentUser.uid, currentProfileId).add({
        dateStr: isoDateFromDate(d),
        dateTs: TS.fromDate(d),
        name: it.name || "Gasto",
        category: it.category || "Sin categoría",
        amount: Number(it.amount || 0),
        createdAt: new Date().toISOString(),
      });
    }
  }

  alert("Importado ✅");
}

/***********************
 * Reset year
 ***********************/
async function resetYear(){
  const year = Number(els.yearSelect.value || nowYear());
  if (!confirm(`Esto borrará TODOS los ingresos y gastos del año ${year} en este perfil. ¿Continuar?`)) return;

  const { start, end } = yearRangeTs(year);

  // delete incomes year
  const incSnap = await incomesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs").startAt(start).endBefore(end).get();
  for (const d of incSnap.docs) await d.ref.delete();

  // delete expenses year
  const expSnap = await expensesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs").startAt(start).endBefore(end).get();
  for (const d of expSnap.docs) await d.ref.delete();

  alert("Año reseteado ✅");
}

/***********************
 * Events
 ***********************/
on(els.btnTogglePass,"click", ()=>{
  const hidden = els.authPass.type === "password";
  els.authPass.type = hidden ? "text" : "password";
  els.btnTogglePass.textContent = hidden ? "Hide pass" : "Show pass";
});

on(els.btnSignup,"click", async ()=>{
  try{
    setText(els.authMsg,"Creando cuenta…");
    await auth.createUserWithEmailAndPassword((els.authEmail.value||"").trim(), els.authPass.value||"");
  }catch(e){
    setText(els.authMsg, e?.message || "Error creando cuenta");
  }
});

on(els.btnLogin,"click", async ()=>{
  try{
    setText(els.authMsg,"Entrando…");
    await auth.signInWithEmailAndPassword((els.authEmail.value||"").trim(), els.authPass.value||"");
    els.authPass.type = "password";
    els.btnTogglePass.textContent = "Show pass";
  }catch(e){
    setText(els.authMsg, e?.message || "Error entrando");
  }
});

on(els.btnLogout,"click", async ()=> auth.signOut());

on(els.btnRefreshProfiles,"click", ()=> refreshProfilesUI());

on(els.newPayMode,"change", ()=>{
  toggleHidden(els.newPayDayWrap, els.newPayMode.value !== "monthly");
});

on(els.btnCreateProfile,"click", ()=> createProfile());

on(els.btnBackProfiles,"click", ()=>{
  stopListeners();
  show("profiles");
});

on(els.yearSelect,"change", ()=>{
  startYearListeners(Number(els.yearSelect.value || nowYear()));
});

on(els.profileName,"input", ()=>{
  meta.displayName = (els.profileName.value || "").trim() || meta.displayName;
  setText(els.whoTitle, `Perfil: ${meta.displayName}`);
  saveMetaDebounced();
});

on(els.currency,"change", ()=>{
  meta.currency = els.currency.value || "USD";
  saveMetaDebounced();
  renderAll(); // refresh money formatting
});

on(els.payMode,"change", ()=>{
  meta.payMode = els.payMode.value || "manual";
  toggleHidden(els.payDayWrap, meta.payMode !== "monthly");
  saveMetaDebounced();
  renderMonthlyPanel();
});

on(els.payDay,"input", ()=>{
  meta.payDay = clamp(Number(els.payDay.value || 15), 1, 31);
  saveMetaDebounced();
  renderMonthlyPanel();
});

on(els.btnSaveMonthly,"click", ()=> saveMonthlySalaries());

on(els.btnAddIncome,"click", ()=> addIncome());
on(els.btnAddExpense,"click", ()=> addExpense());
on(els.btnAddFixed,"click", ()=> addFixedTemplate());
on(els.btnApplyFixedYear,"click", ()=> applyFixedToYear());

on(els.btnExport,"click", ()=> exportAll());

on(els.importFile,"change", async (e)=>{
  const f = e.target.files?.[0];
  if (!f) return;
  try { await importAll(f); } catch { alert("No pude importar."); }
  e.target.value = "";
});

on(els.btnResetYear,"click", ()=> resetYear());

/***********************
 * Auth state
 ***********************/
auth.onAuthStateChanged(async (user)=>{
  currentUser = user;

  if (!user) {
    currentProfileId = null;
    meta = null;
    stopListeners();
    setText(els.authMsg,"");
    show("auth");
    return;
  }

  show("profiles");
  await refreshProfilesUI();

  const last = localStorage.getItem("lastProfileId");
  if (last) {
    const profiles = await listProfiles(user.uid);
    if (profiles.some(p => p.id === last)) await openProfile(last);
  }
});
