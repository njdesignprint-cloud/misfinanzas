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

// DEFINICIÓN DE BOTONES
const GASTOS_CAT = [
    { id: 'renta', n: 'Renta', i: '🏠' }, { id: 'carro', n: 'Carro', i: '🚗' },
    { id: 'cel', n: 'Celulares', i: '📱' }, { id: 'seg_c', n: 'Seg. Carro', i: '🛡️' },
    { id: 'seg_m', n: 'Seg. Médico', i: '🏥' }, { id: 'merc', n: 'Mercado', i: '🛒' },
    { id: 'mia', n: 'Mia', i: '👧' }, { id: 'col', n: 'Colegio', i: '🎓' },
    { id: 'fam', n: 'Familia', i: '👨‍👩‍👧' }
];

function iniciarTema() {
    if (localStorage.getItem('modo-oscuro') === 'activado') document.body.classList.add('dark-mode');
}
iniciarTema();

auth.onAuthStateChanged(user => {
    if(user) { renderButtons(); cargarDatos(user.uid); }
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
});

// RENDER DE BOTONES PRO
function renderButtons() {
    const grid = document.getElementById('fixed-grid');
    grid.innerHTML = '';
    GASTOS_CAT.forEach(g => {
        const monto = localStorage.getItem(`m_${g.id}`);
        const dia = localStorage.getItem(`d_${g.id}`);
        const btn = document.createElement('button');
        btn.className = `btn-fixed ${monto ? 'configurado' : ''}`;
        btn.innerHTML = `<b>${g.i}</b><span>${g.n}</span>${monto ? `<small>$${monto}</small>` : ''}`;
        
        btn.onclick = () => {
            const modoEdicion = document.getElementById('modo-edicion').checked;
            if(modoEdicion) configGasto(g); else registrarPagoRapido(g);
        };
        grid.appendChild(btn);
    });
}

// 1 CLIC: REGISTRAR
async function registrarPagoRapido(g) {
    const monto = localStorage.getItem(`m_${g.id}`);
    const dia = localStorage.getItem(`d_${g.id}`);
    
    if(!monto) {
        alert("Primero activa el 'Modo Editar' arriba para poner el monto a este gasto.");
        return;
    }

    if(confirm(`¿Registrar pago de $${monto} en ${g.n}?`)) {
        await db.collection("transacciones").add({
            uid: auth.currentUser.uid, monto: Number(monto), tipo: 'gasto', categoria: g.n,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Recordatorio automático basado en el día guardado
        if(confirm("¿Agendar recordatorio para el próximo mes?")) {
            const hoy = new Date();
            const prox = new Date(hoy.getFullYear(), hoy.getMonth() + 1, parseInt(dia || hoy.getDate()), 10, 0);
            const iso = prox.toISOString().replace(/-|:|\.\d\d\d/g, "");
            window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=PAGAR+${g.n.toUpperCase()}&dates=${iso}/${iso}&details=Monto:+$${monto}&sf=true&output=xml`, '_blank');
        }
    }
}

// CONFIGURAR (SOLO EN MODO EDICIÓN)
function configGasto(g) {
    const m = prompt(`Monto mensual para ${g.n}:`, localStorage.getItem(`m_${g.id}`) || "");
    const d = prompt(`Día del mes que vence (1-31):`, localStorage.getItem(`d_${g.id}`) || "1");
    
    if(m === "0" || m === "") {
        localStorage.removeItem(`m_${g.id}`);
        localStorage.removeItem(`d_${g.id}`);
    } else if (m) {
        localStorage.setItem(`m_${g.id}`, m);
        localStorage.setItem(`d_${g.id}`, d);
    }
    renderButtons();
}

// SWITCH DE MODO EDICIÓN
document.getElementById('modo-edicion').onchange = (e) => {
    document.getElementById('fixed-grid').classList.toggle('modo-editar-on', e.target.checked);
};

// --- RESTO DE LÓGICA (BALANCE, GRÁFICO, ETC) ---
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
            <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none;">🗑️</button></div>`;
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
    if(!m || !c) return alert("Datos incompletos");
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
        data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'], borderWidth: 2 }] },
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