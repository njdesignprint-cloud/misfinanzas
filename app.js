import { initializeApp } from "https://www.gstatic.com/firebasejs/9/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9/firebase-storage.js";

// 1. REEMPLAZA ESTO CON TUS CREDENCIALES REALES
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_ID",
    appId: "TU_APP_ID"
};

// Inicializar
let app, auth, db, storage;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} catch (error) {
    alert("Error de configuración de Firebase: " + error.message);
}

let grafico = null;
let userActual = null;

// GESTIÓN DE INTERFAZ
const authDiv = document.getElementById('auth-container');
const appDiv = document.getElementById('main-app');

onAuthStateChanged(auth, (user) => {
    if (user) {
        userActual = user;
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        cargarDatos();
    } else {
        userActual = null;
        authDiv.style.display = 'block';
        appDiv.style.display = 'none';
    }
});

// LOGIN / REGISTRO
document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if(!email || !pass) return alert("Ingresa datos");
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, pass);
                alert("Cuenta creada y sesión iniciada");
            } catch (err2) { alert("Error al crear cuenta: " + err2.message); }
        } else { alert("Error: " + error.message); }
    }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

// GRÁFICO
function renderChart(datos) {
    const ctx = document.getElementById('miGrafico');
    if (!ctx) return;
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
        options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });
}

// CARGAR DATOS
function cargarDatos() {
    if (!userActual) return;
    const filtroMes = document.getElementById('filtro-mes');
    const [year, month] = filtroMes.value.split('-');
    const inicioMes = new Date(year, month - 1, 1);
    const finMes = new Date(year, month, 0, 23, 59, 59);

    const q = query(
        collection(db, "transacciones"),
        where("uid", "==", userActual.uid),
        where("fecha", ">=", inicioMes),
        where("fecha", "<=", finMes),
        orderBy("fecha", "desc")
    );

    onSnapshot(q, (snap) => {
        let balance = 0;
        let gastosCat = {};
        const lista = document.getElementById('lista-movimientos');
        lista.innerHTML = "";

        snap.forEach(doc => {
            const t = doc.data();
            const val = Number(t.monto);
            balance += (t.tipo === 'ingreso' ? val : -val);
            if (t.tipo === 'gasto') gastosCat[t.categoria] = (gastosCat[t.categoria] || 0) + val;

            lista.innerHTML += `
                <div class="item">
                    <div><strong>${t.categoria}</strong><br><small>${t.fecha.toDate().toLocaleDateString()}</small></div>
                    <span class="monto-${t.tipo}">${t.tipo === 'gasto' ? '-' : '+'}$${val.toFixed(2)}</span>
                </div>`;
        });
        document.getElementById('balance-total').innerText = `$${balance.toFixed(2)}`;
        renderChart(gastosCat);
    }, (error) => {
        console.error("Error en Snapshot:", error);
        if(error.code === "failed-precondition") {
            alert("Falta crear un índice en Firebase. Revisa la consola (F12) y haz clic en el link azul.");
        }
    });
}

// BOTÓN GUARDAR
document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto');
    const c = document.getElementById('categoria');
    const tipo = document.getElementById('tipo').value;
    const f = document.getElementById('foto').files[0];

    if(!m.value || !c.value) return alert("Llena los campos");

    const btn = document.getElementById('btn-guardar');
    btn.disabled = true; btn.innerText = "Guardando...";

    try {
        let url = "";
        if(f) {
            const sRef = ref(storage, `recibos/${userActual.uid}/${Date.now()}`);
            await uploadBytes(sRef, f);
            url = await getDownloadURL(sRef);
        }

        await addDoc(collection(db, "transacciones"), {
            uid: userActual.uid,
            monto: Number(m.value),
            tipo,
            categoria: c.value,
            reciboURL: url,
            fecha: new Date()
        });
        
        m.value = ""; c.value = ""; 
        alert("¡Guardado!");
    } catch (e) { alert("Error al guardar: " + e.message); }
    finally { btn.disabled = false; btn.innerText = "Guardar Transacción"; }
};

document.getElementById('filtro-mes').onchange = cargarDatos;