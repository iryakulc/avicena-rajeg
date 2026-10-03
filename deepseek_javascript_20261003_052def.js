const API_URL = 'https://script.google.com/macros/s/AKfycbwINKMgUmWZ4T-nRqOvsoMog0uwdEbkXLmddb15meQhl4fvP-miHryRLQ22sQj5_c2b0A/exec';
const KODE_RAHASIA_GURU = "GURUAVC2026";

document.addEventListener('DOMContentLoaded', function() {
  const activeGuru = localStorage.getItem('active_guru');
  if (activeGuru) {
    window.location.href = 'dashboard-guru.html';
  }
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

// Helper: kirim POST ke Apps Script
function callAPI(payload) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(res) { return res.json(); });
}

// HANDLER REGISTRASI GURU
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

  const mapelUmumChecked = Array.from(document.querySelectorAll('input[name="mapelUmum"]:checked')).map(cb => cb.value);
  const mapelUmumStr = mapelUmumChecked.length > 0 ? mapelUmumChecked.join(', ') : '-';

  const mapelKejuruanChecked = Array.from(document.querySelectorAll('input[name="mapelKejuruan"]:checked')).map(cb => cb.value);
  const mapelKejuruanStr = mapelKejuruanChecked.length > 0 ? mapelKejuruanChecked.join(', ') : '-';

  Swal.fire({ title: 'Mendaftarkan Guru...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  callAPI({
    action: 'register_guru',
    nama: nama,
    hp: hp,
    mapelUmum: mapelUmumStr,
    mapelKejuruan: mapelKejuruanStr,
    password: pass
  })
  .then(function(result) {
    if (result.status === 'success') {
      Swal.fire({
        icon: 'success',
        title: 'Pendaftaran Guru Berhasil!',
        text: 'Selamat datang ' + nama + '. Silakan login sekarang.',
        confirmButtonColor: '#10b981'
      }).then(() => {
        switchForm('login');
        document.getElementById('loginNama').value = nama;
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Daftar Guru', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server: ' + err.message });
  });
}

// HANDLER LOGIN GURU
function handleLoginGuru(e) {
  e.preventDefault();
  const namaOrHp = document.getElementById('loginNama').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  Swal.fire({ title: 'Memeriksa Akun...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  callAPI({
    action: 'login_guru',
    username: namaOrHp,
    password: password
  })
  .then(function(result) {
    if (result.status === 'success') {
      localStorage.setItem('active_guru', JSON.stringify(result.data));
      Swal.fire({
        icon: 'success',
        title: 'Login Berhasil!',
        text: 'Selamat datang kembali, ' + result.data.nama,
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        window.location.href = 'dashboard-guru.html';
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Masuk', text: result.message });
    }
  })
  .catch(function(err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server: ' + err.message });
  });
}

// LUPA PASSWORD (LOKAL)
function forgotPasswordOTPGuru() {
  Swal.fire({
    title: 'Lupa Password Guru?',
    text: 'Masukkan No. WA atau Nama Lengkap Anda:',
    input: 'text',
    inputPlaceholder: 'Contoh: 081234567890 atau Budi, S.Pd.',
    showCancelButton: true,
    confirmButtonText: 'Cari Akun',
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
        confirmButtonText: 'Verifikasi',
        confirmButtonColor: '#10b981'
      }).then((otpResult) => {
        if (otpResult.isConfirmed && otpResult.value == otp) {
          Swal.fire({
            icon: 'info',
            title: 'Hubungi Admin',
            text: 'Silakan hubungi admin sekolah untuk reset password akun guru Anda.',
            confirmButtonColor: '#2563eb'
          });
        }
      });
    }
  });
}