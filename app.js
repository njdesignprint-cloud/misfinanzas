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

function cargarDatos(uid) {
    const filtro = document.getElementById('filtro-mes');
    if(!filtro.value) filtro.value = new Date().toISOString().slice(0, 7);
    const [y, m] = filtro.value.split('-');
    const inicio = firebase.firestore.Timestamp.fromDate(new Date(y, m-1, 1));
    const fin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59));

    db.collection("transacciones").where("uid", "==", uid)
      .where("fecha", ">=", inicio).where("fecha", "<=", fin)
      .orderBy("fecha", "desc").onSnapshot(snap => {
        let totalIngresos = 0, totalGastos = 0, datosGrafica = {}, html = "";
        
        snap.forEach(doc => {
            const d = doc.data();
            const monto = d.monto;
            
            if(d.tipo === 'ingreso') {
                totalIngresos += monto;
            } else {
                totalGastos += monto;
            }
            
            const etiqueta = `${d.categoria} (${d.tipo === 'gasto' ? 'G' : 'I'})`;
            datosGrafica[etiqueta] = (datosGrafica[etiqueta] || 0) + monto;

            html += `
                <div class="item">
                    <div><b>${d.categoria}</b><br><span class="monto-${d.tipo}">$${monto.toFixed(2)}</span></div>
                    <div>
                        <button onclick="editarDoc('${doc.id}', ${monto})" style="border:none; background:none; cursor:pointer;">✏️</button>
                        <button onclick="eliminarDoc('${doc.id}')" style="border:none; background:none; cursor:pointer; color:#EF4444;">🗑️</button>
                    </div>
                </div>`;
        });

        document.getElementById('res-ingresos').innerText = `+$${totalIngresos.toFixed(2)}`;
        document.getElementById('res-gastos').innerText = `-$${totalGastos.toFixed(2)}`;
        document.getElementById('balance-total').innerText = `$${(totalIngresos - totalGastos).toFixed(2)}`;
        document.getElementById('lista-movimientos').innerHTML = html;
        actualizarGrafico(datosGrafica);
    });
}

document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value, c = document.getElementById('categoria').value, t = document.getElementById('tipo').value;
    if(!m || !c) return alert("Llena todos los campos");
    await db.collection("transacciones").add({
        uid: auth.currentUser.uid, monto: Number(m), tipo: t, categoria: c, fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('monto').value = ""; document.getElementById('categoria').value = "";
};

window.eliminarDoc = (id) => confirm("¿Deseas eliminar permanentemente?") && db.collection("transacciones").doc(id).delete();

window.editarDoc = (id, monto) => {
    const n = prompt("Actualizar monto:", monto);
    if(n) db.collection("transacciones").doc(id).update({ monto: Number(n) });
};

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
                // Colores profesionales y diferenciados
                backgroundColor: [
                    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
                    '#6366F1', '#EC4899', '#8B5CF6', '#F97316'
                ], 
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).getPropertyValue('--card')
            }]
        },
        options: { 
            maintainAspectRatio: false, 
            cutout: '75%', 
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { boxWidth: 12, padding: 15, font: { size: 11, family: 'sans-serif' }, color: getComputedStyle(document.body).getPropertyValue('--text') } 
                } 
            } 
        }
    });
}
document.getElementById('filtro-mes').onchange = () => cargarDatos(auth.currentUser.uid);