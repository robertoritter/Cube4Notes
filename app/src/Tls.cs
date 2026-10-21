/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * HTTPS local do Cube4Notes: autoridade certificadora própria, restrita a nomes e IPs locais,
 * certificado do servidor guardado entre uma abertura e outra (refeito só quando o IP muda ou perto de vencer)
 * e confiança automática no Windows.
 */
using System.Formats.Asn1;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

// Autoridade certificadora própria, criada uma vez neste computador e restrita a nomes e IPs locais
// (mesmo que a chave vaze, ela não serve para se passar por sites da internet).
static class Tls
{
    public const string CertPath = "/cube4notes-ca.cer";
    private static readonly object Sync = new();
    private static X509Certificate2? ca;
    private static X509Certificate2? leaf;
    private static string leafKey = "";
    private static string dir = "";
    private static DateTime checkedAt = DateTime.MinValue;

    public static byte[] CaDer => ca!.Export(X509ContentType.Cert);

    // Nome do computador em forma DNS (só ASCII). Com acento, usa a forma IDN que a rede usa de fato (xn--...);
    // se isso falhar, tira os acentos (João-PC -> joao-pc). Nome inválido mesmo assim fica de fora (IPs continuam valendo).
    public static string Machine { get; } = DnsName(Environment.MachineName);

    private static string DnsName(string raw)
    {
        var m = raw.Trim().ToLowerInvariant();
        string ascii;
        try { ascii = new System.Globalization.IdnMapping().GetAscii(m); }
        catch (Exception)
        {
            var noMarks = new string(m.Normalize(NormalizationForm.FormD).Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
            ascii = new string(noMarks.Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        }
        return ascii.Length is > 0 and <= 63 && ascii.All(c => char.IsAsciiLetterOrDigit(c) || c == '-') ? ascii : "";
    }
    public static string CaThumbprint => ca!.Thumbprint;

    // Nome do Cube4Notes na rede de casa: <computador>-notes.local. É um nome só dele (o sistema responde por
    // <computador>.local, às vezes com o endereço de uma VPN ou placa virtual, o que confundiria os aparelhos).
    public static string NetName => Machine.Length is > 0 and <= 57 ? Machine + "-notes.local" : "";

    public static void Init(string folder)
    {
        dir = folder;
        Directory.CreateDirectory(dir);
        var pfx = Path.Combine(dir, "cube4notes-ca.pfx");
        if (File.Exists(pfx))
        {
            ca = X509CertificateLoader.LoadPkcs12FromFile(pfx, null, X509KeyStorageFlags.Exportable);
            if (ca.NotAfter > DateTime.Now.AddDays(30) && ca.HasPrivateKey) { File.WriteAllBytes(Path.Combine(dir, "cube4notes-ca.cer"), CaDer); return; }
        }
        using var key = RSA.Create(3072);
        var req = new CertificateRequest($"CN=Cube4Notes CA ({Environment.MachineName}), O=Cube4Notes", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        req.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, true, 0, true));
        req.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, true));
        req.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(req.PublicKey, false));
        req.CertificateExtensions.Add(NameConstraints());
        using var created = req.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(10));
        var bytes = created.Export(X509ContentType.Pfx);
        File.WriteAllBytes(pfx, bytes);
        ca = X509CertificateLoader.LoadPkcs12(bytes, null, X509KeyStorageFlags.Exportable);
        File.WriteAllBytes(Path.Combine(dir, "cube4notes-ca.cer"), CaDer);
        Console.WriteLine($"  Certificado do Cube4Notes criado em {dir}");
    }

    // Só vale para localhost, *.local, o nome deste computador e IPs privados (10/8, 172.16/12, 192.168/16, 127/8).
    private static X509Extension NameConstraints()
    {
        var w = new AsnWriter(AsnEncodingRules.DER);
        w.PushSequence();
        var permitted = new Asn1Tag(TagClass.ContextSpecific, 0, true);
        w.PushSequence(permitted);
        foreach (var dns in new[] { "localhost", "local", Machine }.Where(x => x.Length > 0))
        {
            w.PushSequence();
            w.WriteCharacterString(UniversalTagNumber.IA5String, dns, new Asn1Tag(TagClass.ContextSpecific, 2));
            w.PopSequence();
        }
        byte[][] ranges =
        [
            [10, 0, 0, 0, 255, 0, 0, 0],
            [172, 16, 0, 0, 255, 240, 0, 0],
            [192, 168, 0, 0, 255, 255, 0, 0],
            [127, 0, 0, 0, 255, 0, 0, 0],
        ];
        foreach (var r in ranges)
        {
            w.PushSequence();
            w.WriteOctetString(r, new Asn1Tag(TagClass.ContextSpecific, 7));
            w.PopSequence();
        }
        w.PopSequence(permitted);
        w.PopSequence();
        return new X509Extension("2.5.29.30", w.Encode(), true);
    }

    // Certificado do servidor para os endereços atuais; refeito sozinho quando o IP muda (DHCP).
    public static X509Certificate2 Current()
    {
        lock (Sync)
        {
            if (leaf is not null && DateTime.UtcNow - checkedAt < TimeSpan.FromSeconds(15)) return leaf;
            checkedAt = DateTime.UtcNow;
            var ips = Lan.Addresses().Select(a => a.Address).ToList();
            var key = string.Join(',', ips) + "|" + NetName; // certificado novo quando o IP ou o nome mudam
            if (leaf is null) (leaf, leafKey) = LoadSaved();
            if (leaf is not null && key == leafKey && leaf.NotAfter > DateTime.Now.AddDays(14)) return leaf;
            var pfx = Issue(ips);
            leaf = X509CertificateLoader.LoadPkcs12(pfx, null);
            leafKey = key;
            Save(pfx, key);
            return leaf;
        }
    }

    // O mesmo certificado volta depois de fechar e abrir o Cube4Notes: os aparelhos não veem um certificado novo a cada início.
    private static (X509Certificate2?, string) LoadSaved()
    {
        try
        {
            var pfx = Path.Combine(dir, "servidor.pfx");
            var ips = Path.Combine(dir, "servidor-enderecos.txt");
            if (!File.Exists(pfx) || !File.Exists(ips)) return (null, "");
            var cert = X509CertificateLoader.LoadPkcs12FromFile(pfx, null);
            // só vale se foi emitido pela autoridade atual (mesmo identificador de chave da autoridade)
            var expected = X509AuthorityKeyIdentifierExtension.CreateFromCertificate(ca!, true, false).RawData;
            var aki = cert.Extensions.Cast<X509Extension>().FirstOrDefault(e => e.Oid?.Value == "2.5.29.35")?.RawData;
            if (!cert.HasPrivateKey || aki is null || !aki.AsSpan().SequenceEqual(expected)) return (null, "");
            return (cert, File.ReadAllText(ips).Trim());
        }
        catch (Exception) { return (null, ""); }
    }

    private static void Save(byte[] pfx, string key)
    {
        try
        {
            File.WriteAllBytes(Path.Combine(dir, "servidor.pfx"), pfx);
            File.WriteAllText(Path.Combine(dir, "servidor-enderecos.txt"), key);
        }
        catch (Exception ex) { Console.WriteLine($"  Certificado do servidor não foi guardado ({ex.Message})."); }
    }

    // Devolve o certificado com a chave em PFX (recarregar de PFX evita o erro de chave efêmera do Windows/SChannel).
    private static byte[] Issue(List<IPAddress> ips)
    {
        using var key = RSA.Create(2048);
        var req = new CertificateRequest("CN=Cube4Notes", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder();
        san.AddDnsName("localhost");
        if (Machine.Length > 0) { san.AddDnsName(Machine); san.AddDnsName(Machine + ".local"); }
        if (NetName.Length > 0) san.AddDnsName(NetName);
        san.AddIpAddress(IPAddress.Loopback);
        foreach (var ip in ips) san.AddIpAddress(ip);
        req.CertificateExtensions.Add(san.Build());
        req.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        req.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        req.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));
        req.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(req.PublicKey, false));
        req.CertificateExtensions.Add(X509AuthorityKeyIdentifierExtension.CreateFromCertificate(ca!, true, false));
        var serial = RandomNumberGenerator.GetBytes(16);
        serial[0] &= 0x7F;
        // 397 dias: limite aceito pelo iPhone/iPad para certificados de servidor
        var notAfter = DateTimeOffset.UtcNow.AddDays(397);
        if (notAfter > ca!.NotAfter) notAfter = ca.NotAfter.AddDays(-1);
        using var signed = req.Create(ca!, DateTimeOffset.UtcNow.AddDays(-1), notAfter, serial);
        using var withKey = signed.CopyWithPrivateKey(key);
        return withKey.Export(X509ContentType.Pfx);
    }

    // No Windows, adiciona o certificado às autoridades confiáveis do usuário atual (o Windows pede confirmação uma vez).
    public static void TrustOnWindows()
    {
        try
        {
            using var store = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
            store.Open(OpenFlags.ReadWrite);
            if (store.Certificates.Find(X509FindType.FindByThumbprint, ca!.Thumbprint, false).Count > 0) return;
            Console.WriteLine("  O Windows vai pedir confirmação para confiar no certificado do Cube4Notes neste computador.");
            Console.WriteLine("  Ele só vale para endereços locais (localhost e rede de casa). Clique em Sim.");
            using var publicOnly = X509CertificateLoader.LoadCertificate(CaDer);
            store.Add(publicOnly);
            Console.WriteLine("  Certificado instalado neste computador.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  Certificado não instalado no Windows ({ex.Message}). O navegador vai mostrar um aviso; dá para continuar mesmo assim.");
        }
    }
}
