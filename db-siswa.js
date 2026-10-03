const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';
let currentSiswa = null;

function apiCall(action, params) {
  const payload = Object.assign({ action: action }, params || {});
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); });
}

document.addEventListener('DOMContentLoaded', function() {
  const sessionData = localStorage.getItem('active_siswa');
  if (!sessionData) {
    Swal.fire({ icon: 'warning', title: 'Akses Ditolak!', text: 'Silakan login dulu.', confirmButtonColor: '#2563eb' })
      .then(() => { window.top.location.href = 'auth-siswa.html'; });
    return;
  }
  currentSiswa = JSON.parse(sessionData);
  populateSiswaData(currentSiswa);
  initAbsenPage(); renderTugasSiswa(); renderNilaiSiswa(); updateStatOverview();
  syncBackground();
});

function syncBackground() {
  if (!currentSiswa) return;
  apiCall('getDataForSiswa', { nisn: currentSiswa.nisn })
    .then(function(bundle) {
      if (!bundle) return;
      localStorage.setItem('database_siswa', JSON.stringify(bundle.siswa || []));
      localStorage.setItem('database_guru', JSON.stringify(bundle.guru || []));
      localStorage.setItem('database_tugas', JSON.stringify(bundle.tugas || []));
      localStorage.setItem('database_absensi', JSON.stringify(bundle.absensi || []));
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(bundle.pengumpulan || []));
      initAbsenPage(); renderTugasSiswa(); renderNilaiSiswa(); updateStatOverview();
    })
    .catch(function(err) { console.error('Sync error:', err); });
}

function populateSiswaData(siswa) {
  if (!siswa) return;
  const nama = siswa.nama || 'Siswa';
  document.querySelectorAll('.val-nama-siswa').forEach(el => el.textContent = nama);
  const el1 = document.getElementById('valNisn'); if (el1) el1.textContent = siswa.nisn || '-';
  const el2 = document.getElementById('valNisnDetail'); if (el2) el2.textContent = siswa.nisn || '-';
  const el3 = document.getElementById('valKelas'); if (el3) el3.textContent = siswa.kelas || '-';
  const el4 = document.getElementById('lblKelasTugasSiswa'); if (el4) el4.textContent = siswa.kelas || '-';
  const el5 = document.getElementById('valJalur'); if (el5) el5.textContent = siswa.jurusan || '-';
  const el6 = document.getElementById('valJalurDetail'); if (el6) el6.textContent = siswa.jurusan || '-';
  const el7 = document.getElementById('valAyah'); if (el7) el7.textContent = siswa.namaAyah || '-';
  const el8 = document.getElementById('valIbu'); if (el8) el8.textContent = siswa.namaIbu || '-';
  const el9 = document.getElementById('valHp'); if (el9) el9.textContent = siswa.hp || '-';
  const words = nama.trim().split(' ');
  let ini = words.length >= 2 ? words[0][0] + words[1][0] : words[0].substring(0, 2);
  const av = document.getElementById('avatarInisial'); if (av) av.textContent = ini.toUpperCase() || 'SA';
}

function initAbsenPage() {
  const inputTgl = document.getElementById('tglAbsenSiswa');
  if (inputTgl && !inputTgl.value) inputTgl.value = new Date().toISOString().split('T')[0];
  const selectGuru = document.getElementById('selectGuruAbsen');
  if (!selectGuru) return;
  const dbGuru = JSON.parse(localStorage.getItem('database_guru')) || [];
  const statG = document.getElementById('statGuruAktif'); if (statG) statG.textContent = dbGuru.length;
  if (dbGuru.length === 0) {
    selectGuru.innerHTML = '<option value="">-- Belum ada Guru --</option>';
    renderRiwayatAbsen(); return;
  }
  let h = '<option value="">-- Pilih Guru & Mapel --</option>';
  dbGuru.forEach(g => {
    const mu = (g.mapelUmum && g.mapelUmum !== '-') ? g.mapelUmum : '';
    const mk = (g.mapelKejuruan && g.mapelKejuruan !== '-') ? g.mapelKejuruan : '';
    let mapel = mu && mk ? mu + ' | ' + mk : (mu || mk || 'Umum');
    h += '<option value="' + g.nama + '||' + mapel + '">' + g.nama + ' — ' + mapel + '</option>';
  });
  selectGuru.innerHTML = h;
  renderRiwayatAbsen();
}

function kirimAbsensiSiswa() {
  if (!currentSiswa) return;
  const s = document.getElementById('selectGuruAbsen').value;
  const tgl = document.getElementById('tglAbsenSiswa').value;
  const st = document.querySelector('input[name="statusAbsen"]:checked').value;
  if (!s) { Swal.fire({ icon: 'warning', title: 'Pilih Guru/Mapel dulu' }); return; }
  if (!tgl) { Swal.fire({ icon: 'warning', title: 'Pilih tanggal dulu' }); return; }
  const parts = s.split('||');
  const dataAbsen = {
    nisn: currentSiswa.nisn, namaSiswa: currentSiswa.nama, kelas: currentSiswa.kelas,
    guru: parts[0], mapel: parts[1], tanggal: tgl, status: st,
    waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };
  let dbAbsen = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const idx = dbAbsen.findIndex(a => String(a.nisn) === String(dataAbsen.nisn) && String(a.tanggal) === String(tgl) && String(a.guru) === String(dataAbsen.guru));
  if (idx !== -1) dbAbsen[idx] = dataAbsen; else dbAbsen.unshift(dataAbsen);
  localStorage.setItem('database_absensi', JSON.stringify(dbAbsen));
  apiCall('saveAbsensi', { data: dataAbsen });
  Swal.fire({ icon: 'success', title: 'Presensi Terkirim!', timer: 1200, showConfirmButton: false });
  renderRiwayatAbsen(); updateStatOverview();
}

function renderRiwayatAbsen() {
  const tbody = document.getElementById('tbodyRiwayatAbsen');
  if (!tbody || !currentSiswa) return;
  const dbAbsen = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const riwayat = dbAbsen.filter(a => String(a.nisn) === String(currentSiswa.nisn));
  if (riwayat.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Belum ada.</td></tr>'; return; }
  let h = '';
  riwayat.forEach(item => {
    const col = item.status === 'Hadir' ? 'var(--emerald)' : (item.status === 'Izin' ? 'var(--gold)' : 'var(--danger)');
    h += '<tr><td><b>' + item.tanggal + '</b></td><td><b>' + (item.mapel || '-') + '</b><br><small>' + (item.guru || '-') + '</small></td><td><span style="font-weight:800;color:' + col + ';">' + item.status + '</span></td></tr>';
  });
  tbody.innerHTML = h;
}

function renderTugasSiswa() {
  const container = document.getElementById('containerDaftarTugasSiswa');
  if (!container || !currentSiswa) return;
  const dbTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = dbTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  if (tugasSiswa.length === 0) {
    container.innerHTML = '<div class="glass-card"><div class="empty-state"><i class="fa-solid fa-box-archive"></i><b>Belum Ada Tugas</b></div></div>';
    return;
  }
  let h = '';
  tugasSiswa.forEach(t => {
    const p = listPeng.find(x => String(x.tugasId) === String(t.id) && String(x.nisn) === String(currentSiswa.nisn));
    const sudah = !!p;
    const nilai = (p && p.nilai !== '' && p.nilai !== null) ? p.nilai : null;
    let badge = '';
    if (sudah && nilai !== null) badge = '<span style="background:rgba(16,185,129,.15);color:var(--emerald);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;">Dinilai (' + nilai + ')</span>';
    else if (sudah) badge = '<span style="background:rgba(37,99,235,.15);color:var(--royal);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;">Dikirim</span>';
    else badge = '<span style="background:rgba(239,68,68,.15);color:var(--danger);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;">Belum</span>';
    let filePreview = '';
    if (t.fileUrl) filePreview += '<div style="margin-top:6px;font-size:12px;"><i class="fa-solid fa-paperclip"></i> Lampiran Guru: <a href="' + t.fileUrl + '" target="_blank" style="color:#2563eb;">' + (t.fileName || 'File') + '</a></div>';
    if (sudah && p.fileUrl) filePreview += '<div style="margin-top:6px;font-size:12px;"><i class="fa-solid fa-paperclip"></i> Jawabanmu: <a href="' + p.fileUrl + '" target="_blank" style="color:#10b981;">' + (p.fileName || 'File') + '</a></div>';
    const judulEsc = String(t.judul).replace(/'/g, "\\'");
    h += '<div class="glass-card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><div><h3 style="margin:0 0 4px;font-size:16px;">' + t.judul + '</h3><span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-user-tie me-1"></i>' + (t.pembuatGuru || 'Guru') + '</span></div>' + badge + '</div><p style="font-size:13px;background:#f8fafc;padding:10px;border-radius:8px;margin:8px 0;">' + (t.deskripsi || '-') + '</p>' + filePreview + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:var(--text-muted);"><span><i class="fa-solid fa-calendar me-1"></i>' + t.deadlineTgl + ' (' + t.deadlineJam + ')</span><button class="btn-top-nav" style="background:var(--royal);color:#fff;border:none;padding:6px 14px;border-radius:8px;" onclick="kirimJawabanTugas(\'' + t.id + '\', \'' + judulEsc + '\')"><i class="fa-solid fa-paper-plane me-1"></i> ' + (sudah ? 'Edit' : 'Kirim') + '</button></div></div>';
  });
  container.innerHTML = h;
}

function kirimJawabanTugas(tugasId, judulTugas) {
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const pEksis = listPeng.find(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
  const isiLama = pEksis ? (pEksis.catatanAtauFile || '') : '';

  Swal.fire({
    title: 'Kirim Tugas',
    html: '<p style="font-size:13px;color:#475569;text-align:left;">' + judulTugas + '</p>' +
      '<textarea id="swCatatan" class="swal2-textarea" placeholder="Catatan (opsional)..." style="margin:0;">' + isiLama + '</textarea>' +
      '<div style="text-align:left;margin-top:12px;">' +
      '<label style="font-size:12px;font-weight:700;display:block;margin-bottom:6px;">📎 Upload File (maks 10MB):</label>' +
      '<input type="file" id="swFile" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
      '<div id="swFileInfo" style="font-size:11px;color:#64748b;margin-top:6px;"></div></div>',
    showCancelButton: true, confirmButtonText: 'Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb', width: 550,
    didOpen: () => {
      const fi = document.getElementById('swFile');
      fi.addEventListener('change', function() {
        const f = this.files[0]; const info = document.getElementById('swFileInfo');
        if (f) { const mb = (f.size / (1024 * 1024)).toFixed(2);
          if (f.size > 10 * 1024 * 1024) { info.textContent = '❌ ' + f.name + ' (' + mb + ' MB) terlalu besar!'; info.style.color = '#ef4444'; }
          else { info.textContent = '✅ ' + f.name + ' (' + mb + ' MB)'; info.style.color = '#10b981'; }
        }
      });
    }
  }).then((res) => {
    if (!res.isConfirmed) return;
    const catatan = document.getElementById('swCatatan').value.trim();
    const file = document.getElementById('swFile').files[0];
    if (file && file.size > 10 * 1024 * 1024) { Swal.fire({ icon: 'error', title: 'File terlalu besar!' }); return; }
    if (!catatan && !file && !pEksis) { Swal.fire({ icon: 'warning', title: 'Isi catatan atau upload file!' }); return; }

    Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const base64 = e.target.result.split(',')[1];
        apiCall('uploadFileToDrive', { base64Data: base64, fileName: file.name, mimeType: file.type || 'application/octet-stream', category: 'jawaban' })
          .then(function(up) {
            if (up.status === 'success') simpanPengumpulan(tugasId, catatan, up, pEksis);
            else Swal.fire({ icon: 'error', title: 'Upload gagal', text: up.message });
          })
          .catch(function(err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); });
      };
      reader.readAsDataURL(file);
    } else {
      simpanPengumpulan(tugasId, catatan, null, pEksis);
    }
  });
}

function simpanPengumpulan(tugasId, catatan, up, pEksis) {
  const waktu = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  const data = {
    tugasId: tugasId, nisn: currentSiswa.nisn, namaSiswa: currentSiswa.nama, waktu: waktu,
    catatanAtauFile: catatan || '',
    fileUrl: up ? up.fileUrl : (pEksis ? pEksis.fileUrl : ''),
    fileName: up ? up.fileName : (pEksis ? pEksis.fileName : ''),
    nilai: pEksis ? pEksis.nilai : ''
  };
  apiCall('savePengumpulan', { data: data })
    .then(function() {
      let list = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
      let idx = list.findIndex(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
      if (idx !== -1) list[idx] = data; else list.push(data);
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(list));
      Swal.fire({ icon: 'success', title: 'Terkirim!', timer: 1200, showConfirmButton: false });
      renderTugasSiswa(); renderNilaiSiswa(); updateStatOverview();
    })
    .catch(function(err) { Swal.fire({ icon: 'error', title: 'Gagal', text: err.message }); });
}

function renderNilaiSiswa() {
  const tbody = document.getElementById('tbodyNilaiSiswa');
  if (!tbody || !currentSiswa) return;
  const dbTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = dbTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  if (tugasSiswa.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Belum ada.</td></tr>'; return; }
  let h = '';
  tugasSiswa.forEach(t => {
    const p = listPeng.find(x => String(x.tugasId) === String(t.id) && String(x.nisn) === String(currentSiswa.nisn));
    const ada = p && p.nilai !== '' && p.nilai !== null;
    const badge = ada ? '<span style="color:var(--emerald);font-weight:700;">✓ Sudah</span>' : '<span style="color:var(--gold);font-weight:700;">⏳ Belum</span>';
    const nv = ada ? '<b style="color:var(--royal);">' + p.nilai + '</b>' : '-';
    h += '<tr><td><b>' + t.judul + '</b></td><td>' + (t.pembuatGuru || '-') + '</td><td>' + badge + '</td><td>' + nv + '</td></tr>';
  });
  tbody.innerHTML = h;
}

function updateStatOverview() {
  if (!currentSiswa) return;
  const dbAbsen = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const dbTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const myAbsen = dbAbsen.filter(a => String(a.nisn) === String(currentSiswa.nisn));
  const hadir = myAbsen.filter(a => a.status === 'Hadir').length;
  const persen = myAbsen.length > 0 ? Math.round((hadir / myAbsen.length) * 100) : 0;
  const el1 = document.getElementById('statPresensiBulan'); if (el1) el1.textContent = persen + '%';
  const tugasK = dbTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  let pending = 0, tot = 0, n = 0;
  tugasK.forEach(t => {
    const p = listPeng.find(x => String(x.tugasId) === String(t.id) && String(x.nisn) === String(currentSiswa.nisn));
    if (!p) pending++;
    if (p && p.nilai !== '' && p.nilai !== null) { tot += parseFloat(p.nilai); n++; }
  });
  const el2 = document.getElementById('statTugasPending'); if (el2) el2.textContent = pending;
  const el3 = document.getElementById('statRataNilai'); if (el3) el3.textContent = n > 0 ? (tot / n).toFixed(1) : '0.0';
}

function logoutSiswa() {
  Swal.fire({ title: 'Keluar?', icon: 'question', showCancelButton: true, confirmButtonColor: '#2563eb', cancelButtonColor: '#64748b', confirmButtonText: 'Ya', cancelButtonText: 'Batal' })
    .then((r) => { if (r.isConfirmed) { localStorage.removeItem('active_siswa'); window.top.location.href = 'index.html'; } });
}

function hapusAkunSiswa() {
  Swal.fire({
    title: 'Hapus Akun Permanen?',
    html: '<p style="font-size:14px;color:#475569;">Data yang akan dihapus:</p>' +
          '<ul style="text-align:left;font-size:13px;color:#0f172a;margin-top:8px;">' +
          '<li>✅ Akun siswa Anda</li>' +
          '<li>✅ Semua jawaban tugas yang Anda kirim</li>' +
          '<li>✅ Semua data absensi Anda</li>' +
          '</ul>' +
          '<p style="font-size:12px;color:#ef4444;margin-top:10px;">⚠️ Tindakan ini tidak dapat dibatalkan!</p>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus Semua',
    cancelButtonText: 'Batal'
  }).then((r) => {
    if (r.isConfirmed) {
      Swal.fire({ title: 'Menghapus semua data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      apiCall('deleteSiswa', { nisn: currentSiswa.nisn })
        .then(function(res) {
          if (res.status === 'success') {
            localStorage.removeItem('active_siswa');
            localStorage.removeItem('database_pengumpulan_tugas');
            localStorage.removeItem('database_absensi');

            Swal.fire({
              icon: 'success',
              title: 'Akun Terhapus!',
              text: res.message,
              confirmButtonColor: '#2563eb'
            }).then(() => { window.top.location.href = 'index.html'; });
          } else {
            Swal.fire({ icon: 'error', title: 'Gagal', text: res.message });
          }
        })
        .catch(function(err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); });
    }
  });
}

function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.bottom-tab').forEach(tab => tab.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
