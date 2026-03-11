const firebaseConfig = {
    apiKey: "AIzaSyATpb8_S2JhY1T2Lb8lzn3_544C7Kqd4OI",
    authDomain: "misfinanzas-618f2.firebaseapp.com",
    projectId: "misfinanzas-618f2",
    storageBucket: "misfinanzas-618f2.firebasestorage.app",
    messagingSenderId: "998483559442",
    appId: "1:998483559442:web:435dced19e19a884b984cb"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let grafico = null;

const ICONOS = {
    renta: '🏠', casa: '🏠', carro: '🚗', auto: '🚗', celular: '📱', movil: '📱',
    seguro: '🛡️', medico: '🏥', salud: '🏥', mercado: '🛒', comida: '🛒',
    mia: '👧', colegio: '🎓', escuela: '🎓', familia: '👨‍👩+👧', gym: '🏋️',
    luz: '💡', agua: '💧', internet: '🌐', netflix: '📺', suscrip: '📺'
};

function getIcon(nombre) {
    const n = nombre.toLowerCase();
    for (let key in ICONOS) { if (n.includes(key)) return ICONOS[key]; }
    return '💸';
}

let misGastosFijos = JSON.parse(localStorage.getItem('misGastosFijos')) || [
    'Renta', 'Carro', 'Celulares', 'Seguro Carro', 'Seguro Medico', 'Mercado', 'Mia', 'Colegio', 'Familia'
];

auth.onAuthStateChanged(user => {
    if(user) { renderFijos(); cargarDatos(user.uid); }
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
});

function renderFijos() {
    const grid = document.getElementById('fixed-grid');
    grid.innerHTML = '';
    misGastosFijos.forEach(nombre => {
        const btn = document.createElement('button');
        btn.className = 'btn-fixed';
        btn.innerHTML = `<b>${getIcon(nombre)}</b><span>${nombre}</span>`;
        
        let timer;
        const start = () => timer = setTimeout(() => eliminarGastoLista(nombre), 800);
        const end = () => clearTimeout(timer);

        btn.ontouchstart = start; btn.ontouchend = end;
        btn.onmousedown = start; btn.onmouseup = end;
        btn.onclick = () => procesarPago(nombre);
        grid.appendChild(btn);
    });
}

function eliminarGastoLista(nombre) {
    if(confirm(`¿Eliminar "${nombre}" de los gastos fijos?`)) {
        misGastosFijos = misGastosFijos.filter(n => n !== nombre);
        localStorage.setItem('misGastosFijos', JSON.stringify(misGastosFijos));
        renderFijos();
    }
}

document.getElementById('btn-nuevo-fijo').onclick = () => {
    const nuevo = prompt("Nombre del nuevo gasto fijo:");
    if(nuevo && !misGastosFijos.includes(nuevo)) {
        misGastosFijos.push(nuevo);
        localStorage.setItem('misGastosFijos', JSON.stringify(misGastosFijos));
        renderFijos();
    }
};

async function procesarPago(nombre) {
    const montoPrevio = localStorage.getItem(`monto_${nombre}`) || "";
    const monto = prompt(`Monto a pagar para ${nombre}:`, montoPrevio);
    
    if (monto && !isNaN(monto)) {
        localStorage.setItem(`monto_${nombre}`, monto);
        await db.collection("transacciones").add({
            uid: auth.currentUser.uid, monto: Number(monto), tipo: 'gasto', categoria: nombre,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        if(confirm("¿Agendar aviso en el calendario del iPhone?")) {
            const diaVence = prompt("¿Qué día del mes vence?", new Date().getDate());
            const hoy = new Date();
            const prox = new Date(hoy.getFullYear(), hoy.getMonth() + 1, parseInt(diaVence), 10, 0);
            const iso = prox.toISOString().replace(/-|:|\.\d\d\d/g, "");
            window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=PAGAR+${nombre.toUpperCase()}&dates=${iso}/${iso}&details=Monto:+$${monto}&sf=true`, '_blank');
        }
    }
}

function cargarDatos(uid) {
    const filtro = document.getElementById('filtro-mes');
    if(!filtro.value) filtro.value = new Date().toISOString().slice(0, 7);
    const [y, m] = filtro.value.split('-');
    const inicio = firebase.firestore.Timestamp.fromDate(new Date(y, m-1, 1));
    const fin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59));

    db.collection("transacciones").where("uid", "==", uid)
      .where("fecha", ">=", inicio).where("fecha", "<=", fin)
      .orderBy("fecha", "desc").onSnapshot(snap => {
        let tIn = 0, tGa = 0, dG = {}, html = "";
        snap.forEach(doc => {
            const d = doc.data();
            if(d.tipo === 'ingreso') tIn += d.monto; else tGa += d.monto;
            dG[d.categoria] = (dG[d.categoria] || 0) + d.monto;
            html += `<div class="item"><span><b>${d.categoria}</b><br><small class="monto-${d.tipo}">$${d.monto}</small></span>
            <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none; cursor:pointer;">🗑️</button></div>`;
        });
        document.getElementById('balance-total').innerText = `$${(tIn - tGa).toFixed(2)}`;
        document.getElementById('res-ingresos').innerText = `+$${tIn}`;
        document.getElementById('res-gastos').innerText = `-$${tGa}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        actualizarGrafico(dG);
    });
}

document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Faltan datos");
    await db.collection("transacciones").add({ uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
};

window.eliminarDoc = (id) => confirm("¿Eliminar registro?") && db.collection("transacciones").doc(id).delete();

document.getElementById('btn-dark-mode').onclick = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('modo-oscuro', document.body.classList.contains('dark-mode') ? 'activado' : 'desactivado');
};

function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'], borderWidth: 4, borderColor: getComputedStyle(document.body).getPropertyValue('--card') }] },
        options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
    });
}

document.getElementById('btn-login').onclick = async () => {
    const e = document.getElementById('email').value, p = document.getElementById('pass').value;
    try { await auth.signInWithEmailAndPassword(e, p); } catch {
        try { await auth.createUserWithEmailAndPassword(e, p); } catch(err) { alert(err.message); }
    }
};
document.getElementById('btn-logout').onclick = () => auth.signOut();
document.getElementById('filtro-mes').onchange = () => cargarDatos(auth.currentUser.uid);
if (localStorage.getItem('modo-oscuro') === 'activado') document.body.classList.add('dark-mode');