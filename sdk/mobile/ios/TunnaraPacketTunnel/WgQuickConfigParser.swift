import Foundation
import WireGuardKit

enum WgQuickConfigParser {
    enum ParseError: LocalizedError {
        case invalidLine(Int, String)
        case duplicateInterface
        case missingInterface
        case missingValue(String)
        case duplicateKey(String)
        case unsupportedKey(String)
        case invalidValue(String, String)
        case duplicatePeer

        var errorDescription: String? {
            switch self {
            case let .invalidLine(line, value): return "Linha wg-quick inválida em \(line): \(value)"
            case .duplicateInterface: return "A configuração possui mais de uma seção [Interface]."
            case .missingInterface: return "A seção [Interface] é obrigatória."
            case let .missingValue(key): return "O campo obrigatório \(key) não foi informado."
            case let .duplicateKey(key): return "O campo \(key) foi informado mais de uma vez."
            case let .unsupportedKey(key): return "O campo wg-quick \(key) não é suportado."
            case let .invalidValue(key, value): return "Valor inválido em \(key): \(value)"
            case .duplicatePeer: return "Dois peers utilizam a mesma chave pública."
            }
        }
    }

    private enum Section { case none, interface, peer }
    private static let multiValueKeys: Set<String> = ["address", "dns", "allowedips"]
    private static let interfaceKeys: Set<String> = ["privatekey", "listenport", "address", "dns", "mtu"]
    private static let peerKeys: Set<String> = ["publickey", "presharedkey", "allowedips", "endpoint", "persistentkeepalive"]

    static func parse(_ text: String, name: String? = nil) throws -> TunnelConfiguration {
        var section = Section.none
        var attributes: [String: String] = [:]
        var interface: InterfaceConfiguration?
        var peers: [PeerConfiguration] = []

        func flush() throws {
            switch section {
            case .none:
                break
            case .interface:
                guard interface == nil else { throw ParseError.duplicateInterface }
                interface = try makeInterface(attributes)
            case .peer:
                peers.append(try makePeer(attributes))
            }
            attributes.removeAll(keepingCapacity: true)
        }

        for (offset, sourceLine) in text.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline).enumerated() {
            let content = sourceLine.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false).first ?? ""
            let line = content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }

            switch line.lowercased() {
            case "[interface]":
                try flush()
                section = .interface
                continue
            case "[peer]":
                try flush()
                section = .peer
                continue
            default:
                break
            }

            guard section != .none, let separator = line.firstIndex(of: "=") else {
                throw ParseError.invalidLine(offset + 1, line)
            }
            let originalKey = line[..<separator].trimmingCharacters(in: .whitespacesAndNewlines)
            let key = originalKey.lowercased()
            let value = line[line.index(after: separator)...].trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { throw ParseError.invalidValue(originalKey, value) }

            let allowed = section == .interface ? interfaceKeys : peerKeys
            guard allowed.contains(key) else { throw ParseError.unsupportedKey(originalKey) }
            if let existing = attributes[key] {
                guard multiValueKeys.contains(key) else { throw ParseError.duplicateKey(originalKey) }
                attributes[key] = existing + "," + value
            } else {
                attributes[key] = value
            }
        }
        try flush()

        guard let interface else { throw ParseError.missingInterface }
        let publicKeys = peers.map(\.publicKey)
        guard Set(publicKeys).count == publicKeys.count else { throw ParseError.duplicatePeer }
        return TunnelConfiguration(name: name, interface: interface, peers: peers)
    }

    private static func makeInterface(_ values: [String: String]) throws -> InterfaceConfiguration {
        guard let rawPrivateKey = values["privatekey"] else { throw ParseError.missingValue("PrivateKey") }
        guard let privateKey = PrivateKey(base64Key: rawPrivateKey) else { throw ParseError.invalidValue("PrivateKey", rawPrivateKey) }
        var configuration = InterfaceConfiguration(privateKey: privateKey)

        if let raw = values["listenport"] {
            guard let value = UInt16(raw) else { throw ParseError.invalidValue("ListenPort", raw) }
            configuration.listenPort = value
        }
        if let raw = values["address"] {
            configuration.addresses = try commaSeparated(raw).map {
                guard let value = IPAddressRange(from: $0) else { throw ParseError.invalidValue("Address", $0) }
                return value
            }
        }
        if let raw = values["dns"] {
            var servers: [DNSServer] = []
            var searches: [String] = []
            for item in commaSeparated(raw) {
                if let server = DNSServer(from: item) { servers.append(server) } else { searches.append(item) }
            }
            configuration.dns = servers
            configuration.dnsSearch = searches
        }
        if let raw = values["mtu"] {
            guard let value = UInt16(raw) else { throw ParseError.invalidValue("MTU", raw) }
            configuration.mtu = value
        }
        return configuration
    }

    private static func makePeer(_ values: [String: String]) throws -> PeerConfiguration {
        guard let rawPublicKey = values["publickey"] else { throw ParseError.missingValue("PublicKey") }
        guard let publicKey = PublicKey(base64Key: rawPublicKey) else { throw ParseError.invalidValue("PublicKey", rawPublicKey) }
        var configuration = PeerConfiguration(publicKey: publicKey)

        if let raw = values["presharedkey"] {
            guard let value = PreSharedKey(base64Key: raw) else { throw ParseError.invalidValue("PresharedKey", raw) }
            configuration.preSharedKey = value
        }
        if let raw = values["allowedips"] {
            configuration.allowedIPs = try commaSeparated(raw).map {
                guard let value = IPAddressRange(from: $0) else { throw ParseError.invalidValue("AllowedIPs", $0) }
                return value
            }
        }
        if let raw = values["endpoint"] {
            guard let value = Endpoint(from: raw) else { throw ParseError.invalidValue("Endpoint", raw) }
            configuration.endpoint = value
        }
        if let raw = values["persistentkeepalive"] {
            guard let value = UInt16(raw) else { throw ParseError.invalidValue("PersistentKeepalive", raw) }
            configuration.persistentKeepAlive = value
        }
        return configuration
    }

    private static func commaSeparated(_ value: String) -> [String] {
        value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
}
