/**
 * form-data.js
 * Centralized data store — single source of truth for all inspection categories,
 * workshop defaults, and login credentials.
 */

// ─── Login Credentials (client-side only) ────────────────────────────
const AUTH_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// ─── Default Workshop Info ───────────────────────────────────────────
const DEFAULT_WORKSHOP = {
  logo: 'data:image/png;base64,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',
  name: 'Super Shop&Drive Ampera',
  address: 'Jl. Ampera Raya No. 138 Ragunan, Pasar Minggu',
  phone: '(021)-7823844',
  whatsapp: '+62217823844',
  email: 'jkt.ssdampera@shopanddrive.com'
};

// ─── Customer Form Fields ────────────────────────────────────────────
const CUSTOMER_FIELDS = [
  { id: 'customerName',    label: 'Nama Customer',          type: 'text',   placeholder: 'Nama pemilik kendaraan', required: true },
  { id: 'customerPhone',   label: 'No. Telepon Customer',   type: 'tel',    placeholder: '08xxxxxxxxxx', required: false },
  { id: 'vehicleBrand',    label: 'Merek & Model Mobil',    type: 'text',   placeholder: 'Toyota Avanza 1.3 G', required: true },
  { id: 'vehicleYear',     label: 'Tahun Kendaraan',        type: 'number', placeholder: '2024', required: false },
  { id: 'vehiclePlate',    label: 'Nomor Polisi',           type: 'text',   placeholder: 'B 1234 ABC', required: true },
  { id: 'vehicleOdometer', label: 'Odometer (KM)',          type: 'number', placeholder: '50000', required: false },
  { id: 'inspectionDate',  label: 'Tanggal Inspeksi',       type: 'date',   placeholder: '', required: true },
  { id: 'mechanicName',    label: 'Nama Mekanik',           type: 'text',   placeholder: 'Nama mekanik yang memeriksa', required: true }
];

// ─── Inspection Status Options ───────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'good',      label: 'Baik',              icon: 'check-circle',    colorClass: 'status-good' },
  { value: 'warning',   label: 'Perlu Perhatian',   icon: 'alert-triangle',  colorClass: 'status-warning' },
  { value: 'danger',    label: 'Rusak',             icon: 'x-circle',        colorClass: 'status-danger' },
  { value: 'unchecked', label: 'Tidak Diperiksa',   icon: 'minus-circle',    colorClass: 'status-unchecked' }
];

// ─── Inspection Categories & Items ───────────────────────────────────
const INSPECTION_CATEGORIES = [
  {
    id: 'A',
    name: 'Mesin (Engine)',
    icon: 'settings',
    items: [
      { id: 'A1',  label: 'Kondisi Oli Mesin (warna, level, kekentalan)' },
      { id: 'A2',  label: 'Kondisi Filter Udara' },
      { id: 'A3',  label: 'Kondisi Radiator & Coolant' },
      { id: 'A4',  label: 'Kondisi Fan Belt / V-Belt' },
      { id: 'A5',  label: 'Mounting Mesin' },
      { id: 'A6',  label: 'Kebocoran Oli / Cairan' },
      { id: 'A7',  label: 'Suara Mesin Abnormal' },
      { id: 'A8',  label: 'Idle RPM / Stabilitas Mesin' },
      { id: 'A9',  label: 'Cek Kondisi Filter AC' },
      { id: 'A10', label: 'Oli Transmisi (matic/manual) — level & kondisi' }
    ]
  },
  {
    id: 'B',
    name: 'Kelistrikan (Electrical)',
    icon: 'zap',
    items: [
      { id: 'B1', label: 'Kondisi Aki / Baterai (voltase, terminal)' },
      { id: 'B2', label: 'Alternator / Pengisian' },
      { id: 'B4', label: 'Lampu Utama (dekat & jauh)' },
      { id: 'B5', label: 'Lampu Sein / Hazard' },
      { id: 'B6', label: 'Lampu Rem' },
      { id: 'B7', label: 'Lampu Mundur' },
      { id: 'B8', label: 'Lampu Dashboard / Indikator' },
      { id: 'B9', label: 'Wiper & Washer' }
    ]
  },
  {
    id: 'C',
    name: 'Kaki-Kaki (Suspension & Steering)',
    icon: 'disc',
    items: [
      { id: 'C1',  label: 'Shock Absorber Depan' },
      { id: 'C2',  label: 'Shock Absorber Belakang' },
      { id: 'C3',  label: 'Ball Joint' },
      { id: 'C4',  label: 'Tie Rod & Tie Rod End' },
      { id: 'C5',  label: 'Rack Steer / Steering Rack' },
      { id: 'C6',  label: 'Long Tie Rod / Drag Link' },
      { id: 'C7',  label: 'Bushing-bushing Arm' },
      { id: 'C8',  label: 'Stabilizer Link & Bushing' },
      { id: 'C9',  label: 'CV Joint / Boot Karet' },
      { id: 'C10', label: 'Bearing Roda' },
      { id: 'C11', label: 'Per / Spring (depan & belakang)' }
    ]
  },
  {
    id: 'D',
    name: 'Rem (Brake System)',
    icon: 'octagon',
    items: [
      { id: 'D1', label: 'Kampas Rem Depan' },
      { id: 'D2', label: 'Kampas Rem Belakang' },
      { id: 'D3', label: 'Disc / Piringan Rem Depan' },
      { id: 'D4', label: 'Disc / Drum Rem Belakang' },
      { id: 'D5', label: 'Selang Rem' },
      { id: 'D6', label: 'Master Rem' },
      { id: 'D7', label: 'Minyak Rem (level & kondisi)' }
    ]
  },
  {
    id: 'E',
    name: 'Ban & Velg (Tires & Wheels)',
    icon: 'circle',
    items: [
      { id: 'E1', label: 'Ban Depan Kiri (Tahun Produksi, Kondisi)' },
      { id: 'E2', label: 'Ban Depan Kanan' },
      { id: 'E3', label: 'Ban Belakang Kiri' },
      { id: 'E4', label: 'Ban Belakang Kanan' },
      { id: 'E5', label: 'Kondisi Velg (retak, peyang, aus)' },
      { id: 'E6', label: 'Tekanan Angin Ban' }
    ]
  }
];

// ─── Summary Fields ──────────────────────────────────────────────────
const SUMMARY_FIELDS = [
  { id: 'summaryCondition', label: 'Kondisi Umum Kendaraan', type: 'textarea', placeholder: 'Deskripsikan kondisi umum kendaraan...' },
  { id: 'summaryRecommend', label: 'Rekomendasi Perbaikan', type: 'textarea', placeholder: 'Tuliskan rekomendasi perbaikan untuk customer...' },
  { id: 'summaryNotes', label: 'Catatan Tambahan', type: 'textarea', placeholder: 'Catatan lain jika ada...' }
];

// ─── Max photos per inspection item ──────────────────────────────────
const MAX_PHOTOS_PER_ITEM = 2;
