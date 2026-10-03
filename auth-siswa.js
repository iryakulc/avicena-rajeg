const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';

document.addEventListener('DOMContentLoaded', function() {
  const activeSiswa = localStorage.getItem('active_siswa');
  if (activeSiswa) {
    window.location.href = 'dashboard-siswa.html';
  }
  renderJurusanGrid();
});

const dataJurusanReguler = [
  { id: 'j_tkj', code: 'TKJ', name: 'Teknik Komputer & Jaringan', icon: 'fa-network-wired' },
  { id: 'j_dkv', code: 'DKV', name: 'Desain Komunikasi Visual', icon: 'fa-palette' },
  { id: 'j_mp',  code: 'MP',  name: 'Manajemen Perkantoran', icon: 'fa-briefcase' },
  { id: 'j_akl', code: 'AKL', name: 'Akuntansi & Keuangan', icon: 'fa-calculator' },
  { id: 'j_tkr', code: 'TKR', name: 'Teknik Kendaraan Ringan', icon: 'fa-car' },
  { id: 'j_tbsm', code: 'TBSM', name: 'Teknik Sepeda Motor', icon: 'fa-motorcycle' }
];

const dataJurusanExcellent = [
  { id: 'j_tkj', code: 'TKJ', name: 'Teknik Komputer & Jaringan', icon: 'fa-network-wired' },
  { id: 'j_dkv', code: 'DKV', name: 'Desain Komunikasi Visual', icon: 'fa-palette' },
  { id: 'j_mp',  code: 'MP',  name: 'Manajemen Perkantoran', icon: 'fa-briefcase' }
];

function renderJurusanGrid() {
  const container = document.getElementById('jurusanGridContainer');
  if (!container) return;

  const jalurSelected = document.querySelector('input[name="jalur"]:checked')?.value || 'Reguler';
  const listJurusan = jalurSelected === 'Excellent' ? dataJurusanExcellent : dataJurusanReguler;
  let html = '';

  listJurusan.forEach((j, index) => {
    const isChecked = index === 0 ? 'checked' : '';
    const suffix = jalurSelected === 'Excellent' ? ' (+)' : '';

    html += '<div class="jurusan-card-radio">' +
      '<input type="radio" name="jurusan" id="' + j.id + '" value="' + j.name + suffix + '" ' + isChecked + '>' +
      '<label for="' + j.id + '" class="jurusan-card-label">' +
        '<i class="fa-solid ' + j.icon + '"></i>' +
        '<div>' +
          '<span class="fw-bold d-block" style="font-size:0.85rem;color:#fff;">' + j.code + suffix + '</span>' +
          '<span style="font-size:0.65rem;color:rgba(255,255,255,0.6);">' + j.name + '</span>' +
        '</div>' +
      '</label>' +
    '</div>';
  });
  container.innerHTML = html;
}

function switchForm(target) {
  if (target === 'signup') {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('signupBox').style.display = 'block';
    renderJurusanGrid();
  } else {
    document.getElementById('signupBox').style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
  }
}

function callAPI(payload) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(res) { return res.json(); });
}

// HANDLER REGISTRASI SISWA
function handleSignup(e) {
  e.preventDefault();

  const tingkat = document.querySelector('input[name="tingkat"]:checked')?.value || '10';
  const jalur = document.querySelector('input[name="jalur"]:checked')?.value || 'Reguler';
  const rombel = document.querySelector('input[name="rombel"]:checked')?.value || '1';
  const jalurSuffix = jalur === 'Excellent' ? '+' : ' ';
  const kelasLengkap = tingkat + ' TKJ' + jalurSuffix + rombel;

  const jurusanSelected = document.querySelector('input[name="jurusan"]:checked')?.value || 'Teknik Komputer & Jaringan';

  const dataSiswaBaru = {
    nama: document.getElementById('regNama').value.trim(),
    nisn: document.getElementById('regNisn').value.trim(),
    hp: document.getElementById('regHp').value.trim(),
    kelas: kelasLengkap,
    jurusan: jurusanSelected,
    namaAyah: document.getElementById('regAyah').value.trim(),
    namaIbu: document.getElementById('regIbu').value.trim(),
    password: document.getElementById('regPassword').value.trim(),
    kodeUnik: document.getElementById('regKodeUnik').value.trim()
  };

  if (dataSiswaBaru.kodeUnik !== 'SISWAAVC2026' && dataSiswaBaru.kodeUnik !== 'AVC2026') {
    Swal.fire({ icon: 'error', title: 'Kode Unik Salah!', text: 'Gunakan kode rahasia siswa resmi (Contoh: SISWAAVC2026)', confirmButtonColor: '#3b82f6' });
    return;
  }

  Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  callAPI(Object.assign({ action: 'register_siswa' }, dataSiswaBaru))
  .then(function(result) {
    if (result.status === 'success') {
      localStorage.setItem('active_siswa', JSON.stringify(dataSiswaBaru));
      Swal.fire({
        icon: 'success',
        title: 'Pendaftaran Berhasil!',
        text: 'Data Anda telah berhasil terdaftar di server.',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        window.location.href = 'dashboard-siswa.html';
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Pendaftaran Gagal', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Koneksi Server Gagal', text: err.message });
  });
}

// HANDLER LOGIN SISWA
function handleLogin(e) {
  e.preventDefault();
  const nisn = document.getElementById('loginNisn').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  Swal.fire({ title: 'Memeriksa Akun...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  callAPI({ action: 'login_siswa', nisn: nisn, password: password })
  .then(function(result) {
    if (result.status === 'success') {
      localStorage.setItem('active_siswa', JSON.stringify(result.data));
      Swal.fire({
        icon: 'success',
        title: 'Login Berhasil!',
        text: 'Mengalihkan ke dashboard...',
        timer: 1200,
        showConfirmButton: false
      }).then(() => {
        window.location.href = 'dashboard-siswa.html';
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Login', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error Koneksi', text: err.message });
  });
}

// LUPA PASSWORD (LOKAL)
function forgotPasswordOTP() {
  Swal.fire({
    title: 'Lupa Password Siswa?',
    text: 'Masukkan NISN Anda yang terdaftar:',
    input: 'number',
    inputPlaceholder: 'Masukkan 10 Digit NISN',
    showCancelButton: true,
    confirmButtonText: 'Verifikasi',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb'
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      let otp = Math.floor(1000 + Math.random() * 9000);
      Swal.fire({
        title: 'Verifikasi Kode OTP',
        html: 'Kode OTP verifikasi Anda: <b style="font-size: 1.5rem; color: #10b981;">' + otp + '</b><br><br>Masukkan kode OTP di atas:',
        input: 'number',
        inputPlaceholder: '4 Digit OTP',
        showCancelButton: true,
        confirmButtonText: 'Lanjutkan',
        confirmButtonColor: '#10b981'
      }).then((otpResult) => {
        if (otpResult.isConfirmed && otpResult.value == otp) {
          Swal.fire({ icon: 'info', title: 'Hubungi Admin', text: 'Silakan hubungi admin sekolah untuk reset password akun siswa Anda.', confirmButtonColor: '#2563eb' });
        } else if (otpResult.isConfirmed) {
          Swal.fire({ icon: 'error', title: 'OTP Salah!', text: 'Kode OTP yang Anda masukkan tidak sesuai.' });
        }
      });
    }
  });
}
