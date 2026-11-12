require('dotenv').config();
const express  = require('express');
const mysql    = require('mysql2/promise');
const path     = require('path');
const crypto   = require('crypto');

// Helper hash password sederhana (SHA-256)
const hashPassword = (pw) => crypto.createHash('sha256').update(pw).digest('hex');

const app = express();
app.use(express.json());

// Landing page sebagai halaman utama
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
// Aplikasi utama
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use(express.static(path.join(__dirname)));

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Ringkasan ────────────────────────────────────────────────────────────────
app.get('/api/ringkasan', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) AS total_setor,
        COALESCE(SUM(CASE WHEN jenis = 'Tarik' THEN jumlah ELSE 0 END), 0) AS total_tarik,
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah
                          WHEN jenis = 'Tarik' THEN -jumlah ELSE 0 END), 0) AS saldo
      FROM transaksi
    `);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Kategori ─────────────────────────────────────────────────────────────────
app.get('/api/kategori', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM kategori ORDER BY nama_kategori');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/kategori', async (req, res) => {
  try {
    const { nama_kategori } = req.body;
    if (!nama_kategori) return res.status(400).json({ error: 'nama_kategori wajib diisi' });
    const [result] = await pool.query(
      'INSERT INTO kategori (nama_kategori) VALUES (?)', [nama_kategori]
    );
    res.status(201).json({ id_kategori: result.insertId, nama_kategori });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Target ────────────────────────────────────────────────────────────────────
app.get('/api/target', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*,
        COALESCE((
          SELECT SUM(jumlah) FROM transaksi
          WHERE id_target = t.id_target AND jenis = 'setor'
        ), 0) AS terkumpul
      FROM target_tabungan t
      ORDER BY t.id_target
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/target', async (req, res) => {
  try {
    const { nama_target, target_dana } = req.body;
    if (!nama_target || !target_dana) return res.status(400).json({ error: 'nama_target dan target_dana wajib diisi' });
    const [result] = await pool.query(
      'INSERT INTO target_tabungan (nama_target, target_dana) VALUES (?, ?)',
      [nama_target, target_dana]
    );
    res.status(201).json({ id_target: result.insertId, nama_target, target_dana });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/target/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM target_tabungan WHERE id_target = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transaksi ─────────────────────────────────────────────────────────────────
app.get('/api/transaksi', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT tr.*, k.nama_kategori, tg.nama_target
      FROM transaksi tr
      LEFT JOIN kategori       k  ON k.id_kategori = tr.id_kategori
      LEFT JOIN target_tabungan tg ON tg.id_target  = tr.id_target
      ORDER BY tr.tanggal DESC, tr.id_transaksi DESC
    `);
    // Format tanggal ke YYYY-MM-DD
    res.json(rows.map(r => ({ ...r, tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().slice(0,10) : r.tanggal })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transaksi', async (req, res) => {
  try {
    const { tanggal, jenis, id_kategori, id_target, jumlah, sumber_rekening, catatan } = req.body;
    if (!tanggal || !jenis || !id_kategori || !jumlah)
      return res.status(400).json({ error: 'tanggal, jenis, id_kategori, dan jumlah wajib diisi' });
    const [result] = await pool.query(
      `INSERT INTO transaksi (tanggal, jenis, id_kategori, id_target, jumlah, sumber_rekening, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tanggal, jenis, id_kategori, id_target || null, jumlah, sumber_rekening || null, catatan || null]
    );
    res.status(201).json({ id_transaksi: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transaksi/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transaksi WHERE id_transaksi = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
// Buat tabel users jika belum ada
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id_user   INT AUTO_INCREMENT PRIMARY KEY,
    nama      VARCHAR(100) NOT NULL,
    username  VARCHAR(100) NOT NULL UNIQUE,
    password  VARCHAR(64)  NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(e => console.error('Gagal buat tabel users:', e.message));

app.post('/api/register', async (req, res) => {
  try {
    const { nama, username, password } = req.body;
    if (!nama || !username || !password)
      return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password minimal 6 karakter' });

    const hashed = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (nama, username, password) VALUES (?, ?, ?)',
      [nama, username, hashed]
    );
    res.status(201).json({ id_user: result.insertId, nama, username });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Username sudah dipakai, coba yang lain' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username dan password wajib diisi' });

    const hashed = hashPassword(password);
    const [rows] = await pool.query(
      'SELECT id_user, nama, username FROM users WHERE username = ? AND password = ?',
      [username, hashed]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Username atau password salah' });

    res.json({ ok: true, user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`));
