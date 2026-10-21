/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Responde pelo nome do Cube4Notes na rede local (<computador>-notes.local), pelo protocolo mDNS (o mesmo usado por
 * impressoras e AirPlay), para os aparelhos acharem o Cube4Notes mesmo quando o roteador troca o IP.
 * Não depende do sistema: o Windows nem sempre responde por esse nome. Só responde perguntas do próprio
 * nome, só com endereços da rede local, e nunca sai da rede de casa (mDNS não atravessa roteadores).
 */
using System.Net;
using System.Net.Sockets;
using System.Text;

sealed class Mdns : IDisposable
{
    private static readonly IPAddress Group = IPAddress.Parse("224.0.0.251");
    private const int Port = 5353;
    private readonly string name;          // ex.: "meu-pc-notes.local"
    private readonly byte[] encodedName;
    private readonly CancellationTokenSource stop = new();
    private Socket? socket;

    public Mdns(string netName)
    {
        name = netName;
        encodedName = Encode(name);
    }

    public string Name => name;

    // Começa a responder; devolve false se a porta 5353 não pôde ser usada (o sistema talvez já responda pelo nome).
    public bool Start()
    {
        try
        {
            var s = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);
            if (OperatingSystem.IsWindows()) s.ExclusiveAddressUse = false; // divide a porta com outros (Chrome, serviço do Windows)
            s.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            s.Bind(new IPEndPoint(IPAddress.Any, Port));
            s.SetSocketOption(SocketOptionLevel.IP, SocketOptionName.MulticastTimeToLive, 255);
            s.SetSocketOption(SocketOptionLevel.IP, SocketOptionName.MulticastLoopback, true);
            Join(s);
            socket = s;
            _ = Task.Run(Loop);
            Announce();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine(Idioma.T($"  Nome na rede ({name}) não ativado: {ex.Message}", $"  Network name ({name}) not enabled: {ex.Message}"));
            return false;
        }
    }

    // Entra no grupo mDNS em cada placa da rede local (Wi-Fi e cabo).
    private static void Join(Socket s)
    {
        var joined = false;
        foreach (var a in Lan.Addresses())
        {
            try { s.SetSocketOption(SocketOptionLevel.IP, SocketOptionName.AddMembership, new MulticastOption(Group, a.Address)); joined = true; }
            catch (SocketException) { }
        }
        if (!joined) s.SetSocketOption(SocketOptionLevel.IP, SocketOptionName.AddMembership, new MulticastOption(Group));
    }

    // A rede mudou (IP novo, outra placa): entra de novo no grupo e anuncia o endereço atual.
    public void Refresh()
    {
        if (socket is null) return;
        try { Join(socket); } catch (Exception) { }
        Announce();
    }

    public void Dispose()
    {
        stop.Cancel();
        try { socket?.Dispose(); } catch (Exception) { }
    }

    private async Task Loop()
    {
        var buffer = new byte[9000];
        while (!stop.IsCancellationRequested && socket is not null)
        {
            SocketReceiveFromResult r;
            try { r = await socket.ReceiveFromAsync(buffer, SocketFlags.None, new IPEndPoint(IPAddress.Any, 0), stop.Token); }
            catch (OperationCanceledException) { return; }
            catch (ObjectDisposedException) { return; }
            catch (SocketException) { continue; }
            try { Handle(buffer.AsSpan(0, r.ReceivedBytes).ToArray(), (IPEndPoint)r.RemoteEndPoint); }
            catch (Exception) { /* pacote estranho: ignora */ }
        }
    }

    private void Handle(byte[] p, IPEndPoint from)
    {
        if (p.Length < 12) return;
        var remote = Lan.Normalize(from.Address);
        if (!Lan.IsLocalClient(remote)) return;                // só a rede de casa
        var flags = (p[2] << 8) | p[3];
        if ((flags & 0x8000) != 0) return;                   // é resposta, não pergunta
        var qd = (p[4] << 8) | p[5];
        var pos = 12;
        var wanted = false;
        var unicast = false;
        var qtype = 1;
        for (var i = 0; i < qd && pos < p.Length; i++)
        {
            var qname = ReadName(p, ref pos);
            if (pos + 4 > p.Length) return;
            var type = (p[pos] << 8) | p[pos + 1];
            var qclass = (p[pos + 2] << 8) | p[pos + 3];
            pos += 4;
            if (qname is not null && string.Equals(qname, name, StringComparison.OrdinalIgnoreCase) && (type is 1 or 255))
            {
                wanted = true;
                unicast |= (qclass & 0x8000) != 0;
                qtype = type;
            }
        }
        if (!wanted) return;
        var addresses = AddressesFor(remote);
        if (addresses.Count == 0) return;
        // Pergunta "comum" de DNS (porta diferente de 5353): responde só para quem perguntou, com o mesmo id e a pergunta.
        var legacy = from.Port != Port;
        // a pergunta é reescrita por inteiro (copiar os bytes levaria ponteiros de compressão inválidos)
        byte[]? question = legacy ? encodedName.Concat(new byte[] { (byte)(qtype >> 8), (byte)qtype, 0, 1 }).ToArray() : null;
        var reply = Build(addresses, legacy ? (ushort)((p[0] << 8) | p[1]) : (ushort)0, question, legacy ? 10u : 120u);
        var target = legacy || unicast ? from : new IPEndPoint(Group, Port);
        socket?.SendTo(reply, target);
    }

    // Endereços da mesma sub-rede de quem perguntou; senão, os das placas principais.
    private static List<IPAddress> AddressesFor(IPAddress remote)
    {
        var same = Lan.SameSubnet(remote).ToList();
        return same.Count > 0 ? same : Lan.Addresses().Where(a => a.Primary).Select(a => a.Address).ToList();
    }

    private void Announce()
    {
        var addresses = Lan.Addresses().Where(a => a.Primary).Select(a => a.Address).ToList();
        if (addresses.Count == 0 || socket is null) return;
        var packet = Build(addresses, 0, null, 120);
        _ = Task.Run(async () =>
        {
            for (var i = 0; i < 2; i++)
            {
                try { socket?.SendTo(packet, new IPEndPoint(Group, Port)); } catch (Exception) { }
                await Task.Delay(1000);
            }
        });
    }

    private byte[] Build(List<IPAddress> addresses, ushort id, byte[]? question, uint ttl)
    {
        var o = new List<byte>(64);
        void U16(int v) { o.Add((byte)(v >> 8)); o.Add((byte)v); }
        U16(id);
        U16(0x8400);                                         // resposta com autoridade
        U16(question is null ? 0 : 1);
        U16(addresses.Count);
        U16(0); U16(0);
        if (question is not null) o.AddRange(question);
        foreach (var a in addresses)
        {
            o.AddRange(encodedName);
            U16(1);                                          // A (IPv4)
            U16(question is null ? 0x8001 : 0x0001);         // IN, com "cache flush" no mDNS
            U16((int)(ttl >> 16)); U16((int)(ttl & 0xFFFF));
            U16(4);
            o.AddRange(a.GetAddressBytes());
        }
        return o.ToArray();
    }

    private static byte[] Encode(string dnsName)
    {
        var o = new List<byte>();
        foreach (var label in dnsName.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            var b = Encoding.ASCII.GetBytes(label);
            o.Add((byte)b.Length);
            o.AddRange(b);
        }
        o.Add(0);
        return o.ToArray();
    }

    // Lê um nome DNS (com ponteiros de compressão); null se o pacote estiver malformado.
    private static string? ReadName(byte[] p, ref int pos)
    {
        var labels = new List<string>();
        var jumped = false;
        var end = pos;
        for (var hops = 0; hops < 20; hops++)
        {
            if (pos >= p.Length) return null;
            var len = p[pos];
            if (len == 0) { if (!jumped) end = pos + 1; pos = end; return string.Join('.', labels); }
            if ((len & 0xC0) == 0xC0)
            {
                if (pos + 1 >= p.Length) return null;
                if (!jumped) end = pos + 2;
                jumped = true;
                pos = ((len & 0x3F) << 8) | p[pos + 1];
                continue;
            }
            if (pos + 1 + len > p.Length) return null;
            labels.Add(Encoding.ASCII.GetString(p, pos + 1, len));
            pos += 1 + len;
        }
        return null;
    }
}
