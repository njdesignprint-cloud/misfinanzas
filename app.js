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

const LISTA_FIJOS = [
    { id: 'renta', n: 'Renta', i: '🏠' }, { id: 'carro', n: 'Carro', i: '🚗' },
    { id: 'cel', n: 'Celulares', i: '📱' }, { id: 'seg_c', n: 'Seguro Carro', i: '🛡️' },
    { id: 'seg_m', n: 'Seguro Medico', i: '🏥' }, { id: 'merc', n: 'Mercado', i: '🛒' },
    { id: 'mia', n: 'Mia', i: '👧' }, { id: 'col', n: 'Colegio', i: '🎓' },
    { id: 'fam', n: 'Familia', i: '👨‍👩‍👧' }
];

function aplicarTema() {
    if (localStorage.getItem('modo-oscuro') === 'activado') document.body.classList.add('dark-mode');
}
aplicarTema();

auth.onAuthStateChanged(user => {
    if(user) { renderizarFijos(); cargarDatos(user.uid); }
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
});

// 1. DIBUJAR LOS BOTONES
function renderizarFijos() {
    const grid = document.getElementById('fixed-grid');
    grid.innerHTML = '';
    LISTA_FIJOS.forEach(g => {
        const monto = localStorage.getItem(`m_${g.id}`) || "0";
        const dia = localStorage.getItem(`d_${g.id}`) || "--";
        const btn = document.createElement('button');
        btn.className = 'btn-fixed';
        btn.innerHTML = `<b>${g.i}</b>${g.n}<br><small>$${monto}</small><br><span style="font-size:0.5rem">Día: ${dia}</span>`;
        btn.onclick = () => pagarFijo(g);
        grid.appendChild(btn);
    });
}

// 2. CONFIGURAR (PARA CAMBIAR MONTOS Y FECHAS SIN PAGAR)
window.configurarGastosFijos = () => {
    const id = prompt("Escribe el nombre del gasto a configurar (Ej: Renta, Carro, Mia...):").toLowerCase();
    const gasto = LISTA_FIJOS.find(x => x.n.toLowerCase().includes(id) || x.id.includes(id));
    
    if(gasto) {
        const nuevoM = prompt(`Nuevo monto para ${gasto.n}:`, localStorage.getItem(`m_${gasto.id}`) || "0");
        const nuevoD = prompt(`Día de pago (1-31):`, localStorage.getItem(`d_${gasto.id}`) || "1");
        
        // Si pone 0 o vacío, se borra
        if(!nuevoM || nuevoM == "0") {
            localStorage.removeItem(`m_${gasto.id}`);
            localStorage.removeItem(`d_${gasto.id}`);
        } else {
            localStorage.setItem(`m_${gasto.id}`, nuevoM);
            localStorage.setItem(`d_${gasto.id}`, nuevoD);
        }
        renderizarFijos();
    } else {
        alert("No encontré ese gasto. Escribe el nombre tal cual aparece.");
    }
};

// 3. PAGAR (REGISTRAR EN FIREBASE Y AGENDAR)
async function pagarFijo(g) {
    const monto = localStorage.getItem(`m_${g.id}`);
    const dia = localStorage.getItem(`d_${g.id}`);

    if(!monto || monto == "0") {
        return alert("Primero configura este gasto en el botón ⚙️ Configurar");
    }

    if(confirm(`¿Registrar pago de $${monto} para ${g.n}?`)) {
        await db.collection("transacciones").add({
            uid: auth.currentUser.uid, monto: Number(monto), tipo: 'gasto', categoria: g.n,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        if(confirm("¿Quieres agendar el recordatorio para el próximo mes?")) {
            const hoy = new Date();
            const proxMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, parseInt(dia), 10, 0);
            const iso = proxMes.toISOString().replace(/-|:|\.\d\d\d/g, "");
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=PAGAR+${g.n.toUpperCase()}&dates=${iso}/${iso}&details=Pago+de+$${monto}&sf=true&output=xml`;
            window.open(url, '_blank');
        }
    }
}

// LOGICA DE CARGA Y GRAFICO (IGUAL QUE ANTES)
function cargarDatos(uid) {
    const filtro = document.getElementById('filtro-mes');
    if(!filtro.value) filtro.value = new Date().toISOString().slice(0, 7);
    const [y, m] = filtro.value.split('-');
    const inicio = firebase.firestore.Timestamp.fromDate(new Date(y, m-1, 1));
    const fin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59));

    db.collection("transacciones").where("uid", "==", uid)
      .where("fecha", ">=", inicio).where("fecha", "<=", fin)
      .orderBy("fecha", "desc").onSnapshot(snap => {
        let tIn = 0, tGa = 0, datosG = {}, html = "";
        snap.forEach(doc => {
            const d = doc.data();
            if(d.tipo === 'ingreso') tIn += d.monto; else tGa += d.monto;
            datosG[d.categoria] = (datosG[d.categoria] || 0) + d.monto;
            html += `<div class="item"><div><b>${d.categoria}</b><br><span class="monto-${d.tipo}">$${d.monto.toFixed(2)}</span></div>
            <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none; cursor:pointer;">🗑️</button></div>`;
        });
        document.getElementById('res-ingresos').innerText = `+$${tIn.toFixed(0)}`;
        document.getElementById('res-gastos').innerText = `-$${tGa.toFixed(0)}`;
        document.getElementById('balance-total').innerText = `$${(tIn - tGa).toFixed(2)}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        actualizarGrafico(datosG);
    });
}

document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Faltan datos");
    await db.collection("transacciones").add({ uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
};

window.eliminarDoc = (id) => confirm("¿Eliminar?") && db.collection("transacciones").doc(id).delete();

document.getElementById('btn-dark-mode').onclick = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('modo-oscuro', document.body.classList.contains('dark-mode') ? 'activado' : 'desactivado');
};

function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: ['#4299E1', '#F56565', '#48BB78', '#ECC94B', '#9F7AEA', '#ED64A6'], borderWidth: 2 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text') } } } }
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