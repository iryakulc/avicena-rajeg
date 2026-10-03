const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';
const KODE_RAHASIA_GURU = "GURUAVC2026";

function apiCall(action, params) {
  const payload = Object.assign({ action: action }, params || {});
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); });
}

document.addEventListener('DOMContentLoaded', function() {
  const activeGuru = localStorage.getItem('active_guru');
  if (activeGuru) window.top.location.href = 'dashboard-guru.html';
});

function switchForm(target) {
  if (target === 'signup') {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('signupBox').style.display = 'block';
  } else {
    document.getElementById('signupBox').style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
  }
}

function handleSignupGuru(e) {
  e.preventDefault();
  const nama = document.getElementById('regNama').value.trim();
  const hp = document.getElementById('regHp').value.trim();
  const pass = document.getElementById('regPassword').value.trim();
  const inputKode = document.getElementById('regKodeUnik').value.trim().toUpperCase();

  if (inputKode !== KODE_RAHASIA_GURU) {
    Swal.fire({ icon: 'error', title: 'Kode Unik Guru Salah!', confirmButtonColor: '#ef4444' });
    return;
  }

  const muChecked = Array.from(document.querySelectorAll('input[name="mapelUmum"]:checked')).map(cb => cb.value);
  const mapelUmumStr = muChecked.length > 0 ? muChecked.join(', ') : '-';
  const mkChecked = Array.from(document.querySelectorAll('input[name="mapelKejuruan"]:checked')).map(cb => cb.value);
  const mapelKejuruanStr = mkChecked.length > 0 ? mkChecked.join(', ') : '-';

  if (mkChecked.length === 0) {
    Swal.fire({ icon: 'warning', title: 'Pilih Mapel Kejuruan!', text: 'Pilih minimal 1.', confirmButtonColor: '#f59e0b' });
    return;
  }

  Swal.fire({ title: 'Mendaftarkan Guru...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  apiCall('registerGuru', {
    data: { nama: nama, hp: hp, mapelUmum: mapelUmumStr, mapelKejuruan: mapelKejuruanStr, password: pass }
  })
  .then(function(result) {
    if (result.status === 'success') {
      Swal.fire({ icon: 'success', title: 'Pendaftaran Berhasil!', text: 'Silakan login.', confirmButtonColor: '#10b981' })
        .then(() => {
          switchForm('login');
          document.getElementById('loginNama').value = nama;
        });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Daftar', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  });
}

function handleLoginGuru(e) {
  e.preventDefault();
  const namaOrHp = document.getElementById('loginNama').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  Swal.fire({ title: 'Memeriksa Akun...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  apiCall('loginGuru', { username: namaOrHp, password: password })
  .then(function(result) {
    if (result.status === 'success') {
      localStorage.setItem('active_guru', JSON.stringify(result.data));
      Swal.fire({ icon: 'success', title: 'Login Berhasil!', text: 'Selamat datang, ' + result.data.nama, timer: 1200, showConfirmButton: false })
        .then(() => { window.top.location.href = 'dashboard-guru.html'; });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Masuk', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  });
}

function forgotPasswordOTPGuru() {
  Swal.fire({ title: 'Lupa Password?', text: 'Hubungi admin sekolah.', icon: 'info', confirmButtonColor: '#2563eb' });
}
