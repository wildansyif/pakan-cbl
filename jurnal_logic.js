// ==========================================
// LOGIKA JURNAL UMUM (DOUBLE-ENTRY)
// Mengambil data dari view_jurnal_umum
// ==========================================

let jurnalDataGlobal = [];

async function fetchDataJurnal(silent = false) {
    let bulan = document.getElementById('jurnal-bulan').value;
    let tahun = document.getElementById('jurnal-tahun').value;
    
    let start, end;
    if (bulan === 'ALL') {
        start = `${tahun}-01-01`;
        end = `${tahun}-12-31`;
    } else {
        start = `${tahun}-${bulan}-01`;
        // Mencari hari terakhir di bulan tsb
        let lastDay = new Date(tahun, Number(bulan), 0).getDate();
        end = `${tahun}-${bulan}-${lastDay}`;
    }

    if (!silent) {
        document.getElementById('jurnal-loader').classList.remove('hidden');
        document.getElementById('tbody-jurnal').innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">Memuat data jurnal...</td></tr>`;
    }

    try {
        let res = await fetch(`${SUPA_URL}/rest/v1/view_jurnal_umum?tanggal=gte.${start}&tanggal=lte.${end}&order=tanggal.asc,id_jurnal.asc`, {
            headers: {
                'apikey': SUPA_ANON_KEY,
                'Authorization': `Bearer ${SUPA_ANON_KEY}`
            }
        });
        
        if (res.ok) {
            let data = await res.json();
            jurnalDataGlobal = data;
            renderJurnal(data);
        } else {
            console.error("Gagal load jurnal", await res.text());
        }
    } catch (e) {
        console.error("Network error jurnal", e);
    } finally {
        if (!silent) document.getElementById('jurnal-loader').classList.add('hidden');
    }
}

function renderJurnal(data) {
    let tbody = document.getElementById('tbody-jurnal');
    let tDebit = 0;
    let tKredit = 0;
    
    let html = "";
    
    // Ambil nilai dari filter tambahan
    let fKode = document.getElementById('jurnal-kode').value;
    let fPerkiraan = document.getElementById('jurnal-perkiraan').value.toLowerCase();
    let fRelasi = document.getElementById('jurnal-relasi').value.toLowerCase();
    
    let filtered = data;
    
    if (fKode || fPerkiraan || fRelasi) {
        filtered = data.filter(d => {
            let matchKode = !fKode || (d.kode_akun && d.kode_akun.startsWith(fKode));
            let matchPerkiraan = !fPerkiraan || (d.nama_akun && d.nama_akun.toLowerCase().includes(fPerkiraan));
            let matchRelasi = !fRelasi || (d.relasi && d.relasi.toLowerCase().includes(fRelasi));
            return matchKode && matchPerkiraan && matchRelasi;
        });
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">Tidak ada transaksi jurnal pada rentang ini.</td></tr>`;
        document.getElementById('jurnal-total-debit').innerText = "0";
        document.getElementById('jurnal-total-kredit').innerText = "0";
        document.getElementById('jurnal-total-saldo').innerText = "0";
        return;
    }

    let nf = new Intl.NumberFormat('id-ID');
    let runningSaldo = 0;
    
    // Tarik data piutang lokal untuk lookup detail potongan nota
    let dataPiutangCache = localStorage.getItem('piutang_ptcbl_cache');
    let piutangParsed = dataPiutangCache ? JSON.parse(dataPiutangCache) : null;
    
    filtered.forEach(d => {
        let tglStr = d.tanggal.split('-').reverse().join('/');
        let tglUraian = Number(d.tanggal.split('-')[2]) + '/' + Number(d.tanggal.split('-')[1]);
        
        // Ambil digit pertama dari kode akun
        let kodeDepan = d.kode_akun ? d.kode_akun.charAt(0) : "-";
        
        // Format angka (kosong jika 0)
        let debNum = Number(d.debit) || 0;
        let kreNum = Number(d.kredit) || 0;
        
        let debStr = debNum > 0 ? nf.format(debNum) : "";
        let kreStr = kreNum > 0 ? nf.format(kreNum) : "";
        
        // Hitung Saldo Berjalan
        runningSaldo += (debNum - kreNum);
        let saldoStr = runningSaldo === 0 ? "0" : nf.format(runningSaldo);
        
        // Gabungkan Uraian Dasar
        let uraian = `${d.nama_akun}. ${tglUraian} ${d.relasi ? d.relasi + ' ' : ''}${d.deskripsi}`;
        
        // 🔥 INJEKSI DETAIL NOTA PIUTANG JIKA INI ADALAH PEMBAYARAN KAS
        if (d.id_jurnal && d.id_jurnal.startsWith('CF-') && piutangParsed && d.relasi && piutangParsed[d.relasi] && piutangParsed[d.relasi].riwayat_all) {
            let nominalCari = debNum > 0 ? debNum : kreNum;
            // Cari pembayaran yang cocok di riwayat_all (berdasarkan tgl & nominal)
            // Karena mungkin ada double, kita cari yang belum diproses (kita tandai sementara)
            let matchedBayar = piutangParsed[d.relasi].riwayat_all.find(b => b.tgl === d.tanggal && b.nominal === nominalCari && !b._jurnal_used);
            
            if (matchedBayar && matchedBayar.detailPotongan && matchedBayar.detailPotongan.length > 0) {
                matchedBayar._jurnal_used = true; // Tandai agar tidak ganda jika ada pembayaran kembar
                let teksPotong = matchedBayar.detailPotongan.map(p => {
                    return `Nota ${p.tglNota} (Rp ${nf.format(p.jumlah)})`;
                }).join('; ');
                
                uraian += ` [Memotong: ${teksPotong}]`;
            }
        }
        
        let bg = debNum > 0 ? "background:#f9fdfa;" : "background:#fefafa;";
        
        html += `<tr style="${bg} border-bottom:1px solid #eee;">
            <td style="padding:10px;">${tglStr}</td>
            <td style="padding:10px; text-align:center;">${kodeDepan}</td>
            <td style="padding:10px;">${d.nama_akun}</td>
            <td style="padding:10px;">${d.relasi || ''}</td>
            <td style="padding:10px;">${uraian}</td>
            <td style="padding:10px; text-align:right;">${debStr}</td>
            <td style="padding:10px; text-align:right;">${kreStr}</td>
            <td style="padding:10px; text-align:right;">${saldoStr}</td>
        </tr>`;
        
        tDebit += debNum;
        tKredit += kreNum;
    });

    tbody.innerHTML = html;
    document.getElementById('jurnal-total-debit').innerText = nf.format(tDebit);
    document.getElementById('jurnal-total-kredit').innerText = nf.format(tKredit);
    document.getElementById('jurnal-total-saldo').innerText = nf.format(tDebit - tKredit);
    
    // Peringatan jika tidak balance
    if (tDebit !== tKredit) {
        document.getElementById('jurnal-total-debit').style.color = "#c62828";
        document.getElementById('jurnal-total-kredit').style.color = "#c62828";
    } else {
        document.getElementById('jurnal-total-debit').style.color = "#2e7d32";
        document.getElementById('jurnal-total-kredit').style.color = "#2e7d32";
    }
}

// Inisialisasi Tanggal Saat Buka Menu Jurnal
function initTanggalJurnal() {
    if (!document.getElementById('jurnal-bulan').value || document.getElementById('jurnal-bulan').value === 'ALL') {
        let now = new Date();
        document.getElementById('jurnal-bulan').value = ("0" + (now.getMonth() + 1)).slice(-2);
        document.getElementById('jurnal-tahun').value = now.getFullYear();
    }
}

function exportExcelJurnal() {
    if (jurnalDataGlobal.length === 0) {
        alert("Tidak ada data untuk diexport!");
        return;
    }
    alert("Fitur Export Excel Jurnal akan dikembangkan di tahap selanjutnya!");
}

// Tambahkan Event Listener Search Realtime
document.getElementById('jurnal-kode').addEventListener('change', () => renderJurnal(jurnalDataGlobal));
document.getElementById('jurnal-perkiraan').addEventListener('input', () => renderJurnal(jurnalDataGlobal));
document.getElementById('jurnal-relasi').addEventListener('input', () => renderJurnal(jurnalDataGlobal));
