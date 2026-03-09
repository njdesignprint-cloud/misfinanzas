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

// --- CONTROL DE SESIÓN ---
auth.onAuthStateChanged(user => {
    document.getElementById('auth-section').style.display = user ? 'none' : 'block';
    document.getElementById('app-section').style.display = user ? 'block' : 'none';
    if(user) cargarDatos(user.uid);
});

document.getElementById('btn-login').onclick = async () => {
    const e = document.getElementById('email').value, p = document.getElementById('pass').value;
    try { await auth.signInWithEmailAndPassword(e, p); } catch {
        try { await auth.createUserWithEmailAndPassword(e, p); } catch(err) { alert(err.message); }
    }
};
document.getElementById('btn-logout').onclick = () => auth.signOut();

// --- ESCÁNER DE RECIBOS ---
document.getElementById('input-scan').onchange = function(e) {
    const status = document.getElementById('scan-status');
    status.innerText = "Leyendo datos... 🔍";
    
    Tesseract.recognize(e.target.files[0], 'spa').then(({ data: { text } }) => {
        // Busca números con formato de moneda (ej: 15.00 o 1,500.00)
        const precios = text.match(/\d+[.,]\d{2}/g);
        if (precios) {
            const valores = precios.map(p => parseFloat(p.replace(',', '.')));
            document.getElementById('monto').value = Math.max(...valores);
            status.innerText = "¡Monto detectado! ✅";
        } else {
            status.innerText = "No se halló monto claro. ❌";
        }
    }).catch(() => status.innerText = "Error al procesar imagen.");
};

// --- CARGA DE DATOS ---
function cargarDatos(uid) {
    const filtro = document.getElementById('filtro-mes');
    if(!filtro.value) filtro.value = new Date().toISOString().slice(0, 7);
    const [y, m] = filtro.value.split('-');
    const inicio = firebase.firestore.Timestamp.fromDate(new Date(y, m-1, 1));
    const fin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59));

    db.collection("transacciones").where("uid", "==", uid)
      .where("fecha", ">=", inicio).where("fecha", "<=", fin)
      .orderBy("fecha", "desc").onSnapshot(snap => {
        let bal = 0, cats = {}, html = "";
        snap.forEach(doc => {
            const d = doc.data();
            bal += (d.tipo === 'ingreso' ? d.monto : -d.monto);
            if(d.tipo === 'gasto') cats[d.categoria] = (cats[d.categoria] || 0) + d.monto;
            html += `
                <div class="item">
                    <div><b>${d.categoria}</b><br><span class="monto-${d.tipo}">$${d.monto.toFixed(2)}</span></div>
                    <div>
                        <button onclick="editarDoc('${doc.id}', ${d.monto})" style="border:none; background:none; cursor:pointer; font-size:1.1rem">✏️</button>
                        <button class="btn-del" onclick="eliminarDoc('${doc.id}')">🗑️</button>
                    </div>
                </div>`;
        });
        document.getElementById('balance-total').innerText = `$${bal.toFixed(2)}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        actualizarGrafico(cats);
    });
}

// --- GUARDAR Y EXTRAS ---
document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Llena todos los campos");
    await db.collection("transacciones").add({
        uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
    document.getElementById('scan-status').innerText = "";
};

window.eliminarDoc = (id) => confirm("¿Eliminar este movimiento?") && db.collection("transacciones").doc(id).delete();

window.editarDoc = (id, monto) => {
    const n = prompt("Actualizar monto:", monto);
    if(n) db.collection("transacciones").doc(id).update({ monto: Number(n) });
};

document.getElementById('btn-dark-mode').onclick = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('btn-dark-mode').innerText = isDark ? '☀️' : '🌙';
};

document.getElementById('btn-exportar').onclick = () => {
    let csv = "Categoria,Tipo,Monto\n";
    db.collection("transacciones").where("uid", "==", auth.currentUser.uid).get().then(snap => {
        snap.forEach(doc => { const d = doc.data(); csv += `${d.categoria},${d.tipo},${d.monto}\n`; });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'reporte_gastos.csv'; a.click();
    });
};

function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(datos),
            datasets: [{ data: Object.values(datos), backgroundColor: ['#064E3B', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'], borderWidth: 0 }]
        },
        options: { maintainAspectRatio: false, cutout: '80%', plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text'), font: { size: 10 } } } } }
    });
}

document.getElementById('filtro-mes').onchange = () => cargarDatos(auth.currentUser.uid);