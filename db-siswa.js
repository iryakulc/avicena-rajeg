const API_URL = 'https://script.google.com/macros/s/AKfycbzX1pbVQKisdmesboeROBQ6O5u4WVErBoW_UwdILnvEY2G0uGeNO-UGVU9Fr5ZW88iHvA/exec';

let currentSiswa = null;

function callAPI(payload) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(res) { return res.json(); });
}

document.addEventListener('DOMContentLoaded', function() {
  const sessionData = localStorage.getItem('active_siswa');
  if (!sessionData) {
    Swal.fire({
      icon: 'warning',
      title: 'Akses Ditolak!',
      text: 'Silakan login atau daftar akun siswa terlebih dahulu.',
      confirmButtonColor: '#2563eb'
    }).then(() => { window.location.href = 'auth-siswa.html'; });
    return;
  }

  try {
    currentSiswa = JSON.parse(sessionData);
    populateSiswaData(currentSiswa);
    Swal.fire({ title: 'Sinkronisasi data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    callAPI({ action: 'get_all_for_siswa' })
      .then(function(res) {
        const bundle = res.data || {};
        localStorage.setItem('database_siswa', JSON.stringify(bundle.siswa || []));
        localStorage.setItem('database_guru', JSON.stringify(bundle.guru || []));
        localStorage.setItem('database_tugas', JSON.stringify(bundle.tugas || []));
        localStorage.setItem('database_absensi', JSON.stringify(bundle.absensi || []));
        localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(bundle.pengumpulan || []));
        initAbsenPage();
        renderTugasSiswa();
        renderNilaiSiswa();
        updateStatOverview();
        Swal.close();
      })
      .catch(function(err) {
        console.error('Sync error:', err);
        initAbsenPage();
        renderTugasSiswa();
        renderNilaiSiswa();
        updateStatOverview();
        Swal.close();
      });
  } catch (e) {
    console.error('Error parsing data siswa:', e);
  }
});

function populateSiswaData(siswa) {
  if (!siswa) return;
  const namaSiswa = siswa.nama || siswa.namaLengkap || 'Siswa SMK Avicena';
  const nisn = siswa.nisn || '-';
  const kelas = siswa.kelas || '-';
  const jalur = siswa.jalur || siswa.jurusan || siswa.programKeahlian || 'Teknik Komputer dan Jaringan';
  const hp = siswa.hp || siswa.noHp || siswa.whatsapp || '-';
  let namaAyah = siswa.namaAyah || siswa.ayah || '-';
  let namaIbu = siswa.namaIbu || siswa.ibu || '-';

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
    const mapel = guru.mapelUmum || guru.mapelKejuruan || 'Umum';
    optionsHtml += '<option value="' + guru.nama + '||' + mapel + '">' + guru.nama + ' — Mapel: ' + mapel + '</option>';
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

  if (!selectGuru) {
    Swal.fire({ icon: 'warning', title: 'Pilih Guru / Mapel', text: 'Silakan pilih guru pengajar terlebih dahulu.', confirmButtonColor: '#2563eb' });
    return;
  }
  if (!tgl) {
    Swal.fire({ icon: 'warning', title: 'Pilih Tanggal', text: 'Silakan isi tanggal presensi.', confirmButtonColor: '#2563eb' });
    return;
  }

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

  callAPI({ action: 'save_absensi', absensi: dataAbsen });

  Swal.fire({ icon: 'success', title: 'Presensi Berhasil!', text: 'Status presensi [' + status + '] untuk mapel ' + namaMapel + ' (' + namaGuru + ') telah tersimpan.', confirmButtonColor: '#10b981' });
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

function renderTugasSiswa() {
  const container = document.getElementById('containerDaftarTugasSiswa');
  if (!container || !currentSiswa) return;
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);

  if (tugasSiswa.length === 0) {
    container.innerHTML = '<div class="glass-card"><div class="empty-state"><i class="fa-solid fa-box-archive"></i><b>Belum Ada Tugas Diberikan</b><p style="font-size:12px;margin-top:4px;">Belum ada tugas khusus untuk kelas <b>' + (currentSiswa.kelas || '') + '</b>.</p></div></div>';
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
        badgeStatus = '<span style="background:rgba(16,185,129,0.15);color:var(--emerald);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-check-circle me-1"></i>Sudah Dinilai (' + nilaiText + ')</span>';
      } else {
        badgeStatus = '<span style="background:rgba(37,99,235,0.15);color:var(--royal);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-clock me-1"></i>Sudah Dikirim (Menunggu Koreksi)</span>';
      }
    } else {
      badgeStatus = '<span style="background:rgba(239,68,68,0.15);color:var(--danger);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fa-solid fa-triangle-exclamation me-1"></i>Belum Dikirim</span>';
    }
    const judulEsc = String(tgs.judul).replace(/\'/g, "\\\'");
    html += '<div class="glass-card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><div><h3 style="margin:0 0 4px;font-size:16px;color:var(--navy-deep);">' + tgs.judul + '</h3><span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-user-tie me-1"></i>Guru: <b>' + (tgs.pembuatGuru || 'Pengajar') + '</b></span></div>' + badgeStatus + '</div><p style="font-size:13px;color:var(--navy-soft);margin:8px 0;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;">' + (tgs.deskripsi || 'Tidak ada deskripsi tambahan.') + '</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:var(--text-muted);"><span><i class="fa-solid fa-calendar me-1"></i>Tenggat: <b>' + tgs.deadlineTgl + ' (' + tgs.deadlineJam + ')</b></span><button class="btn-top-nav" style="background:var(--royal);color:#fff;border:none;padding:6px 14px;border-radius:8px;" onclick="kirimJawabanTugas(\'' + tgs.id + '\', \'' + judulEsc + '\')"><i class="fa-solid fa-paper-plane me-1"></i> ' + (sudahKirim ? 'Edit Jawaban' : 'Kirim Jawaban') + '</button></div></div>';
  });
  container.innerHTML = html;
}

function kirimJawabanTugas(tugasId, judulTugas) {
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const pEksis = listPengumpulan.find(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
  const isiLama = pEksis ? (pEksis.catatanAtauFile || '') : '';

  Swal.fire({
    title: 'Kirim Tugas', text: judulTugas,
    input: 'textarea', inputValue: isiLama,
    inputPlaceholder: 'Tuliskan catatan jawaban atau masukkan link Google Drive/File kamu di sini...',
    showCancelButton: true,
    confirmButtonText: 'Kirim Jawaban', cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    preConfirm: (val) => {
      if (!val.trim()) { Swal.showValidationMessage('Jawaban / Tautan tugas tidak boleh kosong!'); return false; }
      return val.trim();
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      let list = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
      let idx = list.findIndex(p => String(p.tugasId) === String(tugasId) && String(p.nisn) === String(currentSiswa.nisn));
      const waktuSekarang = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
      if (idx !== -1) {
        list[idx].catatanAtauFile = res.value;
        list[idx].waktu = waktuSekarang;
      } else {
        list.push({
          tugasId: tugasId, nisn: currentSiswa.nisn,
          namaSiswa: currentSiswa.nama, waktu: waktuSekarang,
          catatanAtauFile: res.value, nilai: ''
        });
      }
      localStorage.setItem('database_pengumpulan_tugas', JSON.stringify(list));
      const payload = (idx !== -1) ? list[idx] : list[list.length - 1];
      callAPI({ action: 'save_pengumpulan', pengumpulan: payload });
      Swal.fire({ icon: 'success', title: 'Jawaban Terkirim!', text: 'Jawaban tugas berhasil dikirimkan ke guru pengajar.', confirmButtonColor: '#10b981' });
      renderTugasSiswa();
      renderNilaiSiswa();
      updateStatOverview();
    }
  });
}

function renderNilaiSiswa() {
  const tbody = document.getElementById('tbodyNilaiSiswa');
  if (!tbody || !currentSiswa) return;
  const databaseTugas = JSON.parse(localStorage.getItem('database_tugas')) || [];
  const listPengumpulan = JSON.parse(localStorage.getItem('database_pengumpulan_tugas')) || [];
  const tugasSiswa = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);

  if (tugasSiswa.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada tugas & nilai tercatat.</td></tr>';
    return;
  }

  let html = '';
  tugasSiswa.forEach(tgs => {
    const p = listPengumpulan.find(item => String(item.tugasId) === String(tgs.id) && String(item.nisn) === String(currentSiswa.nisn));
    const adaNilai = p && (p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-');
    const statusBadge = adaNilai
      ? '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-circle-check me-1"></i>Sudah Dikoreksi</span>'
      : '<span style="color:var(--gold);font-weight:700;"><i class="fa-solid fa-clock me-1"></i>Belum Dikoreksi</span>';
    const nilaiVal = adaNilai ? '<b style="font-size:16px;color:var(--royal);">' + p.nilai + '</b>' : '<span style="color:var(--text-muted);">-</span>';
    html += '<tr><td><b>' + tgs.judul + '</b></td><td><b>' + (tgs.pembuatGuru || 'Guru Pengajar') + '</b></td><td>' + statusBadge + '</td><td>' + nilaiVal + '</td></tr>';
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
  const persenPresensi = myAbsen.length > 0 ? Math.round((totalHadir / myAbsen.length) * 100) : 0;
  const elPresensi = document.getElementById('statPresensiBulan');
  if (elPresensi) elPresensi.textContent = persenPresensi + '%';

  const tugasKelas = databaseTugas.filter(t => t.kelasTarget === currentSiswa.kelas);
  let pendingCount = 0, totalNilai = 0, countNilai = 0;
  tugasKelas.forEach(tgs => {
    const p = listPengumpulan.find(item => String(item.tugasId) === String(tgs.id) && String(item.nisn) === String(currentSiswa.nisn));
    if (!p) pendingCount++;
    if (p && p.nilai !== undefined && p.nilai !== null && p.nilai !== '' && p.nilai !== '-') {
      totalNilai += parseFloat(p.nilai);
      countNilai++;
    }
  });
  const elPending = document.getElementById('statTugasPending');
  if (elPending) elPending.textContent = pendingCount;
  const rata = countNilai > 0 ? (totalNilai / countNilai).toFixed(1) : '0.0';
  const elRata = document.getElementById('statRataNilai');
  if (elRata) elRata.textContent = rata;
}

function logoutSiswa() {
  Swal.fire({
    title: 'Keluar Portal Siswa?',
    text: 'Sesi Anda akan diakhiri. Anda bisa kembali kapan saja.',
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('active_siswa');
      window.location.href = 'index.html';
    }
  });
}

function hapusAkunSiswa() {
  Swal.fire({
    title: 'Hapus Akun Permanen?',
    text: 'Peringatan! Data akun siswa Anda akan dihapus dari sistem.',
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus Akun', cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('active_siswa');
      Swal.fire({ icon: 'success', title: 'Sesi Dihapus!', text: 'Anda telah keluar dari akun.', confirmButtonColor: '#2563eb' })
        .then(() => { window.location.href = 'index.html'; });
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
