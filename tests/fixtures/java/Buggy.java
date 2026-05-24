// EXPECTED FINDINGS:
// - line 19: java-hardcoded-password — security — Hardcoded password literal
// - line 22: java-sqli-statement-concat — security — Statement.executeQuery with concat
// - line 26: java-runtime-exec-user-input — security — Runtime.exec with variable
// - line 30: java-xxe-documentbuilder — security — DocumentBuilderFactory unsafe
// - line 34: java-weak-crypto-md5 — security — MessageDigest MD5
// - line 39: java-deserialization-readobject — security — ObjectInputStream.readObject
// - line 43: java-resource-not-closed — bug — FileInputStream not in try-with-resources
// - line 51: java-empty-catch — logic — Empty catch block
// - line 56: java-system-out-println-prod — quality — System.out.println

import java.io.*;
import java.sql.*;
import javax.xml.parsers.*;
import java.security.MessageDigest;

public class Buggy {

    public static final String password = "topsecretpassword";

    public static ResultSet lookupUser(Statement stmt, String name) throws SQLException {
        return stmt.executeQuery("SELECT * FROM users WHERE name = '" + name + "'");
    }

    public static Process runCmd(String cmd) throws IOException {
        return Runtime.getRuntime().exec(cmd);
    }

    public static DocumentBuilderFactory newDocFactory() {
        return DocumentBuilderFactory.newInstance();
    }

    public static byte[] fingerprint(byte[] data) throws Exception {
        return MessageDigest.getInstance("MD5").digest(data);
    }

    public static Object loadSession(byte[] blob) throws Exception {
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(blob));
        return ois.readObject();
    }

    public static String readFile(String path) throws IOException {
        FileInputStream fis = new FileInputStream(path);
        byte[] buf = fis.readAllBytes();
        return new String(buf);
    }

    public static void safelyParse(String s) {
        try {
            Integer.parseInt(s);
        } catch (NumberFormatException e) {
        }
    }

    public static void debugTrace(String message) {
        System.out.println("trace: " + message);
    }
}
