const APP_SECRET_SALT = "GaramRahasiaEnkripta2026_!@#"; 

// --- NAVIGASI VIEW ---
function showApp() {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showHome() {
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('homeView').classList.remove('hidden');
    window.scrollTo(0, 0);
}

// --- MANAJEMEN UI ---
function switchTab(tab) {
    hideAlert();
    const isEnc = tab === 'encrypt';
    document.getElementById('tabEncrypt').classList.toggle('active', isEnc);
    document.getElementById('tabDecrypt').classList.toggle('active', !isEnc);
    
    const activeClass = "w-full rounded-xl py-2.5 text-sm font-bold transition-all bg-white shadow-sm text-slate-700";
    const inactiveClass = "w-full rounded-xl py-2.5 text-sm font-bold transition-all text-slate-500 hover:text-slate-700";
    
    document.getElementById('tabEncryptBtn').className = isEnc ? activeClass : inactiveClass;
    document.getElementById('tabDecryptBtn').className = !isEnc ? activeClass : inactiveClass;
}

function showAlert(message, isError = false) {
    const box = document.getElementById('alertBox');
    box.innerText = message;
    box.className = `mb-4 p-4 rounded-xl text-sm text-center font-bold border ${
        isError ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
    }`;
    box.style.display = 'block';
}

function hideAlert() { document.getElementById('alertBox').style.display = 'none'; }

// Tombol Batal & Reset
function resetInput(mode) {
    if(mode === 'encrypt') {
        document.getElementById('fileEncrypt').value = "";
        document.getElementById('fileInfoEncrypt').classList.add('hidden');
        document.getElementById('dropZoneEncrypt').classList.remove('hidden');
        document.getElementById('passEncrypt').value = "";
    } else {
        document.getElementById('fileDecrypt').value = "";
        document.getElementById('fileInfoDecrypt').classList.add('hidden');
        document.getElementById('dropZoneDecrypt').classList.remove('hidden');
        document.getElementById('passDecrypt').value = "";
    }
    hideAlert();
}

// Handler Tipe Input (File vs Folder)
const typeRadios = document.querySelectorAll('input[name="encType"]');
typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const input = document.getElementById('fileEncrypt');
        const text = document.getElementById('dropText');
        resetInput('encrypt');
        if (e.target.value === 'folder') {
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            text.innerText = "Pilih Folder untuk dienkripsi";
        } else {
            input.removeAttribute('webkitdirectory');
            input.removeAttribute('directory');
            text.innerText = "Pilih File untuk dienkripsi";
        }
    });
});

// Info Display
document.getElementById('fileEncrypt').addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        document.getElementById('dropZoneEncrypt').classList.add('hidden');
        document.getElementById('fileInfoEncrypt').classList.remove('hidden');
        const isFolder = document.querySelector('input[name="encType"]:checked').value === 'folder';
        const name = isFolder ? e.target.files[0].webkitRelativePath.split('/')[0] : e.target.files[0].name;
        document.getElementById('fileNameDisplay').innerText = (isFolder ? "📁 " : "📄 ") + name;
    }
});

document.getElementById('fileDecrypt').addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        document.getElementById('dropZoneDecrypt').classList.add('hidden');
        document.getElementById('fileInfoDecrypt').classList.remove('hidden');
        document.getElementById('vaultNameDisplay').innerText = "🔒 " + e.target.files[0].name;
    }
});

// --- KRIPTOGRAFI LOGIC ---
async function deriveKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode(APP_SECRET_SALT), iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

// Proyeksi Enkripsi (File/Folder)
document.getElementById('btnEncrypt').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileEncrypt');
    const passInput = document.getElementById('passEncrypt');
    if (!fileInput.files.length || !passInput.value) return showAlert("⚠️ Lengkapi data!", true);

    showAlert("Memproses enkripsi...");
    try {
        const files = fileInput.files;
        let dataToEncrypt;
        let outputName;

        if (files.length > 1 || document.querySelector('input[name="encType"]:checked').value === 'folder') {
            const zip = new JSZip();
            for (let f of files) zip.file(f.webkitRelativePath || f.name, f);
            dataToEncrypt = await zip.generateAsync({ type: "arraybuffer" });
            outputName = (files[0].webkitRelativePath.split('/')[0] || "vault") + ".vault";
        } else {
            dataToEncrypt = await files[0].arrayBuffer();
            outputName = files[0].name + ".vault";
        }

        const key = await deriveKey(passInput.value);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, dataToEncrypt);
        
        const blob = new Blob([iv, encrypted], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = outputName; a.click();

        showAlert("✅ Berhasil! Data di layar telah dibersihkan demi keamanan.");
        resetInput('encrypt'); // "Hapus" data dari layar
    } catch (e) { showAlert("❌ Gagal enkripsi.", true); }
});

// Dekripsi
document.getElementById('btnDecrypt').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileDecrypt');
    const passInput = document.getElementById('passDecrypt');
    if (!fileInput.files.length || !passInput.value) return showAlert("⚠️ Lengkapi data!", true);

    showAlert("Mencoba membuka vault...");
    try {
        const buf = await fileInput.files[0].arrayBuffer();
        const iv = buf.slice(0, 12);
        const data = buf.slice(12);
        const key = await deriveKey(passInput.value);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, data);
        
        let originalName = fileInput.files[0].name.replace(".vault", "");
        let blobType = 'application/octet-stream';
        
        const header = new Uint8Array(decrypted.slice(0, 4));
        const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
        
        if (isZip && !originalName.endsWith('.zip')) {
            originalName += ".zip";
            blobType = 'application/zip';
        }

        const blob = new Blob([decrypted], { type: blobType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "decrypted_" + originalName;
        a.click();

        showAlert("✅ Vault terbuka! Data layar dibersihkan.");
        resetInput('decrypt');
    } catch (e) { 
        showAlert("❌ Password salah atau file rusak!", true); 
    }
});