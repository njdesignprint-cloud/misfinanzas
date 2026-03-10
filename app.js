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

// CONFIGURACIÓN DE GASTOS FIJOS
const GASTOS_FIJOS = [
    { id: 'renta', nombre: 'Renta', icon: '🏠' },
    { id: 'carro', nombre: 'Carro', icon: '🚗' },
    { id: 'celulares', nombre: 'Celulares', icon: '📱' },
    { id: 'seguro_c', nombre: 'Seguro Carro', icon: '🛡️' },
    { id: 'seguro_m', nombre: 'Seguro Medico', icon: '🏥' },
    { id: 'mercado', nombre: 'Mercado', icon: '🛒' },
    { id: 'mia', nombre: 'Mia', icon: '👧' },
    { id: 'colegio', nombre: 'Colegio', icon: '🎓' },
    { id: 'familia', nombre: 'Familia', icon: '👨‍👩‍👧' }
];

// --- PERSISTENCIA TEMA ---
function aplicarTema() {
    if (localStorage.getItem('modo-oscuro') === 'activado') document.body.classList.add('dark-mode');
}
aplicarTema();

auth.onAuthStateChanged(user => {
    if(user) {
        renderizarGastosFijos();
        cargarDatos(user.uid);
    }
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
});

// Renderizar botones de gastos fijos
function renderizarGastosFijos() {
    const grid = document.getElementById('fixed-grid');
    grid.innerHTML = '';
    GASTOS_FIJOS.forEach(gasto => {
        // Recuperamos el monto guardado de localStorage si existe
        const montoGuardado = localStorage.getItem(`monto_${gasto.id}`) || "0";
        const btn = document.createElement('button');
        btn.className = 'btn-fixed';
        btn.innerHTML = `<span>${gasto.icon}</span>${gasto.nombre}<br><small>$${montoGuardado}</small>`;
        btn.onclick = () => procesarGastoFijo(gasto);
        grid.appendChild(btn);
    });
}

async function procesarGastoFijo(gasto) {
    const montoActual = localStorage.getItem(`monto_${gasto.id}`) || "0";
    const nuevoMonto = prompt(`Monto para ${gasto.nombre}:`, montoActual);
    
    if (nuevoMonto !== null) {
        localStorage.setItem(`monto_${gasto.id}`, nuevoMonto);
        
        // Guardar en Firebase
        await db.collection("transacciones").add({
            uid: auth.currentUser.uid,
            monto: Number(nuevoMonto),
            tipo: 'gasto',
            categoria: gasto.nombre,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        // PREGUNTAR POR RECORDATORIO
        if(confirm(`¿Deseas agendar un recordatorio en tu calendario para el pago de ${gasto.nombre}?`)) {
            crearRecordatorioGoogle(gasto.nombre, nuevoMonto);
        }
        
        renderizarGastosFijos();
    }
}

// Función Pro: Crea un evento de calendario para que el celular avise
function crearRecordatorioGoogle(nombre, monto) {
    const fecha = new Date();
    // Lo programamos para el próximo mes el mismo día
    const fechaRecordatorio = new Date(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate(), 10, 0); 
    const fmtFecha = fechaRecordatorio.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=PAGAR+${nombre.toUpperCase()}+($${monto})&dates=${fmtFecha}/${fmtFecha}&details=Recordatorio+de+pago+desde+Finanzas+Elite&sf=true&output=xml`;
    
    window.open(url, '_blank');
}

// --- LOGICA DE DATOS ---
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

// (Resto de funciones: guardar manual, borrar, gráfico, dark mode...)
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