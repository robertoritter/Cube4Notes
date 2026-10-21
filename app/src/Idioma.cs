/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Língua das mensagens do próprio programa (ícone ao lado do relógio, avisos do Windows, console e nomes de
 * cópias de conflito): português se o sistema estiver em português, senão inglês. A interface web tem a
 * própria escolha de língua, em Preferências.
 */
using System.Globalization;

static class Idioma
{
    public static readonly bool Pt = Detect();

    private static bool Detect()
    {
        var forced = Environment.GetEnvironmentVariable("CUBE4NOTES_LANG");
        if (!string.IsNullOrWhiteSpace(forced)) return forced.Trim().StartsWith("pt", StringComparison.OrdinalIgnoreCase);
        return CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "pt";
    }

    public static string T(string pt, string en) => Pt ? pt : en;
}
