import { initializeApp } from "https://www.gstatic.com/firebasejs/9/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9/firebase-storage.js";

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_ID",
    appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let grafico = null;
let userActual = null;

// --- GESTIÓN DE USUARIOS ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userActual = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        cargarDatos();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch {
        await createUserWithEmailAndPassword(auth, email, pass);
    }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

// --- LÓGICA DE DATOS ---
const filtroMes = document.getElementById('filtro-mes');
const hoy = new Date();
filtroMes.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

function renderChart(datos) {
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
        options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });
}

function cargarDatos() {
    if (!userActual) return;
    const [year, month] = filtroMes.value.split('-');
    const inicioMes = new Date(year, month - 1, 1);
    const finMes = new Date(year, month, 0, 23, 59, 59);

    const q = query(
        collection(db, "transacciones"),
        where("uid", "==", userActual.uid), // Solo ve sus propios datos
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
            balance += (t.tipo === 'ingreso' ? t.monto : -t.monto);
            if (t.tipo === 'gasto') gastosCat[t.categoria] = (gastosCat[t.categoria] || 0) + t.monto;

            lista.innerHTML += `
                <div class="item">
                    <div><strong>${t.categoria}</strong><br><small>${t.fecha.toDate().toLocaleDateString()}</small></div>
                    <span class="monto-${t.tipo}">${t.tipo === 'gasto' ? '-' : '+'}$${t.monto.toFixed(2)}</span>
                </div>`;
        });
        document.getElementById('balance-total').innerText = `$${balance.toFixed(2)}`;
        renderChart(gastosCat);
    });
}

// BOTÓN GUARDAR (CORREGIDO)
document.getElementById('btn-guardar').onclick = async () => {
    const montoInput = document.getElementById('monto');
    const catInput = document.getElementById('categoria');
    const tipo = document.getElementById('tipo').value;
    const foto = document.getElementById('foto').files[0];

    if(!montoInput.value || !catInput.value) return alert("Llena los campos");

    const btn = document.getElementById('btn-guardar');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    let url = "";
    if(foto) {
        const sRef = ref(storage, `recibos/${userActual.uid}/${Date.now()}`);
        await uploadBytes(sRef, foto);
        url = await getDownloadURL(sRef);
    }

    try {
        await addDoc(collection(db, "transacciones"), {
            uid: userActual.uid,
            monto: Number(montoInput.value),
            tipo,
            categoria: catInput.value,
            reciboURL: url,
            fecha: new Date()
        });
        
        // LIMPIAR CAMPOS DESPUÉS DE GUARDAR
        montoInput.value = "";
        catInput.value = "";
        document.getElementById('foto').value = "";
        alert("Guardado correctamente");
    } catch (e) {
        console.error(e);
        alert("Error al guardar");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Transacción";
    }
};

filtroMes.onchange = cargarDatos;