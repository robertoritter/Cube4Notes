/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Aplica os temas de terminal à interface: converte a paleta ANSI em cores de títulos, subtítulos,
 * marcadores, negrito, itálico, código e links, garantindo contraste mínimo de leitura.
 */
import { termThemes, type TermTheme } from './themes';

export { termThemes };
type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t) as RGB); };
const lum = (h: string) => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Aproxima a cor do texto principal até atingir o contraste mínimo (WCAG) sobre o fundo.
function legible(c: string, bg: string, fg: string, min = 3): string {
  for (let t = 0; t <= 1.001; t += 0.1) { const m = mix(c, fg, t); if (contrast(m, bg) >= min) return m; }
  return fg;
}

const VARS = ['--bg', '--side', '--ink', '--ink-2', '--muted', '--line', '--line-2', '--hover', '--sel', '--accent', '--accent-2', '--on-accent', '--accent-soft',
  '--warn', '--warn-soft', '--danger', '--add', '--add-ink', '--del', '--del-ink',
  '--md-h1', '--md-h2', '--md-h3', '--md-h4', '--md-bullet', '--md-bold', '--md-italic', '--md-code', '--md-code-bg', '--md-link', '--md-quote'];

export function findTheme(id: string): TermTheme | undefined { return termThemes.find(t => t.id === id); }

export function applyTermTheme(t: TermTheme | undefined) {
  const s = document.documentElement.style;
  for (const v of VARS) s.removeProperty(v);
  if (!t) { delete document.documentElement.dataset.term; return; }
  const { bg, fg, p } = t;
  const L = (c: string, m = 3) => legible(c, bg, fg, m);
  const accent = L(p[4], 3.2);
  const set: Record<string, string> = {
    '--bg': bg, '--side': mix(bg, fg, 0.045), '--ink': fg, '--ink-2': mix(fg, bg, 0.18), '--muted': L(mix(fg, bg, 0.45), 3.5),
    '--line': mix(bg, fg, 0.12), '--line-2': mix(bg, fg, 0.2), '--hover': mix(bg, fg, 0.08), '--sel': t.sel ?? mix(bg, p[4], 0.35),
    '--accent': accent, '--accent-2': L(p[12], 3.2), '--on-accent': contrast(bg, accent) >= contrast(fg, accent) ? bg : fg, '--accent-soft': mix(bg, accent, 0.18),
    '--warn': L(p[3]), '--warn-soft': mix(bg, p[3], 0.14), '--danger': L(p[1], 3.5),
    '--add': mix(bg, p[2], 0.18), '--add-ink': L(p[2], 4.5), '--del': mix(bg, p[1], 0.18), '--del-ink': L(p[1], 4.5),
    // texto da nota
    '--md-h1': L(p[5]), '--md-h2': L(p[4]), '--md-h3': L(p[6]), '--md-h4': L(p[2]),
    '--md-bullet': L(p[3]), '--md-bold': L(p[1], 3.5), '--md-italic': L(p[14], 3.5),
    '--md-code': L(p[2], 4), '--md-code-bg': mix(bg, p[2], 0.1), '--md-link': L(p[12], 3.5), '--md-quote': L(p[5]),
  };
  for (const [k, v] of Object.entries(set)) s.setProperty(k, v);
  document.documentElement.dataset.term = t.id;
}

export function swatches(t: TermTheme) { return [t.bg, t.fg, t.p[1], t.p[2], t.p[3], t.p[4], t.p[5], t.p[6]]; }
