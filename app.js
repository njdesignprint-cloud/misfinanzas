import { initializeApp } from "https://www.gstatic.com/firebasejs/9/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9/firebase-storage.js";

// 1. CONFIGURACIÓN (REEMPLAZA CON TUS DATOS)
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_ID",
    appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let grafico = null;

// Establecer mes actual por defecto en el filtro
const filtroMes = document.getElementById('filtro-mes');
const hoy = new Date();
filtroMes.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

// 2. FUNCIÓN PARA EL GRÁFICO
function renderChart(datos) {
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
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
            cutout: '75%' 
        }
    });
}

// 3. LEER DATOS (CON FILTRO DE MES)
function cargarDatos() {
    const [year, month] = filtroMes.value.split('-');
    const inicioMes = new Date(year, month - 1, 1);
    const finMes = new Date(year, month, 0, 23, 59, 59);

    const q = query(
        collection(db, "transacciones"),
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
            const valor = Number(t.monto);
            
            if (t.tipo === 'ingreso') {
                balance += valor;
            } else {
                balance -= valor;
                gastosCat[t.categoria] = (gastosCat[t.categoria] || 0) + valor;
            }

            lista.innerHTML += `
                <div class="item">
                    <div class="item-info">
                        <strong>${t.categoria}</strong>
                        <small>${t.fecha.toDate().toLocaleDateString()}</small>
                    </div>
                    <span class="monto-${t.tipo}">${t.tipo === 'gasto' ? '-' : '+'}$${valor.toFixed(2)}</span>
                </div>
            `;
        });
        document.getElementById('balance-total').innerText = `$${balance.toFixed(2)}`;
        renderChart(gastosCat);
    });
}

// Escuchar cambios en el filtro de mes
filtroMes.onchange = cargarDatos;
cargarDatos(); // Carga inicial

// 4. GUARDAR TRANSACCIÓN
document.getElementById('btn-guardar').onclick = async () => {
    const btn = document.getElementById('btn-guardar');
    const monto = document.getElementById('monto').value;
    const tipo = document.getElementById('tipo').value;
    const cat = document.getElementById('categoria').value;
    const foto = document.getElementById('foto').files[0];

    if(!monto || !cat) return alert("Completa monto y categoría");

    btn.disabled = true;
    btn.innerText = "Guardando...";

    let url = "";
    if(foto) {
        const sRef = ref(storage, `recibos/${Date.now()}_${foto.name}`);
        await uploadBytes(sRef, foto);
        url = await getDownloadURL(sRef);
    }

    try {
        await addDoc(collection(db, "transacciones"), {
            monto: Number(monto),
            tipo,
            categoria: cat.trim(),
            reciboURL: url,
            fecha: new Date()
        });
        document.getElementById('monto').value = "";
        document.getElementById('categoria').value = "";
        document.getElementById('foto').value = "";
    } catch (e) {
        alert("Error al guardar");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar";
    }
};