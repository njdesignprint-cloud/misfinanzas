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
let limiteGasto = 1000; // Valor por defecto

auth.onAuthStateChanged(user => {
    if(user) cargarDatos(user.uid);
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
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
        let tIn = 0, tGa = 0, cats = {}, html = "";
        
        snap.forEach(doc => {
            const d = doc.data();
            if(d.tipo === 'ingreso') tIn += d.monto; 
            else { 
                tGa += d.monto; 
                cats[d.categoria] = (cats[d.categoria] || 0) + d.monto; 
            }
            html += `
                <div class="item" data-nombre="${d.categoria.toLowerCase()}">
                    <div><b>${d.categoria}</b><br><span class="monto-${d.tipo}">$${d.monto.toFixed(2)}</span></div>
                    <div>
                        <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
        });

        // Actualizar UI
        document.getElementById('res-ingresos').innerText = `+$${tIn.toFixed(0)}`;
        document.getElementById('res-gastos').innerText = `-$${tGa.toFixed(0)}`;
        document.getElementById('balance-total').innerText = `$${(tIn - tGa).toFixed(2)}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        
        // Lógica de Presupuesto
        const porc = Math.min((tGa / limiteGasto) * 100, 100);
        document.getElementById('bar-progreso').style.width = porc + "%";
        document.getElementById('bar-progreso').style.background = porc > 85 ? "#F43F5E" : "#10B981";
        document.getElementById('txt-presupuesto').innerText = `$${tGa.toFixed(0)} / $${limiteGasto}`;

        actualizarGrafico(cats);
    });
}

// Buscador Pro en tiempo real
document.getElementById('buscador').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.item').forEach(it => {
        it.style.display = it.dataset.nombre.includes(term) ? 'flex' : 'none';
    });
};

document.getElementById('btn-set-presupuesto').onclick = () => {
    const nuevo = prompt("¿Cuál es tu límite de gasto mensual?", limiteGasto);
    if(nuevo) { limiteGasto = Number(nuevo); cargarDatos(auth.currentUser.uid); }
};

document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Datos incompletos");
    await db.collection("transacciones").add({
        uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
};

window.eliminarDoc = (id) => confirm("¿Eliminar?") && db.collection("transacciones").doc(id).delete();

document.getElementById('btn-dark-mode').onclick = () => {
    document.body.classList.toggle('dark-mode');
    document.getElementById('btn-dark-mode').innerText = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
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
                backgroundColor: ['#6366F1', '#F43F5E', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'], 
                borderWidth: 0 
            }]
        },
        options: { maintainAspectRatio: false, cutout: '80%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
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