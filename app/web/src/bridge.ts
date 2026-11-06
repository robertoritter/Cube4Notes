/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Conversa com a janela do Cube4Notes no modo cliente (mensagens do Photino em window.external):
 * descobre se esta janela abre o servidor de outro computador, troca o endereço e volta a ser servidor.
 * Em navegador, celular ou na janela de um servidor, nada responde e tudo fica desligado.
 */
type External = { sendMessage?: (m: string) => void; receiveMessage?: (cb: (m: string) => void) => void };
const ext = (window as any).external as External | undefined;
const ok = !!ext && typeof ext.sendMessage === 'function' && typeof ext.receiveMessage === 'function';
const waiting = new Map<string, (d: any) => void>();
if (ok) {
  try {
    ext!.receiveMessage!((m: string) => {
      let d: any;
      try { d = JSON.parse(m); } catch { return; }
      const w = waiting.get(d?.type);
      if (w) w(d);
    });
  } catch {}
}

function ask(message: string, replies: string[], timeout: number): Promise<any | null> {
  return new Promise(resolve => {
    const done = (d: any) => { clearTimeout(timer); replies.forEach(r => waiting.delete(r)); resolve(d); };
    const timer = setTimeout(() => done(null), timeout);
    replies.forEach(r => waiting.set(r, done));
    try { ext!.sendMessage!(message); } catch { done(null); }
  });
}

export interface ClientInfo { server: string }

// Esta janela é do modo cliente? Devolve o endereço do servidor (null em qualquer outro caso).
export async function clientInfo(): Promise<ClientInfo | null> {
  if (!ok) return null;
  const d = await ask('client:info', ['client-info'], 1500);
  return d?.server ? { server: d.server } : null;
}

// Troca o servidor. Sucesso fecha a janela (o Cube4Notes abre outra); erro volta como código.
export async function setServer(address: string): Promise<string | null> {
  if (!ok) return 'no-window';
  const d = await ask('client:set\n' + address, ['client-error'], 130000);
  return d?.error ?? null;
}

// Volta a ser servidor: a janela fecha e o Cube4Notes abre com os vaults deste computador.
export function useServer() { if (ok) try { ext!.sendMessage!('client:server'); } catch {} }
