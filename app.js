/***********************
 * Helpers (anti-crash)
 ***********************/
const $ = (id) => document.getElementById(id);
const on = (el, evt, fn) => el && el.addEventListener(evt, fn);
const setText = (el, txt) => el && (el.textContent = txt);
const toggleHidden = (el, hidden) => el && el.classList.toggle("hidden", hidden);

function parseNumber(v) {
  const cleaned = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toDateAtLocalMidnight(dateStr){
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1, 0,0,0,0);
}
function isoDateFromDate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function startOfDay(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function addDays(d, n){
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d, n){
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth()+1, 0).getDate();
  if (day > last) x.setDate(last);
  return x;
}
function monthIndexFromDate(d){ return d.getMonth(); }
function monthName(i){
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][i] || "";
}
function fmtShortDate(d){
  return new Intl.DateTimeFormat("es-US",{month:"short", day:"2-digit", year:"numeric"}).format(d);
}

/***********************
 * Categories (base)
 ***********************/
const BASE_CATEGORIES = [
  "Renta",
  "Telefonos",
  "Electricidad",
  "Agua",
  "Gas",
  "Auto",
  "Seguro Auto",
  "Seguro Medico",
  "Mercado",
  "Colegio",
  "Ayuda Familiar"
];

/***********************
 * Donut colors (fix: ya no queda negra)
 ***********************/
const DONUT_COLORS = [
  "#4aa3ff", "#38d488", "#ffcc00", "#ff7a7a", "#9b7bff",
  "#00d4ff", "#ff8a00", "#00ff95", "#ffd1dc", "#a0ff4a",
  "#ff4aa3", "#4afff3"
];

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
  newCurrency: $("newCurrency"),
  newPayFrequency: $("newPayFrequency"),
  newPayDayWrap: $("newPayDayWrap"),
  newPayDay: $("newPayDay"),
  btnCreateProfile: $("btnCreateProfile"),
  profilesMsg: $("profilesMsg"),

  whoTitle: $("whoTitle"),
  btnBackProfiles: $("btnBackProfiles"),
  btnExport: $("btnExport"),
  importFile: $("importFile"),
  btnResetYear: $("btnResetYear"),
  cloudMsg: $("cloudMsg"),

  profileName: $("profileName"),
  currency: $("currency"),
  yearSelect: $("yearSelect"),

  payFrequency: $("payFrequency"),
  lastPayDate: $("lastPayDate"),
  payDayWrap: $("payDayWrap"),
  payDay: $("payDay"),
  nextPayDate: $("nextPayDate"),
  btnRecalcSave: $("btnRecalcSave"),
  btnAddCategory: $("btnAddCategory"),

  urgentSave: $("urgentSave"),
  nextSave: $("nextSave"),
  saveCount: $("saveCount"),
  savePlan: $("savePlan"),

  monthlyPanel: $("monthlyPanel"),
  monthlyGrid: $("monthlyGrid"),
  btnSaveMonthly: $("btnSaveMonthly"),
  monthlyMsg: $("monthlyMsg"),

  sumIncome: $("sumIncome"),
  sumExpense: $("sumExpense"),
  sumNet: $("sumNet"),
  lineChart: $("lineChart"),
  donutChart: $("donutChart"),

  incomeDate: $("incomeDate"),
  incomeAmount: $("incomeAmount"),
  incomeNote: $("incomeNote"),
  btnAddIncome: $("btnAddIncome"),
  incomeRows: $("incomeRows"),

  fixedName: $("fixedName"),
  fixedCategory: $("fixedCategory"),
  fixedAmount: $("fixedAmount"),
  fixedDay: $("fixedDay"),
  btnAddFixed: $("btnAddFixed"),
  btnApplyFixedYear: $("btnApplyFixedYear"),
  fixedRows: $("fixedRows"),

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

let meta = null;
let incomes = [];
let expenses = [];
let fixedTemplates = [];

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

/***********************
 * View
 ***********************/
function show(view){
  toggleHidden(els.authView, view !== "auth");
  toggleHidden(els.profileView, view !== "profiles");
  toggleHidden(els.appView, view !== "app");
  toggleHidden(els.btnLogout, view === "auth");
}

/***********************
 * Money
 ***********************/
function fmtMoney(n){
  const c = meta?.currency || "USD";
  const v = Number.isFinite(n) ? n : 0;
  try {
    return v.toLocaleString(undefined, { style:"currency", currency: c });
  } catch {
    return `${c} ${v.toFixed(2)}`;
  }
}

/***********************
 * Year
 ***********************/
function nowYear(){ return new Date().getFullYear(); }
function buildYearSelect(){
  const y = nowYear();
  const years = [y-2, y-1, y, y+1].sort((a,b)=>b-a);
  els.yearSelect.innerHTML = years.map(v => `<option value="${v}">${v}</option>`).join("");
  els.yearSelect.value = String(y);
}
function yearRangeTs(year){
  const start = new Date(year,0,1,0,0,0,0);
  const end = new Date(year+1,0,1,0,0,0,0);
  return { start: TS.fromDate(start), end: TS.fromDate(end) };
}

/***********************
 * Categories per profile
 ***********************/
function getAllCategories(){
  const custom = Array.isArray(meta?.customCategories) ? meta.customCategories : [];
  const set = new Set([...BASE_CATEGORIES, ...custom].map(x => String(x).trim()).filter(Boolean));
  return Array.from(set);
}
function buildCategorySelect(selectEl, value){
  if (!selectEl) return;
  const cats = getAllCategories();
  const addOpt = "__ADD__";

  selectEl.innerHTML =
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
    `<option value="${addOpt}">+ Agregar categoría…</option>`;

  if (value && cats.includes(value)) selectEl.value = value;
  else if (cats.length) selectEl.value = cats[0];
}
async function addCategoryFlow(){
  const name = prompt("Nueva categoría (ej: Internet, Gym, etc.)");
  const clean = String(name ?? "").trim();
  if (!clean) return;

  const current = Array.isArray(meta.customCategories) ? meta.customCategories : [];
  const set = new Set(current.map(x=>String(x).trim()).filter(Boolean));
  set.add(clean);

  meta.customCategories = Array.from(set);
  saveMetaDebounced();

  buildCategorySelect(els.fixedCategory, els.fixedCategory.value);
  buildCategorySelect(els.expCategory, els.expCategory.value);
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
    payFrequency: "biweekly",
    lastPayDate: "",
    payDay: 15,
    customCategories: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge:true });

  await profileRef(uid,"jenniffer").set({
    displayName: "Jenniffer",
    currency: "USD",
    payFrequency: "weekly",
    lastPayDate: "",
    payDay: 15,
    customCategories: [],
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
  const pf = p.payFrequency || "biweekly";
  const pfLabel = pf === "weekly" ? "Semanal" : (pf === "monthly" ? "Mensual" : "Quincenal");
  return `
    <div class="profileCard">
      <div class="row">
        <div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="meta">${escapeHtml(pfLabel)} · ${escapeHtml(cur)}</div>
        </div>
        <button class="btn" data-open="${escapeHtml(p.id)}" type="button">Abrir</button>
      </div>
    </div>
  `;
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
  const payFrequency = els.newPayFrequency.value || "biweekly";
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
    payFrequency,
    lastPayDate: "",
    payDay,
    customCategories: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge:true });

  els.newProfileName.value = "";
  els.newPayDay.value = "";
  setText(els.profilesMsg, "Perfil creado ✅");
  await refreshProfilesUI();
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

  unsubIncome = incomesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs")
    .startAt(start)
    .endBefore(end)
    .onSnapshot((snap) => {
      incomes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderAll();
    });

  unsubExpense = expensesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs")
    .startAt(start)
    .endBefore(end)
    .onSnapshot((snap) => {
      expenses = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderAll();
    });

  unsubFixed = fixedCol(currentUser.uid, currentProfileId)
    .orderBy("name")
    .onSnapshot((snap) => {
      fixedTemplates = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      renderFixedList();
      renderSavePlan(); // usa plantillas
    });
}

/***********************
 * Charts (FIX donut colors)
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
        plugins: {
          legend: { labels: { color: "#eaf0ff" } }
        },
        scales: {
          x: { ticks: { color: "#a8b2cc" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "#a8b2cc" }, grid: { color: "rgba(255,255,255,.06)" } }
        }
      }
    });
  }

  if (!donutChart) {
    donutChart = new Chart(els.donutChart, {
      type: "doughnut",
      data: { labels: [], datasets: [{ label:"Gastos", data: [], backgroundColor: [] }] },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#eaf0ff" } }
        }
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

  // gastos por categoría
  const catMap = new Map();
  for (const it of expenses) {
    const cat = String(it.category || "Sin categoría").trim() || "Sin categoría";
    catMap.set(cat, (catMap.get(cat)||0) + Number(it.amount||0));
  }
  const labels = Array.from(catMap.keys());
  const data = labels.map(k => catMap.get(k));

  donutChart.data.labels = labels;
  donutChart.data.datasets[0].data = data;
  donutChart.data.datasets[0].backgroundColor = labels.map((_,i)=>DONUT_COLORS[i % DONUT_COLORS.length]);
  donutChart.data.datasets[0].borderColor = "rgba(0,0,0,0)";
  donutChart.update();
}

/***********************
 * Render dashboard + lists
 ***********************/
function renderDashboard(){
  const sumInc = incomes.reduce((a,b)=>a + Number(b.amount||0), 0);
  const sumExp = expenses.reduce((a,b)=>a + Number(b.amount||0), 0);
  const net = sumInc - sumExp;

  setText(els.sumIncome, fmtMoney(sumInc));
  setText(els.sumExpense, fmtMoney(sumExp));
  setText(els.sumNet, fmtMoney(net));
  if (els.sumNet) els.sumNet.className = "strong " + (net >= 0 ? "ok" : "bad");
}

function renderIncomeList(){
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
    row.innerHTML = `
      <div>${isoDateFromDate(d)}</div>
      <div class="muted">${escapeHtml(it.note || "")}</div>
      <div class="right strong">${fmtMoney(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;
    on(row.querySelector(".del"), "click", async () => {
      await incomesCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });
    els.incomeRows.appendChild(row);
  }
}

function renderExpenseList(){
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
    row.innerHTML = `
      <div>${isoDateFromDate(d)}</div>
      <div>${escapeHtml(it.name || "")}</div>
      <div class="muted">${escapeHtml(it.category || "Sin categoría")}</div>
      <div class="right strong">${fmtMoney(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;
    on(row.querySelector(".del"), "click", async () => {
      await expensesCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });
    els.expenseRows.appendChild(row);
  }
}

function renderFixedList(){
  els.fixedRows.innerHTML = "";
  const sorted = [...fixedTemplates].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

  for (const it of sorted) {
    const row = document.createElement("div");
    row.className = "trow listRowFixed";
    row.innerHTML = `
      <div>${escapeHtml(it.name || "")}</div>
      <div class="muted">${escapeHtml(it.category || "Sin categoría")}</div>
      <div>${Number(it.day || 1)}</div>
      <div class="right strong">${fmtMoney(Number(it.amount||0))}</div>
      <button class="btn danger ghost del" type="button">✕</button>
    `;
    on(row.querySelector(".del"), "click", async () => {
      await fixedCol(currentUser.uid, currentProfileId).doc(it.id).delete();
    });
    els.fixedRows.appendChild(row);
  }
}

/***********************
 * Monthly salary panel (solo si "monthly")
 ***********************/
function renderMonthlyPanel(){
  const isMonthly = (meta?.payFrequency === "monthly");
  toggleHidden(els.monthlyPanel, !isMonthly);
  toggleHidden(els.payDayWrap, !isMonthly);

  if (!isMonthly) return;

  const year = Number(els.yearSelect.value || nowYear());
  const payDay = clamp(Number(meta?.payDay || 15), 1, 31);

  els.monthlyGrid.innerHTML = "";
  for (let m=1; m<=12; m++){
    const id = `m-${year}-${String(m).padStart(2,"0")}`;
    const existing = incomes.find(x => x.id === id);
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

/***********************
 * ✅ MÓDULO SEMANAL/QUINCENAL (ARREGLADO)
 * Objetivo: cuánto separar POR COBRO para cubrir FIJOS del mes
 * - Planea el mes del PRÓXIMO COBRO (no el mes “de hoy” si ya viene otro mes)
 * - Si un fijo ya fue aplicado/pagado como expense "source=fixedTemplate", no lo cuenta 2 veces
 ***********************/
function getNextPayDate(){
  const freq = meta?.payFrequency || "biweekly";
  const today = startOfDay(new Date());

  if (freq === "monthly") {
    const payDay = clamp(Number(meta?.payDay || 15), 1, 31);
    const now = new Date();
    let next = startOfDay(new Date(now.getFullYear(), now.getMonth(), payDay, 0,0,0,0));
    if (next < today) next = startOfDay(new Date(now.getFullYear(), now.getMonth()+1, payDay, 0,0,0,0));
    return next;
  }

  // weekly/biweekly
  if (!meta?.lastPayDate) return null;
  let d = startOfDay(new Date(meta.lastPayDate));
  if (Number.isNaN(d.getTime())) return null;

  const step = (freq === "weekly") ? 7 : 14;

  // si lo que pusiste fue "último cobro" => próximo = último + step
  if (d <= today) d = startOfDay(addDays(d, step));
  while (d < today) d = startOfDay(addDays(d, step));

  return d;
}

function monthBounds(date){
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = startOfDay(new Date(y, m, 1, 0,0,0,0));
  const end = startOfDay(new Date(y, m+1, 0, 0,0,0,0));
  return { start, end };
}

function getPayDatesInMonth(nextPay, monthEnd){
  const freq = meta?.payFrequency || "biweekly";
  const dates = [];

  if (!nextPay) return dates;

  if (freq === "monthly") {
    dates.push(startOfDay(nextPay));
    return dates;
  }

  const step = (freq === "weekly") ? 7 : 14;
  let d = startOfDay(nextPay);
  while (d <= monthEnd) {
    dates.push(d);
    d = startOfDay(addDays(d, step));
  }
  return dates;
}

function fixedAlreadyPaidThisMonth(templateId, monthStart, monthEnd){
  // si el usuario aplicó fijos al año, aparecen como expense source=fixedTemplate + templateId
  return expenses.some(e => {
    if (e.source !== "fixedTemplate") return false;
    if (e.templateId !== templateId) return false;
    const dt = e.dateTs?.toDate ? startOfDay(e.dateTs.toDate()) : startOfDay(toDateAtLocalMidnight(e.dateStr));
    return dt >= monthStart && dt <= monthEnd;
  });
}

function renderSavePlan(){
  if (!meta) return;

  const nextPay = getNextPayDate();

  // ✅ FIX: nextPayDate es INPUT, no texto
  if (els.nextPayDate) els.nextPayDate.value = nextPay ? fmtShortDate(nextPay) : "";

  if (!nextPay) {
    setText(els.urgentSave, fmtMoney(0));
    setText(els.nextSave, fmtMoney(0));
    setText(els.saveCount, "0");
    els.savePlan.innerHTML = `<div class="planRow"><span class="muted">Configura “Último cobro” (Semanal/Quincenal) o “Día de cobro” (Mensual).</span><span class="muted">—</span></div>`;
    return;
  }

  // Planificamos el MES del próximo cobro
  const { start: mStart, end: mEnd } = monthBounds(nextPay);
  const payDates = getPayDatesInMonth(nextPay, mEnd);
  setText(els.saveCount, String(payDates.length));

  // Construir lista de FIJOS de ese mes (no los que ya fueron pagados)
  let urgent = 0;
  const planTotals = payDates.map(d => ({ date: d, total: 0 }));

  const monthLabel = `${monthName(nextPay.getMonth())} ${nextPay.getFullYear()}`;

  for (const t of fixedTemplates) {
    const amount = Number(t.amount || 0);
    if (amount <= 0) continue;

    const day = clamp(Number(t.day || 1), 1, 31);

    // fecha de vencimiento en este mes (ajustando al último día real)
    const lastDay = new Date(mStart.getFullYear(), mStart.getMonth()+1, 0).getDate();
    const due = startOfDay(new Date(mStart.getFullYear(), mStart.getMonth(), Math.min(day, lastDay), 0,0,0,0));

    // si ya fue aplicado/pagado como fijo este mes => no lo contamos
    if (fixedAlreadyPaidThisMonth(t.id, mStart, mEnd)) continue;

    // si vence antes del próximo cobro => urgente (pagar con dinero existente)
    if (due < nextPay) {
      urgent += amount;
      continue;
    }

    // cuántos cobros hay antes (o el mismo día) del vencimiento
    const eligible = payDates.filter(p => p <= due);
    if (!eligible.length) {
      urgent += amount;
      continue;
    }

    // repartir el monto entre esos cobros
    const share = amount / eligible.length;
    for (const p of eligible) {
      const idx = payDates.findIndex(x => x.getTime() === p.getTime());
      if (idx >= 0) planTotals[idx].total += share;
    }
  }

  // resultados
  const nextSave = planTotals[0]?.total || 0;
  setText(els.urgentSave, fmtMoney(urgent));
  setText(els.nextSave, fmtMoney(nextSave));

  // render UI
  els.savePlan.innerHTML = `
    <div class="planRow">
      <span class="muted">Mes planificado</span>
      <span class="strong">${escapeHtml(monthLabel)}</span>
    </div>
  ` + planTotals.map(p => `
    <div class="planRow">
      <span>${escapeHtml(fmtShortDate(p.date))}</span>
      <span class="strong">${escapeHtml(fmtMoney(p.total))}</span>
    </div>
  `).join("");
}

/***********************
 * Meta save (debounced)
 ***********************/
let saveMetaTimer = null;
function saveMetaDebounced(){
  clearTimeout(saveMetaTimer);
  saveMetaTimer = setTimeout(async ()=>{
    if (!currentUser || !currentProfileId || !meta) return;
    meta.updatedAt = new Date().toISOString();
    await profileRef(currentUser.uid, currentProfileId).set(meta, { merge:true });
    setText(els.cloudMsg, `Guardado: ${new Date().toLocaleTimeString()}`);
  }, 250);
}

/***********************
 * Actions
 ***********************/
async function addIncome(){
  const dateStr = els.incomeDate.value;
  const amount = parseNumber(els.incomeAmount.value);
  const note = (els.incomeNote.value || "").trim();

  if (!dateStr) return alert("Pon la fecha del ingreso.");
  if (amount <= 0) return alert("Pon un monto válido.");

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
  const category = els.expCategory.value || "Sin categoría";
  const amount = parseNumber(els.expAmount.value);

  if (!dateStr) return alert("Pon la fecha del gasto.");
  if (!name) return alert("Pon el nombre del gasto.");
  if (amount <= 0) return alert("Pon un monto válido.");

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
  const category = els.fixedCategory.value || "Sin categoría";
  const amount = parseNumber(els.fixedAmount.value);
  const day = clamp(Number(els.fixedDay.value || 1), 1, 31);

  if (!name) return alert("Pon el nombre del fijo.");
  if (amount <= 0) return alert("Pon un monto válido.");

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
  let saved = 0;

  for (const inp of inputs) {
    const id = inp.getAttribute("data-mid");
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
      try { await ref.delete(); } catch {}
    }
  }

  setText(els.monthlyMsg, `Guardado ✅ (${saved} meses).`);
}

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
  if (!data?.meta || !data?.year) return alert("Archivo inválido.");

  meta = { ...meta, ...data.meta };
  await profileRef(currentUser.uid, currentProfileId).set(meta, { merge:true });

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

async function resetYear(){
  const year = Number(els.yearSelect.value || nowYear());
  if (!confirm(`Esto borrará TODOS los ingresos y gastos del año ${year}. ¿Continuar?`)) return;

  const { start, end } = yearRangeTs(year);

  const incSnap = await incomesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs").startAt(start).endBefore(end).get();
  for (const d of incSnap.docs) await d.ref.delete();

  const expSnap = await expensesCol(currentUser.uid, currentProfileId)
    .orderBy("dateTs").startAt(start).endBefore(end).get();
  for (const d of expSnap.docs) await d.ref.delete();

  alert("Año reseteado ✅");
}

/***********************
 * Render all
 ***********************/
function renderAll(){
  if (!meta) return;

  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  updateCharts();

  buildCategorySelect(els.fixedCategory, els.fixedCategory.value);
  buildCategorySelect(els.expCategory, els.expCategory.value);

  renderMonthlyPanel();
  renderSavePlan();
}

/***********************
 * Open profile
 ***********************/
async function openProfile(profileId){
  currentProfileId = profileId;
  localStorage.setItem("lastProfileId", profileId);

  setText(els.cloudMsg, "Cargando…");

  const snap = await profileRef(currentUser.uid, profileId).get();
  meta = snap.data() || {};

  meta.displayName = meta.displayName || profileId;
  meta.currency = meta.currency || "USD";
  meta.payFrequency = meta.payFrequency || "biweekly";
  meta.lastPayDate = meta.lastPayDate || "";
  meta.payDay = clamp(Number(meta.payDay || 15), 1, 31);
  meta.customCategories = Array.isArray(meta.customCategories) ? meta.customCategories : [];

  setText(els.whoTitle, `Perfil: ${meta.displayName}`);
  els.profileName.value = meta.displayName;
  els.currency.value = meta.currency;

  buildYearSelect();

  els.payFrequency.value = meta.payFrequency;
  els.lastPayDate.value = meta.lastPayDate;
  els.payDay.value = String(meta.payDay);
  toggleHidden(els.payDayWrap, meta.payFrequency !== "monthly");

  buildCategorySelect(els.fixedCategory, BASE_CATEGORIES[0]);
  buildCategorySelect(els.expCategory, BASE_CATEGORIES[0]);

  show("app");
  setText(els.cloudMsg, "Listo ✅");

  startYearListeners(Number(els.yearSelect.value || nowYear()));
  renderFixedList();
  renderAll();
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

on(els.newPayFrequency,"change", ()=>{
  toggleHidden(els.newPayDayWrap, els.newPayFrequency.value !== "monthly");
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
  renderAll();
});

on(els.payFrequency,"change", ()=>{
  meta.payFrequency = els.payFrequency.value || "biweekly";
  toggleHidden(els.payDayWrap, meta.payFrequency !== "monthly");
  saveMetaDebounced();
  renderMonthlyPanel();
  renderSavePlan();
});

on(els.lastPayDate,"change", ()=>{
  meta.lastPayDate = els.lastPayDate.value || "";
  saveMetaDebounced();
  renderSavePlan();
});

on(els.payDay,"input", ()=>{
  meta.payDay = clamp(Number(els.payDay.value || 15), 1, 31);
  saveMetaDebounced();
  renderMonthlyPanel();
  renderSavePlan();
});

on(els.btnRecalcSave,"click", ()=> renderSavePlan());
on(els.btnAddCategory,"click", ()=> addCategoryFlow());

on(els.fixedCategory, "change", ()=>{
  if (els.fixedCategory.value === "__ADD__") {
    addCategoryFlow().then(()=> buildCategorySelect(els.fixedCategory, BASE_CATEGORIES[0]));
  }
});
on(els.expCategory, "change", ()=>{
  if (els.expCategory.value === "__ADD__") {
    addCategoryFlow().then(()=> buildCategorySelect(els.expCategory, BASE_CATEGORIES[0]));
  }
});

on(els.btnAddIncome,"click", ()=> addIncome());
on(els.btnAddExpense,"click", ()=> addExpense());
on(els.btnAddFixed,"click", ()=> addFixedTemplate());
on(els.btnApplyFixedYear,"click", ()=> applyFixedToYear());

on(els.btnSaveMonthly,"click", ()=> saveMonthlySalaries());

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
