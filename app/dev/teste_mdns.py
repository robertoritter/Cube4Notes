# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Confere se o computador do Cube4Notes responde pelo nome na rede local (<nome>.local, mDNS).
# Rode em outro computador da mesma rede (ou no próprio): python dev/teste_mdns.py <nome-do-computador>
import socket, struct, sys, time

name = (sys.argv[1] if len(sys.argv) > 1 else socket.gethostname()).lower()
if not name.endswith(".local"): name += ".local"

def query(qname: str) -> bytes:
    q = b"".join(bytes([len(p)]) + p.encode() for p in qname.split(".")) + b"\0"
    return struct.pack(">HHHHHH", 0x1234, 0, 1, 0, 0, 0) + q + struct.pack(">HH", 1, 1)

def answers(p: bytes):
    an = struct.unpack(">H", p[6:8])[0]
    pos, qd = 12, struct.unpack(">H", p[4:6])[0]
    def skip(pos):
        while True:
            n = p[pos]
            if n == 0: return pos + 1
            if n & 0xC0 == 0xC0: return pos + 2
            pos += 1 + n
    for _ in range(qd): pos = skip(pos) + 4
    out = []
    for _ in range(an):
        pos = skip(pos); t, c, ttl, ln = struct.unpack(">HHIH", p[pos:pos + 10]); pos += 10
        if t == 1 and ln == 4: out.append(socket.inet_ntoa(p[pos:pos + 4]))
        pos += ln
    return out

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3)
s.sendto(query(name), ("224.0.0.251", 5353))
t0 = time.time(); found = []
try:
    while time.time() - t0 < 3:
        data, src = s.recvfrom(9000)
        found += [f"{ip} (respondido por {src[0]})" for ip in answers(data)]
except socket.timeout:
    pass
print(f"mDNS {name}: " + (", ".join(found) if found else "ninguém respondeu"))
try: print(f"sistema resolve {name}: {socket.gethostbyname(name)}")
except OSError as e: print(f"sistema não resolve {name}: {e}")
