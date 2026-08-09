// Design tokens — single source of truth (01-UI-SPEC.md Implementation Contract).
// No style values outside this file.
export const colors = {
  background: '#FAFAFA', surface: '#FFFFFF', textPrimary: '#1E293B',
  textSecondary: '#94A3B8', border: '#F1F5F9', income: '#16A34A',
  expense: '#DC2626', accent: '#EF6D40', danger: '#DC2626', onAccent: '#FFFFFF',
  primary: '#EF6D40', primaryDark: '#DB281C', teal: '#45C0CF', yellow: '#F8C519',
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
export const radius = { sm: 8, md: 16, lg: 24, icon: 14 };
export const shadow = {
  card: {
    shadowColor: '#EF6D40',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  surface: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
