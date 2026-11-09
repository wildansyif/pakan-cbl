// =============================================================================
// FILE: pakan_analytic_logic.js
// MODUL ANALITIK SPESIFIK JENIS PAKAN & DOSSIER DUE DILIGENCE INVESTOR / MITRA
// PT CITA BENGGALA LESTARI
// =============================================================================

// State Global Analitik Jenis Pakan
window.pakanAnalyticState = {
    pakan: '',
    start: '',
    end: '',
    tahun: '',
    totalKeluar: 0,
    totalMasuk: 0,
    tJual: 0,
    tPakai: 0,
    tGiling: 0,
    tMutasi: 0,
    tOmzet: 0,
    tHpp: 0,
    tProfit: 0,
    tMargin: 0,
    asp: 0,
    profitPerKg: 0,
    top3Ratio: 0,
    statusKonsentrasi: '',
    statusWarna: '',
    konsumenList: [],
    monthlyCommercial: {},
    totalPembeliKomersial: 0,
    rutinCount: 0,
    filterMode: 'komersial', // 'komersial' | 'all'
    limit: 10,              // 5 | 10 | 20 | 'ALL'
    sortBy: 'qty',          // 'qty' | 'omzet' | 'name'
    searchQuery: '',
    trendData: {},
    apBulanGroup: {}
};

// Instance Chart
let chMixAp = null;
let chApTrend = null;
let chApDist = null;

// =============================================================================
// 1. FUNGSI UTAMA: TARIK DATA ANALISA PAKAN DARI SUPABASE
// =============================================================================
async function tarikDataAnalisaPakan() {
    let pakanEl = document.getElementById('ap_pilih_pakan');
    let startEl = document.getElementById('ap_start');
    let endEl = document.getElementById('ap_end');

    let pakan = pakanEl ? pakanEl.value : '';
    let start = startEl ? startEl.value : '';
    let end = endEl ? endEl.value : '';

    if (!pakan) return alert("Pilih jenis pakan terlebih dahulu!");
    if (!start || !end) return alert("Pilih rentang tanggal!");
    if (start > end) return alert("Tanggal akhir tidak boleh lebih kecil dari tanggal awal!");

    let loader = document.getElementById('ap-loader');
    let result = document.getElementById('ap-result');
    if (loader) loader.classList.remove('hidden');
    if (result) result.classList.add('hidden');

    let tahunPilihan = start.substring(0, 4);

    try {
        const [dataRentang, dataSetahun] = await Promise.all([
            fetchSupabaseAll(`${SUPA_URL}/rest/v1/transaksi_pakan?pakan=eq.${encodeURIComponent(pakan)}&tanggal=gte.${start}&tanggal=lte.${end}&select=tanggal,relasi,cabang,status,qty,catatan,harga_satuan,total_hpp`),
            fetchSupabaseAll(`${SUPA_URL}/rest/v1/transaksi_pakan?pakan=eq.${encodeURIComponent(pakan)}&tanggal=gte.${tahunPilihan}-01-01&tanggal=lte.${tahunPilihan}-12-31&status=ilike.%25keluar%25&select=tanggal,relasi,cabang,qty`)
        ]);

        if (loader) loader.classList.add('hidden');

        let totalKeluar = 0, tMasuk = 0;
        let tJual = 0, tPakai = 0, tGiling = 0, tMutasi = 0;
        let tOmzet = 0, tHpp = 0;

        let konsumenMap = {};
        let trendData = {};
        let monthlyCommercial = {};

        const kelompokSapi = ['bx', 'domba', 'rd', 'rl', 'darbun', 'laktasi', 'kapalang', 'dewasa', 'jantan', 'pedet', 'kerbau', 'bunting'];

        // --- 1. Olah Data Rentang Pilihan ---
        (dataRentang || []).forEach(row => {
            let qty = parseFloat(row.qty) || 0;
            let statusTxt = String(row.status || '').toLowerCase();
            let isKeluar = statusTxt.includes("keluar");
            let isMasuk = statusTxt.includes("masuk");
            let tgl = row.tanggal;

            if (!trendData[tgl]) trendData[tgl] = { masuk: 0, keluar: 0 };

            if (isMasuk) {
                tMasuk += qty;
                trendData[tgl].masuk += qty;
                return;
            }

            if (!isKeluar) return;

            let namaRelasi = String(row.relasi || 'Tanpa Nama').trim();
            let namaLower = namaRelasi.toLowerCase();
            let cabangLower = String(row.cabang || '').toLowerCase();
            let cKat = "Penjualan";

            if (namaLower === "rd" || namaLower === "rl" || namaLower === "darbun" || namaLower === "laktasi") {
                cKat = "Giling";
            } else if (
                cabangLower.includes('kandang') || namaLower.includes("kandang") ||
                namaLower.includes("rph") || namaLower.includes("spn") ||
                namaLower.includes("cibulakan") || namaLower.includes("pembibitan") ||
                namaLower.includes("mutasi") || kelompokSapi.includes(namaLower)
            ) {
                cKat = "Pemakaian";
                if (namaLower.includes("rph") || namaLower.includes("spn") || namaLower.includes("pembibitan") || namaLower.includes("mutasi")) {
                    cKat = "Mutasi";
                }
            }

            totalKeluar += qty;
            trendData[tgl].keluar += qty;

            let hrgSatuan = parseFloat(row.harga_satuan) || 0;
            let barisOmzet = qty * hrgSatuan;
            let barisHpp = parseFloat(row.total_hpp) || 0;

            let blnKey = (row.tanggal || '').substring(0, 7); // e.g. "2026-01"

            if (cKat === "Penjualan") {
                tJual += qty;
                tOmzet += barisOmzet;
                tHpp += barisHpp;

                if (blnKey) {
                    if (!monthlyCommercial[blnKey]) {
                        monthlyCommercial[blnKey] = { qty: 0, omzet: 0 };
                    }
                    monthlyCommercial[blnKey].qty += qty;
                    monthlyCommercial[blnKey].omzet += barisOmzet;
                }
            } else if (cKat === "Pemakaian") {
                tPakai += qty;
            } else if (cKat === "Giling") {
                tGiling += qty;
            } else if (cKat === "Mutasi") {
                tMutasi += qty;
            }

            // Agregasi Konsumen
            if (!konsumenMap[namaRelasi]) {
                konsumenMap[namaRelasi] = {
                    nama: namaRelasi,
                    kategoriRelasi: (cKat === "Penjualan") ? "Komersial" : (cKat === "Pemakaian" ? "Internal Kandang" : cKat),
                    qtyKomersial: 0,
                    omzetKomersial: 0,
                    hppKomersial: 0,
                    qtyAll: 0,
                    omzetAll: 0,
                    txCount: 0,
                    monthsSet: new Set(),
                    lastTxDate: ''
                };
            }

            konsumenMap[namaRelasi].qtyAll += qty;
            konsumenMap[namaRelasi].omzetAll += barisOmzet;
            konsumenMap[namaRelasi].txCount += 1;

            if (cKat === "Penjualan") {
                konsumenMap[namaRelasi].qtyKomersial += qty;
                konsumenMap[namaRelasi].omzetKomersial += barisOmzet;
                konsumenMap[namaRelasi].hppKomersial += barisHpp;
                if (blnKey) konsumenMap[namaRelasi].monthsSet.add(blnKey);
                if (!konsumenMap[namaRelasi].lastTxDate || row.tanggal > konsumenMap[namaRelasi].lastTxDate) {
                    konsumenMap[namaRelasi].lastTxDate = row.tanggal;
                }
            }
        });

        // Hitung Metrik Keuangan
        let tProfit = tOmzet - tHpp;
        let tMargin = tOmzet > 0 ? ((tProfit / tOmzet) * 100) : 0;
        let asp = tJual > 0 ? (tOmzet / tJual) : 0;
        let profitPerKg = tJual > 0 ? (tProfit / tJual) : 0;

        // Siapkan Array Konsumen
        let konsumenArray = Object.values(konsumenMap);

        // Filter Pembeli Komersial Riil
        let pembeliKomersial = konsumenArray.filter(k => k.qtyKomersial > 0).sort((a, b) => b.qtyKomersial - a.qtyKomersial);
        let totalPembeliKomersial = pembeliKomersial.length;

        // Hitung Pembeli Rutin (Beli di >= 2 bulan berbeda, atau >= 2 kali order jika rentang pendek)
        let rutinCount = pembeliKomersial.filter(k => (k.monthsSet && k.monthsSet.size >= 2) || k.txCount >= 3).length;

        // Hitung Rasio Konsentrasi Top 3 (Komersial)
        let top3Qty = (pembeliKomersial[0]?.qtyKomersial || 0) + (pembeliKomersial[1]?.qtyKomersial || 0) + (pembeliKomersial[2]?.qtyKomersial || 0);
        let top3Ratio = tJual > 0 ? ((top3Qty / tJual) * 100) : 0;

        let statusKonsentrasi = "Diversifikasi Sehat";
        let statusWarna = "#16a34a";
        if (top3Ratio > 70) {
            statusKonsentrasi = "Ketergantungan Tinggi (>70%)";
            statusWarna = "#dc2626";
        } else if (top3Ratio > 50) {
            statusKonsentrasi = "Konsentrasi Moderat (50-70%)";
            statusWarna = "#ea580c";
        } else {
            statusKonsentrasi = "Diversifikasi Sehat (<50%)";
            statusWarna = "#16a34a";
        }

        // --- 2. Olah Data Setahun untuk Chart Stacked Bar ---
        let apBulanGroup = {};
        for (let i = 1; i <= 12; i++) {
            apBulanGroup[("0" + i).slice(-2)] = { jual: 0, pakai: 0, giling: 0, mutasi: 0, tot: 0 };
        }

        (dataSetahun || []).forEach(row => {
            let namaRelasi = String(row.relasi || 'Tanpa Nama').trim();
            let namaLower = namaRelasi.toLowerCase();
            let cabangLower = String(row.cabang || '').toLowerCase();
            let cKat = "Penjualan";

            if (namaLower === "rd" || namaLower === "rl" || namaLower === "darbun" || namaLower === "laktasi") {
                cKat = "Giling";
            } else if (
                cabangLower.includes('kandang') || namaLower.includes("kandang") ||
                namaLower.includes("rph") || namaLower.includes("spn") ||
                namaLower.includes("cibulakan") || namaLower.includes("pembibitan") ||
                namaLower.includes("mutasi") || kelompokSapi.includes(namaLower)
            ) {
                cKat = "Pemakaian";
                if (namaLower.includes("rph") || namaLower.includes("spn") || namaLower.includes("pembibitan") || namaLower.includes("mutasi")) {
                    cKat = "Mutasi";
                }
            }

            let blnKey = (row.tanggal || '').substring(5, 7);
            let qty = parseFloat(row.qty) || 0;

            if (apBulanGroup[blnKey]) {
                if (cKat === "Penjualan") apBulanGroup[blnKey].jual += qty;
                else if (cKat === "Pemakaian") apBulanGroup[blnKey].pakai += qty;
                else if (cKat === "Giling") apBulanGroup[blnKey].giling += qty;
                else if (cKat === "Mutasi") apBulanGroup[blnKey].mutasi += qty;
                apBulanGroup[blnKey].tot += qty;
            }
        });

        // Simpan ke State
        window.pakanAnalyticState = {
            pakan: pakan,
            start: start,
            end: end,
            tahun: tahunPilihan,
            totalKeluar: totalKeluar,
            totalMasuk: tMasuk,
            tJual: tJual,
            tPakai: tPakai,
            tGiling: tGiling,
            tMutasi: tMutasi,
            tOmzet: tOmzet,
            tHpp: tHpp,
            tProfit: tProfit,
            tMargin: tMargin,
            asp: asp,
            profitPerKg: profitPerKg,
            top3Ratio: top3Ratio,
            statusKonsentrasi: statusKonsentrasi,
            statusWarna: statusWarna,
            konsumenList: konsumenArray,
            monthlyCommercial: monthlyCommercial,
            totalPembeliKomersial: totalPembeliKomersial,
            rutinCount: rutinCount,
            filterMode: 'komersial',
            limit: 10,
            sortBy: 'qty',
            searchQuery: '',
            trendData: trendData,
            apBulanGroup: apBulanGroup
        };

        window.apDataBulanan = apBulanGroup;

        // Render Tampilan Keseluruhan
        renderPakanAnalyticDOM();

    } catch (err) {
        if (loader) loader.classList.add('hidden');
        console.error("Gagal menarik analisa pakan:", err);
        alert("Gagal menarik data analisa pakan: " + err.message);
    }
}

// =============================================================================
// 2. RENDER TAMPILAN DOM & METRIK KEUANGAN / INVESTOR
// =============================================================================
function renderPakanAnalyticDOM() {
    let s = window.pakanAnalyticState;
    if (!s) return;

    let nf = new Intl.NumberFormat('id-ID');
    let nfRp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

    // Header Ringkasan
    let elTotalKeluar = document.getElementById('ap_total_keluar');
    let elValMasuk = document.getElementById('ap_val_masuk');
    if (elTotalKeluar) elTotalKeluar.innerText = `${nf.format(s.totalKeluar)} Kg`;
    if (elValMasuk) elValMasuk.innerText = `${nf.format(s.totalMasuk)} Kg`;

    // 1. Grid Keuangan Penjualan
    let elOmzet = document.getElementById('ap_val_omzet');
    let elHpp = document.getElementById('ap_val_hpp');
    let elProfit = document.getElementById('ap_val_profit');
    let elMargin = document.getElementById('ap_val_margin');

    if (elOmzet) elOmzet.innerText = `Rp ${nfRp.format(s.tOmzet)}`;
    if (elHpp) elHpp.innerText = `Rp ${nfRp.format(s.tHpp)}`;
    if (elProfit) elProfit.innerText = `Rp ${nfRp.format(s.tProfit)}`;
    if (elMargin) elMargin.innerText = `${s.tMargin.toFixed(1)}%`;

    // 2. Grid Investor Due Diligence
    let elTotalPelanggan = document.getElementById('ap_val_total_pelanggan');
    let elSubPelanggan = document.getElementById('ap_sub_pelanggan');
    let elTop3Ratio = document.getElementById('ap_val_top3_ratio');
    let elStatusKonsentrasi = document.getElementById('ap_status_konsentrasi');
    let elAsp = document.getElementById('ap_val_asp');
    let elProfitPerKg = document.getElementById('ap_val_profit_per_kg');

    if (elTotalPelanggan) elTotalPelanggan.innerText = `${s.totalPembeliKomersial} Peternak`;
    if (elSubPelanggan) elSubPelanggan.innerText = `${s.rutinCount} Peternak Rutin (>1 Bln)`;
    if (elTop3Ratio) elTop3Ratio.innerText = `${s.top3Ratio.toFixed(1)}%`;
    if (elStatusKonsentrasi) {
        elStatusKonsentrasi.innerText = s.statusKonsentrasi;
        elStatusKonsentrasi.style.color = s.statusWarna || '#16a34a';
    }
    if (elAsp) elAsp.innerText = `Rp ${nfRp.format(Math.round(s.asp))} / Kg`;
    if (elProfitPerKg) elProfitPerKg.innerText = `Rp ${nfRp.format(Math.round(s.profitPerKg))} / Kg`;

    // 3. Mini Cards Volume
    let elJual = document.getElementById('ap_val_jual');
    let elPakai = document.getElementById('ap_val_pakai');
    let elGiling = document.getElementById('ap_val_giling');
    let elMutasi = document.getElementById('ap_val_mutasi');

    if (elJual) elJual.innerText = `${nf.format(s.tJual)} Kg`;
    if (elPakai) elPakai.innerText = `${nf.format(s.tPakai)} Kg`;
    if (elGiling) elGiling.innerText = `${nf.format(s.tGiling)} Kg`;
    if (elMutasi) elMutasi.innerText = `${nf.format(s.tMutasi)} Kg`;

    // 4. Render Charts
    renderChartApMix();
    renderChartApDistribusi();
    renderChartApTrend();

    // 5. Render Tabel Serapan Pasar
    renderPakanMarketTable();

    // Tampilkan Wadah Hasil
    let result = document.getElementById('ap-result');
    if (result) result.classList.remove('hidden');
}

// =============================================================================
// 3. RENDER GRAFIK-GRAFIK (STACKED MIX, DONUT, DAILY TREND)
// =============================================================================
function renderChartApMix() {
    let s = window.pakanAnalyticState;
    if (!s || !s.apBulanGroup) return;

    let d = s.apBulanGroup;
    let modeEl = document.querySelector('input[name="view_ap_chart_mode"]:checked');
    let mode = modeEl ? modeEl.value : 'mom';
    let nf = new Intl.NumberFormat('id-ID');

    let labels = [], jualData = [], pakaiData = [], mutasiData = [], gilingData = [], totData = [], growthArr = [];

    if (mode === 'mom') {
        labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        for (let i = 1; i <= 12; i++) {
            let k = ("0" + i).slice(-2);
            jualData.push(d[k].jual);
            pakaiData.push(d[k].pakai);
            mutasiData.push(d[k].mutasi);
            gilingData.push(d[k].giling);
            totData.push(d[k].tot);
        }
    } else {
        labels = ["Q1", "Q2", "Q3", "Q4"];
        for (let i = 0; i < 4; i++) {
            let m1 = ("0" + (i * 3 + 1)).slice(-2);
            let m2 = ("0" + (i * 3 + 2)).slice(-2);
            let m3 = ("0" + (i * 3 + 3)).slice(-2);

            jualData.push(d[m1].jual + d[m2].jual + d[m3].jual);
            pakaiData.push(d[m1].pakai + d[m2].pakai + d[m3].pakai);
            mutasiData.push(d[m1].mutasi + d[m2].mutasi + d[m3].mutasi);
            gilingData.push(d[m1].giling + d[m2].giling + d[m3].giling);
            totData.push(d[m1].tot + d[m2].tot + d[m3].tot);
        }
    }

    for (let i = 0; i < labels.length; i++) {
        let curr = totData[i];
        let prev = i === 0 ? 0 : totData[i - 1];
        let pct = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
        growthArr.push(pct);
    }

    let canvas = document.getElementById('chartMixAp');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (chMixAp) chMixAp.destroy();

    chMixAp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'Growth (%)', data: growthArr, borderColor: '#16a34a', backgroundColor: '#16a34a', tension: 0.2, borderWidth: 2, pointRadius: 3, yAxisID: 'yGrowth', order: 1 },
                { type: 'bar', label: 'Penjualan', data: jualData, backgroundColor: '#2563eb', yAxisID: 'yQty', stack: 'Stack 0', order: 2 },
                { type: 'bar', label: 'Pemakaian', data: pakaiData, backgroundColor: '#38bdf8', yAxisID: 'yQty', stack: 'Stack 0', order: 2 },
                { type: 'bar', label: 'Giling', data: gilingData, backgroundColor: '#9333ea', yAxisID: 'yQty', stack: 'Stack 0', order: 2 },
                { type: 'bar', label: 'Mutasi', data: mutasiData, backgroundColor: '#f97316', yAxisID: 'yQty', stack: 'Stack 0', order: 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { stacked: true },
                yQty: { type: 'linear', position: 'left', stacked: true, ticks: { display: true, font: { size: 9 }, callback: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 't' : val }, beginAtZero: true },
                yGrowth: { type: 'linear', position: 'right', display: false, min: -300, suggestedMax: 150 }
            },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            if (c.dataset.yAxisID === 'yQty') return c.dataset.label + ': ' + nf.format(c.raw) + ' Kg';
                            if (c.dataset.yAxisID === 'yGrowth') {
                                let sign = c.raw > 0 ? '+' : '';
                                return 'Growth: ' + sign + c.raw.toFixed(1) + '%';
                            }
                            return '';
                        },
                        afterBody: function (c) {
                            let total = c.reduce((sum, item) => item.dataset.yAxisID === 'yQty' ? sum + item.raw : sum, 0);
                            if (total > 0) return '\nTotal Keluar: ' + nf.format(total) + ' Kg';
                            return '';
                        }
                    }
                }
            }
        }
    });
}

function renderChartApDistribusi() {
    let s = window.pakanAnalyticState;
    if (!s) return;

    let canvas = document.getElementById('chartApDistribusi');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (chApDist) chApDist.destroy();

    chApDist = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ["Penjualan", "Pemakaian", "Giling", "Mutasi"],
            datasets: [{
                data: [s.tJual, s.tPakai, s.tGiling, s.tMutasi],
                backgroundColor: ['#2563eb', '#38bdf8', '#9333ea', '#f97316'],
                borderWidth: 0
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 9 } } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 9.5 },
                    formatter: (value, context) => {
                        let sum = context.dataset.data.reduce((a, b) => a + b, 0);
                        if (sum === 0 || value === 0) return "";
                        let pct = (value * 100 / sum);
                        return pct >= 5 ? pct.toFixed(1) + "%" : "";
                    }
                }
            }
        }
    });
}

function renderChartApTrend() {
    let s = window.pakanAnalyticState;
    if (!s || !s.trendData) return;

    let canvas = document.getElementById('chartApTrend');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (chApTrend) chApTrend.destroy();

    let tglKeys = Object.keys(s.trendData).sort();
    let arrLabels = tglKeys.map(d => { let p = d.split('-'); return p[2] + '/' + p[1]; });
    let arrMsk = tglKeys.map(d => s.trendData[d].masuk);
    let arrKlr = tglKeys.map(d => s.trendData[d].keluar);

    let arrStok = [];
    let runningStok = 0;
    tglKeys.forEach(d => {
        runningStok += (s.trendData[d].masuk - s.trendData[d].keluar);
        arrStok.push(runningStok);
    });

    chApTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: arrLabels,
            datasets: [
                { label: 'Masuk (Kg)', data: arrMsk, borderColor: '#16a34a', backgroundColor: '#16a34a', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, yAxisID: 'yUtama', order: 2 },
                { label: 'Keluar (Kg)', data: arrKlr, borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, yAxisID: 'yUtama', order: 3 },
                { label: 'Saldo Akumulasi (Kg)', data: arrStok, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', tension: 0.3, fill: true, borderWidth: 2, pointRadius: 0, borderDash: [4, 4], yAxisID: 'yKanan', order: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 9.5 } } },
                datalabels: { display: false }
            },
            scales: {
                yUtama: { type: 'linear', position: 'left', beginAtZero: true, ticks: { font: { size: 9 }, callback: val => val.toLocaleString('id-ID') } },
                yKanan: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 9 }, color: '#d97706', callback: val => (val > 0 ? '+' : '') + val.toLocaleString('id-ID') } }
            }
        }
    });
}

// =============================================================================
// 4. KONTROL INTERAKTIF TABEL (FILTER, LIMIT, SORT, SEARCH)
// =============================================================================
function setPakanAnalyticFilter(mode) {
    window.pakanAnalyticState.filterMode = mode;

    let btnKomersial = document.getElementById('btn-ap-filter-komersial');
    let btnAll = document.getElementById('btn-ap-filter-all');

    if (btnKomersial && btnAll) {
        if (mode === 'komersial') {
            btnKomersial.style.background = '#2563eb';
            btnKomersial.style.color = '#fff';
            btnKomersial.style.fontWeight = '700';

            btnAll.style.background = 'transparent';
            btnAll.style.color = '#64748b';
            btnAll.style.fontWeight = '600';
        } else {
            btnAll.style.background = '#2563eb';
            btnAll.style.color = '#fff';
            btnAll.style.fontWeight = '700';

            btnKomersial.style.background = 'transparent';
            btnKomersial.style.color = '#64748b';
            btnKomersial.style.fontWeight = '600';
        }
    }

    renderPakanMarketTable();
}

function setPakanAnalyticLimit(lim) {
    window.pakanAnalyticState.limit = lim;

    document.querySelectorAll('.btn-ap-limit').forEach(btn => {
        let btnLim = btn.getAttribute('data-limit');
        if (String(btnLim) === String(lim)) {
            btn.style.background = '#2563eb';
            btn.style.color = '#fff';
            btn.style.fontWeight = '700';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.fontWeight = '600';
        }
    });

    renderPakanMarketTable();
}

function setPakanAnalyticSort(sortBy) {
    window.pakanAnalyticState.sortBy = sortBy;
    renderPakanMarketTable();
}

function setPakanAnalyticSearch(val) {
    window.pakanAnalyticState.searchQuery = (val || '').toLowerCase().trim();
    renderPakanMarketTable();
}

// =============================================================================
// 5. RENDER TABEL SERAPAN PASAR KONSUMEN (INVESTOR GRADE)
// =============================================================================
function renderPakanMarketTable() {
    let s = window.pakanAnalyticState;
    if (!s || !s.konsumenList) return;

    let tbody = document.getElementById('tbody-pakan-market');
    let tfoot = document.getElementById('tfoot-pakan-market');
    if (!tbody) return;

    let isKomersialOnly = (s.filterMode === 'komersial');
    let totalAcuanQty = isKomersialOnly ? s.tJual : s.totalKeluar;

    // Filter daftar konsumen
    let list = s.konsumenList.filter(item => {
        let qtyVal = isKomersialOnly ? item.qtyKomersial : item.qtyAll;
        if (qtyVal <= 0) return false;

        if (s.searchQuery) {
            let matchName = item.nama.toLowerCase().includes(s.searchQuery);
            let matchKat = (item.kategoriRelasi || '').toLowerCase().includes(s.searchQuery);
            if (!matchName && !matchKat) return false;
        }
        return true;
    });

    // Sorting
    list.sort((a, b) => {
        let qA = isKomersialOnly ? a.qtyKomersial : a.qtyAll;
        let qB = isKomersialOnly ? b.qtyKomersial : b.qtyAll;
        let oA = isKomersialOnly ? a.omzetKomersial : a.omzetAll;
        let oB = isKomersialOnly ? b.omzetKomersial : b.omzetAll;

        if (s.sortBy === 'omzet') return oB - oA;
        if (s.sortBy === 'name') return a.nama.localeCompare(b.nama);
        return qB - qA; // default: qty
    });

    let totalFilteredQty = list.reduce((sum, item) => sum + (isKomersialOnly ? item.qtyKomersial : item.qtyAll), 0);
    let totalFilteredOmzet = list.reduce((sum, item) => sum + (isKomersialOnly ? item.omzetKomersial : item.omzetAll), 0);

    // Potong sesuai limit
    let slicedList = list;
    if (s.limit !== 'ALL') {
        let limNum = parseInt(s.limit, 10) || 10;
        slicedList = list.slice(0, limNum);
    }

    let nf = new Intl.NumberFormat('id-ID');
    let nfRp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

    if (slicedList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:24px 10px; color:#64748b;">
                    <span class="material-symbols-outlined" style="font-size:28px; vertical-align:middle; color:#94a3b8; display:block; margin-bottom:4px;">search_off</span>
                    Tidak ada transaksi konsumen yang sesuai kriteria filter.
                </td>
            </tr>
        `;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    let htmlRows = '';
    slicedList.forEach((row, idx) => {
        let rank = idx + 1;
        let qty = isKomersialOnly ? row.qtyKomersial : row.qtyAll;
        let omzet = isKomersialOnly ? row.omzetKomersial : row.omzetAll;
        let avgPrice = (qty > 0 && omzet > 0) ? (omzet / qty) : 0;
        let sharePct = totalAcuanQty > 0 ? ((qty / totalAcuanQty) * 100) : 0;

        // Styling Badge Peringkat
        let badgeStyle = "background:#f1f5f9; color:#475569;";
        if (rank === 1) badgeStyle = "background:#fef3c7; color:#b45309; font-weight:800; border:1px solid #fde68a;";
        else if (rank === 2) badgeStyle = "background:#f1f5f9; color:#334155; font-weight:800; border:1px solid #cbd5e1;";
        else if (rank === 3) badgeStyle = "background:#ffedd5; color:#9a3412; font-weight:800; border:1px solid #fed7aa;";

        // Badge Kategori Relasi
        let isInternal = row.kategoriRelasi !== "Komersial";
        let katBadge = isInternal
            ? `<span style="font-size:9.5px; background:#f1f5f9; color:#64748b; padding:1px 5px; border-radius:4px; font-weight:600; margin-left:5px;">Internal</span>`
            : `<span style="font-size:9.5px; background:#eff6ff; color:#1e40af; padding:1px 5px; border-radius:4px; font-weight:600; margin-left:5px;">Peternak</span>`;

        // Bar Warna Progress
        let barColor = rank <= 3 ? '#2563eb' : '#64748b';

        htmlRows += `
            <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s;" class="row-top-konsumen">
                <!-- 1. Peringkat -->
                <td style="padding:10px 6px; text-align:center;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:10px; ${badgeStyle}">
                        ${rank}
                    </span>
                </td>

                <!-- 2. Nama Konsumen + Info Mobile -->
                <td style="padding:10px 6px;">
                    <div style="font-weight:700; color:#0f172a; font-size:12.5px; display:flex; align-items:center; flex-wrap:wrap;">
                        <span>${row.nama}</span>
                        ${katBadge}
                    </div>
                    <!-- Sub-info khusus layar ponsel -->
                    <div class="mobile-only-sub" style="font-size:10.5px; color:#64748b; margin-top:2px;">
                        <span>Omzet: <b style="color:#1e40af;">Rp ${nfRp.format(omzet)}</b></span>
                        ${avgPrice > 0 ? `<span style="margin-left:6px;">• @Rp ${nfRp.format(Math.round(avgPrice))}</span>` : ''}
                    </div>
                </td>

                <!-- 3. Volume Serapan (Kg) -->
                <td style="padding:10px 6px; text-align:right; font-weight:800; color:#0f172a;" class="ap-col-qty">
                    ${nf.format(qty)} <span style="font-size:10px; font-weight:600; color:#64748b;">Kg</span>
                </td>

                <!-- 4. Total Omzet (Rp) -->
                <td style="padding:10px 6px; text-align:right; font-weight:700; color:#1e40af;" class="ap-col-omzet">
                    Rp ${nfRp.format(omzet)}
                </td>

                <!-- 5. Harga Riil / ASP -->
                <td style="padding:10px 6px; text-align:right; font-size:11px; color:#475569;" class="ap-col-asp">
                    ${avgPrice > 0 ? 'Rp ' + nfRp.format(Math.round(avgPrice)) : '-'}
                </td>

                <!-- 6. Porsi Pangsa Pasar & Visual Bar -->
                <td style="padding:10px 6px; width:170px;" class="ap-col-share">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; font-size:11px;">
                        <span style="font-weight:700; color:#0f172a;">${sharePct.toFixed(1)}%</span>
                        <span style="font-size:10px; color:#64748b;">${row.txCount}x ambil</span>
                    </div>
                    <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                        <div style="width:${Math.min(sharePct, 100)}%; height:100%; background:${barColor}; border-radius:3px;"></div>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlRows;

    // Render TFoot Ringkasan
    if (tfoot) {
        let coveragePct = totalAcuanQty > 0 ? ((totalFilteredQty / totalAcuanQty) * 100) : 0;
        tfoot.innerHTML = `
            <tr>
                <td colspan="2" style="padding:10px 8px; text-align:left; font-size:11.5px; color:#334155;">
                    TOTAL TAMPILAN (${slicedList.length} dari ${list.length} Relasi):
                </td>
                <td style="padding:10px 6px; text-align:right; font-size:12px; color:#0f172a;" class="ap-col-qty">
                    ${nf.format(totalFilteredQty)} Kg
                </td>
                <td style="padding:10px 6px; text-align:right; font-size:12px; color:#1e40af;" class="ap-col-omzet">
                    Rp ${nfRp.format(totalFilteredOmzet)}
                </td>
                <td style="padding:10px 6px; text-align:right; font-size:11px; color:#475569;" class="ap-col-asp">
                    ${totalFilteredQty > 0 && totalFilteredOmzet > 0 ? 'Rp ' + nfRp.format(Math.round(totalFilteredOmzet / totalFilteredQty)) : '-'}
                </td>
                <td style="padding:10px 6px; text-align:right; font-size:11.5px; color:#0f172a;" class="ap-col-share">
                    <b>${coveragePct.toFixed(1)}%</b> <span style="font-size:10px; color:#64748b; font-weight:normal;">cakupan</span>
                </td>
            </tr>
        `;
    }
}

// =============================================================================
// 6. CETAK LAPORAN DOSSIER RESMI INVESTOR / MITRA (A4 PORTRAIT)
// =============================================================================
function cetakDossierPakanA4() {
    let s = window.pakanAnalyticState;
    if (!s || !s.pakan) {
        return alert("Silakan tarik data analisa pakan terlebih dahulu sebelum mencetak!");
    }

    let nf = new Intl.NumberFormat('id-ID');
    let nfRp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    let tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
        return alert("Pop-up browser terblokir. Izinkan pop-up di browser Anda untuk melihat dan mencetak dokumen.");
    }

    // Ambil SEMUA Pembeli Komersial
    let allPembeliKomersial = s.konsumenList
        .filter(k => k.qtyKomersial > 0)
        .sort((a, b) => b.qtyKomersial - a.qtyKomersial);

    let totalPembeliKomersial = allPembeliKomersial.length;
    let rutinCount = s.rutinCount || allPembeliKomersial.filter(k => (k.monthsSet && k.monthsSet.size >= 2) || k.txCount >= 3).length;

    // Ambil Top 10 Pembeli Komersial
    let top10 = allPembeliKomersial.slice(0, 10);
    let sisaList = allPembeliKomersial.slice(10);

    let sisaQty = sisaList.reduce((sum, k) => sum + k.qtyKomersial, 0);
    let sisaOmzet = sisaList.reduce((sum, k) => sum + k.omzetKomersial, 0);
    let sisaAsp = sisaQty > 0 ? (sisaOmzet / sisaQty) : 0;
    let sisaSharePct = s.tJual > 0 ? ((sisaQty / s.tJual) * 100) : 0;

    let rowsKonsumenHtml = "";
    if (top10.length > 0) {
        top10.forEach((k, idx) => {
            let sharePct = s.tJual > 0 ? ((k.qtyKomersial / s.tJual) * 100) : 0;
            let avgPrice = (k.qtyKomersial > 0 && k.omzetKomersial > 0) ? (k.omzetKomersial / k.qtyKomersial) : 0;

            rowsKonsumenHtml += `
                <tr style="border-bottom:1px solid #e2e8f0; font-size:9.5px;">
                    <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:center; font-weight:bold;">${idx + 1}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700; color:#0f172a;">${k.nama}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold;">${nf.format(k.qtyKomersial)} Kg</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold; color:#0f172a;">Rp ${nfRp.format(k.omzetKomersial)}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#475569;">Rp ${nfRp.format(Math.round(avgPrice))}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold; color:#0f172a;">${sharePct.toFixed(1)}%</td>
                </tr>
            `;
        });

        // Baris "Konsumen Lainnya" jika ada lebih dari 10 peternak
        if (sisaList.length > 0) {
            rowsKonsumenHtml += `
                <tr style="border-bottom:1px solid #e2e8f0; font-size:9.5px; background:#f8fafc; font-style:italic;">
                    <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:center; color:#64748b;">-</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700; color:#475569;">
                        Konsumen Lainnya (${sisaList.length} Peternak)
                    </td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold; color:#475569;">${nf.format(sisaQty)} Kg</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold; color:#475569;">Rp ${nfRp.format(sisaOmzet)}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#64748b;">Rp ${nfRp.format(Math.round(sisaAsp))}</td>
                    <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-weight:bold; color:#475569;">${sisaSharePct.toFixed(1)}%</td>
                </tr>
            `;
        }
    } else {
        rowsKonsumenHtml = `<tr><td colspan="6" style="text-align:center; padding:10px; border:1px solid #cbd5e1;">Belum ada transaksi penjualan komersial.</td></tr>`;
    }

    // --- Olah Tabel Rekapitulasi Penjualan Bulanan (MoM) Full Width dengan Omzet ---
    const namaBulanMap = {
        '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April', '05': 'Mei', '06': 'Juni',
        '07': 'Juli', '08': 'Agustus', '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
    };

    let monthlyKeys = Object.keys(s.monthlyCommercial || {}).sort();
    let rowsMonthlyHtml = "";
    let prevQty = 0;
    let sumMonthlyQty = 0;
    let sumMonthlyOmzet = 0;

    if (monthlyKeys.length > 0) {
        monthlyKeys.forEach((key, idx) => {
            let mData = s.monthlyCommercial[key] || { qty: 0, omzet: 0 };
            let mQty = mData.qty || 0;
            let mOmzet = mData.omzet || 0;
            sumMonthlyQty += mQty;
            sumMonthlyOmzet += mOmzet;

            let mCode = key.substring(5, 7);
            let mLabel = (namaBulanMap[mCode] || mCode) + " " + key.substring(0, 4);

            let momGrowthText = "- (Awal Periode)";
            let momColor = "#64748b";

            if (idx > 0 && prevQty > 0) {
                let diffPct = ((mQty - prevQty) / prevQty) * 100;
                let sign = diffPct > 0 ? "▲ +" : (diffPct < 0 ? "▼ " : "");
                momGrowthText = `${sign}${diffPct.toFixed(1)}%`;
                momColor = diffPct >= 0 ? "#16a34a" : "#dc2626";
            }

            rowsMonthlyHtml += `
                <tr style="font-size:9.5px;">
                    <td style="border:1px solid #cbd5e1; padding:3.5px 8px; font-weight:700;">${mLabel}</td>
                    <td style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; font-weight:bold; color:#0f172a;">${nf.format(mQty)} Kg</td>
                    <td style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; font-weight:700; color:#0f172a;">Rp ${nfRp.format(mOmzet)}</td>
                    <td style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; font-weight:800; color:${momColor};">${momGrowthText}</td>
                </tr>
            `;

            prevQty = mQty;
        });

        let avgMonthlyQty = sumMonthlyQty / monthlyKeys.length;
        let avgMonthlyOmzet = sumMonthlyOmzet / monthlyKeys.length;

        rowsMonthlyHtml += `
            <tr style="font-size:9.5px; background:#f1f5f9; font-weight:800; border-top:1.5px solid #94a3b8;">
                <td style="border:1px solid #cbd5e1; padding:4px 8px;">RATA-RATA / BULAN (${monthlyKeys.length} Bulan):</td>
                <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">${nf.format(Math.round(avgMonthlyQty))} Kg</td>
                <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">Rp ${nfRp.format(Math.round(avgMonthlyOmzet))}</td>
                <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#475569;">Stabilitas Konsisten</td>
            </tr>
        `;
    } else {
        rowsMonthlyHtml = `<tr><td colspan="4" style="text-align:center; padding:8px; border:1px solid #cbd5e1;">Data bulanan belum tersedia.</td></tr>`;
    }

    let pdfFilename = `Dossier_Performa_${s.pakan.replace(/\s+/g, '_')}_${s.start}_sd_${s.end}.pdf`;

    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>Dossier Evaluasi Produk - ${s.pakan}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <style>
                @page { size: A4 portrait; margin: 0; }
                body {
                    margin: 0; padding: 0; background: #525659;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact;
                }
                .btn-floating-print {
                    position: fixed; top: 16px; right: 20px; z-index: 9999;
                    background: #0f172a; color: #ffffff; border: none; padding: 10px 18px;
                    border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 8px;
                }
                .btn-floating-print:hover { background: #1e293b; }
                .a4-page {
                    width: 210mm; min-height: 297mm; margin: 15px auto; background: #ffffff;
                    padding: 13mm 16mm 13mm 16mm; box-sizing: border-box;
                    box-shadow: 0 0 15px rgba(0,0,0,0.2); position: relative;
                }
                .kop-surat {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #0f172a; padding-bottom: 7px; margin-bottom: 9px;
                }
                .section-title {
                    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
                    color: #0f172a; margin-top: 8px; margin-bottom: 4px;
                    border-left: 3px solid #0f172a; padding-left: 6px;
                }
                table { width: 100%; border-collapse: collapse; }
                .grid-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 6px; }
                .card-box {
                    border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px; background: #f8fafc;
                }
                .card-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
                .card-value { font-size: 13px; font-weight: 800; color: #0f172a; }
                @media print {
                    body { background: #ffffff; }
                    .btn-floating-print { display: none; }
                    .a4-page { margin: 0; box-shadow: none; width: 100%; min-height: auto; padding: 11mm 14mm; }
                }
            </style>
        </head>
        <body>
            <button class="btn-floating-print" onclick="downloadPdfDoc()">
                📥 Download PDF Resmi A4
            </button>

            <div class="a4-page" id="printable-doc">
                <!-- 1. KOP SURAT RESMI -->
                <div class="kop-surat">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="https://raw.githubusercontent.com/wildansyif/pakan-cbl/2e732398572a6ac7d3512559c4344d40ab0902f9/Logo%20CBL.png" 
                             alt="Logo CBL" style="height:44px; width:auto;" />
                        <div>
                            <div style="font-size:14.5px; font-weight:900; color:#0f172a; letter-spacing:0.5px;">PT CITA BENGGALA LESTARI</div>
                            <div style="font-size:9px; color:#475569; font-weight:600; line-height:1.3; margin-top:2px;">
                                Cikahuripan RT.04/RW.10, Kec. Lembang, Kabupaten Bandung Barat, Jawa Barat 40391
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="background:#0f172a; color:#ffffff; font-size:8.5px; font-weight:800; padding:3px 8px; border-radius:3px; letter-spacing:0.5px; display:inline-block;">
                            DOKUMEN RESMI ANALISA PAKAN
                        </span>
                        <div style="font-size:8.5px; color:#64748b; margin-top:3px;">Tanggal Cetak: <b>${tglCetak}</b></div>
                    </div>
                </div>

                <!-- 2. JUDUL DOSSIER -->
                <div style="text-align:center; margin-bottom:8px;">
                    <h2 style="font-size:13px; font-weight:900; color:#0f172a; margin:0; text-transform:uppercase; letter-spacing:0.5px;">
                        DOSSIER EVALUASI KELAYAKAN & PERFORMA PRODUK: ${s.pakan}
                    </h2>
                    <div style="font-size:8.5px; color:#475569; margin-top:2px; font-weight:600;">
                        Periode Audit: ${s.start} s/d ${s.end} | Basis Data: Database Penjualan Pakan PT CBL
                    </div>
                </div>

                <!-- 3. BAGIAN I: RINGKASAN EKSEKUTIF FINANSIAL (MINIMALIS FORMAL) -->
                <div class="section-title">I. Ringkasan Eksekutif Keuangan (Penjualan Komersial)</div>
                <div class="grid-cards">
                    <div class="card-box">
                        <div class="card-label">Total Omzet Penjualan</div>
                        <div class="card-value">Rp ${nfRp.format(s.tOmzet)}</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Realisasi penerimaan kas</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Total HPP (Modal)</div>
                        <div class="card-value">Rp ${nfRp.format(s.tHpp)}</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Beban pokok produksi</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Laba Bersih (Net Profit)</div>
                        <div class="card-value">Rp ${nfRp.format(s.tProfit)}</div>
                        <div style="font-size:7.5px; color:#16a34a; font-weight:700; margin-top:2px;">Net profit operasional</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Margin Keuntungan</div>
                        <div class="card-value">${s.tMargin.toFixed(1)}%</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Rasio marjin bersih</div>
                    </div>
                </div>

                <!-- 4. BAGIAN II: KESEHATAN PASAR & UNIT ECONOMICS -->
                <div class="section-title">II. Kesehatan Pasar & Unit Economics (Analisa Investor)</div>
                <div class="grid-cards">
                    <div class="card-box">
                        <div class="card-label">Total Konsumen</div>
                        <div class="card-value">${totalPembeliKomersial} Peternak</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">${rutinCount} Peternak Rutin (>1 Bln)</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Rasio Top 3 Konsumen</div>
                        <div class="card-value">${s.top3Ratio.toFixed(1)}%</div>
                        <div style="font-size:7.5px; color:${s.statusWarna}; font-weight:700; margin-top:2px;">${s.statusKonsentrasi}</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Rata-rata Harga Jual (ASP)</div>
                        <div class="card-value">Rp ${nfRp.format(Math.round(s.asp))} / Kg</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Realisasi harga netto pasar</div>
                    </div>
                    <div class="card-box">
                        <div class="card-label">Net Profit per Kg</div>
                        <div class="card-value">Rp ${nfRp.format(Math.round(s.profitPerKg))} / Kg</div>
                        <div style="font-size:7.5px; color:#64748b; margin-top:2px;">Kontribusi laba per satuan</div>
                    </div>
                </div>

                <!-- 5. BAGIAN III: ALOKASI DISTRIBUSI FISIK (STACKED BERURUTAN KE BAWAH) -->
                <div class="section-title">III. Rincian Alokasi Distribusi Fisik (Total Keluar: ${nf.format(s.totalKeluar)} Kg)</div>
                <table style="font-size:9px; margin-bottom:6px;">
                    <thead>
                        <tr style="background:#f1f5f9; text-transform:uppercase; font-size:8px;">
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:left;">Saluran Distribusi</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:95px;">Volume (Kg)</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:65px;">Porsi (%)</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:left;">Sifat / Keterangan Alokasi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; font-weight:700;">Penjualan Pasar Komersial</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right; font-weight:700; color:#0f172a;">${nf.format(s.tJual)} Kg</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right; font-weight:700;">${s.totalKeluar > 0 ? ((s.tJual / s.totalKeluar) * 100).toFixed(1) : 0}%</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; color:#475569;">Penjualan riil menghasilkan penerimaan omzet kas</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; font-weight:700;">Pemakaian Internal Kandang</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${nf.format(s.tPakai)} Kg</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${s.totalKeluar > 0 ? ((s.tPakai / s.totalKeluar) * 100).toFixed(1) : 0}%</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; color:#475569;">Pakan populasi sapi/domba internal kandang CBL</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; font-weight:700;">Upah / Bahan Baku Giling</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${nf.format(s.tGiling)} Kg</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${s.totalKeluar > 0 ? ((s.tGiling / s.totalKeluar) * 100).toFixed(1) : 0}%</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; color:#475569;">Pemrosesan mesin giling SPN Mandiri</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; font-weight:700;">Mutasi Antar Gudang</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${nf.format(s.tMutasi)} Kg</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; text-align:right;">${s.totalKeluar > 0 ? ((s.tMutasi / s.totalKeluar) * 100).toFixed(1) : 0}%</td>
                            <td style="border:1px solid #cbd5e1; padding:3px 8px; color:#475569;">Transfer logistik antar unit usaha / cabang</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 6. BAGIAN IV: REKAPITULASI PENJUALAN BULANAN (FULL WIDTH DENGAN OMZET) -->
                <div class="section-title">IV. Rekapitulasi Penjualan Bulanan & Pertumbuhan (MoM)</div>
                <table style="font-size:9px; margin-bottom:6px;">
                    <thead>
                        <tr style="background:#f1f5f9; text-transform:uppercase; font-size:8px;">
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:left;">Periode Bulan</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:95px;">Volume (Kg)</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:110px;">Omzet Penjualan</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:100px;">Pertumbuhan MoM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsMonthlyHtml}
                    </tbody>
                </table>

                <!-- 7. BAGIAN V: TABEL PEMBELI UTAMA & LAINNYA (100% BALANCED) -->
                <div class="section-title">V. Top 10 Konsumen Utama & Serapan Pasar Komersial (${s.pakan})</div>
                <table style="margin-bottom:6px;">
                    <thead>
                        <tr style="background:#f1f5f9; text-transform:uppercase; font-size:8px;">
                            <th style="border:1px solid #cbd5e1; padding:3.5px 6px; width:22px; text-align:center;">#</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:left;">Nama Peternak / Relasi</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:95px;">Volume (Kg)</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:110px;">Total Omzet</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:75px;">ASP / Kg</th>
                            <th style="border:1px solid #cbd5e1; padding:3.5px 8px; text-align:right; width:65px;">Pangsa (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsKonsumenHtml}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f1f5f9; font-weight:800; font-size:9px; border-top:1.5px solid #0f172a;">
                            <td colspan="2" style="border:1px solid #cbd5e1; padding:4px 8px; text-align:left;">
                                TOTAL PENJUALAN KOMERSIAL (${totalPembeliKomersial} Peternak):
                            </td>
                            <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">
                                ${nf.format(s.tJual)} Kg
                            </td>
                            <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">
                                Rp ${nfRp.format(s.tOmzet)}
                            </td>
                            <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">
                                ${s.tJual > 0 && s.tOmzet > 0 ? 'Rp ' + nfRp.format(Math.round(s.tOmzet / s.tJual)) : '-'}
                            </td>
                            <td style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; color:#0f172a;">
                                100.0%
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div style="font-size:8px; color:#64748b; text-align:right; margin-top:4px;">
                    Seluruh data pada laporan ini bersumber langsung dari database penjualan pakan PT Cita Benggala Lestari.
                </div>
            </div>

            <script>
                function downloadPdfDoc() {
                    const el = document.getElementById('printable-doc');
                    const opt = {
                        margin: [6, 6, 6, 6],
                        filename: '${pdfFilename}',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    html2pdf().set(opt).from(el).save();
                }
            </script>
        </body>
        </html>
    `);

    printWin.document.close();
}

// Ekspor ke Window Global agar dapat dipanggil dari mana saja
window.tarikDataAnalisaPakan = tarikDataAnalisaPakan;
window.renderPakanAnalyticDOM = renderPakanAnalyticDOM;
window.renderChartApMix = renderChartApMix;
window.renderChartApDistribusi = renderChartApDistribusi;
window.renderChartApTrend = renderChartApTrend;
window.setPakanAnalyticFilter = setPakanAnalyticFilter;
window.setPakanAnalyticLimit = setPakanAnalyticLimit;
window.setPakanAnalyticSort = setPakanAnalyticSort;
window.setPakanAnalyticSearch = setPakanAnalyticSearch;
window.renderPakanMarketTable = renderPakanMarketTable;
window.cetakDossierPakanA4 = cetakDossierPakanA4;
