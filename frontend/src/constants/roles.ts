// frontend/src/constants/roles.ts
// Single source of truth for roles, role labels, and Indonesian month/day names.

export const STAFF_ROLES = [
  'staff',
  'petugas kebersihan',
  'guru ra',
  'guru mi akhwat',
  'guru mi ikhwan',
  'guru tahfidz fase a',
  'guru tahfidz fase b & c',
  'guru asisten',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type Role = 'admin' | StaffRole;

export const ALL_ROLES: readonly Role[] = ['admin', ...STAFF_ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Staff',
  'petugas kebersihan': 'Petugas Kebersihan',
  'guru ra': 'Guru RA',
  'guru mi akhwat': 'Guru MI Akhwat',
  'guru mi ikhwan': 'Guru MI Ikhwan',
  'guru tahfidz fase a': 'Guru Tahfidz Fase A',
  'guru tahfidz fase b & c': 'Guru Tahfidz Fase B & C',
  'guru asisten': 'Guru Asisten',
};

export const ROLE_OPTIONS = ALL_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

export const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const DAYS_ID_SUNDAY_FIRST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const DAYS_ID_MONDAY_FIRST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;