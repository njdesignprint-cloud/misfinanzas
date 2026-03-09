// 1. Configuración de tu Firebase
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let grafico = null;
let userActual = null;

// Elementos de la UI
const authDiv = document.getElementById('auth-container');
const appDiv = document.getElementById('main-app');
const filtroMes = document.getElementById('filtro-mes');

// Establecer mes actual
const hoy = new Date();
filtroMes.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

// --- CONTROL DE USUARIOS ---
auth.onAuthStateChanged((user) => {
    if (user) {
        userActual = user;
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        cargarDatos();
    } else {
        authDiv.style.display = 'block';
        appDiv.style.display = 'none';
    }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
        } catch (err) { alert("Error: " + err.message); }
    }
};

document.getElementById('btn-logout').onclick = () => auth.signOut();

// --- GRÁFICO ---
function actualizarGrafico(datos) {
    const ctx = document.getElementById('miGrafico').getContext('2d');
    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(datos),
            datasets: [{
                data: Object.values(datos),
                backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f', '#3498db', '#9b59b6'],
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, cutout: '75%' }
    });
}

// --- CARGAR DATOS ---
function cargarDatos() {
    if (!userActual) return;
    const [year, month] = filtroMes.value.split('-');
    const inicioMes = firebase.firestore.Timestamp.fromDate(new Date(year, month - 1, 1));
    const finMes = firebase.firestore.Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

    db.collection("transacciones")
        .where("uid", "==", userActual.uid)
        .where("fecha", ">=", inicioMes)
        .where("fecha", "<=", finMes)
        .orderBy("fecha", "desc")
        .onSnapshot((snap) => {
            let balance = 0;
            let gastosCat = {};
            const lista = document.getElementById('lista-movimientos');
            lista.innerHTML = "";

            snap.forEach(doc => {
                const t = doc.data();
                balance += (t.tipo === 'ingreso' ? t.monto : -t.monto);
                if (t.tipo === 'gasto') gastosCat[t.categoria] = (gastosCat[t.categoria] || 0) + t.monto;

                lista.innerHTML += `
                    <div class="item">
                        <div><strong>${t.categoria}</strong></div>
                        <span class="monto-${t.tipo}">${t.tipo === 'gasto' ? '-' : '+'}$${t.monto.toFixed(2)}</span>
                    </div>`;
            });
            document.getElementById('balance-total').innerText = `$${balance.toFixed(2)}`;
            actualizarGrafico(gastosCat);
        }, (error) => {
            console.log("Error: ", error);
            // Si ves este error en consola, crea el índice que te pide Firebase
        });
}

// --- GUARDAR ---
document.getElementById('btn-guardar').onclick = async () => {
    const monto = document.getElementById('monto').value;
    const categoria = document.getElementById('categoria').value;
    const tipo = document.getElementById('tipo').value;

    if (!monto || !categoria) return alert("Completa los datos");

    try {
        await db.collection("transacciones").add({
            uid: userActual.uid,
            monto: Number(monto),
            tipo: tipo,
            categoria: categoria,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('monto').value = "";
        document.getElementById('categoria').value = "";
    } catch (e) { alert("Error al guardar"); }
};

filtroMes.onchange = cargarDatos;