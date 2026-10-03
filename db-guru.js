const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';

let currentGuru = null;
let currentSelectedClass = null;
let currentSelectedStudent = null;

let selectedAbsenJalur = null;
let selectedAbsenTingkat = null;
let selectedAbsenKelasFix = null;

let selectedTugasJalur = null;
let selectedTugasTingkat = null;
let selectedTugasKelasFix = null;
let activeTugasDetailId = null;

let selectedNilaiJalur = null;
let selectedNilaiTingkat = null;
let selectedNilaiKelasFix = null;

document.addEventListener('DOMContentLoaded', function() {
  const sessionData = localStorage.getItem('active_guru');
  if (!sessionData) {
    Swal.fire({
      icon: 'warning', title: 'Akses Ditolak!',
      text: 'Silakan login dulu.',
      confirmButtonColor: '#2563eb'
    }).then(() => { window.top.location.href = 'auth-guru.html'; });
    return;
  }

  currentGuru = JSON.parse(sessionData);

  // ✅ 1. LANGSUNG tampilkan dashboard dari localStorage (tidak tunggu backend)
  populateGuruData(currentGuru);
  syncDataSiswa();
  syncStatTugas();
  renderDaftarTugasAktif();

  const tgl = document.getElementById('tglAbsensiGuru');
  if (tgl && !tgl.value) tgl.value = new Date().toISOString().split('T')[0];

  // ✅ 2. Sync di BACKGROUND — tidak menghalangi UI
  syncBackgroundGuru();
});

// Sync background — tidak blocking
function syncBackgroundGuru() {
  if (!currentGuru) return;

  setTimeout(function() {
    console.warn('Sync masih jalan di background...');
  }, 30000);

  google.script.run
    .withSuccessHandler(function(bundle) {
      if (!bundle) return;

      localStorage.setItem('database_siswa', JSON.stringify(bundle.siswa || []));
      localStorage.setItem('database_guru', JSON.stringify(bundle.guru || []));
      localStorage.setItem('database_tugas', JSON.stringify(bundle.tugas || []));
      localStorage.setItem('database_absensi', JSON.stringify(bundle.absensi || []));
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(bundle.pengumpulan || []));

      // Refresh tampilan dengan data baru
      syncDataSiswa();
      syncStatTugas();
      renderDaftarTugasAktif();
    })
    .withFailureHandler(function(err) {
      console.error('Sync error:', err);
      // Diam-diam fallback — dashboard tetap jalan
    })
    .getAllDataForGuru();
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select-wrap')) {
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
  }
});

function toggleDropdownAbsen(id) {
  document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
    if (m.id !== id) m.classList.remove('show');
  });
  const el = document.getElementById(id);
  if (el) el.classList.toggle('show');
}

/* ============ PROFIL GURU ============ */
function populateGuruData(guru) {
  if (!guru) return;
  const namaGuru = guru.nama || 'Guru Pengajar';
  document.querySelectorAll('.val-nama-guru').forEach(el => el.textContent = namaGuru);

  const elHp = document.getElementById('valHpGuru'); if (elHp) elHp.textContent = guru.hp || '-';
  const elMu = document.getElementById('valMapelUmum'); if (elMu) elMu.textContent = guru.mapelUmum || '-';
  const elMk = document.getElementById('valMapelKejuruan'); if (elMk) elMk.textContent = guru.mapelKejuruan || '-';

  const words = namaGuru.trim().split(' ');
  let inisial = words.length >= 2 ? words[0][0] + words[1][0] : words[0].substring(0, 2);
  const avatarEl = document.getElementById('avatarGuruInisial');
  if (avatarEl) avatarEl.textContent = inisial.toUpperCase() || 'PG';
}

function editProfilGuru() {
  Swal.fire({
    title: 'Edit Profil Pengajar',
    html: '<div style="text-align:left;font-size:13px;color:#0f172a;">' +
      '<label style="font-weight:700;display:block;margin-bottom:4px;">Nama Guru & Gelar:</label>' +
      '<input type="text" id="swalNamaGuru" class="form-control-custom" value="' + (currentGuru.nama || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;margin-bottom:4px;">No. WhatsApp:</label>' +
      '<input type="tel" id="swalHpGuru" class="form-control-custom" value="' + (currentGuru.hp || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;margin-bottom:4px;">Mapel Umum:</label>' +
      '<input type="text" id="swalMapelUmum" class="form-control-custom" value="' + (currentGuru.mapelUmum || '') + '">' +
      '<label style="font-weight:700;display:block;margin-top:10px;margin-bottom:4px;">Mapel Kejuruan:</label>' +
      '<input type="text" id="swalMapelKejuruan" class="form-control-custom" value="' + (currentGuru.mapelKejuruan || '') + '">' +
      '</div>',
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    preConfirm: () => {
      const nama = document.getElementById('swalNamaGuru').value.trim();
      const hp = document.getElementById('swalHpGuru').value.trim();
      const mapelUmum = document.getElementById('swalMapelUmum').value.trim();
      const mapelKejuruan = document.getElementById('swalMapelKejuruan').value.trim();
      if (!nama || !hp) { Swal.showValidationMessage('Nama dan HP wajib!'); return false; }
      return { nama, hp, mapelUmum, mapelKejuruan };
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      currentGuru = Object.assign({}, currentGuru, result.value);
      localStorage.setItem('active_guru', JSON.stringify(currentGuru));
      populateGuruData(currentGuru);
      Swal.fire({ icon: 'success', title: 'Tersimpan!', confirmButtonColor: '#10b981' });
    }
  });
}

/* ============ SINKRONISASI ============ */
function syncDataSiswa() {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const elTotalSiswa = document.getElementById('statTotalSiswa');
  if (elTotalSiswa) elTotalSiswa.textContent = databaseSiswa.length;

  const kelasSet = new Set();
  databaseSiswa.forEach(s => { if (s.kelas) kelasSet.add(s.kelas); });
  const elTotalKelas = document.getElementById('statTotalKelas');
  if (elTotalKelas) elTotalKelas.textContent = kelasSet.size;

  const sortedKelasArray = Array.from(kelasSet).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  renderDaftarKelas(sortedKelasArray, databaseSiswa);
}

function syncStatTugas() {
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const statEl = document.getElementById('statTugas');
  if (statEl) statEl.textContent = databaseTugas.length;
}

function renderDaftarKelas(kelasArray, databaseSiswa) {
  const container = document.getElementById('containerDaftarKelas');
  if (!container) return;

  if (kelasArray.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fa-solid fa-folder-open"></i><b>Belum Ada Data Kelas</b><p style="font-size:12px;margin-top:4px;">Menunggu sinkronisasi dari server...</p></div>';
    return;
  }

  let html = '';
  kelasArray.forEach(kName => {
    const jmlSiswa = databaseSiswa.filter(s => s.kelas === kName).length;
    const isExc = kName.includes('+') || kName.toLowerCase().includes('excellent');
    const badgeClass = isExc ? 'badge-exc' : 'badge-reg';
    const badgeText = isExc ? 'Excellent (+)' : 'Reguler';
    html += '<div class="kelas-card-item" onclick="bukaDetailKelas(\'' + kName + '\')"><div><span class="kelas-badge ' + badgeClass + '">' + badgeText + '</span><h4 style="margin:6px 0 2px;font-size:16px;font-weight:800;">' + kName + '</h4><span style="font-size:12.5px;color:var(--text-muted);"><i class="fa-solid fa-users me-1"></i>' + jmlSiswa + ' Siswa</span></div><i class="fa-solid fa-chevron-right text-muted fs-5"></i></div>';
  });
  container.innerHTML = html;
}

function bukaDetailKelas(namaKelas) {
  currentSelectedClass = namaKelas;
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const siswaInKelas = databaseSiswa.filter(s => s.kelas === namaKelas);

  document.getElementById('viewDaftarKelas').style.display = 'none';
  document.getElementById('viewSiswaInKelas').style.display = 'block';
  document.getElementById('viewDetailProfilSiswa').style.display = 'none';
  document.getElementById('lblNamaKelasAktif').textContent = namaKelas;
  document.getElementById('lblJmlSiswaKelas').textContent = siswaInKelas.length + ' Siswa Terdaftar';

  const tbody = document.getElementById('tbodySiswaKelas');
  if (siswaInKelas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Tidak ada siswa di kelas ini.</td></tr>';
    return;
  }
  let html = '';
  siswaInKelas.forEach(s => {
    html += '<tr style="cursor:pointer;" onclick="bukaProfilDetailSiswa(\'' + s.nisn + '\')"><td><b>' + (s.nisn || '-') + '</b></td><td style="color:var(--royal);font-weight:700;">' + (s.nama || '-') + '</td><td>' + (s.jurusan || '-') + '</td><td style="text-align:right;"><button class="btn-action" style="padding:4px 10px;font-size:11px;"><i class="fa-solid fa-id-card me-1"></i> Profil</button></td></tr>';
  });
  tbody.innerHTML = html;
}

function bukaProfilDetailSiswa(nisn) {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const siswa = databaseSiswa.find(s => String(s.nisn) === String(nisn));
  if (!siswa) return;
  currentSelectedStudent = siswa;

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
  const viewKelas = document.getElementById('viewDaftarKelas');
  const viewSiswa = document.getElementById('viewSiswaInKelas');
  const viewProfil = document.getElementById('viewDetailProfilSiswa');

  if (viewProfil.style.display === 'block') {
    viewProfil.style.display = 'none';
    viewSiswa.style.display = 'block';
  } else if (viewSiswa.style.display === 'block') {
    viewSiswa.style.display = 'none';
    viewKelas.style.display = 'block';
  } else {
    switchTab('home', document.querySelector('.bottom-tab'));
  }
}

/* ============ ABSENSI ============ */
function pilihJalurAbsen(jalurName) {
  selectedAbsenJalur = jalurName;
  document.getElementById('lblAbsenJalur').textContent = jalurName === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownJalur').classList.remove('show');

  selectedAbsenTingkat = null; selectedAbsenKelasFix = null;
  document.getElementById('lblAbsenTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblAbsenKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnAbsenTingkat').disabled = false;
  document.getElementById('btnAbsenKelasFix').disabled = true;
  resetTabelAbsensi();
}

function pilihTingkatAbsen(tingkatNum) {
  selectedAbsenTingkat = tingkatNum;
  document.getElementById('lblAbsenTingkat').textContent = 'Kelas ' + tingkatNum;
  document.getElementById('dropdownTingkat').classList.remove('show');
  populateDropdownKelasFix();
}

function populateDropdownKelasFix() {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menuKelas = document.getElementById('dropdownKelasFix');

  let filteredKelas = databaseSiswa.filter(s => {
    const isExc = s.kelas.includes('+') || s.kelas.toLowerCase().includes('excellent');
    const cocokJalur = selectedAbsenJalur === 'Excellent' ? isExc : !isExc;
    const cocokTingkat = String(s.kelas).startsWith(String(selectedAbsenTingkat));
    return cocokJalur && cocokTingkat;
  }).map(s => s.kelas);

  let listUnikKelas = Array.from(new Set(filteredKelas)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  if (listUnikKelas.length === 0) {
    menuKelas.innerHTML = '<div class="custom-option" style="color:#94a3b8;cursor:default;">Tidak ada kelas</div>';
  } else {
    let html = '';
    listUnikKelas.forEach(kName => {
      html += '<div class="custom-option" onclick="pilihKelasFixAbsen(\'' + kName + '\')"><span>' + kName + '</span><i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></div>';
    });
    menuKelas.innerHTML = html;
  }
  document.getElementById('lblAbsenKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnAbsenKelasFix').disabled = false;
  resetTabelAbsensi();
}

function pilihKelasFixAbsen(namaKelas) {
  selectedAbsenKelasFix = namaKelas;
  document.getElementById('lblAbsenKelasFix').textContent = namaKelas;
  document.getElementById('dropdownKelasFix').classList.remove('show');
  muatTabelAbsensiFix(namaKelas);
}

function muatTabelAbsensiFix(namaKelas) {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const databaseAbsensi = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const tglAktif = document.getElementById('tglAbsensiGuru').value;

  const siswaInKelas = databaseSiswa.filter(s => s.kelas === namaKelas);
  const tbody = document.getElementById('tbodyAbsensiSiswa');

  if (siswaInKelas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada siswa di kelas <b>' + namaKelas + '</b>.</td></tr>';
    return;
  }
  let html = '';
  siswaInKelas.forEach(s => {
    const dataAbsenSiswa = databaseAbsensi.find(a => String(a.nisn) === String(s.nisn) && String(a.tanggal) === String(tglAktif));
    let statusText = (dataAbsenSiswa && dataAbsenSiswa.status) ? dataAbsenSiswa.status : 'Alpha';
    html += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td style="font-weight:600;">' + (s.nama || '-') + '</td><td style="font-weight:700;">' + statusText + '</td></tr>';
  });
  tbody.innerHTML = html;
}

function resetTabelAbsensi() {
  const tbody = document.getElementById('tbodyAbsensiSiswa');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:28px;"><i class="fa-solid fa-filter me-1"></i> Pilih Kelas & Rombel dulu.</td></tr>';
  }
}

/* ============ TUGAS ============ */
function pilihJalurTugas(jalurName) {
  selectedTugasJalur = jalurName;
  document.getElementById('lblTugasJalur').textContent = jalurName === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownTugasJalur').classList.remove('show');

  selectedTugasTingkat = null; selectedTugasKelasFix = null;
  document.getElementById('lblTugasTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblTugasKelasFix').textContent = '-- Pilih Kelas Target --';
  document.getElementById('btnTugasTingkat').disabled = false;
  document.getElementById('btnTugasKelasFix').disabled = true;
}

function pilihTingkatTugas(tingkatNum) {
  selectedTugasTingkat = tingkatNum;
  document.getElementById('lblTugasTingkat').textContent = 'Kelas ' + tingkatNum;
  document.getElementById('dropdownTugasTingkat').classList.remove('show');
  populateDropdownTugasKelasFix();
}

function populateDropdownTugasKelasFix() {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menuKelas = document.getElementById('dropdownTugasKelasFix');

  let filteredKelas = databaseSiswa.filter(s => {
    const isExc = s.kelas.includes('+') || s.kelas.toLowerCase().includes('excellent');
    const cocokJalur = selectedTugasJalur === 'Excellent' ? isExc : !isExc;
    const cocokTingkat = String(s.kelas).startsWith(String(selectedTugasTingkat));
    return cocokJalur && cocokTingkat;
  }).map(s => s.kelas);

  let listUnikKelas = Array.from(new Set(filteredKelas)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  if (listUnikKelas.length === 0) {
    menuKelas.innerHTML = '<div class="custom-option" style="color:#94a3b8;cursor:default;">Tidak ada kelas</div>';
  } else {
    let html = '';
    listUnikKelas.forEach(kName => {
      html += '<div class="custom-option" onclick="pilihKelasFixTugas(\'' + kName + '\')"><span>' + kName + '</span><i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></div>';
    });
    menuKelas.innerHTML = html;
  }
  document.getElementById('lblTugasKelasFix').textContent = '-- Pilih Kelas Target --';
  document.getElementById('btnTugasKelasFix').disabled = false;
}

function pilihKelasFixTugas(namaKelas) {
  selectedTugasKelasFix = namaKelas;
  document.getElementById('lblTugasKelasFix').textContent = namaKelas;
  document.getElementById('dropdownTugasKelasFix').classList.remove('show');
}

function buatTugas() {
  if (!selectedTugasKelasFix) {
    Swal.fire({ icon: 'warning', title: 'Pilih Kelas Target dulu!' });
    return;
  }
  const judul = document.getElementById('inputJudulTugas').value.trim();
  const deskripsi = document.getElementById('inputDeskripsiTugas').value.trim();
  const tgl = document.getElementById('inputTglTugas').value;
  const jam = document.getElementById('inputJamTugas').value || '23:59';

  if (!judul || !tgl) {
    Swal.fire({ icon: 'warning', title: 'Judul & tanggal wajib!' });
    return;
  }

  let listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const baru = {
    id: 'TGS-' + Date.now(),
    judul: judul, deskripsi: deskripsi,
    kelasTarget: selectedTugasKelasFix,
    deadlineTgl: tgl, deadlineJam: jam,
    pembuatGuru: currentGuru ? currentGuru.nama : 'Guru'
  };
  listTugas.unshift(baru);
  localStorage.setItem('database_tugas', JSON.stringify(listTugas));

  google.script.run.saveTugas(baru);

  document.getElementById('inputJudulTugas').value = '';
  document.getElementById('inputDeskripsiTugas').value = '';
  document.getElementById('inputTglTugas').value = '';
  syncStatTugas();
  renderDaftarTugasAktif();
  Swal.fire({ icon: 'success', title: 'Tugas Diterbitkan!', timer: 1200, showConfirmButton: false });
}

function renderDaftarTugasAktif() {
  const tbody = document.getElementById('tbodyDaftarTugasAktif');
  if (!tbody) return;

  const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const listSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];

  if (listTugas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada tugas.</td></tr>';
    return;
  }

  let html = '';
  listTugas.forEach(tgs => {
    const totalSiswaKelas = listSiswa.filter(s => s.kelas === tgs.kelasTarget).length;
    const pengumpulanUntukTugas = listPengumpulan.filter(p => String(p.tugasId) === String(tgs.id));
    const sudahDinilaiCount = pengumpulanUntukTugas.filter(p => p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-').length;

    let badgePenilaian = '';
    if (totalSiswaKelas > 0 && sudahDinilaiCount >= totalSiswaKelas) {
      badgePenilaian = '<span class="badge-status-tugas status-done"><i class="fa-solid fa-check-circle me-1"></i>Selesai</span>';
    } else {
      badgePenilaian = '<span class="badge-status-tugas status-pending"><i class="fa-solid fa-clock me-1"></i>Sebagian</span>';
    }

    html += '<tr><td style="font-weight:700;color:var(--royal);">' + tgs.judul + '</td><td><span class="kelas-badge badge-exc">' + tgs.kelasTarget + '</span></td><td><i class="fa-solid fa-calendar text-muted me-1"></i>' + tgs.deadlineTgl + ' (' + tgs.deadlineJam + ')</td><td>' + badgePenilaian + '</td><td style="text-align:right;"><button class="btn-action" style="padding:6px 12px;font-size:12px;" onclick="bukaDetailPengumpulanTugas(\'' + tgs.id + '\')"><i class="fa-solid fa-eye me-1"></i> Lihat</button></td></tr>';
  });
  tbody.innerHTML = html;
}

function bukaDetailPengumpulanTugas(tugasId) {
  activeTugasDetailId = tugasId;
  const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const tugas = listTugas.find(t => String(t.id) === String(tugasId));
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
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const siswaInKelas = databaseSiswa.filter(s => s.kelas === tugas.kelasTarget);

  if (siswaInKelas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada siswa di kelas <b>' + tugas.kelasTarget + '</b>.</td></tr>';
    return;
  }

  let html = '';
  siswaInKelas.forEach(s => {
    const dataKirim = listPengumpulan.find(p => String(p.tugasId) === String(tugas.id) && String(p.nisn) === String(s.nisn));

    let statusHtml = '', waktuHtml = '-', fileHtml = '-', nilaiDisplay = '-';
    if (dataKirim) {
      statusHtml = '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-circle-check me-1"></i>Sudah</span>';
      waktuHtml = dataKirim.waktu || '-';

      const fileParts = [];
      if (dataKirim.fileUrl) {
        fileParts.push('<a href="' + dataKirim.fileUrl + '" target="_blank" style="color:#2563eb;font-weight:700;text-decoration:none;">📎 ' + (dataKirim.fileName || 'Buka') + '</a>');
      }
      if (dataKirim.catatanAtauFile) {
        fileParts.push('<div style="font-size:11px;color:#64748b;margin-top:4px;">' + dataKirim.catatanAtauFile + '</div>');
      }
      fileHtml = fileParts.length ? fileParts.join('') : '-';

      nilaiDisplay = (dataKirim.nilai !== undefined && dataKirim.nilai !== null && dataKirim.nilai !== '') ? dataKirim.nilai : '-';
    } else {
      statusHtml = '<span style="color:var(--danger);font-weight:700;"><i class="fa-solid fa-circle-xmark me-1"></i>Belum</span>';
    }

    html += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td style="font-weight:600;">' + (s.nama || '-') + '</td><td>' + statusHtml + '</td><td>' + waktuHtml + '</td><td>' + fileHtml + '</td><td><b style="font-size:15px;color:var(--royal);">' + nilaiDisplay + '</b></td><td style="text-align:right;"><button class="btn-action" style="padding:5px 10px;font-size:11px;" onclick="inputNilaiTugasSiswa(\'' + tugas.id + '\', \'' + s.nisn + '\', \'' + (s.nama || '').replace(/\'/g, "\\\'") + '\', \'' + nilaiDisplay + '\')"><i class="fa-solid fa-pen-to-square me-1"></i> Nilai</button></td></tr>';
  });
  tbody.innerHTML = html;
}

function inputNilaiTugasSiswa(tugasId, nisn, namaSiswa, nilaiLama) {
  const currentVal = nilaiLama !== '-' ? nilaiLama : '';
  Swal.fire({
    title: 'Beri Nilai: ' + namaSiswa,
    input: 'number',
    inputValue: currentVal,
    inputAttributes: { min: 0, max: 100, step: 1 },
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    preConfirm: (value) => {
      if (value === '' || value < 0 || value > 100) {
        Swal.showValidationMessage('Nilai 0-100!');
        return false;
      }
      return value;
    }
  }).then((result) => {
    if (result.isConfirmed && result.value !== undefined) {
      let listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
      let index = listPengumpulan.findIndex(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(nisn));

      if (index !== -1) {
        listPengumpulan[index].nilai = parseInt(result.value);
      } else {
        listPengumpulan.push({
          tugasId: tugasId, nisn: nisn,
          waktu: 'Dinilai Langsung', catatanAtauFile: 'Manual Guru',
          nilai: parseInt(result.value), fileUrl: '', fileName: ''
        });
      }
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(listPengumpulan));

      google.script.run.updateNilaiPengumpulan(tugasId, nisn, parseInt(result.value));

      const listTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
      const tugas = listTugas.find(t => String(t.id) === String(tugasId));
      if (tugas) renderPengumpulanSiswa(tugas);

      Swal.fire({ icon: 'success', title: 'Tersimpan!', timer: 1200, showConfirmButton: false });
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
function pilihJalurNilai(jalurName) {
  selectedNilaiJalur = jalurName;
  document.getElementById('lblNilaiJalur').textContent = jalurName === 'Excellent' ? 'Excellent (+)' : 'Reguler';
  document.getElementById('dropdownNilaiJalur').classList.remove('show');

  selectedNilaiTingkat = null; selectedNilaiKelasFix = null;
  document.getElementById('lblNilaiTingkat').textContent = '-- Pilih Tingkat --';
  document.getElementById('lblNilaiKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnNilaiTingkat').disabled = false;
  document.getElementById('btnNilaiKelasFix').disabled = true;
  resetTabelNilai();
}

function pilihTingkatNilai(tingkatNum) {
  selectedNilaiTingkat = tingkatNum;
  document.getElementById('lblNilaiTingkat').textContent = 'Kelas ' + tingkatNum;
  document.getElementById('dropdownNilaiTingkat').classList.remove('show');
  populateDropdownNilaiKelasFix();
}

function populateDropdownNilaiKelasFix() {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const menuKelas = document.getElementById('dropdownNilaiKelasFix');

  let filteredKelas = databaseSiswa.filter(s => {
    const isExc = s.kelas.includes('+') || s.kelas.toLowerCase().includes('excellent');
    const cocokJalur = selectedNilaiJalur === 'Excellent' ? isExc : !isExc;
    const cocokTingkat = String(s.kelas).startsWith(String(selectedNilaiTingkat));
    return cocokJalur && cocokTingkat;
  }).map(s => s.kelas);

  let listUnikKelas = Array.from(new Set(filteredKelas)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  if (listUnikKelas.length === 0) {
    menuKelas.innerHTML = '<div class="custom-option" style="color:#94a3b8;cursor:default;">Tidak ada kelas</div>';
  } else {
    let html = '';
    listUnikKelas.forEach(kName => {
      html += '<div class="custom-option" onclick="pilihKelasFixNilai(\'' + kName + '\')"><span>' + kName + '</span><i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></div>';
    });
    menuKelas.innerHTML = html;
  }
  document.getElementById('lblNilaiKelasFix').textContent = '-- Pilih Kelas --';
  document.getElementById('btnNilaiKelasFix').disabled = false;
  resetTabelNilai();
}

function pilihKelasFixNilai(namaKelas) {
  selectedNilaiKelasFix = namaKelas;
  document.getElementById('lblNilaiKelasFix').textContent = namaKelas;
  document.getElementById('dropdownNilaiKelasFix').classList.remove('show');
  muatTabelRekapNilai(namaKelas);
}

function muatTabelRekapNilai(namaKelas) {
  const databaseSiswa = JSON.parse(localStorage.getItem('database_siswa')) || [];
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];

  const siswaInKelas = databaseSiswa.filter(s => s.kelas === namaKelas);
  const tbody = document.getElementById('tbodyNilaiSiswa');

  if (siswaInKelas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada siswa di kelas <b>' + namaKelas + '</b>.</td></tr>';
    return;
  }

  const tugasKelas = databaseTugas.filter(t => t.kelasTarget === namaKelas);

  let html = '';
  siswaInKelas.forEach(s => {
    let totalNilai = 0, jumlahNilaiAda = 0;
    tugasKelas.forEach(tgs => {
      const p = listPengumpulan.find(item => String(item.tugasId) === String(tgs.id) && String(item.nisn) === String(s.nisn));
      if (p && p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-') {
        totalNilai += parseFloat(p.nilai); jumlahNilaiAda++;
      }
    });
    let avgDisplay = '-';
    if (jumlahNilaiAda > 0) avgDisplay = (totalNilai / jumlahNilaiAda).toFixed(1);

    html += '<tr><td><b>' + (s.nisn || '-') + '</b></td><td style="font-weight:600;">' + (s.nama || '-') + '</td><td>' + jumlahNilaiAda + '/' + tugasKelas.length + '</td><td><b style="font-size:16px;color:var(--royal);">' + avgDisplay + '</b></td></tr>';
  });
  tbody.innerHTML = html;
}

function resetTabelNilai() {
  const tbody = document.getElementById('tbodyNilaiSiswa');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:28px;"><i class="fa-solid fa-filter me-1"></i> Pilih Jalur, Tingkat, dan Kelas dulu.</td></tr>';
  }
}

/* ============ LOGOUT & HAPUS ============ */
function logoutGuru() {
  Swal.fire({
    title: 'Keluar?', icon: 'question',
    showCancelButton: true, confirmButtonColor: '#2563eb', cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('active_guru');
      window.top.location.href = 'index.html';
    }
  });
}

function hapusAkunGuru() {
  Swal.fire({
    title: 'Hapus Akun Permanen?',
    text: 'Data akan dihapus dari database.',
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      google.script.run
        .withSuccessHandler(function(res) {
          localStorage.removeItem('active_guru');
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: res.message, confirmButtonColor: '#2563eb' })
            .then(() => { window.top.location.href = 'index.html'; });
        })
        .withFailureHandler(function(err) {
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
        })
        .deleteGuru(currentGuru.nama || currentGuru.hp);
    }
  });
}

/* ============ BOTTOM TAB ============ */
function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.bottom-tab').forEach(tab => tab.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  else {
    const tabMatch = document.querySelector('.bottom-tab[onclick*="\'' + sectionId + '\'"]');
    if (tabMatch) tabMatch.classList.add('active');
  }

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
