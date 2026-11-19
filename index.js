const $ = (id) => document.getElementById(id);

// ── Format Rupiah ─────────────────────────────────────────────────────────────
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const m = $(id);
  m.classList.remove('hidden');
  m.style.display = 'flex';
}
function closeModal(id) {
  const m = $(id);
  m.classList.add('hidden');
  m.style.display = '';
}
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.onclick = () => closeModal(btn.dataset.close);
});

// ── State ─────────────────────────────────────────────────────────────────────
let jenisTrx = 'setor';
let kategoriList = [];
let targetList = [];

// ── Load Ringkasan ─────────────────────────────────────────────────────────────
async function loadRingkasan() {
  try {
    const r = await fetch('/api/ringkasan');
    const d = await r.json();
    $('saldo').textContent = rp(d.saldo);
    $('setor').textContent = rp(d.total_setor);
    $('tarik').textContent = rp(d.total_tarik);
  } catch (e) { console.error('ringkasan:', e); }
}

// ── Load Transaksi ─────────────────────────────────────────────────────────────
async function loadTransaksi() {
  try {
    const r = await fetch('/api/transaksi');
    const data = await r.json();
    const tbody = $('riwayat');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-400">Belum ada transaksi</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(t => `
      <tr class="border-b border-slate-100 dark:border-slate-700">
        <td class="py-2 pr-2">${t.tanggal}</td>
        <td class="py-2 pr-2">
          <span class="px-2 py-0.5 rounded text-xs font-medium ${t.jenis === 'setor' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
            ${t.jenis}
          </span>
        </td>
        <td class="py-2 pr-2">${t.nama_kategori || '-'}</td>
        <td class="py-2 pr-2">${t.nama_target || '-'}</td>
        <td class="py-2 pr-2">${t.sumber_rekening || '-'}</td>
        <td class="py-2 pr-2 font-medium">${rp(t.jumlah)}</td>
        <td class="py-2">
          <button onclick="hapusTrx(${t.id_transaksi})" class="text-red-400 hover:text-red-600 text-xs">Hapus</button>
        </td>
      </tr>
    `).join('');
  } catch (e) { console.error('transaksi:', e); }
}

// ── Load Target ───────────────────────────────────────────────────────────────
async function loadTarget() {
  try {
    const r = await fetch('/api/target');
    targetList = await r.json();
    const container = $('targets');
    if (!targetList.length) {
      container.innerHTML = '<p class="text-slate-400 text-sm">Belum ada target</p>';
    } else {
      container.innerHTML = targetList.map(t => {
        const terkumpul = Number(t.terkumpul) || 0;
        const targetDana = Number(t.target_dana) || 1;
        const rawPct = (terkumpul / targetDana) * 100;
        const pctDisplay = rawPct > 0 && rawPct < 1 ? rawPct.toFixed(2) : Math.round(rawPct);
        const barWidth = terkumpul > 0 ? Math.max(3, Math.min(100, rawPct)) : 0;

        return `
          <div class="mb-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80">
            <div class="flex justify-between items-center text-sm mb-1">
              <span class="font-semibold text-slate-800 dark:text-white">${t.nama_target}</span>
              <div class="flex items-center gap-2">
                <button onclick="setorKeTarget(${t.id_target})" class="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium">+ Isi Dana</button>
                <button onclick="hapusTarget(${t.id_target})" class="text-red-400 hover:text-red-600 text-xs">Hapus</button>
              </div>
            </div>
            <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span class="font-medium text-indigo-600 dark:text-indigo-400">${rp(terkumpul)}</span>
              <span>Target: ${rp(targetDana)}</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div class="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500" style="width:${barWidth}%"></div>
            </div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 text-right">${pctDisplay}%</p>
          </div>
        `;
      }).join('');
    }
    // Update dropdown target di modal transaksi
    const sel = $('target');
    sel.innerHTML = '<option value="">-- Tanpa Target --</option>' +
      targetList.map(t => `<option value="${t.id_target}">${t.nama_target}</option>`).join('');
  } catch (e) { console.error('target:', e); }
}

function setorKeTarget(id) {
  $('tanggal').value = new Date().toISOString().slice(0, 10);
  setJenis('setor');
  openModal('mTrx');
  $('target').value = id;
}

// ── Load Kategori ─────────────────────────────────────────────────────────────
async function loadKategori() {
  try {
    const r = await fetch('/api/kategori');
    kategoriList = await r.json();
    const sel = $('kategori');
    sel.innerHTML = kategoriList.map(k =>
      `<option value="${k.id_kategori}">${k.nama_kategori}</option>`
    ).join('');
  } catch (e) { console.error('kategori:', e); }
}

// ── Hapus Transaksi ───────────────────────────────────────────────────────────
async function hapusTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  await fetch('/api/transaksi/' + id, { method: 'DELETE' });
  loadAll();
}

// ── Hapus Target ──────────────────────────────────────────────────────────────
async function hapusTarget(id) {
  if (!confirm('Hapus target ini?')) return;
  await fetch('/api/target/' + id, { method: 'DELETE' });
  loadTarget();
}

// ── Load All ──────────────────────────────────────────────────────────────────
function loadAll() {
  loadRingkasan();
  loadTransaksi();
  loadTarget();
  loadKategori();
}

// ── Button + Transaksi ────────────────────────────────────────────────────────
$('btnTrx').onclick = () => {
  // Set tanggal hari ini
  $('tanggal').value = new Date().toISOString().slice(0, 10);
  setJenis('setor');
  openModal('mTrx');
};

// ── Jenis Setor / Tarik ───────────────────────────────────────────────────────
function setJenis(j) {
  jenisTrx = j;
  $('bSetor').className = 'flex-1 py-2 rounded-lg text-sm font-medium ' +
    (j === 'setor' ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300');
  $('bTarik').className = 'flex-1 py-2 rounded-lg text-sm font-medium ' +
    (j === 'Tarik' ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300');
}
$('bSetor').onclick = () => setJenis('setor');
$('bTarik').onclick = () => setJenis('Tarik');

// ── Tambah Kategori Baru ──────────────────────────────────────────────────────
$('addKat').onclick = async () => {
  const nama = prompt('Nama kategori baru:');
  if (!nama) return;
  const r = await fetch('/api/kategori', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_kategori: nama })
  });
  if (r.ok) await loadKategori();
};

// ── Simpan Transaksi ──────────────────────────────────────────────────────────
$('simpan').onclick = async () => {
  const tanggal = $('tanggal').value;
  const id_kategori = $('kategori').value;
  const id_target = $('target').value || null;
  const jumlah = $('jumlah').value;
  const sumber_rekening = $('rekening').value;
  const catatan = $('catatan').value;

  if (!tanggal || !id_kategori || !jumlah) {
    alert('Tanggal, kategori, dan jumlah wajib diisi!');
    return;
  }

  const r = await fetch('/api/transaksi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tanggal, jenis: jenisTrx, id_kategori, id_target, jumlah, sumber_rekening, catatan })
  });
  if (r.ok) {
    closeModal('mTrx');
    // Reset form
    $('jumlah').value = '';
    $('rekening').value = '';
    $('catatan').value = '';
    loadAll();
  } else {
    const d = await r.json();
    alert(d.error || 'Gagal menyimpan transaksi');
  }
};

// ── Button + Target ───────────────────────────────────────────────────────────
$('btnTarget').onclick = () => openModal('mTarget');

$('tSimpan').onclick = async () => {
  const nama_target = $('tNama').value.trim();
  const target_dana = $('tDana').value;
  if (!nama_target || !target_dana) {
    alert('Nama target dan dana wajib diisi!');
    return;
  }
  const r = await fetch('/api/target', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_target, target_dana })
  });
  if (r.ok) {
    closeModal('mTarget');
    $('tNama').value = '';
    $('tDana').value = '';
    loadTarget();
  } else {
    const d = await r.json();
    alert(d.error || 'Gagal menyimpan target');
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
loadAll();
