const $ = (id) => document.getElementById(id);
const forms = { login: $('login'), register: $('register') };
const text = {
  login: ['Selamat datang kembali', 'Masuk untuk melanjutkan'],
  register: ['Buat akun baru', 'Isi data untuk mulai']
};

function switchTo(name) {
  for (const k in forms) {
    forms[k].classList.toggle('hidden', k !== name);
    $('tab-' + k).className = 'py-2 rounded-md ' + (k === name ? 'bg-white shadow text-slate-800' : 'text-slate-500');
  }
  $('title').textContent = text[name][0];
  $('subtitle').textContent = text[name][1];
  $('msg').classList.add('hidden');
}
$('tab-login').onclick = () => switchTo('login');
$('tab-register').onclick = () => switchTo('register');

document.querySelectorAll('.toggle').forEach((b) => {
  b.onclick = () => {
    const input = b.previousElementSibling;
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    b.textContent = hidden ? 'Sembunyi' : 'Lihat';
  };
});

function setError(input, message) {
  const err = input.parentElement.classList.contains('relative')
    ? input.parentElement.nextElementSibling
    : input.nextElementSibling;
  if (err) err.textContent = message || '';
  input.classList.toggle('border-red-500', !!message);
  return !message;
}

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

forms.login.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const ok = [
    setError(f.email, emailOk(f.email.value.trim()) ? '' : 'Email tidak valid'),
    setError(f.password, f.password.value ? '' : 'Password wajib diisi')
  ];
  if (ok.every(Boolean)) {
    // TODO: kirim ke API login
    $('msg').textContent = 'Login valid (belum terhubung ke backend)';
    $('msg').classList.remove('hidden');
  }
});

forms.register.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const ok = [
    setError(f.nama, f.nama.value.trim().length >= 2 ? '' : 'Nama minimal 2 karakter'),
    setError(f.email, emailOk(f.email.value.trim()) ? '' : 'Email tidak valid'),
    setError(f.password, f.password.value.length >= 8 ? '' : 'Password minimal 8 karakter'),
    setError(f.konfirmasi, f.konfirmasi.value === f.password.value && f.konfirmasi.value ? '' : 'Password tidak sama')
  ];
  if (ok.every(Boolean)) {
    // TODO: kirim ke API register
    $('msg').textContent = 'Register valid (belum terhubung ke backend)';
    $('msg').classList.remove('hidden');
  }
});