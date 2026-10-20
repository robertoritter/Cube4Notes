/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Aplica os temas de terminal à interface usando o Cube4Themes (paletas e cálculo das cores de
 * títulos, subtítulos, marcadores, negrito, itálico, código e links, com contraste mínimo garantido).
 * Aqui só se faz a ligação entre os papéis do Cube4Themes e as variáveis CSS do Cube4Notes.
 */
import { themes, findTheme, roles, swatches, type Theme } from 'cube4themes';

export const termThemes = themes;
export { findTheme, swatches };
export type TermTheme = Theme;

const VARS = ['--bg', '--side', '--ink', '--ink-2', '--muted', '--line', '--line-2', '--hover', '--sel', '--accent', '--accent-2', '--on-accent', '--accent-soft',
  '--warn', '--warn-soft', '--danger', '--add', '--add-ink', '--del', '--del-ink',
  '--md-h1', '--md-h2', '--md-h3', '--md-h4', '--md-bullet', '--md-bold', '--md-italic', '--md-code', '--md-code-bg', '--md-link', '--md-quote'];

export function applyTermTheme(t: Theme | undefined) {
  const s = document.documentElement.style;
  for (const v of VARS) s.removeProperty(v);
  if (!t) { delete document.documentElement.dataset.term; return; }
  const { ui, text } = roles(t);
  const set: Record<string, string> = {
    '--bg': ui.bg, '--side': ui.surface, '--ink': ui.text, '--ink-2': ui.text2, '--muted': ui.muted,
    '--line': ui.line, '--line-2': ui.line2, '--hover': ui.hover, '--sel': ui.selection,
    '--accent': ui.accent, '--accent-2': ui.accent2, '--on-accent': ui.onAccent, '--accent-soft': ui.accentSoft,
    '--warn': ui.warn, '--warn-soft': ui.warnSoft, '--danger': ui.danger,
    '--add': ui.addBg, '--add-ink': ui.addText, '--del': ui.delBg, '--del-ink': ui.delText,
    '--md-h1': text.h1, '--md-h2': text.h2, '--md-h3': text.h3, '--md-h4': text.h4,
    '--md-bullet': text.bullet, '--md-bold': text.bold, '--md-italic': text.italic,
    '--md-code': text.code, '--md-code-bg': text.codeBg, '--md-link': text.link, '--md-quote': text.quote,
  };
  for (const [k, v] of Object.entries(set)) s.setProperty(k, v);
  document.documentElement.dataset.term = t.id;
}
