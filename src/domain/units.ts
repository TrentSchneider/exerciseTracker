export const KG_PER_LB = 0.45359237;

export type Units = 'lb' | 'kg';

export function kgToDisplay(kg: number, units: Units): number {
  const v = units === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(v * 10) / 10;
}

export function displayToKg(v: number, units: Units): number {
  return units === 'lb' ? v * KG_PER_LB : v;
}

export function formatWeight(kg: number, units: Units): string {
  return `${kgToDisplay(kg, units)} ${units}`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
