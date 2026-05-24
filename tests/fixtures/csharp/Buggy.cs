// EXPECTED FINDINGS:
// - line 25: csharp-hardcoded-password — security — Hardcoded password literal
// - line 30: csharp-sqli-string-concat — security — SqlCommand with string concat
// - line 35: csharp-process-start-shell — security — Process.Start with variable
// - line 40: csharp-weak-crypto-md5 — security — MD5.Create() weak hash
// - line 46: csharp-deserialize-binaryformatter — security — BinaryFormatter.Deserialize
// - line 51: csharp-trust-all-cert — security — ServicePointManager callback returning true
// - line 56: csharp-html-raw-no-encode — security — Html.Raw on user input
// - line 62: csharp-empty-catch — bug — Empty catch block
// - line 68: csharp-console-writeline-prod — quality — Console.WriteLine in production

using System;
using System.Data.SqlClient;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.Serialization.Formatters.Binary;
using System.Security.Cryptography;
using System.Web;

public class Buggy
{
    public void Login()
    {
        string password = "topsecretpassword";
    }

    public SqlCommand LookupUser(string name, SqlConnection conn)
    {
        return new SqlCommand("SELECT * FROM users WHERE name = '" + name + "'", conn);
    }

    public Process RunCmd(string cmd)
    {
        return Process.Start(cmd);
    }

    public byte[] Fingerprint(byte[] data)
    {
        return MD5.Create().ComputeHash(data);
    }

    public object LoadSession(Stream blob)
    {
        var bf = new BinaryFormatter();
        return bf.Deserialize(blob);
    }

    public void DisableTls()
    {
        ServicePointManager.ServerCertificateValidationCallback = (s, c, ch, e) => true;
    }

    public string RenderRaw(string userInput)
    {
        return Html.Raw(userInput).ToString();
    }

    public void SafelyParse(string s)
    {
        try { int.Parse(s); }
        catch (Exception e) {
        }
    }

    public void DebugTrace(string message)
    {
        Console.WriteLine("trace: " + message);
    }
}
