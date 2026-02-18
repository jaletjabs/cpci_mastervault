import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, getDoc, query, orderBy, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCMCtSGo42_yIXJ97YIVdEr5D2GleT0M6g",
    authDomain: "master-inventory-pro.firebaseapp.com",
    projectId: "master-inventory-pro",
    storageBucket: "master-inventory-pro.firebasestorage.app",
    messagingSenderId: "498180318440",
    appId: "1:498180318440:web:091a8b0db423e4d595555d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let items = [], orders = [], shipments = [];
let activeSection = localStorage.getItem('activeTab') || 'Home';
let slideIndex = parseInt(localStorage.getItem('slideIndex')) || 0;
let searchQuery = '', filterClient = '', filterItem = '', filterMonth = '', filterYear = '';

// --- GATEKEEPER AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('dashboard-page').classList.add('hidden');
    } else {
        console.log("Vault Secure: Session recognized. Standing by for manual unlock.");
    }
});

document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const emailVal = document.getElementById('email').value;
    const passVal = document.getElementById('password').value;

    try {
        if (!auth.currentUser) {
            await signInWithEmailAndPassword(auth, emailVal, passVal);
        }
        // If we reach here, user is authenticated. Open the vault.
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard-page').classList.replace('hidden', 'flex');
        syncData();
        nav(activeSection, slideIndex);
    } catch (err) {
        alert("Access Denied: Please check credentials.");
    }
};

function syncData() {
    onSnapshot(query(collection(db, "items"), orderBy("code")), (s) => { items = s.docs.map(d => ({id: d.id, ...d.data()})); render(); });
    onSnapshot(query(collection(db, "orders"), orderBy("timestamp", "desc")), (s) => { orders = s.docs.map(d => ({id: d.id, ...d.data()})); render(); });
    onSnapshot(query(collection(db, "shipments"), orderBy("timestamp", "desc")), (s) => { shipments = s.docs.map(d => ({id: d.id, ...d.data()})); render(); });
}

window.nav = (section, slide) => {
    activeSection = section; slideIndex = slide;
    localStorage.setItem('activeTab', section);
    localStorage.setItem('slideIndex', slide);
    document.querySelectorAll('.sub-nav-btn').forEach(btn => btn.classList.toggle('active', btn.id === 'nav-' + section));
    document.getElementById('slider-container').style.transform = `translateX(-${slide * (100/7)}%)`;
    render();
};

// --- WAREHOUSE ACTIONS ---
window.saveItem = async () => {
    const code = document.getElementById('cCode').value.toUpperCase();
    const desc = document.getElementById('cDesc').value;
    if(code && desc) { await addDoc(collection(db, "items"), { code, desc, qty: 0 }); alert("Item Registered!"); nav('Home', 0); }
};

window.addStock = async () => {
    const id = document.getElementById('sId').value, amt = parseInt(document.getElementById('sQty').value);
    const ref = doc(db, "items", id);
    const snap = await getDoc(ref);
    await updateDoc(ref, { qty: snap.data().qty + amt });
    alert("Warehouse Updated!"); nav('Home', 0);
};

// --- ORDER ACTIONS ---
window.savePO = async () => {
    const data = {
        woNum: document.getElementById('poWO').value || 'N/A',
        poNum: document.getElementById('poNum').value.trim().toUpperCase(),
        date: document.getElementById('poDate').value,
        client: document.getElementById('poClient').value,
        item: document.getElementById('poItem').value,
        qty: parseInt(document.getElementById('poQty').value),
        status: 'PENDING',
        timestamp: Date.now()
    };
    if(!data.poNum || isNaN(data.qty)) return alert("Check all fields!");
    await addDoc(collection(db, "orders"), data);
    alert("Order Saved!");
};

window.deleteOrder = async (id) => { if(confirm("Permanently delete?")) await deleteDoc(doc(db, "orders", id)); };

// --- SHIPMENT ACTIONS ---
window.lookupPOData = async () => {
    const poToFind = document.getElementById('shipPO').value.trim().toUpperCase();
    const itemDropdown = document.getElementById('shipItemSelect');
    const clientInput = document.getElementById('shipClient');
    if (!poToFind) { itemDropdown.innerHTML = ''; clientInput.value = ""; return; }
    const q = query(collection(db, "orders"), where("poNum", "==", poToFind));
    const snap = await getDocs(q);
    if (!snap.empty) {
        let options = '<option value="">Select Item</option>';
        snap.docs.forEach(d => {
            const ord = d.data();
            const del = shipments.filter(s => s.po === poToFind && s.itemCode === ord.item).reduce((sum, curr) => sum + curr.qty, 0);
            options += `<option value="${ord.item}">${ord.item} (Bal: ${ord.qty - del})</option>`;
        });
        itemDropdown.innerHTML = options;
        clientInput.value = snap.docs[0].data().client;
    }
};

window.processShipment = async () => {
    const po = document.getElementById('shipPO').value.trim().toUpperCase(), code = document.getElementById('shipItemSelect').value;
    const qty = parseInt(document.getElementById('shipQty').value), date = document.getElementById('shipDate').value;
    const dr = document.getElementById('shipDR').value, client = document.getElementById('shipClient').value;

    if(!date || !po || !code || isNaN(qty) || qty <= 0) return alert("Verify inputs!");
    const whItem = items.find(i => i.code === code);
    if(!whItem || whItem.qty < qty) return alert("Warehouse Shortage!");

    const order = orders.find(o => o.poNum === po && o.item === code);
    if(order) {
        const del = shipments.filter(s => s.po === po && s.itemCode === code).reduce((a, b) => a + b.qty, 0);
        if(qty > (order.qty - del)) return alert("🚫 Hard Cap: Exceeds PO Balance!");
    }

    await updateDoc(doc(db, "items", whItem.id), { qty: whItem.qty - qty });
    await addDoc(collection(db, "shipments"), { date, po, dr, client, qty, itemCode: code, timestamp: Date.now() });
    alert("Dispatched!");
    lookupPOData();
};

window.deleteShipment = async (id, code, qty) => {
    if(!confirm("Revert?")) return;
    const item = items.find(i => i.code === code);
    if(item) await updateDoc(doc(db, "items", item.id), { qty: item.qty + qty });
    await deleteDoc(doc(db, "shipments", id));
};

// --- SEARCH & SUMMARY ---
window.setSearch = (val) => {
    searchQuery = val.toLowerCase();
    const body = document.getElementById('pendingTableBody');
    if(!body) return;
    const filtered = orders.filter(o => o.poNum.toLowerCase().includes(searchQuery) || o.client.toLowerCase().includes(searchQuery));
    body.innerHTML = filtered.map(o => {
        const del = shipments.filter(s => s.po === o.poNum && s.itemCode === o.item).reduce((s, c) => s + c.qty, 0);
        const done = del >= o.qty;
        return `<tr class="border-t hover:bg-slate-50"><td class="p-4 text-xs font-bold text-slate-400">${o.date}</td><td class="p-4 font-bold text-blue-600 italic">${o.woNum}</td><td class="p-4 font-bold uppercase text-xs">${o.poNum}</td><td class="p-4 text-xs font-semibold">${o.client}</td><td class="p-4 font-mono text-[10px] text-blue-700 font-black">${o.item}</td><td class="p-4 text-center font-black">${del}/${o.qty}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded-lg text-[9px] font-black ${done ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">${done ? 'COMPLETE' : 'PENDING'}</span></td></tr>`;
    }).join('');
};

window.updateSummaryFilter = () => {
    filterClient = document.getElementById('fClient').value.toLowerCase();
    filterItem = document.getElementById('fItem').value;
    filterMonth = document.getElementById('fMonth').value;
    filterYear = document.getElementById('fYear').value;
    renderSummaryData(); 
};

function renderSummaryData() {
    const body = document.getElementById('summaryBody'), foot = document.getElementById('summaryFooter');
    if (!body || !foot) return;
    const filteredS = shipments.filter(s => {
        const d = new Date(s.date);
        return s.client.toLowerCase().includes(filterClient) && (filterItem === "" || s.itemCode === filterItem) && (filterMonth === "" || (d.getMonth()+1) == filterMonth) && (filterYear === "" || d.getFullYear() == filterYear);
    });
    const totalDel = filteredS.reduce((sum, s) => sum + s.qty, 0);
    const totalPen = orders.filter(o => o.client.toLowerCase().includes(filterClient) && (filterItem === "" || o.item === filterItem)).reduce((sum, o) => {
        const del = shipments.filter(s => s.po === o.poNum && s.itemCode === o.item).reduce((a,b)=>a+b.qty,0);
        return sum + (o.qty - del);
    }, 0);
    body.innerHTML = filteredS.map(s => `<tr class="border-t hover:bg-slate-50"><td class="p-4 text-xs font-bold text-slate-500">${s.date}</td><td class="p-4 font-black uppercase text-sm">${s.client}</td><td class="p-4 text-xs font-bold"><span class="text-blue-600">PO:${s.po}</span><br><span class="text-orange-600">DR:${s.dr}</span></td><td class="p-4 font-mono font-bold text-purple-700 text-xs">${s.itemCode}</td><td class="p-4 text-right font-black">${s.qty.toLocaleString()}</td></tr>`).join('');
    foot.innerHTML = `<tr class="bg-slate-900 text-white"><td colspan="4" class="p-6 text-right font-bold uppercase text-[10px]">Total Delivered:</td><td class="p-6 text-right font-black text-xl text-green-400">${totalDel.toLocaleString()}</td></tr><tr class="bg-slate-800 text-white"><td colspan="4" class="p-4 text-right font-bold uppercase text-[10px] text-slate-400">Total Pending:</td><td class="p-4 text-right font-black text-lg text-red-400">${totalPen.toLocaleString()}</td></tr>`;
}

// --- MASTER RENDERER ---
function render() {
    const main = document.getElementById('stocks-content');
    if (activeSection === 'Home') {
        main.innerHTML = `<h2 class="text-2xl font-black mb-8 uppercase italic">Warehouse Stock</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-6">${items.map(i => `<div class="bg-white p-6 rounded-[24px] shadow-sm border-l-8 ${i.qty > 10 ? 'border-green-500' : 'border-red-500'}"><p class="text-[10px] font-black text-slate-400 uppercase mb-1">${i.code}</p><h4 class="font-bold text-slate-800 mb-4">${i.desc}</h4><div class="text-4xl font-black text-slate-900">${i.qty.toLocaleString()}</div></div>`).join('')}</div>`;
    }
    if (activeSection === 'Register') {
        main.innerHTML = `<div class="max-w-md mx-auto bg-white p-10 rounded-[32px] shadow-lg"><h3 class="text-xl font-black uppercase mb-6 text-blue-600 italic text-center">Register New Item</h3><input type="text" id="cCode" placeholder="Item Code" class="w-full p-4 mb-4 border-2 rounded-xl outline-none font-bold focus:border-blue-500"><input type="text" id="cDesc" placeholder="Description" class="w-full p-4 mb-6 border-2 rounded-xl outline-none focus:border-blue-500"><button onclick="saveItem()" class="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase">Save Item</button></div>`;
    }
    if (activeSection === 'StockIn') {
        main.innerHTML = `<div class="max-w-md mx-auto bg-white p-10 rounded-[32px] shadow-lg"><h3 class="text-xl font-black uppercase text-green-600 mb-6 italic text-center">Add Stock</h3><select id="sId" class="w-full p-4 mb-4 border-2 rounded-xl font-bold">${items.map(i => `<option value="${i.id}">${i.code} - ${i.desc}</option>`).join('')}</select><input type="number" id="sQty" placeholder="Quantity" class="w-full p-4 mb-6 border-2 rounded-xl font-black outline-none focus:border-green-500"><button onclick="addStock()" class="w-full bg-green-600 text-white font-black py-4 rounded-xl uppercase">Confirm Stock In</button></div>`;
    }
    if (activeSection === 'Orders') {
        main.innerHTML = `<div class="space-y-6"><div class="bg-white p-8 rounded-[32px] shadow-sm"><h3 class="text-xl font-black uppercase text-blue-600 mb-6 italic">New Order Entry</h3><div class="grid grid-cols-2 gap-4 mb-4"><input type="text" id="poWO" placeholder="WO #" class="p-4 border rounded-xl"><input type="text" id="poNum" placeholder="PO #" class="p-4 border rounded-xl font-black"></div><div class="grid grid-cols-2 gap-4 mb-4"><input type="date" id="poDate" class="p-4 border rounded-xl"><input type="text" id="poClient" placeholder="Client Name" class="p-4 border rounded-xl"></div><select id="poItem" class="w-full p-4 mb-4 border rounded-xl font-bold">${items.map(i => `<option value="${i.code}">${i.code} - ${i.desc}</option>`).join('')}</select><input type="number" id="poQty" placeholder="Order Quantity" class="w-full p-4 mb-6 border rounded-xl font-black"><button onclick="savePO()" class="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase">Create Order</button></div><div class="bg-white rounded-[24px] border overflow-x-auto"><table class="w-full text-left"><thead class="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th class="p-4">Date</th><th class="p-4 text-blue-600">WO #</th><th class="p-4">PO #</th><th class="p-4">Client</th><th class="p-4">Item</th><th class="p-4 text-center">Qty</th><th class="p-4 text-center">Action</th></tr></thead><tbody>${orders.map(o => `<tr class="border-t hover:bg-slate-50"><td class="p-4 text-xs font-bold text-slate-500">${o.date}</td><td class="p-4 font-bold text-blue-600 italic">${o.woNum}</td><td class="p-4 font-bold uppercase text-xs">${o.poNum}</td><td class="p-4 text-xs font-semibold">${o.client}</td><td class="p-4 font-mono text-xs font-bold text-slate-700">${o.item}</td><td class="p-4 text-center font-black">${o.qty}</td><td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-red-400 font-black text-[9px] hover:underline">DELETE</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (activeSection === 'Shipment') {
        main.innerHTML = `<div class="space-y-6"><div class="bg-white p-8 rounded-[32px] shadow-sm"><h3 class="text-xl font-black uppercase text-orange-600 mb-6 italic text-center">Confirm Shipment</h3><div class="grid grid-cols-3 gap-4 mb-4"><input type="date" id="shipDate" class="p-4 border rounded-xl"><input type="text" id="shipPO" oninput="lookupPOData()" placeholder="Scan PO#" class="p-4 border-2 border-orange-200 rounded-xl font-black uppercase"><input type="text" id="shipDR" placeholder="DR #" class="p-4 border rounded-xl font-bold"></div><div class="grid grid-cols-2 gap-4 mb-6"><input type="text" id="shipClient" placeholder="Client" class="p-4 bg-slate-50 rounded-xl font-semibold" readonly><select id="shipItemSelect" class="p-4 border rounded-xl font-bold text-xs"></select></div><input type="number" id="shipQty" placeholder="Shipping Quantity" class="w-full p-4 mb-6 border-2 rounded-xl font-black"><button onclick="processShipment()" class="w-full bg-orange-600 text-white font-black py-4 rounded-xl uppercase">Release and Ship</button></div><div class="bg-white rounded-[24px] border overflow-x-auto shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th class="p-4">Date</th><th class="p-4">PO #</th><th class="p-4 text-orange-600">DR #</th><th class="p-4">Client</th><th class="p-4">Item</th><th class="p-4 text-center">Qty</th><th class="p-4 text-center">Action</th></tr></thead><tbody>${shipments.map(s => `<tr class="border-t hover:bg-slate-50"><td class="p-4 text-xs font-bold text-slate-500">${s.date}</td><td class="p-4 uppercase font-bold text-xs">${s.po}</td><td class="p-4 font-bold text-orange-600">${s.dr}</td><td class="p-4 text-xs font-semibold">${s.client}</td><td class="p-4 font-mono font-bold text-purple-700 text-xs">${s.itemCode}</td><td class="p-4 font-black text-center">${s.qty}</td><td class="p-4 text-center"><button onclick="deleteShipment('${s.id}', '${s.itemCode}', ${s.qty})" class="text-red-400 font-black text-[10px] hover:underline">REVERT</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (activeSection === 'Pending') {
        main.innerHTML = `<div class="space-y-6"><div class="flex justify-between items-center"><h2 class="text-2xl font-black uppercase text-red-600 italic">Pending Load</h2><input type="text" placeholder="Search..." oninput="setSearch(this.value)" class="p-4 border-2 rounded-xl w-64 outline-none focus:border-red-500"></div><div class="bg-white rounded-[24px] border overflow-x-auto shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 text-[10px] uppercase"><tr><th class="p-4">Date</th><th class="p-4">WO#</th><th class="p-4">PO#</th><th class="p-4">Client</th><th class="p-4">Item</th><th class="p-4 text-center">Progress</th><th class="p-4 text-center">Status</th></tr></thead><tbody id="pendingTableBody"></tbody></table></div></div>`;
        setSearch('');
    }
    if (activeSection === 'Summary') {
        main.innerHTML = `<div class="space-y-6"><h2 class="text-2xl font-black uppercase text-purple-700 italic">Analytics Ledger</h2><div class="bg-white p-6 rounded-[24px] shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 no-print"><input type="text" id="fClient" oninput="updateSummaryFilter()" placeholder="Filter Client..." class="p-3 border rounded-xl bg-slate-50 text-xs font-bold"><select id="fItem" onchange="updateSummaryFilter()" class="p-3 border rounded-xl bg-white text-xs font-black"><option value="">All Items</option>${items.map(i => `<option value="${i.code}">${i.code}</option>`).join('')}</select><select id="fMonth" onchange="updateSummaryFilter()" class="p-3 border rounded-xl bg-white text-xs"><option value="">All Months</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}">${new Date(0,i).toLocaleString('en',{month:'long'})}</option>`).join('')}</select><select id="fYear" onchange="updateSummaryFilter()" class="p-3 border rounded-xl bg-white text-xs"><option value="">2025</option><option value="2026">2026</option></select><button onclick="window.print()" class="bg-slate-900 text-white rounded-xl font-bold uppercase text-[10px]">Print Report</button></div><div class="bg-white rounded-[24px] border overflow-hidden shadow-sm"><table class="w-full text-left"><thead class="bg-purple-50 text-[10px] uppercase text-purple-400 border-b"><tr><th class="p-4">Date</th><th class="p-4">Client</th><th class="p-4">PO/DR</th><th class="p-4">Item</th><th class="p-4 text-right">Qty</th></tr></thead><tbody id="summaryBody"></tbody><tfoot id="summaryFooter"></tfoot></table></div></div>`;
        renderSummaryData();
    }
}
