// Configuración con tus credenciales reales
const firebaseConfig = {
    apiKey: "AIzaSyATpb8_S2JhY1T2Lb8lzn3_544C7Kqd4OI",
    authDomain: "misfinanzas-618f2.firebaseapp.com",
    projectId: "misfinanzas-618f2",
    storageBucket: "misfinanzas-618f2.firebasestorage.app",
    messagingSenderId: "998483559442",
    appId: "1:998483559442:web:435dced19e19a884b984cb"
};

// Inicialización de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let grafico = null;

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const filtroMes = document.getElementById('filtro-mes');

const fechaHoy = new Date();
filtroMes.value = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;

auth.onAuthStateChanged(user => {
    if (user) {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        cargarDatos(user.uid);
    } else {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
    }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    if(!email || !pass) return alert("Ingresa datos");
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
        } catch (err) { alert("Error: " + err.message); }
    }
};

document.getElementById('btn-logout').onclick = () => auth.signOut();

function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico').getContext('2d');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(datos),
            datasets: [{
                data: Object.values(datos),
                backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#e67e22'],
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, cutout: '78%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
}

function cargarDatos(uid) {
    const [y, m] = filtroMes.value.split('-');
    
    // CORRECCIÓN AQUÍ: Se quita el "new"
    const fechaInicio = firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, 1));
    const fechaFin = firebase.firestore.Timestamp.fromDate(new Date(y, m, 0, 23, 59, 59));

    db.collection("transacciones")
        .where("uid", "==", uid)
        .where("fecha", ">=", fechaInicio)
        .where("fecha", "<=", fechaFin)
        .orderBy("fecha", "desc")
        .onSnapshot(snap => {
            let balance = 0;
            let gastosPorCategoria = {};
            const listaUI = document.getElementById('lista-movimientos');
            listaUI.innerHTML = "";

            snap.forEach(doc => {
                const item = doc.data();
                const monto = Number(item.monto);
                
                if(item.tipo === 'ingreso') {
                    balance += monto;
                } else {
                    balance -= monto;
                    gastosPorCategoria[item.categoria] = (gastosPorCategoria[item.categoria] || 0) + monto;
                }

                listaUI.innerHTML += `
                    <div class="item">
                        <span>${item.categoria}</span>
                        <span class="monto-${item.tipo}">${item.tipo === 'gasto' ? '-' : '+'}$${monto.toFixed(2)}</span>
                    </div>`;
            });
            
            document.getElementById('balance-total').innerText = `$${balance.toFixed(2)}`;
            actualizarGrafico(gastosPorCategoria);
        }, (err) => {
            console.error("Error en Snapshot: ", err);
        });
}

document.getElementById('btn-guardar').onclick = async () => {
    const monto = document.getElementById('monto').value;
    const cat = document.getElementById('categoria').value;
    const tipo = document.getElementById('tipo').value;

    if(!monto || !cat) return alert("Llena los campos");

    try {
        await db.collection("transacciones").add({
            uid: auth.currentUser.uid,
            monto: Number(monto),
            tipo: tipo,
            categoria: cat,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('monto').value = "";
        document.getElementById('categoria').value = "";
    } catch (e) { alert("Error al guardar"); }
};

filtroMes.onchange = () => cargarDatos(auth.currentUser.uid);