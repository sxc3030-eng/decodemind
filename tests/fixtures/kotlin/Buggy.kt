// EXPECTED FINDINGS:
// - line 17: kotlin-hardcoded-secret — security — Hardcoded SECRET constant
// - line 20: kotlin-weak-crypto-md5 — security — MessageDigest MD5
// - line 24: kotlin-runtime-exec — security — Runtime.exec call
// - line 28: kotlin-http-cleartext — security — Cleartext HTTP URL literal
// - line 32: kotlin-webview-js-enabled — security — WebView javaScriptEnabled = true
// - line 36: kotlin-double-bang — bug — Double-bang null assertion
// - line 42: kotlin-empty-catch — bug — Empty catch block
// - line 46: kotlin-todo-fn-call — bug — TODO() call left in code
// - line 50: kotlin-println-prod — quality — println in production

import android.webkit.WebView
import java.security.MessageDigest

object Buggy {

    const val SECRET = "supersecretlivekey"

    fun fingerprint(data: ByteArray): ByteArray {
        return MessageDigest.getInstance("MD5").digest(data)
    }

    fun runCmd(cmd: String): Process {
        return Runtime.getRuntime().exec(cmd)
    }

    fun apiBase(): String {
        return "http://"
    }

    fun configureWebView(wv: WebView) {
        wv.settings.javaScriptEnabled = true
    }

    fun firstChar(value: String?): Char {
        return value!!.first()
    }

    fun safelyParse(s: String): Int {
        return try {
            s.toInt()
        } catch (e: Exception) {}
    }

    fun unfinished(): String {
        TODO("not yet implemented")
    }

    fun debugTrace(value: Any) {
        println("trace: $value")
    }
}
