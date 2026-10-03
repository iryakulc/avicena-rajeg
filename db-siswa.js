const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';
let currentSiswa = null;

document.addEventListener('DOMContentLoaded', function() {
  const sessionData = localStorage.getItem('active_siswa');
  if (!sessionData) {
    Swal.fire({
      icon: 'warning', title: 'Akses Ditolak!',
      text: 'Silakan login dulu.',
      confirmButtonColor: '#2563eb'
    }).then(() => { window.top.location.href = 'auth-siswa.html'; });
    return;
  }

  currentSiswa = JSON.parse(sessionData);

  // 1. LANGSUNG tampilkan dashboard dari data yang ada
  populateSiswaData(currentSiswa);
  initAbsenPage();
  renderTugasSiswa();
  renderNilaiSiswa();
  updateStatOverview();

  // 2. Sync di background — TIDAK menghalangi UI
  syncBackground();
});

// Sync di background, tidak blocking
function syncBackground() {
  if (!currentSiswa) return;

  let sudahSelesai = false;
  setTimeout(function() {
    if (!sudahSelesai) {
      console.warn('Sync timeout — pakai data lokal');
    }
  }, 20000);

  google.script.run
    .withSuccessHandler(function(bundle) {
      sudahSelesai = true;
      if (!bundle) return;

      localStorage.setItem('database_siswa', JSON.stringify(bundle.siswa || []));
      localStorage.setItem('database_guru', JSON.stringify(bundle.guru || []));
      localStorage.setItem('database_tugas', JSON.stringify(bundle.tugas || []));
      localStorage.setItem('database_absensi', JSON.stringify(bundle.absensi || []));
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(bundle.pengumpulan || []));

      // Refresh tampilan dengan data baru
      initAbsenPage();
      renderTugasSiswa();
      renderNilaiSiswa();
      updateStatOverview();
    })
    .withFailureHandler(function(err) {
      sudahSelesai = true;
      console.error('Sync error:', err);
      // Diam saja, dashboard tetap jalan dengan data lokal
    })
    .getDataForSiswa(currentSiswa.nisn);
}

function populateSiswaData(siswa) {
  if (!siswa) return;
  const namaSiswa = siswa.nama || 'Siswa SMK Avicena';
  const nisn = siswa.nisn || '-';
  const kelas = siswa.kelas || '-';
  const jalur = siswa.jurusan || '-';
  const hp = siswa.hp || '-';
  const namaAyah = siswa.namaAyah || '-';
  const namaIbu = siswa.namaIbu || '-';

  document.querySelectorAll('.val-nama-siswa').forEach(el => el.textContent = namaSiswa);
  const elNisn = document.getElementById('valNisn'); if (elNisn) elNisn.textContent = nisn;
  const elNisnD = document.getElementById('valNisnDetail'); if (elNisnD) elNisnD.textContent = nisn;
  const elKelas = document.getElementById('valKelas'); if (elKelas) elKelas.textContent = kelas;
  const elLblKelas = document.getElementById('lblKelasTugasSiswa'); if (elLblKelas) elLblKelas.textContent = kelas;
  const elJalur = document.getElementById('valJalur'); if (elJalur) elJalur.textContent = jalur;
  const elJalurD = document.getElementById('valJalurDetail'); if (elJalurD) elJalurD.textContent = jalur;
  const elAyah = document.getElementById('valAyah'); if (elAyah) elAyah.textContent = namaAyah;
  const elIbu = document.getElementById('valIbu'); if (elIbu) elIbu.textContent = namaIbu;
  const elHp = document.getElementById('valHp'); if (elHp) elHp.textContent = hp;

  const words = namaSiswa.trim().split(' ');
  let inisial = words.length >= 2 ? words[0][0] + words[1][0] : words[0].substring(0, 2);
  const avatarEl = document.getElementById('avatarInisial');
  if (avatarEl) avatarEl.textContent = inisial.toUpperCase() || 'SA';
}

/* ============ ABSENSI ============ */
function initAbsenPage() {
  const inputTgl = document.getElementById('tglAbsenSiswa');
  if (inputTgl && !inputTgl.value) inputTgl.value = new Date().toISOString().split('T')[0];

  const selectGuru = document.getElementById('selectGuruAbsen');
  if (!selectGuru) return;

  const databaseGuru = JSON.parse(localStorage.getItem('database_guru')) || [];
  const statGuruEl = document.getElementById('statGuruAktif');
  if (statGuruEl) statGuruEl.textContent = databaseGuru.length;

  if (databaseGuru.length === 0) {
    selectGuru.innerHTML = '<option value="">-- Belum ada Guru Terdaftar --</option>';
    renderRiwayatAbsen();
    return;
  }

  let optionsHtml = '<option value="">-- Pilih Guru & Mapel --</option>';
  databaseGuru.forEach(guru => {
    const mu = guru.mapelUmum && guru.mapelUmum !== '-' ? guru.mapelUmum : '';
    const mk = guru.mapelKejuruan && guru.mapelKejuruan !== '-' ? guru.mapelKejuruan : '';
    let mapel = '';
    if (mu && mk) mapel = mu + ' | ' + mk;
    else if (mu) mapel = mu;
    else if (mk) mapel = mk;
    else mapel = 'Umum';
    optionsHtml += '<option value="' + guru.nama + '||' + mapel + '">' + guru.nama + ' — ' + mapel + '</option>';
  });
  selectGuru.innerHTML = optionsHtml;
  renderRiwayatAbsen();
}

function kirimAbsensiSiswa() {
  if (!currentSiswa) return;
  const selectGuru = document.getElementById('selectGuruAbsen').value;
  const tgl = document.getElementById('tglAbsenSiswa').value;
  const statusEl = document.querySelector('input[name="statusAbsen"]:checked');
  const status = statusEl ? statusEl.value : 'Hadir';

  if (!selectGuru) { Swal.fire({ icon: 'warning', title: 'Pilih Guru / Mapel dulu', confirmButtonColor: '#2563eb' }); return; }
  if (!tgl) { Swal.fire({ icon: 'warning', title: 'Pilih Tanggal dulu', confirmButtonColor: '#2563eb' }); return; }

  const parts = selectGuru.split('||');
  const namaGuru = parts[0], namaMapel = parts[1];

  let databaseAbsensi = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const indexEksis = databaseAbsensi.findIndex(a =>
    String(a.nisn) === String(currentSiswa.nisn) &&
    String(a.tanggal) === String(tgl) &&
    String(a.guru) === String(namaGuru)
  );

  const dataAbsen = {
    nisn: currentSiswa.nisn, namaSiswa: currentSiswa.nama,
    kelas: currentSiswa.kelas, guru: namaGuru, mapel: namaMapel,
    tanggal: tgl, status: status,
    waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  if (indexEksis !== -1) databaseAbsensi[indexEksis] = dataAbsen;
  else databaseAbsensi.unshift(dataAbsen);
  localStorage.setItem('database_absensi', JSON.stringify(databaseAbsensi));

  google.script.run.saveAbsensi(dataAbsen);

  Swal.fire({ icon: 'success', title: 'Presensi Berhasil!', text: 'Status [' + status + '] telah tersimpan.', confirmButtonColor: '#10b981' });
  renderRiwayatAbsen();
  updateStatOverview();
}

function renderRiwayatAbsen() {
  const tbody = document.getElementById('tbodyRiwayatAbsen');
  if (!tbody || !currentSiswa) return;
  const databaseAbsensi = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const riwayat = databaseAbsensi.filter(a => String(a.nisn) === String(currentSiswa.nisn));
  if (riwayat.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada riwayat presensi.</td></tr>';
    return;
  }
  let html = '';
  riwayat.forEach(item => {
    const colorStatus = item.status === 'Hadir' ? 'var(--emerald)' : (item.status === 'Izin' ? 'var(--gold)' : 'var(--danger)');
    html += '<tr><td><b>' + item.tanggal + '</b> <small style="color:var(--text-muted);">(' + (item.waktu || '') + ')</small></td><td><b>' + (item.mapel || '-') + '</b><br><small style="color:var(--text-muted);">' + (item.guru || '-') + '</small></td><td><span style="font-weight:800;color:' + colorStatus + ';">' + item.status + '</span></td></tr>';
  });
  tbody.innerHTML = html;
}

/* ============ TUGAS ============ */
function renderTugasSiswa() {
  const container = document.getElementById('containerDaftarTugasSiswa');
  if (!container || !currentSiswa) return;
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);

  if (tugasSiswa.length === 0) {
    container.innerHTML = '<div class="glass-card"><div class="empty-state"><i class="fa-solid fa-box-archive"></i><b>Belum Ada Tugas</b><p style="font-size:12px;margin-top:4px;">Tugas dari guru akan muncul di sini.</p></div></div>';
    return;
  }

  let html = '';
  tugasSiswa.forEach(tgs => {
    const pengumpulan = listPengumpulan.find(p => String(p.tugasId) === String(tgs.id) && String(p.nisn) === String(currentSiswa.nisn));
    const sudahKirim = !!pengumpulan;
    const nilaiText = (pengumpulan && pengumpulan.nilai !== undefined && pengumpulan.nilai !== null && pengumpulan.nilai !== '') ? pengumpulan.nilai : null;

    let badgeStatus = '';
    if (sudahKirim) {
      if (nilaiText !== null) {
        badgeStatus = '<span style="background:rgba(16,185,129,0.15);color:var(--emerald);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-check-circle me-1"></i>Dinilai (' + nilaiText + ')</span>';
      } else {
        badgeStatus = '<span style="background:rgba(37,99,235,0.15);color:var(--royal);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-clock me-1"></i>Dikirim</span>';
      }
    } else {
      badgeStatus = '<span style="background:rgba(239,68,68,0.15);color:var(--danger);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-triangle-exclamation me-1"></i>Belum</span>';
    }

    let filePreview = '';
    if (sudahKirim && pengumpulan.fileUrl) {
      filePreview = '<div style="margin-top:8px;font-size:11px;"><i class="fa-solid fa-paperclip"></i> <a href="' + pengumpulan.fileUrl + '" target="_blank" style="color:#2563eb;">' + (pengumpulan.fileName || 'Lihat File') + '</a></div>';
    }

    const judulEsc = String(tgs.judul).replace(/'/g, "\\'");
    html += '<div class="glass-card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><div><h3 style="margin:0 0 4px;font-size:16px;">' + tgs.judul + '</h3><span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-user-tie me-1"></i>' + (tgs.pembuatGuru || 'Guru') + '</span></div>' + badgeStatus + '</div><p style="font-size:13px;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;margin:8px 0;">' + (tgs.deskripsi || '-') + '</p>' + filePreview + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:var(--text-muted);"><span><i class="fa-solid fa-calendar me-1"></i>' + tgs.deadlineTgl + ' (' + tgs.deadlineJam + ')</span><button class="btn-top-nav" style="background:var(--royal);color:#fff;border:none;padding:6px 14px;border-radius:8px;" onclick="kirimJawabanTugas(\'' + tgs.id + '\', \'' + judulEsc + '\')"><i class="fa-solid fa-paper-plane me-1"></i> ' + (sudahKirim ? 'Edit' : 'Kirim') + '</button></div></div>';
  });
  container.innerHTML = html;
}

function kirimJawabanTugas(tugasId, judulTugas) {
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const pEksis = listPengumpulan.find(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
  const isiLama = pEksis ? (pEksis.catatanAtauFile || '') : '';
  const fileLamaHtml = (pEksis && pEksis.fileUrl)
    ? '<div style="margin-top:10px;padding:8px;background:#eff6ff;border-radius:8px;font-size:12px;text-align:left;">📎 File lama: <a href="' + pEksis.fileUrl + '" target="_blank" style="color:#2563eb;font-weight:700;">' + (pEksis.fileName || 'Lihat') + '</a></div>'
    : '';

  Swal.fire({
    title: 'Kirim Tugas',
    html:
      '<p style="font-size:13px;color:#475569;margin-bottom:10px;text-align:left;">' + judulTugas + '</p>' +
      '<textarea id="swalCatatan" class="swal2-textarea" placeholder="Catatan (opsional)..." style="margin:0;">' + isiLama + '</textarea>' +
      '<div style="text-align:left;margin-top:12px;">' +
        '<label style="font-size:12px;font-weight:700;color:#0f172a;display:block;margin-bottom:6px;">📎 Upload File (maks 5MB):</label>' +
        '<input type="file" id="swalFile" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
        '<div id="fileInfo" style="font-size:11px;color:#64748b;margin-top:6px;"></div>' +
      '</div>' + fileLamaHtml,
    showCancelButton: true,
    confirmButtonText: 'Kirim',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    width: 550,
    didOpen: () => {
      const fileInput = document.getElementById('swalFile');
      fileInput.addEventListener('change', function() {
        const f = this.files[0];
        const info = document.getElementById('fileInfo');
        if (f) {
          const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
          if (f.size > 5 * 1024 * 1024) {
            info.textContent = '❌ ' + f.name + ' (' + sizeMB + ' MB) terlalu besar! Maks 5MB.';
            info.style.color = '#ef4444';
          } else {
            info.textContent = '✅ ' + f.name + ' (' + sizeMB + ' MB)';
            info.style.color = '#10b981';
          }
        }
      });
    }
  }).then((res) => {
    if (!res.isConfirmed) return;
    const catatan = document.getElementById('swalCatatan').value.trim();
    const file = document.getElementById('swalFile').files[0];

    if (file && file.size > 5 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'File terlalu besar!', text: 'Maksimal 5MB.' });
      return;
    }
    if (!catatan && !file && !pEksis) {
      Swal.fire({ icon: 'warning', title: 'Kosong!', text: 'Isi catatan atau upload file.' });
      return;
    }

    Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const base64 = e.target.result.split(',')[1];
        google.script.run
          .withSuccessHandler(function(uploadRes) {
            if (uploadRes.status !== 'success') {
              Swal.fire({ icon: 'error', title: 'Upload gagal', text: uploadRes.message });
              return;
            }
            simpanPengumpulan(tugasId, catatan, uploadRes, pEksis);
          })
          .withFailureHandler(function(err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
          })
          .uploadFileToDrive(base64, file.name, file.type);
      };
      reader.readAsDataURL(file);
    } else {
      simpanPengumpulan(tugasId, catatan, null, pEksis);
    }
  });
}

function simpanPengumpulan(tugasId, catatan, uploadRes, pEksis) {
  const waktuSekarang = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  const dataKumpul = {
    tugasId: tugasId, nisn: currentSiswa.nisn, namaSiswa: currentSiswa.nama,
    waktu: waktuSekarang, catatanAtauFile: catatan || '',
    fileUrl: uploadRes ? uploadRes.fileUrl : (pEksis ? pEksis.fileUrl : ''),
    fileName: uploadRes ? uploadRes.fileName : (pEksis ? pEksis.fileName : ''),
    nilai: pEksis ? pEksis.nilai : ''
  };

  google.script.run
    .withSuccessHandler(function() {
      let list = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
      let idx = list.findIndex(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
      if (idx !== -1) list[idx] = dataKumpul;
      else list.push(dataKumpul);
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(list));
      Swal.fire({ icon: 'success', title: 'Terkirim!', text: uploadRes ? 'File di-upload ke Drive.' : 'Catatan tersimpan.', confirmButtonColor: '#10b981' });
      renderTugasSiswa();
      renderNilaiSiswa();
      updateStatOverview();
    })
    .withFailureHandler(function(err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    })
    .savePengumpulan(dataKumpul);
}

/* ============ NILAI ============ */
function renderNilaiSiswa() {
  const tbody = document.getElementById('tbodyNilaiSiswa');
  if (!tbody || !currentSiswa) return;
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  if (tugasSiswa.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada nilai.</td></tr>';
    return;
  }
  let html = '';
  tugasSiswa.forEach(tgs => {
    const p = listPengumpulan.find(item => String(item.tugasId) === String(tgs.id) && String(item.nisn) === String(currentSiswa.nisn));
    const adaNilai = p && (p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-');
    const statusBadge = adaNilai
      ? '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-circle-check me-1"></i>Sudah</span>'
      : '<span style="color:var(--gold);font-weight:700;"><i class="fa-solid fa-clock me-1"></i>Belum</span>';
    const nilaiVal = adaNilai ? '<b style="font-size:16px;color:var(--royal);">' + p.nilai + '</b>' : '-';
    html += '<tr><td><b>' + tgs.judul + '</b></td><td>' + (tgs.pembuatGuru || '-') + '</td><td>' + statusBadge + '</td><td>' + nilaiVal + '</td></tr>';
  });
  tbody.innerHTML = html;
}

function updateStatOverview() {
  if (!currentSiswa) return;
  const databaseAbsensi = JSON.parse(localStorage.getItem('database_absensi')) || [];
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const myAbsen = databaseAbsensi.filter(a => String(a.nisn) === String(currentSiswa.nisn));
  const totalHadir = myAbsen.filter(a => a.status === 'Hadir').length;
  const persen = myAbsen.length > 0 ? Math.round((totalHadir / myAbsen.length) * 100) : 0;
  const elPresensi = document.getElementById('statPresensiBulan'); if (elPresensi) elPresensi.textContent = persen + '%';

  const tugasKelas = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  let pendingCount = 0, totalNilai = 0, countNilai = 0;
  tugasKelas.forEach(tgs => {
    const p = listPengumpulan.find(item => String(item.tugasId) === String(tgs.id) && String(item.nisn) === String(currentSiswa.nisn));
    if (!p) pendingCount++;
    if (p && p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-') {
      totalNilai += parseFloat(p.nilai); countNilai++;
    }
  });
  const elPending = document.getElementById('statTugasPending'); if (elPending) elPending.textContent = pendingCount;
  const rata = countNilai > 0 ? (totalNilai / countNilai).toFixed(1) : '0.0';
  const elRata = document.getElementById('statRataNilai'); if (elRata) elRata.textContent = rata;
}

/* ============ AUTH ============ */
function logoutSiswa() {
  Swal.fire({
    title: 'Keluar?', icon: 'question',
    showCancelButton: true, confirmButtonColor: '#2563eb', cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('active_siswa');
      window.top.location.href = 'index.html';
    }
  });
}

function hapusAkunSiswa() {
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
          localStorage.removeItem('active_siswa');
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: res.message, confirmButtonColor: '#2563eb' })
            .then(() => { window.top.location.href = 'index.html'; });
        })
        .withFailureHandler(function(err) {
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
        })
        .deleteSiswa(currentSiswa.nisn);
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
