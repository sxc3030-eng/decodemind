// EXPECTED FINDINGS:
// - line 17: dart-hardcoded-api-key — security — Hardcoded apiKey constant
// - line 19: dart-weak-random — security — Random() not cryptographically secure
// - line 22: dart-http-cleartext-url — security — Cleartext HTTP URL string literal
// - line 26: dart-runtime-process-run — security — Process.run with variable command
// - line 30: dart-shared-prefs-secret — security — SharedPreferences token storage
// - line 34: dart-print-sensitive — security — print() statement
// - line 38: dart-null-assertion — bug — Null-assertion operator !
// - line 44: dart-empty-catch — bug — Empty catch block
// - line 48: dart-late-without-init — bug — late variable without initializer
// - line 50: dart-todo-comment — quality — TODO comment

import 'dart:io';
import 'dart:math';

class Buggy {
  static const apiKey = "live-prod-secret-9999";

  int randomDigit() => Random().nextInt(10);

  String apiUrl() {
    return "http://api.example.com/v1/data";
  }

  Future<ProcessResult> runCmd(String cmd, List<String> args) {
    return Process.run(cmd, args);
  }

  void persistToken(dynamic prefs, String value) {
    prefs.setString("token", value);
  }

  void debugTrace(String value) {
    print("trace: " + value);
  }

  String firstChar(String? s) {
    return s!.substring(0, 1);
  }

  int safelyParse(String s) {
    try {
      return int.parse(s);
    } catch (e) {}
    return 0;
  }

  late String userId;

  // TODO: implement caching layer before release
  void placeholder() {}
}
