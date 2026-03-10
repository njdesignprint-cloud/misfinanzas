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
let limiteGasto = 1000;

// --- PERSISTENCIA DEL MODO OSCURO ---
function aplicarTema() {
    const estado = localStorage.getItem('modo-oscuro');
    if (estado === 'activado') {
        document.body.classList.add('dark-mode');
        if(document.getElementById('btn-dark-mode')) document.getElementById('btn-dark-mode').innerText = '☀️';
    }
}
aplicarTema();

auth.onAuthStateChanged(user => {
    aplicarTema(); 
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
    if(user) cargarDatos(user.uid);
});

function cargarDatos(uid) {
    const filtro = document.getElementById('filtro-mes');
    if(!filtro.value) filtro.value = new Date().toISOString().slice(0, 7);
    const [y, m] = filtro.value.split('-');
    const inicio = firebase.firestore.Timestamp.fromDate(new Date(y, m-1, 1));
    const fin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59));

    db.collection("transacciones").where("uid", "==", uid)
      .where("fecha", ">=", inicio).where("fecha", "<=", fin)
      .orderBy("fecha", "desc").onSnapshot(snap => {
        let tIn = 0, tGa = 0, datosGrafica = {}, html = "";
        
        snap.forEach(doc => {
            const d = doc.data();
            if(d.tipo === 'ingreso') tIn += d.monto; else tGa += d.monto;
            
            const label = `${d.categoria} (${d.tipo === 'gasto' ? 'G' : 'I'})`;
            datosGrafica[label] = (datosGrafica[label] || 0) + d.monto;

            html += `
                <div class="item" data-nombre="${d.categoria.toLowerCase()}">
                    <div><b>${d.categoria}</b><br><span class="monto-${d.tipo}">$${d.monto.toFixed(2)}</span></div>
                    <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none; cursor:pointer; font-size:1.2rem;">🗑️</button>
                </div>`;
        });

        document.getElementById('res-ingresos').innerText = `+$${tIn.toFixed(0)}`;
        document.getElementById('res-gastos').innerText = `-$${tGa.toFixed(0)}`;
        document.getElementById('balance-total').innerText = `$${(tIn - tGa).toFixed(2)}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        
        const porc = Math.min((tGa / limiteGasto) * 100, 100);
        document.getElementById('bar-progreso').style.width = porc + "%";
        document.getElementById('bar-progreso').style.background = porc > 90 ? "#E53E3E" : "#38A169";
        document.getElementById('txt-presupuesto').innerText = `$${tGa.toFixed(0)} / $${limiteGasto}`;

        actualizarGrafico(datosGrafica);
    });
}

document.getElementById('btn-dark-mode').onclick = () => {
    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('modo-oscuro', esOscuro ? 'activado' : 'desactivado');
    document.getElementById('btn-dark-mode').innerText = esOscuro ? '☀️' : '🌙';
    if(grafico) cargarDatos(auth.currentUser.uid);
};

document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Completa los datos");
    await db.collection("transacciones").add({
        uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
};

window.eliminarDoc = (id) => confirm("¿Eliminar?") && db.collection("transacciones").doc(id).delete();

document.getElementById('btn-set-presupuesto').onclick = () => {
    const n = prompt("Límite mensual de gasto:", limiteGasto);
    if(n) { limiteGasto = Number(n); cargarDatos(auth.currentUser.uid); }
};

document.getElementById('buscador').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.item').forEach(it => {
        it.style.display = it.dataset.nombre.includes(term) ? 'flex' : 'none';
    });
};

function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(datos),
            datasets: [{ 
                data: Object.values(datos), 
                backgroundColor: ['#4299E1', '#F56565', '#48BB78', '#ECC94B', '#9F7AEA', '#ED64A6', '#667EEA'], 
                borderWidth: 5,
                borderColor: getComputedStyle(document.body).getPropertyValue('--card')
            }]
        },
        options: { 
            maintainAspectRatio: false, 
            cutout: '75%', 
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, color: getComputedStyle(document.body).getPropertyValue('--text') } } } 
        }
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
document.getElementById('btn-exportar').onclick = () => {
    let csv = "Categoria,Tipo,Monto\n";
    db.collection("transacciones").where("uid", "==", auth.currentUser.uid).get().then(snap => {
        snap.forEach(doc => { const d = doc.data(); csv += `${d.categoria},${d.tipo},${d.monto}\n`; });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'reporte.csv'; a.click();
    });
};