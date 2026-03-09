import { initializeApp } from "https://www.gstatic.com/firebasejs/9/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_ID",
    appId: "TU_APP_ID"
};

console.log("Iniciando Firebase...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loadingDiv = document.getElementById('loading');
const authDiv = document.getElementById('auth-container');
const appDiv = document.getElementById('main-app');

// MONITOR DE USUARIO
onAuthStateChanged(auth, (user) => {
    loadingDiv.style.display = 'none';
    if (user) {
        console.log("Usuario detectado:", user.email);
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        cargarDatos(user.uid);
    } else {
        console.log("No hay usuario");
        authDiv.style.display = 'block';
        appDiv.style.display = 'none';
    }
});

// LOGIN
document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (err) { alert("Error: " + err.message); }
    }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

// CARGAR DATOS
function cargarDatos(uid) {
    const filtroMes = document.getElementById('filtro-mes');
    if(!filtroMes.value) {
        const h = new Date();
        filtroMes.value = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
    }

    const [y, m] = filtroMes.value.split('-');
    const inicio = new Date(y, m - 1, 1);
    const fin = new Date(y, m, 0, 23, 59, 59);

    const q = query(
        collection(db, "transacciones"),
        where("uid", "==", uid),
        where("fecha", ">=", inicio),
        where("fecha", "<=", fin),
        orderBy("fecha", "desc")
    );

    onSnapshot(q, (snap) => {
        let total = 0;
        const lista = document.getElementById('lista-movimientos');
        lista.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            total += (d.tipo === 'ingreso' ? d.monto : -d.monto);
            lista.innerHTML += `<div class="item"><span>${d.categoria}</span> <b>$${d.monto}</b></div>`;
        });
        document.getElementById('balance-total').innerText = `$${total.toFixed(2)}`;
    }, (error) => {
        console.error("Error Firestore:", error);
        alert("Error de permisos o falta crear índice. Revisa la consola F12.");
    });
}

// GUARDAR
document.getElementById('btn-guardar').onclick = async () => {
    const m = document.getElementById('monto').value;
    const c = document.getElementById('categoria').value;
    const t = document.getElementById('tipo').value;

    if(!m || !c) return;

    await addDoc(collection(db, "transacciones"), {
        uid: auth.currentUser.uid,
        monto: Number(m),
        tipo: t,
        categoria: c,
        fecha: new Date()
    });
    document.getElementById('monto').value = "";
    document.getElementById('categoria').value = "";
};