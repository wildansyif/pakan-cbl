// --- 1. KONFIGURASI ID SPREADSHEET (WAJIB ADA DI PALING ATAS) ---
const ID_PM = '19BjbKiFCHF1OLI149pRA5t29NGtj9OQtGk292Tycwp4';
const ID_SPN = '1cNr6MILEZUOVMf5jHWR4j6H4Oecldz1iITJmdMAn3g0';
const ID_RPH = '1jJBvXkSEqFbIIky1EjWq8Fq0DRISvzh8356Y7vLep-g';

const ID_CASHFLOW_SS = '1VvhiftrnOL5_SkinTBSlWz6gCtWXtfpQzt9Uf0Sb-zo';
const ID_FOLDER_BUKTI = '1ubTbKqstsGJcb0ToByrZN0h6sX3aWZza';
const ID_MASTER_DB = '1MnMu9ud_wd30XTKbs17ksIRbY-jeT35curVCgxtggF0';

const ALIAS_PAKAN = {
    "S20": "Mako S-20", "RL": "Ransum Laktasi", "RD": "Ransum Darbun",
    "A20": "Mako A-20", "SP15": "Mako SP-15", "MM": "Meal Mix",
    "RK": "Rapen Kedelai", "PS": "Pongkol Singkong", "SE": "Silase Edamame",
    "BS": "Bio Smart", "MC": "Mix Calf", "YD": "YD", "KOPRA": "Kopra",
    "RKH": "Rapen Kacang Hijau", "KFZS": "KFZS", "SJ": "Silase Jagung", "HK": "Hay Kangkung"
};

const RELASI_MUTASI = ["spn", "rph", "pembibitan", "cibulakan", "kandang", "pm"];

// =======================================================
// BAGIAN A: API ENDPOINTS (GET & POST)
// =======================================================

function doGet(e) {
    let action = "";
    if (e && e.parameter && e.parameter.action) {
        action = e.parameter.action;
    }

    if (action === 'getPakan') {
        let lokasi = e.parameter.lokasi || '/pm';
        let data = getDaftarPakanDynamic(lokasi);
        return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getRelasi') {
        let ssRelasi = SpreadsheetApp.openById("1MnMu9ud_wd30XTKbs17ksIRbY-jeT35curVCgxtggF0");
        let sheetRelasi = ssRelasi.getSheetByName("Data Konsumen");
        let data = sheetRelasi.getDataRange().getValues();
        let result = [];

        for (let i = 1; i < data.length; i++) {
            if (data[i][0]) {
                result.push({
                    nama: String(data[i][0]).trim(),
                    alamat: String(data[i][1]).trim(),
                    hp: String(data[i][2]).trim()
                });
            }
        }
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("OK");
}

function getMasterRelasi() {
    try {
        const ss = SpreadsheetApp.openById(ID_PM);
        const sheet = ss.getSheetByName('Akun Konsumen');
        if (!sheet) return { status: 'error', data: [] };
        const data = sheet.getDataRange().getValues();
        let relasiList = [];
        for (let i = 1; i < data.length; i++) {
            let nama = String(data[i][0] || "").trim();
            let alamat = String(data[i][1] || "").trim();
            if (nama !== "") relasiList.push({ nama: nama, alamat: alamat });
        }
        return { status: 'success', data: relasiList };
    } catch (e) { return { status: 'error', data: [] }; }
}

function getDaftarPakanDynamic(lokasi) {
    let targetId = ID_PM;
    if (lokasi === '/spn') targetId = ID_SPN;
    if (lokasi === '/rph') targetId = ID_RPH;
    try {
        const ss = SpreadsheetApp.openById(targetId);
        const sheetAkun = ss.getSheetByName('Akun Pakan');
        if (!sheetAkun) return { status: 'error', message: 'Sheet "Akun Pakan" tidak ditemukan.' };
        const lastRow = sheetAkun.getLastRow();
        if (lastRow < 3) return { status: 'success', data: [] };
        const data = sheetAkun.getRange(3, 1, lastRow - 2, 6).getValues();
        // --- 1. Ambil list dasar dari Akun Pakan ---
        let pakanList = [];
        data.forEach(row => {
            let nama = row[1], harga = Number(row[2]) || 0, kemasan = Number(row[3]) || 0;
            let satuan = row[4] || "", statusTampil = String(row[5]).toLowerCase().trim();
            if (nama && nama !== "" && statusTampil !== "hide") pakanList.push({ nama, harga, kemasan, satuan });
        });

        // --- 2. Timpa harga dengan harga terbaru dari 'Data Harga' (Pusat) ---
        try {
            const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
            const sheetHarga = cfSS.getSheetByName('Data Harga');
            if (sheetHarga) {
                let lastH = sheetHarga.getLastRow();
                if (lastH > 0) {
                    let dataH = sheetHarga.getRange(1, 1, lastH, 3).getValues();
                    let hargaMap = {};

                    // Membaca dari atas ke bawah, baris terbawah (terbaru) akan menimpa baris lama
                    for (let i = 0; i < dataH.length; i++) {
                        let namaPakan = String(dataH[i][1] || "").trim().toLowerCase();
                        let hargaStr = String(dataH[i][2] || "").trim().replace(/\./g, '').replace(/,/g, '.');
                        let hargaNum = parseFloat(hargaStr);
                        if (namaPakan !== "" && !isNaN(hargaNum)) {
                            hargaMap[namaPakan] = hargaNum;
                        }
                    }

                    // Terapkan harga terbaru ke list pakan
                    for (let i = 0; i < pakanList.length; i++) {
                        let p = pakanList[i].nama.toLowerCase();
                        if (hargaMap[p] !== undefined) {
                            pakanList[i].harga = hargaMap[p];
                        }
                    }
                }
            }
        } catch (e) { /* Lanjut gunakan harga default dari Akun Pakan jika gagal */ }

        return { status: 'success', data: pakanList };
    } catch (e) { return { status: 'error', message: e.toString() }; }
}

function doPost(e) {
    if (!e || !e.postData || !e.postData.contents) return ContentService.createTextOutput("OK");
    try {
        const contents = JSON.parse(e.postData.contents);

        // ============================================
        // 0. FORM REGISTRASI & CEK MEMBER (KONSUMEN)
        // ============================================

        // A. CEK STATUS MEMBER
        if (contents.source === 'check_member') {
            try {
                const ss = SpreadsheetApp.openById('1MnMu9ud_wd30XTKbs17ksIRbY-jeT35curVCgxtggF0');
                let sheet = ss.getSheetByName('Data Member');
                if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'unregistered' })).setMimeType(ContentService.MimeType.JSON);

                let data = sheet.getDataRange().getValues();
                let isRegistered = false;
                let targetNama = String(contents.nama).trim().toLowerCase();

                // Kolom B (index 1) adalah Nama Relasi (Sistem)
                for (let i = 1; i < data.length; i++) {
                    if (String(data[i][1]).trim().toLowerCase() === targetNama) {
                        isRegistered = true;
                        break;
                    }
                }

                if (isRegistered) {
                    return ContentService.createTextOutput(JSON.stringify({ status: 'registered' })).setMimeType(ContentService.MimeType.JSON);
                } else {
                    return ContentService.createTextOutput(JSON.stringify({ status: 'unregistered' })).setMimeType(ContentService.MimeType.JSON);
                }
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // ============================================
        // B. SIMPAN REGISTRASI MEMBER (FIX KANDANG & GUDANG)
        // ============================================
        if (contents.source === 'register_member') {
            try {
                const ss = SpreadsheetApp.openById(ID_MASTER_DB);
                let sheet = ss.getSheetByName('Data Member');

                if (!sheet) {
                    sheet = ss.insertSheet('Data Member');
                    sheet.appendRow([
                        'Timestamp', 'Nama Relasi (Sistem)', 'Nama Lengkap', 'Kategori Mitra',
                        'No WA', 'Sapi Perah (Ekor)', 'Sapi Non-Perah (Ekor)',
                        'Kapasitas Kandang (Ekor)', 'Kapasitas Gudang Pakan (Kg)',
                        'Akses Jalan', 'Latitude', 'Longitude', 'Link Google Maps'
                    ]);
                    sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#8AA624").setFontColor("white");
                }

                let tgl = new Date();
                let p = contents.payload;

                let mapsLink = (p.lat && p.lng) ? `=HYPERLINK("http://maps.google.com/maps?q=${p.lat},${p.lng}", "📍 Buka Peta")` : "Tanpa Koordinat";

                // PASTIKAN URUTAN INI SAMA PERSIS DENGAN KOLOM SPREADSHEET
                sheet.appendRow([
                    tgl,
                    p.namaSistem,
                    p.namaLengkap,
                    p.kategori,
                    p.wa,
                    p.sapiPerah,
                    p.sapiNonPerah,
                    p.kapasitasKandang, // <--- INI YANG KEMARIN KETINGGALAN
                    p.kapasitasGudang,
                    p.akses,
                    p.lat,
                    p.lng,
                    mapsLink
                ]);

                return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pendaftaran Berhasil!' })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // 1. INPUT PAKAN
        if (contents.source === 'pwa_cbl') {
            let res;
            if (contents.payload && contents.payload.isBatch) {
                res = submitDariPWABackendBatch(contents.payload);
            } else {
                res = submitDariPWABackend(contents.payload);
            }
            return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
        }


        // 2. TARIK REKAP DASHBOARD
        if (contents.source === 'pwa_rekap') {
            let hasil = tarikDataRekapDB(contents);
            return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
        }

        // 3. INPUT CASHFLOW
        if (contents.source === 'cashflow') {
            let res = submitCashflowBackend(contents.payload);
            return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
        }

        // 4. ANALYTICS RELASI (KONSUMEN)
        if (contents.source === 'analytics_relasi') {
            let namaTarget = contents.nama;
            const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
            const sheetKP = cfSS.getSheetByName('Database KP');

            if (!sheetKP) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet Database KP tidak ditemukan!' })).setMimeType(ContentService.MimeType.JSON);

            // SUNTIKAN ANTI-ERROR (Nilai Default jika profil belum dibuat)
            let hasil = {
                profil: "- - Umum",
                ltv: 0, uangMasuk: 0, qty: 0,
                siklus: "-", rapor: [], rankingProduk: [],
                keuangan: { totalPiutang: 0, piutangSehat: 0, piutangTelat: 0 }
            };

            // Coba cari profil khusus, jika ada maka timpa nilai default di atas
            const sheetRekap = cfSS.getSheetByName('Rekap_Analytics_Konsumen');
            if (sheetRekap) {
                const rekapData = sheetRekap.getDataRange().getValues();
                for (let i = 1; i < rekapData.length; i++) {
                    if (rekapData[i][0] && rekapData[i][0].toString().toLowerCase() === namaTarget.toLowerCase()) {
                        hasil.profil = (rekapData[i][1] || "-") + " - " + (rekapData[i][2] || "Umum");
                        hasil.ltv = Number(rekapData[i][3]) || 0;
                        hasil.uangMasuk = Number(rekapData[i][4]) || 0;
                        hasil.qty = Number(rekapData[i][5]) || 0;
                        hasil.siklus = rekapData[i][6] || "-";
                        hasil.rapor = String(rekapData[i][7]).split('\n').filter(r => r.trim() !== "");
                        hasil.rankingProduk = String(rekapData[i][8]).split('\n').filter(r => r.trim() !== "");
                        hasil.keuangan = { totalPiutang: Number(rekapData[i][9]) || 0, piutangSehat: Number(rekapData[i][10]) || 0, piutangTelat: Number(rekapData[i][11]) || 0 };
                        break;
                    }
                }
            }

            function parseDateLokal(tgl) {
                if (!tgl) return new Date("invalid");
                if (tgl instanceof Date) return tgl;
                let mt = String(tgl).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; return new Date(y, parseInt(mt[2]) - 1, parseInt(mt[1])); }
                return new Date(tgl);
            }

            let piutangAktifMap = {};
            let omzetMap = {};
            let riwayatBayarUnsorted = [];
            let totalSisaUang = 0;

            let lastRowKP = sheetKP.getLastRow();
            if (lastRowKP > 1) {
                const kpData = sheetKP.getRange(2, 1, lastRowKP - 1, 23).getValues();
                let relasiDOs = [];
                let saldoAkhir = 0;

                for (let i = 0; i < kpData.length; i++) {
                    let rel = String(kpData[i][3] || "").trim();
                    let alamat = String(kpData[i][4] || "").trim();
                    let keyUnik = alamat ? `${rel} - ${alamat}` : rel;

                    if (rel.toLowerCase() === namaTarget.toLowerCase() || keyUnik.toLowerCase() === namaTarget.toLowerCase()) {
                        let tglObj = parseDateLokal(kpData[i][1]);
                        if (isNaN(tglObj.getTime())) continue;

                        let tagihan = Number(kpData[i][13]) || 0;
                        let sldStr = String(kpData[i][19] || "").replace(/\./g, '').replace(/,/g, '.');
                        let sld = parseFloat(sldStr) || 0;
                        let statusText = String(kpData[i][20]);

                        if (kpData[i][19] !== "") saldoAkhir = sld;

                        if (tagihan > 0) {
                            let mKey = tglObj.getFullYear() + "-" + ("0" + (tglObj.getMonth() + 1)).slice(-2);
                            let pakanQty = Number(kpData[i][7]) || 0;
                            if (!omzetMap[mKey]) omzetMap[mKey] = { o: 0, q: 0 };
                            omzetMap[mKey].o += tagihan;
                            omzetMap[mKey].q += pakanQty;
                        }

                        if (tagihan > 0 && !statusText.toLowerCase().includes('lunas') && statusText !== "") {
                            relasiDOs.push({ tglObj, tgl: Utilities.formatDate(tglObj, "GMT+7", "dd/MM/yy"), tagihan, statusText, pakan: kpData[i][6] || "-", qty: Number(kpData[i][7]) || 0 });
                        }

                        let pLines = String(kpData[i][15] || "").split('\n');
                        let qLines = String(kpData[i][16] || "").split('\n');
                        let vLines = String(kpData[i][21] || "").split('\n\n');

                        for (let k = 0; k < qLines.length; k++) {
                            let nomStr = qLines[k].replace(/[^0-9]/g, '');
                            let nominal = parseInt(nomStr) || 0;
                            if (nominal > 0) {
                                totalSisaUang += nominal;
                                let tglBayarRaw = pLines[k] ? pLines[k].trim() : Utilities.formatDate(tglObj, "GMT+7", "dd/MM/yy");
                                let ketBayar = vLines[k] ? vLines[k].trim().replace(/\n/g, '<br>') : "Pembayaran Kas";

                                let tbObj = parseDateLokal(tglBayarRaw);
                                let tglBayarClean = isNaN(tbObj.getTime()) ? tglBayarRaw : Utilities.formatDate(tbObj, "GMT+7", "dd/MM/yy");

                                riwayatBayarUnsorted.push({ tglMs: tbObj.getTime(), tgl: tglBayarClean, nominal: nominal, ket: ketBayar });
                            }
                        }
                    }
                }

                let totalTagihan = relasiDOs.reduce((sum, item) => sum + item.tagihan, 0);
                let totalDP = totalTagihan - saldoAkhir;
                if (saldoAkhir < 0) totalDP = 0; else if (totalDP < 0) totalDP = 0;

                relasiDOs.sort((a, b) => a.tglObj.getTime() - b.tglObj.getTime());
                relasiDOs.forEach(doItem => {
                    if (totalDP >= doItem.tagihan) {
                        doItem.sisa = 0; totalDP -= doItem.tagihan;
                    } else if (totalDP > 0) {
                        doItem.sisa = doItem.tagihan - totalDP; totalDP = 0;
                    } else {
                        doItem.sisa = doItem.tagihan;
                    }

                    if (doItem.sisa > 0) {
                        let tglKey = doItem.tgl;
                        if (!piutangAktifMap[tglKey]) piutangAktifMap[tglKey] = { tgl: tglKey, total: 0, tagihan: 0, dp: 0, status: doItem.statusText, items: [] };
                        if (doItem.statusText.toLowerCase().includes('terlambat') && !piutangAktifMap[tglKey].status.toLowerCase().includes('terlambat')) {
                            piutangAktifMap[tglKey].status = doItem.statusText;
                        }

                        piutangAktifMap[tglKey].total += doItem.sisa;
                        piutangAktifMap[tglKey].tagihan += doItem.tagihan;
                        piutangAktifMap[tglKey].dp += (doItem.tagihan - doItem.sisa);

                        piutangAktifMap[tglKey].items.push({ pakan: doItem.pakan, qty: doItem.qty, nominal: doItem.tagihan });
                    }
                });
            }

            riwayatBayarUnsorted.sort((a, b) => b.tglMs - a.tglMs);
            let riwayatBayar = riwayatBayarUnsorted.slice(0, 6);

            let chartLabels = [], chartData = [], chartQty = [];
            let namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
            let currDate = new Date();
            for (let i = 5; i >= 0; i--) {
                let d = new Date(currDate.getFullYear(), currDate.getMonth() - i, 1);
                let mKey = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
                chartLabels.push(namaBulan[d.getMonth()]);
                chartData.push(omzetMap[mKey] ? omzetMap[mKey].o : 0);
                chartQty.push(omzetMap[mKey] ? omzetMap[mKey].q : 0);
            }

            hasil.piutangAktif = Object.values(piutangAktifMap);
            hasil.riwayatBayar = riwayatBayar;
            hasil.chart = { labels: chartLabels, data: chartData, qty: chartQty };

            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: hasil })).setMimeType(ContentService.MimeType.JSON);
        }

        // 5. ANALYTICS GLOBAL (VERSI DUMB API - PULL 1 TAHUN)
        if (contents.source === 'analytics_global') {
            let fTahun = parseInt(contents.tahun);

            function parseDateLokal(tgl) {
                if (!tgl) return new Date("invalid");
                if (tgl instanceof Date) return tgl;
                let mt = String(tgl).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; return new Date(y, parseInt(mt[2]) - 1, parseInt(mt[1])); }
                return new Date(tgl);
            }

            // Tarik mentahan secepat mungkin pakai batas bawah
            const ssMaster = SpreadsheetApp.openById(ID_MASTER_DB);
            const sheetM = ssMaster.getSheetByName('Database');
            let lastRowM = sheetM ? sheetM.getLastRow() : 0;
            const dataM = (lastRowM > 5) ? sheetM.getRange(6, 1, lastRowM - 5, 20).getValues() : [];

            const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
            const sheetCF = cfSS.getSheetByName('Database Cashflow');
            let lastRowCF = sheetCF ? sheetCF.getLastRow() : 0;
            const dataCF = (lastRowCF > 1) ? sheetCF.getRange(2, 1, lastRowCF - 1, 9).getValues() : [];

            const sheetKP = cfSS.getSheetByName('Database KP');
            let lastRowKP = sheetKP ? sheetKP.getLastRow() : 0;
            const dataKP = (lastRowKP > 1) ? sheetKP.getRange(2, 1, lastRowKP - 1, 21).getValues() : [];

            let rawMaster = [], rawCF = [], rawKP = [];

            // Ekstrak Semua Transaksi Master di Tahun yang Dipilih
            for (let i = 0; i < dataM.length; i++) {
                let d = parseDateLokal(dataM[i][3]); if (isNaN(d.getTime())) continue;
                if (d.getFullYear() === fTahun) {
                    rawMaster.push({
                        tglDb: d.getDate(), bln: d.getMonth() + 1,
                        status: String(dataM[i][4]).toLowerCase(),
                        relasi: String(dataM[i][5] || "").trim(),
                        pakan: String(dataM[i][8] || "").trim(),
                        qty: Number(dataM[i][9]) || 0,
                        gudang: String(dataM[i][11] || "PM").toUpperCase(),
                        hpp: Number(dataM[i][13]) || 0,
                        omzet: Number(dataM[i][15]) || 0,
                        kat: String(dataM[i][19] || "").toLowerCase()
                    });
                }
            }

            // Ekstrak Semua Transaksi Cashflow
            for (let i = 0; i < dataCF.length; i++) {
                let d = parseDateLokal(dataCF[i][0]); if (isNaN(d.getTime())) continue;
                if (d.getFullYear() === fTahun) {
                    rawCF.push({
                        bln: d.getMonth() + 1,
                        tglFormat: Utilities.formatDate(d, "GMT+7", "dd/MM/yy"),
                        met: dataCF[i][1], kat: dataCF[i][2], relasi: dataCF[i][3],
                        debet: Number(dataCF[i][5]) || 0, kredit: Number(dataCF[i][6]) || 0
                    });
                }
            }

            // Ekstrak Semua Transaksi Piutang
            for (let i = 0; i < dataKP.length; i++) {
                let d = parseDateLokal(dataKP[i][1]); if (isNaN(d.getTime())) continue;
                if (d.getFullYear() === fTahun) {
                    let stPtg = String(dataKP[i][20] || "").toLowerCase();
                    let nominalPtg = Number(dataKP[i][13]) || 0;
                    if (!stPtg.includes("lunas") && nominalPtg > 0) {
                        rawKP.push({ bln: d.getMonth() + 1, nominal: nominalPtg, isTelat: stPtg.includes("terlambat") });
                    }
                }
            }

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                data: { master: rawMaster, cf: rawCF, kp: rawKP }
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // ============================================
        // 5.5 TARIK DATA GILING (UNTUK PENGAJUAN SPN) - KEMBALI KE ASLI
        // ============================================
        if (contents.source === 'tarik_giling') {
            try {
                let start = new Date(contents.startDate); start.setHours(0, 0, 0, 0);
                let end = new Date(contents.endDate); end.setHours(23, 59, 59, 999);

                const ss = SpreadsheetApp.openById(ID_MASTER_DB);
                const sheet = ss.getSheetByName("Database");
                let lastRowM = sheet.getLastRow();
                if (lastRowM < 6) return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] })).setMimeType(ContentService.MimeType.JSON);

                const data = sheet.getRange(6, 1, lastRowM - 5, 25).getValues();

                let hasil = [];
                for (let i = 0; i < data.length; i++) {
                    let status = String(data[i][4]).trim();
                    let relasiRaw = String(data[i][5]).trim().toUpperCase();

                    let isGilingan = relasiRaw.includes('RD') || relasiRaw.includes('RL') || relasiRaw.includes('DARBUN') || relasiRaw.includes('LAKTASI');

                    if (isGilingan) {
                        let relasiClean = (relasiRaw.includes('RD') || relasiRaw.includes('DARBUN')) ? 'RD' : 'RL';

                        let d = new Date(data[i][3]);
                        if (!isNaN(d.getTime()) && d >= start && d <= end) {
                            hasil.push({
                                tglMs: d.getTime(),
                                tglStr: Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy"),
                                status: status,
                                relasi: relasiClean,
                                pakan: String(data[i][8]).trim(),
                                qty: Number(data[i][9]) || 0
                            });
                        }
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: hasil })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // 6. TARIK PIUTANG & RIWAYAT BAYAR
        if (contents.source === 'tarik_piutang') {
            const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
            const sheetKP = cfSS.getSheetByName('Database KP');
            if (!sheetKP) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet Database KP tidak ada!' })).setMimeType(ContentService.MimeType.JSON);

            const dataKP = sheetKP.getDataRange().getValues();
            let piutangMap = {};
            let relasiSaldoMap = {};
            let nowMs = new Date().getTime();

            function parseMutlak(val) {
                if (val === "" || val === null || val === undefined) return 0;
                if (typeof val === 'number') return val;
                let str = String(val).trim().replace(/\./g, '').replace(/,/g, '.');
                let num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            }
            function parseDateLokal(tgl) {
                if (!tgl) return new Date("invalid");
                if (tgl instanceof Date) return tgl;
                let mt = String(tgl).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; return new Date(y, parseInt(mt[2]) - 1, parseInt(mt[1])); }
                return new Date(tgl);
            }

            let kamusAlamat = {};
            for (let i = 1; i < dataKP.length; i++) {
                let relasi = String(dataKP[i][3] || "").trim().toLowerCase();
                let alamat = String(dataKP[i][4] || "").trim();
                if (relasi !== "" && alamat !== "" && !kamusAlamat[relasi]) kamusAlamat[relasi] = alamat;
            }

            for (let i = 1; i < dataKP.length; i++) {
                let relasi = String(dataKP[i][3] || "").trim();
                let alamat = String(dataKP[i][4] || "").trim();
                let saldo = parseMutlak(dataKP[i][19]);

                if (relasi === "" || relasi.toLowerCase().includes('kandang')) continue;

                if (alamat === "" && kamusAlamat[relasi.toLowerCase()]) alamat = kamusAlamat[relasi.toLowerCase()];
                let keyUnik = alamat ? `${relasi} - ${alamat}` : relasi;

                if (dataKP[i][19] !== "") relasiSaldoMap[keyUnik] = saldo;

                if (!piutangMap[keyUnik]) piutangMap[keyUnik] = { total: 0, totalSehat: 0, totalTelat: 0, alamat: alamat, dates: {}, riwayat: [] };

                // EKSTRAK RIWAYAT PEMBAYARAN & KETERANGAN
                let pLines = String(dataKP[i][15] || "").split('\n');
                let qLines = String(dataKP[i][16] || "").split('\n');
                let vLines = String(dataKP[i][21] || "").split('\n\n');

                for (let k = 0; k < qLines.length; k++) {
                    let nomStr = qLines[k].replace(/[^0-9]/g, '');
                    let nominal = parseInt(nomStr) || 0;
                    if (nominal > 0) {
                        let tglBayarRaw = pLines[k] ? pLines[k].trim() : "";
                        let ketBayar = vLines[k] ? vLines[k].trim().replace(/\n/g, '<br>') : "Pembayaran Kas";
                        let tbObj = parseDateLokal(tglBayarRaw);

                        // FIX: Cukur tanggal GMT panjang jadi dd/MM/yy rapi
                        let tglBayarClean = isNaN(tbObj.getTime()) ? tglBayarRaw : Utilities.formatDate(tbObj, "GMT+7", "dd/MM/yy");

                        piutangMap[keyUnik].riwayat.push({ tglMs: tbObj.getTime(), tgl: tglBayarClean, nominal: nominal, ket: ketBayar });
                    }
                }

                let tgl = dataKP[i][1], ongkir = parseMutlak(dataKP[i][5]);
                let jenisPakan = String(dataKP[i][6] || "-"), qty = parseMutlak(dataKP[i][7]);
                let hargaSatuan = parseMutlak(dataKP[i][11]), nominalTagihan = parseMutlak(dataKP[i][13]);
                let status = String(dataKP[i][20] || "").toLowerCase();

                if (!tgl || nominalTagihan <= 0 || status === "") continue;

                let dateStr = ""; let tglObj = parseDateLokal(tgl);
                if (!isNaN(tglObj.getTime())) { dateStr = Utilities.formatDate(tglObj, "GMT+7", "dd/MM/yyyy"); }
                else { dateStr = String(tgl).substring(0, 10); tglObj = new Date(); }

                if (status.includes("lunas") && (nowMs - tglObj.getTime() > 30 * 24 * 60 * 60 * 1000)) continue;

                let tglJT = new Date(tglObj.getTime() + (14 * 24 * 60 * 60 * 1000));
                let jtStr = Utilities.formatDate(tglJT, "GMT+7", "dd/MM/yyyy");

                if (!piutangMap[keyUnik].dates[dateStr]) piutangMap[keyUnik].dates[dateStr] = { tgl: dateStr, jt: jtStr, tagihan: 0, dp: 0, sisaNyata: 0, items: [], isTelat: false, tglMs: tglObj.getTime() };

                if (status.includes("terlambat") || status.includes("telat") || status.includes("tempo") || status.includes("macet")) piutangMap[keyUnik].dates[dateStr].isTelat = true;
                piutangMap[keyUnik].dates[dateStr].tagihan += nominalTagihan;
                let nominalPakan = qty * hargaSatuan;

                if (nominalPakan > 0) piutangMap[keyUnik].dates[dateStr].items.push({ tgl: dateStr, pakan: jenisPakan, qty: qty, satuan: "Kg", hargaSatuan: hargaSatuan, nominal: nominalPakan });
                if (ongkir > 0) piutangMap[keyUnik].dates[dateStr].items.push({ tgl: dateStr, pakan: "Ongkir Pengiriman", qty: 1, satuan: "Rit", hargaSatuan: ongkir, nominal: ongkir });
                if (nominalPakan === 0 && ongkir === 0) piutangMap[keyUnik].dates[dateStr].items.push({ tgl: dateStr, pakan: jenisPakan !== "-" ? jenisPakan : "Tagihan Pakan", qty: qty || 1, satuan: qty > 0 ? "Kg" : "Harga", hargaSatuan: nominalTagihan, nominal: nominalTagihan });
            }

            for (let r in piutangMap) {
                // Sort Riwayat Uang Masuk (Tertinggi / Terbaru ke bawah)
                piutangMap[r].riwayat.sort((a, b) => b.tglMs - a.tglMs);
                piutangMap[r].riwayat = piutangMap[r].riwayat.slice(0, 10); // Ambil 10 teratas

                let totalTagihanRelasi = 0;
                let sortedDates = Object.keys(piutangMap[r].dates).sort((a, b) => piutangMap[r].dates[a].tglMs - piutangMap[r].dates[b].tglMs);
                sortedDates.forEach(d => { totalTagihanRelasi += piutangMap[r].dates[d].tagihan; });

                let saldoAkhirExcel = relasiSaldoMap[r] || 0;
                let isDeposit = saldoAkhirExcel < 0;

                if (isDeposit) {
                    piutangMap[r].total = saldoAkhirExcel;
                    piutangMap[r].totalSehat = 0;
                    piutangMap[r].totalTelat = 0;
                    sortedDates.forEach(d => {
                        piutangMap[r].dates[d].sisaNyata = piutangMap[r].dates[d].tagihan;
                        piutangMap[r].dates[d].dp = 0;
                    });
                } else {
                    let totalDPRelasi = totalTagihanRelasi - saldoAkhirExcel;
                    if (totalDPRelasi < 0) totalDPRelasi = 0;

                    let t = 0, tSehat = 0, tTelat = 0;
                    sortedDates.forEach(d => {
                        let dateObj = piutangMap[r].dates[d];
                        if (totalDPRelasi >= dateObj.tagihan) {
                            dateObj.dp = dateObj.tagihan; dateObj.sisaNyata = 0; totalDPRelasi -= dateObj.tagihan;
                        } else if (totalDPRelasi > 0) {
                            dateObj.dp = totalDPRelasi; dateObj.sisaNyata = dateObj.tagihan - totalDPRelasi; totalDPRelasi = 0;
                        } else {
                            dateObj.dp = 0; dateObj.sisaNyata = dateObj.tagihan;
                        }

                        if (dateObj.sisaNyata > 0) {
                            t += dateObj.sisaNyata;
                            if (dateObj.isTelat) tTelat += dateObj.sisaNyata; else tSehat += dateObj.sisaNyata;
                        } else { delete piutangMap[r].dates[d]; }
                    });
                    piutangMap[r].total = t; piutangMap[r].totalSehat = tSehat; piutangMap[r].totalTelat = tTelat;

                    if (t === 0 && !isDeposit) delete piutangMap[r];
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: piutangMap })).setMimeType(ContentService.MimeType.JSON);
        }

        // ============================================
        // MENU STOK 1: TARIK DARI DATABASE SENTRAL
        // ============================================
        if (contents.source === 'tarik_stok') {
            try {
                var dataStok = [];
                var ss = SpreadsheetApp.openById(ID_MASTER_DB);
                var sheetSentral = ss.getSheetByName("Database");

                if (sheetSentral) {
                    var data = sheetSentral.getDataRange().getValues();
                    for (var i = 1; i < data.length; i++) {
                        var status = data[i][4];
                        var sisaStok = Number(data[i][22]) || 0; // Kolom W (Sisa Stok)

                        if ((status === "Masuk" || status === "Masuk (Retur)" || status === "Masuk Sup.") && sisaStok > 0) {
                            var d = new Date(data[i][3]);
                            var formatTgl = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);

                            dataStok.push({
                                gudang: data[i][11],
                                pakan: data[i][8],
                                batchId: data[i][20], // Kolom U (KTP Induk)
                                blok: data[i][21] || "Tanpa Blok", // Kolom V (Blok 1)
                                tglMasuk: formatTgl,
                                qty: sisaStok
                            });
                        }
                    }
                }
                return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: dataStok })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // ============================================
        // MENU STOK 2: RIWAYAT KARTU STOK (BATCH / BLOK)
        // ============================================
        if (contents.source === 'riwayat_stok') {
            try {
                var reqGudang = contents.payload.gudang;
                var reqPakan = contents.payload.pakan;
                var reqMode = contents.payload.mode || 'batch'; // 'batch' atau 'blok'
                var reqBatch = contents.payload.batchId;
                var reqBlok = contents.payload.blok;

                var ss = SpreadsheetApp.openById(ID_MASTER_DB);
                var sheetSentral = ss.getSheetByName("Database");
                var historyData = [];
                var rawMatches = [];

                if (sheetSentral) {
                    var data = sheetSentral.getDataRange().getValues();

                    for (var i = 1; i < data.length; i++) {
                        var dbGudang = data[i][11];
                        var dbPakan = data[i][8];

                        if (dbGudang === reqGudang && dbPakan === reqPakan) {
                            var status = data[i][4];
                            var relasi = data[i][5];
                            var d = new Date(data[i][3]);
                            var timeMs = d.getTime();

                            var batch1 = data[i][20]; // Kolom U (KTP 1)
                            var blok1 = data[i][21];  // Kolom V (Blok 1)
                            var qty1 = Number(data[i][23]) || 0; // Kolom X (Qty 1)

                            var batch2 = data[i][24]; // Kolom Y (KTP 2)
                            var blok2 = data[i][25];  // Kolom Z (Blok 2)
                            var qty2 = Number(data[i][26]) || 0; // Kolom AA (Qty 2)

                            if (reqMode === 'batch') {
                                // MODE 1: RIWAYAT PER BATCH KHUSUS
                                if (status === "Masuk" || status === "Masuk (Retur)" || status === "Masuk Sup.") {
                                    if (batch1 === reqBatch) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: relasi, inQty: qty1, outQty: 0 });
                                    }
                                } else {
                                    if (batch1 === reqBatch && qty1 > 0) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: relasi, inQty: 0, outQty: qty1 });
                                    }
                                    if (batch2 === reqBatch && qty2 > 0) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: relasi + " (Split DO)", inQty: 0, outQty: qty2 });
                                    }
                                }
                            } else if (reqMode === 'blok') {
                                // MODE 2: PERPUTARAN FISIK DALAM SATU BLOK
                                if (status === "Masuk" || status === "Masuk (Retur)" || status === "Masuk Sup.") {
                                    if (blok1 === reqBlok) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: `${relasi} [${batch1}]`, inQty: qty1, outQty: 0 });
                                    }
                                } else {
                                    if (blok1 === reqBlok && qty1 > 0) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: `${relasi} [${batch1}]`, inQty: 0, outQty: qty1 });
                                    }
                                    if (blok2 === reqBlok && qty2 > 0) {
                                        rawMatches.push({ timeMs: timeMs, status: status, relasi: `${relasi} (Split DO) [${batch2}]`, inQty: 0, outQty: qty2 });
                                    }
                                }
                            }
                        }
                    }
                }

                // Balikkan data agar urut secara kronologis murni (Tanggal Lama -> Baru / A-Z)
                rawMatches.reverse();

                // Jalankan kalkulasi saldo berjalan ke bawah (akumulatif murni)
                var saldo = 0;
                rawMatches.forEach(function (rec) {
                    saldo += rec.inQty;
                    saldo -= rec.outQty;

                    var dateObj = new Date(rec.timeMs);
                    var formatTgl = ("0" + dateObj.getDate()).slice(-2) + "/" + ("0" + (dateObj.getMonth() + 1)).slice(-2) + "/" + dateObj.getFullYear().toString().substring(2);

                    historyData.push({
                        tgl: formatTgl,
                        status: rec.status,
                        relasi: rec.relasi,
                        inQty: rec.inQty,
                        outQty: rec.outQty,
                        saldo: saldo
                    });
                });

                // Kunci hasil akhir murni kronologis A-Z (Tanpa di-reverse lagi)
                return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: historyData })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // ============================================
        // MENU STOK: MONITOR STOK KANDANG (VIA REKAP STOK - JALUR SUPER CEPAT)
        // ============================================
        if (contents.source === 'tarik_stok_kandang') {
            try {
                var ss = SpreadsheetApp.openById(ID_MASTER_DB);
                var sheetRekap = ss.getSheetByName("Rekap Stok");

                if (!sheetRekap) {
                    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet Rekap Stok tidak ditemukan' })).setMimeType(ContentService.MimeType.JSON);
                }

                var dataStokKandang = {};
                var lastRow = sheetRekap.getLastRow();

                if (lastRow > 1) {
                    // Ambil Kolom A (Pakan), B (Blok), C (Sisa), D (Defisit), E (Cabang)
                    var data = sheetRekap.getRange(2, 1, lastRow - 1, 5).getValues();

                    for (var i = 0; i < data.length; i++) {
                        var pakan = String(data[i][0]).trim();
                        var blok = String(data[i][1]).trim().toUpperCase();
                        var sisa = Number(data[i][2]) || 0;
                        var defisit = Number(data[i][3]) || 0;
                        var cabang = String(data[i][4]).trim();

                        // Deteksi Baris Kandang dari nama Blok
                        if (blok.includes("KANDANG")) {
                            var totalStok = sisa + defisit; // Menggabungkan sisa positif dan defisit negatif (-99)

                            var key = cabang + "_" + pakan;
                            if (!dataStokKandang[key]) {
                                dataStokKandang[key] = {
                                    gudang: cabang,
                                    pakan: pakan,
                                    qtyKandang: 0
                                };
                            }
                            dataStokKandang[key].qtyKandang += totalStok;
                        }
                    }
                }

                // Ubah format ke Array agar bisa dikirim ke HP
                var resultStok = Object.keys(dataStokKandang).map(function (k) {
                    return dataStokKandang[k];
                });

                return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: resultStok })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // 7. UPLOAD INVOICE + AUTO CASH-IN
        if (contents.source === 'upload_invoice') {
            try {
                const folder = DriveApp.getFolderById("1IfKQsW5ARL_ZXPNtDg-T3ghmAsP86j0R");
                const blob = Utilities.newBlob(Utilities.base64Decode(contents.fileBase64), 'application/pdf', contents.namaFile + ".pdf");
                const filePDF = folder.createFile(blob);
                try { filePDF.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
                const linkPDF = filePDF.getUrl();

                const ss = SpreadsheetApp.openById(ID_CASHFLOW_SS);
                const sheetRekap = ss.getSheetByName("Rec. INV");
                let timestampSekarang = new Date();

                if (sheetRekap) sheetRekap.appendRow([timestampSekarang, contents.noInvoice, contents.pelanggan, contents.total, linkPDF]);

                // --- EKSEKUSI AUTO CASH-IN KE DATABASE CASHFLOW ---
                if (contents.isCashIn && contents.nominalCashIn > 0) {
                    const sheetCF = ss.getSheetByName("Database Cashflow");
                    if (sheetCF) {
                        let namaAman = contents.pelanggan.split('-')[0].trim();
                        let deskripsi = `Bayar Tunai - ${contents.noInvoice}`;

                        // Format penulisan: Timestamp, Metode, Perkiraan, Relasi, Deskripsi, Debet, Kredit, Diskon, Bukti, Status, Checklist
                        sheetCF.appendRow([
                            timestampSekarang,
                            "Cash",
                            "Bayar Pakan",
                            namaAman,
                            deskripsi,
                            contents.nominalCashIn,
                            0,
                            0,
                            linkPDF, // Pakai link file Invoice sebagai bukti transaksi
                            false,
                            ""
                        ]);
                    }
                }
                // --------------------------------------------------

                return ContentService.createTextOutput(JSON.stringify({ status: 'success', link: linkPDF })).setMimeType(ContentService.MimeType.JSON);
            } catch (e) {
                return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // ============================================
        // 8. TARIK DATA E-STATEMENT (MUTASI PDF YTD)
        // ============================================
        if (contents.source === 'tarik_estatement') {
            let namaTarget = String(contents.nama).toLowerCase().trim();
            // TERIMA REQUEST TAHUN DARI FRONTEND
            let tahunIni = contents.tahun ? parseInt(contents.tahun) : new Date().getFullYear();

            // Penanda request dari Tab Riwayat (3 Bulan)
            let isPreview = contents.isPreview || false;

            const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
            const sheetKP = cfSS.getSheetByName('Database KP');
            if (!sheetKP) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Database KP tidak ditemukan!' })).setMimeType(ContentService.MimeType.JSON);

            const dataKP = sheetKP.getDataRange().getValues();

            let saldoAwal = 0;
            let mutasiYTD = [];
            let totalTagihanYTD = 0;
            let totalBayarYTD = 0;

            function parseTgl(tgl) {
                if (!tgl) return new Date("invalid");
                if (tgl instanceof Date) return tgl;
                let mt = String(tgl).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; return new Date(y, parseInt(mt[2]) - 1, parseInt(mt[1])); }
                return new Date(tgl);
            }

            function parseMutlak(val) {
                if (val === "" || val === null || val === undefined) return 0;
                if (typeof val === 'number') return val;
                let str = String(val).trim().replace(/\./g, '').replace(/,/g, '.');
                let num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            }

            for (let i = 1; i < dataKP.length; i++) {
                let rel = String(dataKP[i][3] || "").toLowerCase().trim();
                let alamat = String(dataKP[i][4] || "").toLowerCase().trim();
                let keyUnik = alamat ? `${rel} - ${alamat}` : rel;

                // Cek nama murni atau nama beserta alamat
                if (rel === namaTarget || keyUnik === namaTarget) {

                    // 1. Ambil Mutasi DO (Tagihan & Ongkir) [VERSI GRUP PER TANGGAL]
                    let tglDO = parseTgl(dataKP[i][1]);
                    let tagihan = parseMutlak(dataKP[i][13]);

                    // KUNCI UTAMA: Tarik teks asli dari Kolom U (Index 20)
                    let actualStatusKolomU = String(dataKP[i][20] || "").trim();
                    let isLunasBaris = (actualStatusKolomU.toUpperCase() === "LUNAS");

                    if (!isNaN(tglDO.getTime()) && tagihan > 0) {
                        let pakan = String(dataKP[i][6] || "-");
                        let qty = parseMutlak(dataKP[i][7]);
                        let harga = parseMutlak(dataKP[i][11]);
                        let ongkir = parseMutlak(dataKP[i][5]);

                        if (tglDO.getFullYear() < tahunIni) {
                            saldoAwal += tagihan;
                        } else if (tglDO.getFullYear() === tahunIni) {
                            totalTagihanYTD += tagihan;

                            // Cek apakah tanggal pengambilan ini sudah terdaftar
                            let tglStrFormat = Utilities.formatDate(tglDO, "GMT+7", "dd/MM/yyyy");
                            let existingIdx = mutasiYTD.findIndex(m => m.jenis === 'DO' && m.tglStr === tglStrFormat);

                            if (existingIdx !== -1) {
                                // Gabungkan ke baris yang sudah ada
                                mutasiYTD[existingIdx].tagihan += tagihan;
                                mutasiYTD[existingIdx].ongkir += ongkir;
                                mutasiYTD[existingIdx].items.push({ pakan: pakan, qty: qty, harga: harga });

                                // Kalau salah satu baris di tanggal itu BUKAN LUNAS, timpa statusnya pakai teks asli yg belum lunas
                                if (!isLunasBaris) {
                                    mutasiYTD[existingIdx].statusTagihan = actualStatusKolomU;
                                }
                            } else {
                                // Bikin baris baru dengan struktur Array Items
                                mutasiYTD.push({
                                    tglMs: tglDO.getTime(),
                                    tglStr: tglStrFormat,
                                    bulan: tglDO.getMonth(),
                                    jenis: 'DO',
                                    items: [{ pakan: pakan, qty: qty, harga: harga }],
                                    ongkir: ongkir,
                                    tagihan: tagihan,
                                    bayar: 0,
                                    statusTagihan: actualStatusKolomU // Murni isi asli dari Spreadsheet!
                                });
                            }
                        }
                    }

                    // 2. Ambil Mutasi Pembayaran (Multi-line)
                    let pLines = String(dataKP[i][15] || "").split('\n'); // Tgl
                    let qLines = String(dataKP[i][16] || "").split('\n'); // Nominal
                    let vLines = String(dataKP[i][21] || "").split('\n\n'); // Keterangan

                    for (let k = 0; k < qLines.length; k++) {
                        let nomStr = qLines[k].replace(/[^0-9]/g, '');
                        let nominalBayar = parseInt(nomStr) || 0;

                        if (nominalBayar > 0) {
                            let tbObj = parseTgl(pLines[k] ? pLines[k].trim() : "");
                            if (isNaN(tbObj.getTime())) tbObj = tglDO; // fallback

                            let ketBayar = vLines[k] ? vLines[k].trim() : "Transfer / Tunai";

                            if (tbObj.getFullYear() < tahunIni) {
                                saldoAwal -= nominalBayar;
                            } else if (tbObj.getFullYear() === tahunIni) {
                                totalBayarYTD += nominalBayar;
                                mutasiYTD.push({
                                    tglMs: tbObj.getTime(),
                                    tglStr: Utilities.formatDate(tbObj, "GMT+7", "dd/MM/yyyy"),
                                    bulan: tbObj.getMonth(),
                                    jenis: 'BAYAR',
                                    metode: ketBayar,
                                    tagihan: 0,
                                    bayar: nominalBayar
                                });
                            }
                        }
                    }
                }
            }

            // 3. Urutkan mutasi berdasarkan Tanggal (Kronologis YTD)
            mutasiYTD.sort((a, b) => a.tglMs - b.tglMs);

            // 4. Kalkulasi Saldo Berjalan (Running Balance)
            let saldoBerjalan = saldoAwal;
            mutasiYTD.forEach(m => {
                saldoBerjalan += m.tagihan;
                saldoBerjalan -= m.bayar;
                m.saldo = saldoBerjalan;
            });

            // 5. LOGIKA FILTER PREVIEW 3 BULAN
            let finalSaldoAwal = saldoAwal;
            if (isPreview) {
                let batasBulan = new Date().getMonth() - 2;
                let indexAwalBulan = mutasiYTD.findIndex(m => m.bulan >= batasBulan);

                if (indexAwalBulan > 0) {
                    finalSaldoAwal = mutasiYTD[indexAwalBulan - 1].saldo;
                    mutasiYTD = mutasiYTD.slice(indexAwalBulan);
                } else if (indexAwalBulan === -1) {
                    finalSaldoAwal = saldoBerjalan;
                    mutasiYTD = [];
                }
            }

            // --- TAMBAHAN BARU: CARI NAMA LENGKAP KTP DI DATA MEMBER ---
            let namaLengkapKTP = namaTarget.toUpperCase(); // Fallback jika tidak ketemu
            try {
                const ssMaster = SpreadsheetApp.openById(ID_MASTER_DB);
                const sheetMember = ssMaster.getSheetByName('Data Member');
                if (sheetMember) {
                    const dataMember = sheetMember.getDataRange().getValues();
                    // Looping cari nama sistem (Kolom B/Index 1) untuk ambil Nama Lengkap (Kolom C/Index 2)
                    for (let j = 1; j < dataMember.length; j++) {
                        if (String(dataMember[j][1]).trim().toLowerCase() === namaTarget) {
                            let namaKTP = String(dataMember[j][2]).trim();
                            if (namaKTP !== "") namaLengkapKTP = namaKTP.toUpperCase();
                            break;
                        }
                    }
                }
            } catch (e) { }
            // -----------------------------------------------------------

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                data: {
                    namaLengkap: namaLengkapKTP, // Kirim Nama KTP ke Frontend
                    saldoAwal: finalSaldoAwal,
                    mutasi: mutasiYTD,
                    totalTagihan: totalTagihanYTD,
                    totalBayar: totalBayarYTD,
                    saldoAkhir: saldoBerjalan
                }
            })).setMimeType(ContentService.MimeType.JSON);
        }

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("OK");
}

function tarikDataRekapDB(payload) {
    try {
        let pBulan = parseInt(payload.bulan), pTahun = parseInt(payload.tahun);
        let rawMaster = [], rawCashflow = [];

        const ssCF = SpreadsheetApp.openById(ID_CASHFLOW_SS);
        const sheetCF = ssCF.getSheetByName('Database Cashflow');
        if (sheetCF) {
            const dataCF = sheetCF.getDataRange().getValues();
            for (let i = 1; i < dataCF.length; i++) {
                let d = dataCF[i][0]; if (!d) continue;
                let dateStr = "";
                if (d instanceof Date) dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
                else { let mt = String(d).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; dateStr = `${y}-${("0" + mt[2]).slice(-2)}-${("0" + mt[1]).slice(-2)}`; } else continue; }

                let [yStr, mStr] = dateStr.split('-');
                if (parseInt(yStr) !== pTahun || parseInt(mStr) !== pBulan) continue;

                rawCashflow.push({ tgl: dateStr, metode: dataCF[i][1] || "Cash", katCF: dataCF[i][2] || "Lainnya", relasi: dataCF[i][3] || "-", debet: Number(dataCF[i][5]) || 0, kredit: Number(dataCF[i][6]) || 0 });
            }
        }

        const ssM = SpreadsheetApp.openById(ID_MASTER_DB);
        const sheetM = ssM.getSheetByName('Database');
        if (!sheetM) return { status: 'error', message: 'Sheet "Database" tidak ditemukan di Master File!' };
        const dataM = sheetM.getDataRange().getValues();

        for (let i = 5; i < dataM.length; i++) {
            let s = String(dataM[i][0]).trim(), d = dataM[i][3], st = String(dataM[i][4]).trim(), r = String(dataM[i][5]).trim();
            let pakan = String(dataM[i][8]).trim(), qty = parseFloat(dataM[i][9]) || 0, gudangDB = String(dataM[i][11]).trim();

            if (!d || s === "") continue;
            let dateStr = "";
            if (d instanceof Date) dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
            else { let mt = String(d).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); if (mt) { let y = parseInt(mt[3]); if (y < 100) y += 2000; dateStr = `${y}-${("0" + mt[2]).slice(-2)}-${("0" + mt[1]).slice(-2)}`; } else continue; }

            let [yStr, mStr] = dateStr.split('-');
            if (parseInt(yStr) !== pTahun || parseInt(mStr) !== pBulan) continue;

            let kat = "";
            if (r.match(/RD|RL/i)) kat = "Giling";
            else if (st === "Masuk") { if (r === "Pembibitan") kat = "Masuk Sup."; else kat = "Return"; }
            else if (s === "Kandang") kat = "Pemakaian";
            else if (r.match(/Kandang PM|RPH|SPN|Cibulakan|Pembibitan/i)) kat = "Mutasi";
            else kat = "Penjualan";

            let catGroup = (kat === "Masuk Sup." || kat === "Return") ? "Masuk" : kat;
            rawMaster.push({ tgl: dateStr, gudang: gudangDB, kat: kat, catGroup: catGroup, relasi: r, pakan: pakan, qty: qty });
        }
        return { status: 'success', rawMaster: rawMaster, rawCashflow: rawCashflow };
    } catch (e) { return { status: 'error', message: e.toString() }; }
}

function submitCashflowBackend(payload) {
    try {
        const folder = DriveApp.getFolderById(ID_FOLDER_BUKTI);
        const ss = SpreadsheetApp.openById(ID_CASHFLOW_SS);

        let sheet = ss.getSheetByName('Database Cashflow');
        if (!sheet) {
            sheet = ss.insertSheet('Database Cashflow');
            sheet.appendRow(['Timestamp', 'Metode', 'Perkiraan', 'Relasi', 'Deskripsi', 'Debet', 'Kredit', 'Diskon', 'Bukti', 'Status', 'Checklist']);
        }

        let tgl = payload.tanggal ? new Date(payload.tanggal) : new Date();
        let debet = payload.jenis === 'Masuk' ? payload.nominal : 0;
        let kredit = payload.jenis === 'Keluar' ? payload.nominal : 0;
        let diskon = Number(payload.diskon) || 0;

        let fileUrl = "-";
        if (payload.fileData && payload.fileData.base64) {
            let decodedData = Utilities.base64Decode(payload.fileData.base64);
            let tglStr = Utilities.formatDate(tgl, "GMT+7", "dd-MM-yyyy");
            let namaRelasiAman = payload.relasi.replace(/[\/\\]/g, "-").trim();
            let namaFile = tglStr + "-" + namaRelasiAman + "-" + payload.nominal + ".jpg";
            let blob = Utilities.newBlob(decodedData, payload.fileData.mime, namaFile);
            let file = folder.createFile(blob);
            try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr) { }
            fileUrl = file.getUrl();
        }

        sheet.appendRow([tgl, payload.metode, payload.perkiraan, payload.relasi, payload.deskripsi, debet, kredit, diskon, fileUrl, false, ""]);

        SpreadsheetApp.flush();

        // --- TAMBAH INI: Buang kode gambar sebelum dikirim ke Pusher ---
        let payloadForPusher = JSON.parse(JSON.stringify(payload));
        delete payloadForPusher.fileData; // Buang beban berat

        sendPusherEvent("cbl-channel", "update-data", {
            device_id: payload.device_id || "unknown",
            data_payload: payloadForPusher
        });

        return { status: 'success', message: 'Data Cashflow, Diskon, & Bukti berhasil direkam!' };
    } catch (e) { return { status: 'error', message: e.toString() }; }
}

function submitDariPWABackend(payload) {
    // =========================================================
    // GERBANG BESI BACKEND (LockService & Idempotency Check)
    // Mencegah dua request ganda mengeksekusi data bersamaan
    // =========================================================
    let lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000); // Tunggu antrean maksimal 10 detik
    } catch (e) {
        return { status: 'error', message: 'Sistem sibuk menerima data, silakan coba lagi.' };
    }

    try {
        // 1. Tentukan Destinasi Gudang
        let targetId = ID_PM;
        let sheetName = "Log Gudang";
        let labelGudang = "PM Gudang";

        if (payload.lokasi === '/spn') { targetId = ID_SPN; sheetName = "Log Gudang"; labelGudang = "SPN Gudang"; }
        else if (payload.lokasi === '/spn_kandang') { targetId = ID_SPN; sheetName = "Log Kandang"; labelGudang = "Kandang SPN"; }
        else if (payload.lokasi === '/rph') { targetId = ID_RPH; sheetName = "Form Pakan"; labelGudang = "RPH"; }
        else if (payload.lokasi === '/kandang') { targetId = ID_PM; sheetName = "Log Kandang"; labelGudang = "Kandang PM"; }

        // --- CEK DUPLIKASI BERDASARKAN HASH ---
        const ss = SpreadsheetApp.openById(targetId);
        const sheet = ss.getSheetByName(sheetName);

        if (payload.hashStr) {
            let lastRow = sheet.getLastRow();
            if (lastRow > 1) {
                // Ambil 50 baris terakhir dari Kolom AB (Kolom ke-28 tempat kita nyimpen Hash)
                let startRow = Math.max(2, lastRow - 50);
                let numRows = lastRow - startRow + 1;
                let recentHashes = sheet.getRange(startRow, 28, numRows, 1).getValues();

                for (let i = 0; i < recentHashes.length; i++) {
                    if (recentHashes[i][0] === payload.hashStr) {
                        lock.releaseLock();
                        return { status: 'success', message: 'Data duplikat dihentikan oleh Server.' };
                    }
                }
            }
        }
        // --------------------------------------

        let fileUrl = "";
        if (payload.fileSJ && payload.fileSJ.base64) {
            const folder = DriveApp.getFolderById('1glw9wIOBkWRV79PAtKHy96LxvVxwnFBs');
            let decodedData = Utilities.base64Decode(payload.fileSJ.base64);
            let tglObj = payload.tanggal ? new Date(payload.tanggal) : new Date();
            let tglStr = Utilities.formatDate(tglObj, "GMT+7", "dd-MM-yyyy");
            let namaRelasiAman = payload.relasi.replace(/[\/\\]/g, "-").trim();

            let locLabel = "PM";
            if (payload.lokasi === '/spn' || payload.lokasi === '/spn_kandang') locLabel = "SPN";
            else if (payload.lokasi === '/rph') locLabel = "RPH";

            let reverseAlias = {};
            for (let key in ALIAS_PAKAN) { reverseAlias[ALIAS_PAKAN[key]] = key; }

            let itemNames = [];
            let totalQty = 0;
            for (let p in payload.items) {
                totalQty += parseFloat(payload.items[p]) || 0;
                let alias = reverseAlias[p] || p.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
                itemNames.push(alias);
            }
            let itemString = itemNames.join('-');
            let qtyString = new Intl.NumberFormat('id-ID').format(totalQty);
            let namaFile = `SJ ${namaRelasiAman}-${tglStr}-${locLabel}-${itemString} @${qtyString}.jpg`;

            let blob = Utilities.newBlob(decodedData, payload.fileSJ.mime, namaFile);
            let file = folder.createFile(blob);
            try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
            fileUrl = file.getUrl();
        }

        let tglObj = payload.tanggal ? new Date(payload.tanggal) : new Date();
        let tglSheet = Utilities.formatDate(tglObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
        let timestampIndo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

        // 2. Susun Array Sesuai Kolom Sheet Master Pakan
        // REVISI: Buat Array 26 kolom (indeks 0-25) karena Hash akan ditaruh di Kolom Z (index 25)
        let rowData = new Array(26).fill("");
        rowData[0] = `${timestampIndo} | By: ${payload.petugas}`;
        rowData[3] = tglSheet;
        rowData[4] = payload.status;
        rowData[5] = payload.relasi;
        rowData[6] = (payload.ekor > 0) ? payload.ekor : (payload.alamat || "");
        rowData[7] = payload.ongkir || "";

        let j = 0;
        for (let pakan in payload.items) {
            if (8 + j < 24) {
                rowData[8 + j] = pakan;
                rowData[8 + j + 1] = payload.items[pakan];
                j += 2;
            }
        }

        rowData[24] = payload.catatan || "";
        if (fileUrl) rowData[24] += (rowData[24] ? " | " : "") + "Bukti SJ: " + fileUrl;

        // SUNTIKKAN HASH KE KOLOM AB (Index 27) SEBAGAI TRACKING ANTI DUPLIKAT
        rowData[27] = payload.hashStr || "";

        // 3. Tembak Langsung ke Gudang Tujuan (Horizontal)
        sheet.appendRow(rowData);

        // SUNTIK LOGIKA BONGKAR MUAT DI SINI
        if (payload.uangBongkar && payload.status === "Masuk") {
            let totalKg = 0;
            let pakanArr = [];
            for (let p in payload.items) {
                totalKg += parseFloat(payload.items[p]) || 0;
                pakanArr.push(p);
            }
            if (totalKg > 0) {
                let biayaBongkar = totalKg * 30;
                let tglReverse = tglSheet.split('-').reverse().join('/');
                let deskripsiBM = "Bongkar Muat " + pakanArr.join(", ") + " @" + totalKg + " Kg (" + tglReverse + ")";

                const cfSS = SpreadsheetApp.openById(ID_CASHFLOW_SS);
                let sheetKas = cfSS.getSheetByName("Database Cashflow");
                if (sheetKas) {
                    sheetKas.appendRow([
                        tglObj, "Cash", "Bongkar Muat", payload.relasi, deskripsiBM,
                        0, biayaBongkar, 0, "-", false, ""
                    ]);
                }
            }
        }

        // 4. Logika Auto-Mutasi Langsung
        let relasiLower = payload.relasi.toLowerCase().trim();
        if (payload.status === "Keluar" && RELASI_MUTASI.includes(relasiLower)) {
            inputMutasiOtomatis(targetId, sheetName, labelGudang, rowData, payload.relasi, tglSheet, timestampIndo, payload.hashStr);
        }

        // 5. Simpan dan Broadcast Pusher
        SpreadsheetApp.flush();

        let payloadForPusher = JSON.parse(JSON.stringify(payload));
        delete payloadForPusher.fileSJ;
        delete payloadForPusher.teksWA; // Hapus teks WA (Teks terlalu panjang dan ada Emoji bikin Pusher crash)
        delete payloadForPusher.hashStr; // Ringankan beban server

        sendPusherEvent("cbl-channel", "update-data", {
            device_id: payload.device_id,
            data_payload: payloadForPusher
        });

        lock.releaseLock(); // Buka gembok server
        return { status: 'success', message: 'Laporan sukses dieksekusi!' };
    } catch (e) {
        lock.releaseLock();
        return { status: 'error', message: e.toString() };
    }
}

function submitDariPWABackendBatch(batchPayload) {
    if (!batchPayload || !batchPayload.isBatch || !batchPayload.items || batchPayload.items.length === 0) {
        return { status: 'error', message: 'Payload batch kosong atau tidak valid.' };
    }

    let lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000); // Tunggu antrean maksimal 10 detik
    } catch (e) {
        return { status: 'error', message: 'Sistem sibuk menerima data, silakan coba lagi.' };
    }

    try {
        let groupedRows = {};
        let pusherEvents = [];
        let ssCache = {}; // Cache Spreadsheet
        let sheetCache = {}; // Cache Sheet

        for (let i = 0; i < batchPayload.items.length; i++) {
            let payload = batchPayload.items[i];

            // 1. Tentukan Destinasi Gudang
            let targetId = ID_PM;
            let sheetName = "Log Gudang";
            let labelGudang = "PM Gudang";

            if (payload.lokasi === '/spn') { targetId = ID_SPN; sheetName = "Log Gudang"; labelGudang = "SPN Gudang"; }
            else if (payload.lokasi === '/spn_kandang') { targetId = ID_SPN; sheetName = "Log Kandang"; labelGudang = "Kandang SPN"; }
            else if (payload.lokasi === '/rph') { targetId = ID_RPH; sheetName = "Form Pakan"; labelGudang = "RPH"; }
            else if (payload.lokasi === '/kandang') { targetId = ID_PM; sheetName = "Log Kandang"; labelGudang = "Kandang PM"; }

            // Cache Spreadsheet Helper
            if (!ssCache[targetId]) ssCache[targetId] = SpreadsheetApp.openById(targetId);
            let ssCheck = ssCache[targetId];
            let sheetKey = targetId + "_" + sheetName;
            if (!sheetCache[sheetKey]) sheetCache[sheetKey] = ssCheck.getSheetByName(sheetName);
            let sheetCheck = sheetCache[sheetKey];

            // --- SUSUN ROW DATA ---
            let tglObj = payload.tanggal ? new Date(payload.tanggal) : new Date();
            let tglSheet = Utilities.formatDate(tglObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
            let timestampIndo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

            let rowData = new Array(28).fill("");
            rowData[0] = `${timestampIndo} | By: ${payload.petugas}`;
            rowData[3] = tglSheet;
            rowData[4] = payload.status;
            rowData[5] = payload.relasi;
            rowData[6] = (payload.ekor > 0) ? payload.ekor : (payload.alamat || "");
            rowData[7] = payload.ongkir || "";

            let j = 0;
            for (let pakan in payload.items) {
                if (8 + j < 24) {
                    rowData[8 + j] = pakan;
                    rowData[8 + j + 1] = payload.items[pakan];
                    j += 2;
                }
            }

            rowData[24] = payload.catatan || "";
            rowData[27] = payload.hashStr || "";

            // Group by target spreadsheet & sheet name
            let groupKey = targetId + "|" + sheetName;
            if (!groupedRows[groupKey]) {
                groupedRows[groupKey] = { targetId: targetId, sheetName: sheetName, rows: [], hashes: [] };
            }

            // --- CEK DUPLIKAT DENGAN HASHSTR (MENCEGAH DOUBLE) ---
            let isDuplicate = false;
            if (payload.hashStr) {
                // 1. Cek di memori Batch (mencegah dobel dalam 1 keranjang/antrean yang sama)
                if (groupedRows[groupKey].hashes.includes(payload.hashStr)) {
                    isDuplicate = true;
                } else {
                    // 2. Cek di Spreadsheet (mencegah dobel beda waktu)
                    if (sheetCheck) {
                        let found = sheetCheck.createTextFinder(payload.hashStr).matchEntireCell(true).findNext();
                        if (found) isDuplicate = true;
                    }
                }
            }

            if (!isDuplicate) {
                groupedRows[groupKey].rows.push(rowData);
                if (payload.hashStr) groupedRows[groupKey].hashes.push(payload.hashStr);

                // LOGIKA BONGKAR MUAT (Append Row biasa karena jarang)
                if (payload.uangBongkar && payload.status === "Masuk") {
                    let totalKg = 0;
                    let pakanArr = [];
                    for (let p in payload.items) {
                        totalKg += parseFloat(payload.items[p]) || 0;
                        pakanArr.push(p);
                    }
                    if (totalKg > 0) {
                        let biayaBongkar = totalKg * 30;
                        let tglReverse = tglSheet.split('-').reverse().join('/');
                        let deskripsiBM = "Bongkar Muat " + pakanArr.join(", ") + " @" + totalKg + " Kg (" + tglReverse + ")";
                        let sheetKas = SpreadsheetApp.openById(ID_CASHFLOW_SS).getSheetByName("Database Cashflow");
                        if (sheetKas) {
                            // Cek duplikat juga di cashflow biar aman
                            let bmHash = payload.hashStr + "_BM";
                            let foundBM = sheetKas.createTextFinder(bmHash).matchEntireCell(true).findNext();
                            if (!foundBM) sheetKas.appendRow([tglObj, "Cash", "Bongkar Muat", payload.relasi, deskripsiBM, 0, biayaBongkar, 0, "-", false, bmHash]);
                        }
                    }
                }

                // LOGIKA AUTO-MUTASI
                let relasiLower = (payload.relasi || "").toLowerCase().trim();
                if (payload.status === "Keluar" && RELASI_MUTASI.includes(relasiLower)) {
                    inputMutasiOtomatis(targetId, sheetName, labelGudang, rowData, payload.relasi, tglSheet, timestampIndo, payload.hashStr, groupedRows, sheetCache);
                }
            }
            // -----------------------------------------------------

            let payloadForPusher = JSON.parse(JSON.stringify(payload));
            delete payloadForPusher.teksWA;
            delete payloadForPusher.hashStr;

            pusherEvents.push({ device_id: payload.device_id, data_payload: payloadForPusher });
        }

        // EXECUTE BATCH INSERTS TERCEPAT (.setValues)
        for (let key in groupedRows) {
            let g = groupedRows[key];
            let sheetKey = g.targetId + "_" + g.sheetName;
            let sheet = sheetCache[sheetKey];
            if (sheet && g.rows.length > 0) {
                let lastRow = sheet.getLastRow();
                sheet.getRange(lastRow + 1, 1, g.rows.length, 28).setValues(g.rows);
            }
        }

        SpreadsheetApp.flush();

        // PUSHER MULTIPLE (DIJADIKAN 1 KALI PING AGAR TIDAK BIKIN SERVER LEMOT)
        if (pusherEvents.length > 0) {
            sendPusherEvent("cbl-channel", "update-data", pusherEvents[pusherEvents.length - 1]);
        }

        lock.releaseLock();
        return { status: 'success', message: `Batch ${batchPayload.items.length} Laporan berhasil dieksekusi dalam 1 kedipan!` };
    } catch (e) {
        if (lock) lock.releaseLock();
        return { status: 'error', message: e.toString() };
    }
}

function inputMutasiOtomatis(targetIdOriginal, sheetNameOriginal, labelGudang, rowDataOriginal, relasiTujuan, tglSheet, timestampIndo, hashStr, groupedRows, sheetCache) {
    let relasiLower = relasiTujuan.toLowerCase().trim();
    let idT = null, shT = "";

    if (relasiLower === 'pembibitan' || relasiLower === 'pm') { idT = ID_PM; shT = "Log Gudang"; }
    else if (relasiLower === 'kandang') { idT = targetIdOriginal; shT = "Log Kandang"; }
    else if (relasiLower === 'spn') { idT = ID_SPN; shT = "Log Gudang"; }
    else if (relasiLower === 'rph') { idT = ID_RPH; shT = "Form Pakan"; }

    if (idT && !(idT === targetIdOriginal && shT === sheetNameOriginal)) {
        let mutasiHash = hashStr ? hashStr + "_MUT" : "";
        let sheetKey = idT + "_" + shT;
        
        if (!sheetCache) sheetCache = {};
        
        if (!sheetCache[sheetKey]) {
            sheetCache[sheetKey] = SpreadsheetApp.openById(idT).getSheetByName(shT);
        }
        let targetSheet = sheetCache[sheetKey];
        if (!targetSheet) return;

        if (mutasiHash) {
            // 1. Cek di memori keranjang
            if (groupedRows && groupedRows[sheetKey] && groupedRows[sheetKey].hashes.includes(mutasiHash)) return;
            
            // 2. Cek di Spreadsheet (Hanya di kolom 28 / AB agar SANGAT CEPAT)
            let foundMut = targetSheet.getRange(1, 28, targetSheet.getMaxRows(), 1).createTextFinder(mutasiHash).matchEntireCell(true).findNext();
            if (foundMut) return; // Sudah ada mutasi ini, skip!
        }

        let mutasiRow = new Array(28).fill(""); // Perlebar ke 28 agar muat Hash di Z/AA/AB
        mutasiRow[0] = `${timestampIndo} | Auto Mutasi`;
        mutasiRow[3] = tglSheet;
        mutasiRow[4] = "Masuk";
        mutasiRow[5] = relasiTujuan;
        mutasiRow[7] = labelGudang; // Gudang asal
        for (let i = 8; i < 24; i++) mutasiRow[i] = rowDataOriginal[i];
        mutasiRow[27] = mutasiHash; // Taruh hash mutasi di kolom 28 (AB)

        if (groupedRows) {
            if (!groupedRows[sheetKey]) {
                groupedRows[sheetKey] = { targetId: idT, sheetName: shT, rows: [], hashes: [] };
            }
            // Tampung di dalam memori batch
            groupedRows[sheetKey].rows.push(mutasiRow);
            if (mutasiHash) groupedRows[sheetKey].hashes.push(mutasiHash);
        } else {
            // Eksekusi langsung ke Spreadsheet jika mode 1 Laporan (Bukan Keranjang)
            targetSheet.appendRow(mutasiRow);
        }
    }
}

function sendPusherEvent(channelName, eventName, payload) {
    const appId = "2157449";
    const key = "b8320dcc9c1e40177646";
    const secret = "ed41a8e372f483c27027";
    const cluster = "ap1";

    const path = `/apps/${appId}/events`;
    const body = JSON.stringify({ name: eventName, channels: [channelName], data: JSON.stringify(payload) });
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyMd5 = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
    const authString = ["POST", path, `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`].join('\n');
    const signature = Utilities.computeHmacSha256Signature(authString, secret).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
    const url = `https://api-${cluster}.pusher.com${path}?auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${signature}`;

    UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: body });
}