const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';

function apiCall(action, params) {
  const payload = Object.assign({ action: action }, params || {});
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); });
}

document.addEventListener('DOMContentLoaded', function() {
  const activeSiswa = localStorage.getItem('active_siswa');
  if (activeSiswa) window.top.location.href = 'dashboard-siswa.html';
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
    html += '<div class="jurusan-card-radio"><input type="radio" name="jurusan" id="' + j.id + '" value="' + j.name + suffix + '" ' + isChecked + '><label for="' + j.id + '" class="jurusan-card-label"><i class="fa-solid ' + j.icon + '"></i><div><span class="fw-bold d-block" style="font-size:0.85rem;color:#fff;">' + j.code + suffix + '</span><span style="font-size:0.65rem;color:rgba(255,255,255,0.6);">' + j.name + '</span></div></label></div>';
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
    password: document.getElementById('regPassword').value.trim()
  };

  const kodeUnik = document.getElementById('regKodeUnik').value.trim();
  if (kodeUnik !== 'SISWAAVC2026' && kodeUnik !== 'AVC2026') {
    Swal.fire({ icon: 'error', title: 'Kode Unik Salah!', text: 'Gunakan SISWAAVC2026', confirmButtonColor: '#3b82f6' });
    return;
  }

  Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  apiCall('registerSiswa', { data: dataSiswaBaru })
  .then(function(result) {
    if (result.status === 'success') {
      Swal.fire({ icon: 'success', title: 'Pendaftaran Berhasil!', timer: 1500, showConfirmButton: false })
        .then(() => { switchForm('login'); });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  });
}

function handleLogin(e) {
  e.preventDefault();
  const nisn = document.getElementById('loginNisn').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  Swal.fire({ title: 'Memeriksa Akun...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  apiCall('loginSiswa', { nisn: nisn, password: password })
  .then(function(result) {
    if (result.status === 'success') {
      localStorage.setItem('active_siswa', JSON.stringify(result.data));
      Swal.fire({ icon: 'success', title: 'Login Berhasil!', timer: 1200, showConfirmButton: false })
        .then(() => { window.top.location.href = 'dashboard-siswa.html'; });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Login', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  });
}

function forgotPasswordOTP() {
  Swal.fire({ title: 'Lupa Password?', text: 'Hubungi admin sekolah.', icon: 'info', confirmButtonColor: '#2563eb' });
}
