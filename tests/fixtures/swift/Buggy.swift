// EXPECTED FINDINGS:
// - line 17: swift-hardcoded-api-key — security — Hardcoded apiKey literal
// - line 19: swift-weak-crypto-md5 — security — Insecure.MD5 hash
// - line 23: swift-http-cleartext-url — security — URL with cleartext http://
// - line 27: swift-print-sensitive — security — print() statement
// - line 31: swift-force-unwrap — bug — Force unwrap with !
// - line 37: swift-empty-catch — bug — Empty catch block
// - line 47: swift-fatalError-prod — logic — fatalError in production code
// - line 50: swift-todo-comment — quality — TODO comment

import CryptoKit
import Foundation

class Buggy {

    func sample() {
        let apiKey = "live-prod-secret-9999"

        _ = Insecure.MD5.hash(data: Data())
    }

    func makeUrl() -> URL? {
        return URL(string: "http://example.com/api")
    }

    func debugTrace(value: String) {
        print(value)
    }

    func firstChar(s: String?) -> Character {
        return s!.first!
    }

    func safelyParse(_ s: String) -> Int? {
        do {
            return try parseInt(s)
        } catch {
        }
        return nil
    }

    func parseInt(_ s: String) throws -> Int {
        return Int(s) ?? 0
    }

    func unreachable() -> Never {
        fatalError("not implemented")
    }

    // TODO: refactor this entire module before shipping
    func placeholder() {}
}
