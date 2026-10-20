/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Conjunto de ícones (Lucide) usados na interface do Cube4Notes.
 */
import { createElement, Search, FilePlus, FolderPlus, Folder, FolderOpen, FileText, ChevronRight, Settings, PanelLeft, PanelRight, X, Cloud, CloudOff, RefreshCw, TriangleAlert, Pencil, Trash2, Code, Eye, ListTree, Link, Menu, Ellipsis, Plus, GitCompare, Check, Command, Hash, Library, ChevronsUpDown, ArrowUp, Smartphone, ShieldCheck, Server, HardDrive } from 'lucide';

const set = { Search, FilePlus, FolderPlus, Folder, FolderOpen, FileText, ChevronRight, Settings, PanelLeft, PanelRight, X, Cloud, CloudOff, RefreshCw, TriangleAlert, Pencil, Trash2, Code, Eye, ListTree, Link, Menu, Ellipsis, Plus, GitCompare, Check, Command, Hash, Library, ChevronsUpDown, ArrowUp, Smartphone, ShieldCheck, Server, HardDrive };
export type IconName = keyof typeof set;
export function ic(name: IconName, size = 16): SVGElement {
  const el = createElement(set[name] as any) as SVGElement;
  el.setAttribute('width', String(size)); el.setAttribute('height', String(size));
  el.setAttribute('stroke-width', '1.75'); el.setAttribute('aria-hidden', 'true');
  el.classList.add('ic');
  return el;
}
