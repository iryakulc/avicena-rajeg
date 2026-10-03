const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';

let currentGuru = null;
let currentSelectedClass = null;
let currentSelectedStudent = null;
let selectedAbsenJalur = null, selectedAbsenTingkat = null, selectedAbsenKelasFix = null;
let selectedTugasJalur = null, selectedTugasTingkat = null, selectedTugasKelasFix = null;
let activeTugasDetailId = null;
let selectedNilaiJalur = null, selectedNilaiTingkat = null, selectedNilaiKelasFix = null;
let fileTugasBase64 = null, fileTugasName = null, fileTugasType = null;

function apiCall(action, params) {
  const payload = Object.assign({ action: action }, params || {});
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); });
}

document.addEventListener('DOMContentLoaded', function() {
  const sessionData = localStorage.getItem('active_guru');
  if (!sessionData) {
    Swal.fire({ icon: 'warning', title: 'Akses Ditolak!', text: 'Silakan login dulu.', confirmButtonColor: '#2563eb' })
      .then(() => { window.top.location.href = 'auth-guru.html'; });
    return;
  }
  currentGuru = JSON.parse(sessionData);
  populateGuruData(currentGuru);
  syncDataSiswa(); syncStatTugas(); renderDaftarTugasAktif();
  const tgl = document.getElementById('tglAbsensiGuru');
  if (tgl && !tgl.value) tgl.value = new Date().toISOString().split('T')[0];
  syncBackgroundGuru();
});

function syncBackgroundGuru() {
  if (!currentGuru) return;
  apiCall('getAllDataForGuru')
    .then(function(bundle) {
      if (!bundle) return;
      localStorage.setItem('database_siswa', JSON.stringify(bundle.siswa || []));
      localStorage.setItem('database_guru', JSON.stringify(bundle.guru || []));
      localStorage.setItem('database_tugas', JSON.stringify(bundle.tugas || []));
      localStorage.setItem('database_absensi', JSON.stringify(bundle.absensi || []));
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(bundle.pengumpulan || []));
      syncDataSiswa(); syncStatTugas(); renderDaftarTugasAktif();
    })
    .catch(function(err) { console.error('Sync error:', err); });
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select-wrap')) {
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
  }
});

function toggleDropdownAbsen(id) {
  document.querySelectorAll('.custom-dropdown-menu').forEach(m => { if (m.id !== id) m.classList.remove('show'); });
  const el = document.getElementById(id); if (el) el.classList.toggle('show');
}

/* ============ PROFIL ============ */
function populateGuruData(guru) {
  if (!guru) return;
  const namaGuru = guru.nama || 'Guru Pengajar';
  document.querySelectorAll('.val-nama-guru').forEach(el => el.textContent = namaGuru);
  const elHp = document.getElementById('valHpGuru'); if (elHp) elHp.textContent = guru.hp || '-';
  const elMu = document.getElementById('valMapelUmum'); if (elMu) elMu.textContent = guru.mapelUmum || '-';
  const elMk = document.getElementById('valMapelKejuruan'); if (elMk) elMk.textContent = guru.mapelKejuruan || '-';
  const words = namaGuru.trim().split(' ');
  let inisial = words.length >= 2 ? words[0][0] + words[1][0] : words[0].substring(0, 2);
  const av = document.getElementById('avatarGuruInisial'); if (av) av.textContent = inisial.toUpperCase() || 'PG';
}

function editProfilGuru() {
  Swal.fire({
    title: 'Edit Profil',
    html: '<div style="text-align:left;font-size:13px;color:#0f172a;">' +
      '<label style="font-weight:700;">Nama:</label>' +
      '<input type="text" id="swNama" class="form-control-custom" value="' + (currentGuru.nama || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;">No. HP:</label>' +
      '<input type="tel" id="swHp" class="form-control-custom" value="' + (currentGuru.hp || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;">Mapel Umum:</label>' +
      '<input type="text" id="swMU" class="form-control-custom" value="' + (currentGuru.mapelUmum || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;">Mapel Kejuruan:</label>' +
      '<input type="text" id="swMK" class="form-control-custom" value="' + (currentGuru.mapelKejuruan || '') + '">' +
      '</div>',
    showCancelButton: true, confirmButtonText: 'Simpan', confirmButtonColor: '#2563eb',
    preConfirm: () => {
      const nama = document.getElementById('swNama').value.trim();
      const hp = document.getElementById('swHp').value.trim();
      if (!nama || !hp) { Swal.showValidationMessage('Nama & HP wajib!'); return false; }
      return { nama_lama: currentGuru.nama, nama: nama, hp: hp,
        mapelUmum: document.getElementById('swMU').value.trim() || '-',
        mapelKejuruan: document.getElementById('swMK').value.trim() || '-' };
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      apiCall('updateProfilGuru', { hp_lama: currentGuru.hp, dataBaru: result.value })
        .then(function(res) {
          if (res.status === 'success') {
            currentGuru.nama = result.value.nama;
            currentGuru.hp = result.value.hp;
            currentGuru.mapelUmum = result.value.mapelUmum;
            currentGuru.mapelKejuruan = result.value.mapelKejuruan;
            localStorage.setItem('active_guru', JSON.stringify(currentGuru));
            populateGuruData(currentGuru);
            Swal.fire({ icon: 'success', title: 'Tersimpan!', timer: 1200, showConfirmButton: false });
          } else Swal.fire({ icon: 'error', title: 'Gagal', text: res.message });
        })
        .catch(function(err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); });
    }
  });
}

/* ============ DATA ============ */
function syncDataSiswa() {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const el1 = document.getElementById('statTotalSiswa'); if (el1) el1.textContent = dbSiswa.length;
  const kSet = new Set(); dbSiswa.forEach(s => { if (s.kelas) kSet.add(s.kelas); });
  const el2 = document.getElementById('statTotalKelas'); if (el2) el2.textContent = kSet.size;
  renderDaftarKelas(Array.from(kSet).sort(), dbSiswa);
}

function syncStatTugas() {
  const db = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const el = document.getElementById('statTugas'); if (el) el.textContent = db.length;
}

function renderDaftarKelas(kelasArray, databaseSiswa) {
  const container = document.getElementById('containerDaftarKelas');
  if (!container) return;
  if (kelasArray.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-folder-open"></i><b>Belum Ada Kelas</b></div>';
    return;
  }
  let html = '';
  kelasArray.forEach(kName => {
    const jml = databaseSiswa.filter(s => s.kelas === kName).length;
    const isExc = kName.includes('+');
    html += '<div class="kelas-card-item" onclick="bukaDetailKelas(\'' + kName + '\')"><div><span class="kelas-badge ' + (isExc ? 'badge-exc' : 'badge-reg') + '">' + (isExc ? 'Excellent' : 'Reguler') + '</span><h4 style="margin:6px 0 2px;">' + kName + '</h4><span style="font-size:12.5px;color:var(--text-muted);"><i class="fa-solid fa-users me-1"></i>' + jml + ' Siswa</span></div><i class="fa-solid fa-chevron-right"></i></div>';
  });
  container.innerHTML = html;
}

function bukaDetailKelas(namaKelas) {
  currentSelectedClass = namaKelas;
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const siswaIn = dbSiswa.filter(s => s.kelas === namaKelas);
  document.getElementById('viewDaftarKelas').style.display = 'none';
  document.getElementById('viewSiswaInKelas').style.display = 'block';
  document.getElementById('viewDetailProfilSiswa').style.display = 'none';
  document.getElementById('lblNamaKelasAktif').textContent = namaKelas;
  document.getElementById('lblJmlSiswaKelas').textContent = siswaIn.length + ' Siswa';
  const tbody = document.getElementById('tbodySiswaKelas');
  if (siswaIn.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Kosong.</td></tr>'; return; }
  let html = '';
  siswaIn.forEach(s => {
    html += '<tr style="cursor:pointer;" onclick="bukaProfilDetailSiswa(\'' + s.nisn + '\')"><td><b>' + (s.nisn || '-') + '</b></td><td style="color:var(--royal);font-weight:700;">' + (s.nama || '-') + '</td><td>' + (s.jurusan || '-') + '</td><td style="text-align:right;"><button class="btn-action" style="padding:4px 10px;font-size:11px;">Profil</button></td></tr>';
  });
  tbody.innerHTML = html;
}

function bukaProfilDetailSiswa(nisn) {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const siswa = dbSiswa.find(s => String(s.nisn) === String(nisn));
  if (!siswa) return;
  document.getElementById('viewDaftarKelas').style.display = 'none';
  document.getElementById('viewSiswaInKelas').style.display = 'none';
  document.getElementById('viewDetailProfilSiswa').style.display = 'block';
  document.getElementById('detailSiswaNama').textContent = siswa.nama || '-';
  document.getElementById('detailSiswaNisn').textContent = siswa.nisn || '-';
  document.getElementById('detailSiswaKelas').textContent = siswa.kelas || '-';
  document.getElementById('detailSiswaJurusan').textContent = siswa.jurusan || '-';
  document.getElementById('detailSiswaHp').textContent = siswa.hp || '-';
  document.getElementById('detailSiswaAyah').textContent = siswa.namaAyah || '-';
  document.getElementById('detailSiswaIbu').textContent = siswa.namaIbu || '-';
}

function navigasiKembaliKelas() {
  const v1 = document.getElementById('viewDaftarKelas');
  const v2 = document.getElementById('viewSiswaInKelas');
  const v3 = document.getElementById('viewDetailProfilSiswa');
  if (v3.style.display === 'block') { v3.style.display = 'none'; v2.style.display = 'block'; }
  else if (v2.style.display === 'block') { v2.style.display = 'none'; v1.style.display = 'block'; }
  else { switchTab('home', document.querySelector('.bottom-tab')); }
}

/* ============ ABSENSI ============ */
function pilihJalurAbsen(j) {
  selectedAbsenJalur = j;
  document.getElementById('lblAbsenJalur').textContent = j === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownJalur').classList.remove('show');
  selectedAbsenTingkat = null; selectedAbsenKelasFix = null;
  document.getElementById('lblAbsenTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblAbsenKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnAbsenTingkat').disabled = false;
  document.getElementById('btnAbsenKelasFix').disabled = true;
  resetTabelAbsensi();
}

function pilihTingkatAbsen(t) {
  selectedAbsenTingkat = t;
  document.getElementById('lblAbsenTingkat').textContent = 'Kelas ' + t;
  document.getElementById('dropdownTingkat').classList.remove('show');
  populateDropdownKelasFix();
}

function populateDropdownKelasFix() {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menu = document.getElementById('dropdownKelasFix');
  let filtered = dbSiswa.filter(s => {
    const isExc = s.kelas.includes('+');
    return (selectedAbsenJalur === 'Excellent' ? isExc : !isExc) && String(s.kelas).startsWith(String(selectedAbsenTingkat));
  }).map(s => s.kelas);
  let unik = Array.from(new Set(filtered)).sort();
  if (unik.length === 0) menu.innerHTML = '<div class="custom-option">Tidak ada kelas</div>';
  else { let h = ''; unik.forEach(k => { h += '<div class="custom-option" onclick="pilihKelasFixAbsen(\'' + k + '\')">' + k + '</div>'; }); menu.innerHTML = h; }
  document.getElementById('lblAbsenKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnAbsenKelasFix').disabled = false;
  resetTabelAbsensi();
}

function pilihKelasFixAbsen(k) {
  selectedAbsenKelasFix = k;
  document.getElementById('lblAbsenKelasFix').textContent = k;
  document.getElementById('dropdownKelasFix').classList.remove('show');
  muatTabelAbsensiFix(k);
}

function muatTabelAbsensiFix(k) {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const dbAbsen = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const tgl = document.getElementById('tglAbsensiGuru').value;
  const list = dbSiswa.filter(s => s.kelas === k);
  const tbody = document.getElementById('tbodyAbsensiSiswa');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Kosong.</td></tr>'; return; }
  let h = '';
  list.forEach(s => {
    const a = dbAbsen.find(x => String(x.nisn) === String(s.nisn) && String(x.tanggal) === String(tgl));
    h += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td>' + (s.nama || '-') + '</td><td style="font-weight:700;">' + (a ? a.status : 'Alpha') + '</td></tr>';
  });
  tbody.innerHTML = h;
}

function resetTabelAbsensi() {
  const t = document.getElementById('tbodyAbsensiSiswa');
  if (t) t.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:28px;">Pilih Kelas dulu.</td></tr>';
}

/* ============ TUGAS ============ */
function pilihJalurTugas(j) {
  selectedTugasJalur = j;
  document.getElementById('lblTugasJalur').textContent = j === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownTugasJalur').classList.remove('show');
  selectedTugasTingkat = null; selectedTugasKelasFix = null;
  document.getElementById('lblTugasTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblTugasKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnTugasTingkat').disabled = false;
  document.getElementById('btnTugasKelasFix').disabled = true;
}

function pilihTingkatTugas(t) {
  selectedTugasTingkat = t;
  document.getElementById('lblTugasTingkat').textContent = 'Kelas ' + t;
  document.getElementById('dropdownTugasTingkat').classList.remove('show');
  populateDropdownTugasKelasFix();
}

function populateDropdownTugasKelasFix() {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menu = document.getElementById('dropdownTugasKelasFix');
  let filtered = dbSiswa.filter(s => {
    const isExc = s.kelas.includes('+');
    return (selectedTugasJalur === 'Excellent' ? isExc : !isExc) && String(s.kelas).startsWith(String(selectedTugasTingkat));
  }).map(s => s.kelas);
  let unik = Array.from(new Set(filtered)).sort();
  if (unik.length === 0) menu.innerHTML = '<div class="custom-option">Tidak ada kelas</div>';
  else { let h = ''; unik.forEach(k => { h += '<div class="custom-option" onclick="pilihKelasFixTugas(\'' + k + '\')">' + k + '</div>'; }); menu.innerHTML = h; }
  document.getElementById('lblTugasKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnTugasKelasFix').disabled = false;
}

function pilihKelasFixTugas(k) {
  selectedTugasKelasFix = k;
  document.getElementById('lblTugasKelasFix').textContent = k;
  document.getElementById('dropdownTugasKelasFix').classList.remove('show');
}

function handleFileTugas(input) {
  const file = input.files[0];
  const info = document.getElementById('fileInfoTugas');
  if (!file) { fileTugasBase64 = null; fileTugasName = null; fileTugasType = null; if (info) info.textContent = ''; return; }
  if (file.size > 10 * 1024 * 1024) {
    if (info) { info.textContent = '❌ File > 10MB!'; info.style.color = '#ef4444'; }
    input.value = ''; fileTugasBase64 = null;
    Swal.fire({ icon: 'error', title: 'File Terlalu Besar!', text: 'Maks 10MB' });
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    fileTugasBase64 = e.target.result.split(',')[1];
    fileTugasName = file.name;
    fileTugasType = file.type || 'application/octet-stream';
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (info) { info.textContent = '✅ ' + file.name + ' (' + sizeMB + ' MB)'; info.style.color = '#10b981'; }
  };
  reader.readAsDataURL(file);
}

function buatTugas() {
  if (!selectedTugasKelasFix) { Swal.fire({ icon: 'warning', title: 'Pilih Kelas Target!' }); return; }
  const judul = document.getElementById('inputJudulTugas').value.trim();
  const deskripsi = document.getElementById('inputDeskripsiTugas').value.trim();
  const tgl = document.getElementById('inputTglTugas').value;
  const jam = document.getElementById('inputJamTugas').value || '23:59';
  if (!judul || !tgl) { Swal.fire({ icon: 'warning', title: 'Judul & tanggal wajib!' }); return; }

  Swal.fire({ title: 'Menerbitkan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const tugasId = 'TGS-' + Date.now();

  function finalizeSave(fileUrl, fileName) {
    const baru = { id: tugasId, judul: judul, deskripsi: deskripsi, kelasTarget: selectedTugasKelasFix, deadlineTgl: tgl, deadlineJam: jam, pembuatGuru: currentGuru.nama, fileUrl: fileUrl || '', fileName: fileName || '' };
    apiCall('saveTugas', { data: baru })
      .then(function() {
        let list = JSON.parse(localStorage.getItem('database_tugas')) || [];
        list.unshift(baru);
        localStorage.setItem('database_tugas', JSON.stringify(list));
        document.getElementById('inputJudulTugas').value = '';
        document.getElementById('inputDeskripsiTugas').value = '';
        document.getElementById('inputTglTugas').value = '';
        const fi = document.getElementById('inputFileTugas'); if (fi) fi.value = '';
        const info = document.getElementById('fileInfoTugas'); if (info) info.textContent = '';
        fileTugasBase64 = null; fileTugasName = null; fileTugasType = null;
        syncStatTugas(); renderDaftarTugasAktif();
        Swal.fire({ icon: 'success', title: 'Tugas Diterbitkan!', text: fileUrl ? 'File di-upload.' : '', timer: 1500, showConfirmButton: false });
      })
      .catch(function(err) { Swal.fire({ icon: 'error', title: 'Gagal', text: err.message }); });
  }

  if (fileTugasBase64) {
    apiCall('uploadFileToDrive', { base64Data: fileTugasBase64, fileName: fileTugasName, mimeType: fileTugasType, category: 'tugas' })
      .then(function(res) {
        if (res.status === 'success') finalizeSave(res.fileUrl, res.fileName);
        else Swal.fire({ icon: 'error', title: 'Upload gagal', text: res.message });
      })
      .catch(function(err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); });
  } else {
    finalizeSave('', '');
  }
}

function renderDaftarTugasAktif() {
  const tbody = document.getElementById('tbodyDaftarTugasAktif');
  if (!tbody) return;
  const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const listSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  if (listTugas.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Belum ada tugas.</td></tr>'; return; }
  let h = '';
  listTugas.forEach(t => {
    const total = listSiswa.filter(s => s.kelas === t.kelasTarget).length;
    const sudah = listPeng.filter(p => String(p.tugasId) === String(t.id) && p.nilai !== '' && p.nilai !== null).length;
    let badge = (total > 0 && sudah >= total) ? '<span class="badge-status-tugas status-done">Selesai</span>' : '<span class="badge-status-tugas status-pending">Sebagian</span>';
    let fileIcon = t.fileUrl ? ' <i class="fa-solid fa-paperclip text-primary"></i>' : '';
    h += '<tr>' +
      '<td style="font-weight:700;color:var(--royal);">' + t.judul + fileIcon + '</td>' +
      '<td><span class="kelas-badge badge-exc">' + t.kelasTarget + '</span></td>' +
      '<td>' + t.deadlineTgl + ' (' + t.deadlineJam + ')</td>' +
      '<td>' + badge + '</td>' +
      '<td style="text-align:right;white-space:nowrap;">' +
        '<button class="btn-action" style="padding:6px 10px;font-size:11px;margin-right:4px;" onclick="bukaDetailPengumpulanTugas(\'' + t.id + '\')"><i class="fa-solid fa-eye"></i></button>' +
        '<button class="btn-action" style="padding:6px 10px;font-size:11px;background:#ef4444;" onclick="hapusTugas(\'' + t.id + '\', \'' + String(t.judul).replace(/\'/g, "\\\'") + '\')"><i class="fa-solid fa-trash"></i></button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

/* ============ HAPUS TUGAS ============ */
function hapusTugas(tugasId, judulTugas) {
  Swal.fire({
    title: 'Hapus Tugas?',
    html: '<p style="font-size:14px;color:#475569;">Tugas berikut akan dihapus permanen:</p>' +
          '<p style="font-weight:700;color:#0f172a;background:#fef2f2;padding:10px;border-radius:8px;">' + judulTugas + '</p>' +
          '<p style="font-size:12px;color:#ef4444;margin-top:8px;">⚠️ Semua jawaban siswa untuk tugas ini juga akan terhapus.</p>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then((r) => {
    if (r.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      apiCall('deleteTugas', { tugasId: tugasId })
        .then(function(res) {
          if (res.status === 'success') {
            // Update localStorage
            let listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
            listTugas = listTugas.filter(t => String(t.id) !== String(tugasId));
            localStorage.setItem('database_tugas', JSON.stringify(listTugas));

            let listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
            listPeng = listPeng.filter(p => String(p.tugasId) !== String(tugasId));
            localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(listPeng));

            syncStatTugas(); renderDaftarTugasAktif();
            Swal.fire({ icon: 'success', title: 'Terhapus!', text: res.message, timer: 1500, showConfirmButton: false });
          } else {
            Swal.fire({ icon: 'error', title: 'Gagal', text: res.message });
          }
        })
        .catch(function(err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); });
    }
  });
}

function bukaDetailPengumpulanTugas(id) {
  activeTugasDetailId = id;
  const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const tugas = listTugas.find(t => String(t.id) === String(id));
  if (!tugas) return;
  document.getElementById('viewMainTugas').style.display = 'none';
  document.getElementById('viewPengumpulanSiswa').style.display = 'block';
  document.getElementById('lblJudulTugasDetail').textContent = tugas.judul;
  document.getElementById('lblKelasTugasDetail').textContent = tugas.kelasTarget;
  document.getElementById('lblDeadlineTugasDetail').textContent = tugas.deadlineTgl + ' pk. ' + tugas.deadlineJam;
  renderPengumpulanSiswa(tugas);
}

function renderPengumpulanSiswa(tugas) {
  const tbody = document.getElementById('tbodyPengumpulanSiswa');
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const siswaIn = dbSiswa.filter(s => s.kelas === tugas.kelasTarget);
  if (siswaIn.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Kosong.</td></tr>'; return; }
  let h = '';
  siswaIn.forEach(s => {
    const p = listPeng.find(x => String(x.tugasId) === String(tugas.id) && String(x.nisn) === String(s.nisn));
    let statusH = p ? '<span style="color:var(--emerald);font-weight:700;">Sudah</span>' : '<span style="color:var(--danger);font-weight:700;">Belum</span>';
    let waktuH = p ? (p.waktu || '-') : '-';
    let fileH = '-';
    if (p) {
      const parts = [];
      if (p.fileUrl) parts.push('<a href="' + p.fileUrl + '" target="_blank" style="color:#2563eb;font-weight:700;">📎 ' + (p.fileName || 'File') + '</a>');
      if (p.catatanAtauFile) parts.push('<div style="font-size:11px;color:#64748b;margin-top:4px;">' + p.catatanAtauFile + '</div>');
      fileH = parts.length ? parts.join('') : '-';
    }
    let nilai = (p && p.nilai !== '' && p.nilai !== null) ? p.nilai : '-';
    h += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td>' + (s.nama || '-') + '</td><td>' + statusH + '</td><td>' + waktuH + '</td><td>' + fileH + '</td><td><b style="color:var(--royal);">' + nilai + '</b></td><td style="text-align:right;"><button class="btn-action" style="padding:5px 10px;font-size:11px;" onclick="inputNilaiTugasSiswa(\'' + tugas.id + '\', \'' + s.nisn + '\', \'' + (s.nama || '').replace(/\'/g, "\\\'") + '\', \'' + nilai + '\')">Nilai</button></td></tr>';
  });
  tbody.innerHTML = h;
}

function inputNilaiTugasSiswa(tugasId, nisn, nama, nilaiLama) {
  const currentVal = nilaiLama !== '-' ? nilaiLama : '';
  Swal.fire({
    title: 'Beri Nilai: ' + nama, input: 'number', inputValue: currentVal,
    inputAttributes: { min: 0, max: 100 },
    showCancelButton: true, confirmButtonText: 'Simpan', confirmButtonColor: '#2563eb',
    preConfirm: (v) => { if (v === '' || v < 0 || v > 100) { Swal.showValidationMessage('0-100!'); return false; } return v; }
  }).then((r) => {
    if (r.isConfirmed && r.value !== undefined) {
      let list = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
      let idx = list.findIndex(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(nisn));
      if (idx !== -1) list[idx].nilai = parseInt(r.value);
      else list.push({ tugasId: tugasId, nisn: nisn, waktu: 'Dinilai', catatanAtauFile: 'Manual', nilai: parseInt(r.value), fileUrl: '', fileName: '' });
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(list));
      apiCall('updateNilaiPengumpulan', { tugasId: tugasId, nisn: nisn, nilai: parseInt(r.value) });
      const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
      const tugas = listTugas.find(t => String(t.id) === String(tugasId));
      if (tugas) renderPengumpulanSiswa(tugas);
      Swal.fire({ icon: 'success', title: 'Tersimpan!', timer: 1000, showConfirmButton: false });
    }
  });
}

function kembaliKeDaftarTugas() {
  activeTugasDetailId = null;
  document.getElementById('viewPengumpulanSiswa').style.display = 'none';
  document.getElementById('viewMainTugas').style.display = 'block';
  renderDaftarTugasAktif();
}

/* ============ NILAI ============ */
function pilihJalurNilai(j) {
  selectedNilaiJalur = j;
  document.getElementById('lblNilaiJalur').textContent = j === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownNilaiJalur').classList.remove('show');
  selectedNilaiTingkat = null; selectedNilaiKelasFix = null;
  document.getElementById('lblNilaiTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblNilaiKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnNilaiTingkat').disabled = false;
  document.getElementById('btnNilaiKelasFix').disabled = true;
  resetTabelNilai();
}

function pilihTingkatNilai(t) {
  selectedNilaiTingkat = t;
  document.getElementById('lblNilaiTingkat').textContent = 'Kelas ' + t;
  document.getElementById('dropdownNilaiTingkat').classList.remove('show');
  populateDropdownNilaiKelasFix();
}

function populateDropdownNilaiKelasFix() {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menu = document.getElementById('dropdownNilaiKelasFix');
  let filtered = dbSiswa.filter(s => {
    const isExc = s.kelas.includes('+');
    return (selectedNilaiJalur === 'Excellent' ? isExc : !isExc) && String(s.kelas).startsWith(String(selectedNilaiTingkat));
  }).map(s => s.kelas);
  let unik = Array.from(new Set(filtered)).sort();
  if (unik.length === 0) menu.innerHTML = '<div class="custom-option">Tidak ada kelas</div>';
  else { let h = ''; unik.forEach(k => { h += '<div class="custom-option" onclick="pilihKelasFixNilai(\'' + k + '\')">' + k + '</div>'; }); menu.innerHTML = h; }
  document.getElementById('lblNilaiKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnNilaiKelasFix').disabled = false;
  resetTabelNilai();
}

function pilihKelasFixNilai(k) {
  selectedNilaiKelasFix = k;
  document.getElementById('lblNilaiKelasFix').textContent = k;
  document.getElementById('dropdownNilaiKelasFix').classList.remove('show');
  muatTabelRekapNilai(k);
}

function muatTabelRekapNilai(k) {
  const dbSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const dbTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPeng = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const siswaIn = dbSiswa.filter(s => s.kelas === k);
  const tbody = document.getElementById('tbodyNilaiSiswa');
  if (siswaIn.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Kosong.</td></tr>'; return; }
  const tugasK = dbTugas.filter(t => t.kelasTarget === k);
  let h = '';
  siswaIn.forEach(s => {
    let tot = 0, n = 0;
    tugasK.forEach(t => {
      const p = listPeng.find(x => String(x.tugasId) === String(t.id) && String(x.nisn) === String(s.nisn));
      if (p && p.nilai !== '' && p.nilai !== null && p.nilai !== '-') { tot += parseFloat(p.nilai); n++; }
    });
    const avg = n > 0 ? (tot / n).toFixed(1) : '-';
    h += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td>' + (s.nama || '-') + '</td><td>' + n + '/' + tugasK.length + '</td><td><b style="color:var(--royal);">' + avg + '</b></td></tr>';
  });
  tbody.innerHTML = h;
}

function resetTabelNilai() {
  const t = document.getElementById('tbodyNilaiSiswa');
  if (t) t.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:28px;">Pilih filter dulu.</td></tr>';
}

/* ============ LOGOUT & HAPUS AKUN ============ */
function logoutGuru() {
  Swal.fire({ title: 'Keluar?', icon: 'question', showCancelButton: true, confirmButtonColor: '#2563eb', cancelButtonColor: '#64748b', confirmButtonText: 'Ya', cancelButtonText: 'Batal' })
    .then((r) => { if (r.isConfirmed) { localStorage.removeItem('active_guru'); window.top.location.href = 'index.html'; } });
}

function hapusAkunGuru() {
  Swal.fire({
    title: 'Hapus Akun Permanen?',
    html: '<p style="font-size:14px;color:#475569;">Data yang akan dihapus:</p>' +
          '<ul style="text-align:left;font-size:13px;color:#0f172a;margin-top:8px;">' +
          '<li>✅ Akun guru Anda</li>' +
          '<li>✅ Semua tugas yang Anda buat</li>' +
          '<li>✅ Semua jawaban siswa untuk tugas Anda</li>' +
          '<li>✅ Semua data absensi yang Anda input</li>' +
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
      Swal.fire({ title: 'Menghapus semua data...', text: 'Mohon tunggu sebentar.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      apiCall('deleteGuru', { identifier: currentGuru.hp || currentGuru.nama })
        .then(function(res) {
          if (res.status === 'success') {
            // Bersihkan localStorage
            localStorage.removeItem('active_guru');
            localStorage.removeItem('database_tugas');
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
        .catch(function(err) {
          Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        });
    }
  });
}

/* ============ TAB ============ */
function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.bottom-tab').forEach(tab => tab.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  else { const m = document.querySelector('.bottom-tab[onclick*="\'' + sectionId + '\'"]'); if (m) m.classList.add('active'); }
  if (sectionId === 'total-kelas') {
    document.getElementById('viewDaftarKelas').style.display = 'block';
    document.getElementById('viewSiswaInKelas').style.display = 'none';
    document.getElementById('viewDetailProfilSiswa').style.display = 'none';
  } else if (sectionId === 'tugas') {
    document.getElementById('viewMainTugas').style.display = 'block';
    document.getElementById('viewPengumpulanSiswa').style.display = 'none';
    renderDaftarTugasAktif();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
