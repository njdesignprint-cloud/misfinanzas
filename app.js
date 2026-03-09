import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Reemplaza con tus credenciales
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

const authDiv = document.getElementById('auth-container');
const appDiv = document.getElementById('main-app');

onAuthStateChanged(auth, (user) => {
    if (user) {
        authDiv.style.display = 'none';
        appDiv.style.display = 'block';
        cargarDatos(user.uid);
    } else {
        authDiv.style.display = 'block';
        appDiv.style.display = 'none';
    }
});

// ... El resto del código de guardado y carga se mantiene igual ...
// (Asegúrate de copiar las funciones de cargarDatos y btn-guardar del mensaje anterior)