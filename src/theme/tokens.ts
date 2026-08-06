// Design tokens — single source of truth (01-UI-SPEC.md Implementation Contract).
// No style values outside this file.
export const colors = {
  background: '#F7F7F8', surface: '#FFFFFF', textPrimary: '#1A1A1A',
  textSecondary: '#6B7280', border: '#E5E7EB', income: '#16A34A',
  expense: '#DC2626', accent: '#111827', danger: '#DC2626',
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 };
// `as const` makes `weight` the literal '400'/'700' so styles can assign it
// to TextStyle["fontWeight"] without casting (found in 01-02 Task 3).
export const typography = {
  display: { size: 28, weight: '700', lineHeight: 34 },   // 28 × 1.2
  heading: { size: 20, weight: '700', lineHeight: 24 },   // 20 × 1.2
  body:    { size: 16, weight: '400', lineHeight: 24 },   // 16 × 1.5
  label:   { size: 14, weight: '400', lineHeight: 20 },   // 14 × 1.4
} as const;
export const radius = { sm: 8 };
