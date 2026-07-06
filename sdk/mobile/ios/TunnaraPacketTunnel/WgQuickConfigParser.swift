import Foundation
import WireGuardKit

enum WgQuickConfigParser {
    enum Section {
        case interface
        case peer
    }

    enum ParseError: LocalizedError {
        case attributeOutsideSection(line: Int)
        case invalidLine(line: Int, content: String)
        case duplicateInterface
        case missingInterface
        case missingPrivateKey
        case invalidPrivateKey
        case invalidListenPort(String)
        case invalidAddress(String)
        case invalidDNS(String)
        case invalidMTU(String)
        case missingPublicKey
        case invalidPublicKey
        case invalidPreSharedKey
        case invalidAllowedIP(String)
        case invalidEndpoint(String)
        case invalidPersistentKeepAlive(String)
        case unsupportedAttribute(section: String, key: String)
        case duplicateAttribute(String)
        case duplicatePeerPublicKey

        var errorDescription: String? {
            switch self {
            case .attributeOutsideSection(let line):
                return "Atributo WireGuard fora de uma seção na linha \(line)."
            case .invalidLine(let line, let content):
                return "Linha WireGuard inválida na linha \(line): \(content)"
            case .duplicateInterface:
                return "A configuração WireGuard contém mais de uma seção [Interface]."
            case .missingInterface:
                return "A configuração WireGuard não contém uma seção [Interface]."
            case .missingPrivateKey:
                return "A seção [Interface] não contém PrivateKey."
            case .invalidPrivateKey:
                return "PrivateKey inválida na seção [Interface]."
            case .invalidListenPort(let value):
                return "ListenPort WireGuard inválido: \(value)"
            case .invalidAddress(let value):
                return "Address WireGuard inválido: \(value)"
            case .invalidDNS(let value):
                return "DNS WireGuard inválido: \(value)"
            case .invalidMTU(let value):
                return "MTU WireGuard inválido: \(value)"
            case .missingPublicKey:
                return "A seção [Peer] não contém PublicKey."
            case .invalidPublicKey:
                return "PublicKey inválida na seção [Peer]."
            case .invalidPreSharedKey:
                return "PresharedKey inválida na seção [Peer]."
            case .invalidAllowedIP(let value):
                return "AllowedIPs WireGuard inválido: \(value)"
            case .invalidEndpoint(let value):
                return "Endpoint WireGuard inválido: \(value)"
            case .invalidPersistentKeepAlive(let value):
                return "PersistentKeepalive WireGuard inválido: \(value)"
            case .unsupportedAttribute(let section, let key):
                return "Atributo WireGuard não suportado em \(section): \(key)"
            case .duplicateAttribute(let key):
                return "Atributo WireGuard duplicado: \(key)"
            case .duplicatePeerPublicKey:
                return "A configuração WireGuard contém peers com a mesma PublicKey."
            }
        }
    }

    private static let interfaceKeys: Set<String> = [
        "privatekey", "listenport", "address", "dns", "mtu"
    ]

    private static let peerKeys: Set<String> = [
        "publickey", "presharedkey", "allowedips", "endpoint", "persistentkeepalive"
    ]

    private static let multipleValueKeys: Set<String> = [
        "address", "dns", "allowedips"
    ]

    static func parse(_ source: String, name: String? = nil) throws -> TunnelConfiguration {
        var currentSection: Section?
        var attributes: [String: String] = [:]
        var interfaceConfiguration: InterfaceConfiguration?
        var peers: [PeerConfiguration] = []

        func commitCurrentSection() throws {
            guard let currentSection else {
                attributes.removeAll(keepingCapacity: true)
                return
            }

            switch currentSection {
            case .interface:
                guard interfaceConfiguration == nil else {
                    throw ParseError.duplicateInterface
                }
                interfaceConfiguration = try makeInterface(from: attributes)
            case .peer:
                peers.append(try makePeer(from: attributes))
            }

            attributes.removeAll(keepingCapacity: true)
        }

        let lines = source.split(omittingEmptySubsequences: false, whereSeparator: \Character.isNewline)
        for (zeroBasedIndex, rawLine) in lines.enumerated() {
            let lineNumber = zeroBasedIndex + 1
            let withoutComment: Substring
            if let commentIndex = rawLine.firstIndex(of: "#") {
                withoutComment = rawLine[..<commentIndex]
            } else {
                withoutComment = rawLine
            }

            let line = withoutComment.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else {
                continue
            }

            switch line.lowercased() {
            case "[interface]":
                try commitCurrentSection()
                currentSection = .interface
                continue
            case "[peer]":
                try commitCurrentSection()
                currentSection = .peer
                continue
            default:
                break
            }

            guard let currentSection else {
                throw ParseError.attributeOutsideSection(line: lineNumber)
            }
            guard let equalsIndex = line.firstIndex(of: "=") else {
                throw ParseError.invalidLine(line: lineNumber, content: line)
            }

            let keyWithCase = line[..<equalsIndex].trimmingCharacters(in: .whitespacesAndNewlines)
            let valueStart = line.index(after: equalsIndex)
            let value = line[valueStart...].trimmingCharacters(in: .whitespacesAndNewlines)
            let key = keyWithCase.lowercased()

            let allowedKeys = currentSection == .interface ? interfaceKeys : peerKeys
            guard allowedKeys.contains(key) else {
                let sectionName = currentSection == .interface ? "[Interface]" : "[Peer]"
                throw ParseError.unsupportedAttribute(section: sectionName, key: keyWithCase)
            }

            if let previousValue = attributes[key] {
                guard multipleValueKeys.contains(key) else {
                    throw ParseError.duplicateAttribute(keyWithCase)
                }
                attributes[key] = previousValue + "," + value
            } else {
                attributes[key] = value
            }
        }

        try commitCurrentSection()

        guard let interfaceConfiguration else {
            throw ParseError.missingInterface
        }

        let publicKeys = peers.map { $0.publicKey.base64Key }
        guard Set(publicKeys).count == publicKeys.count else {
            throw ParseError.duplicatePeerPublicKey
        }

        return TunnelConfiguration(
            name: name,
            interface: interfaceConfiguration,
            peers: peers
        )
    }

    private static func makeInterface(from attributes: [String: String]) throws -> InterfaceConfiguration {
        guard let privateKeyValue = attributes["privatekey"] else {
            throw ParseError.missingPrivateKey
        }
        guard let privateKey = PrivateKey(base64Key: privateKeyValue) else {
            throw ParseError.invalidPrivateKey
        }

        var configuration = InterfaceConfiguration(privateKey: privateKey)

        if let listenPortValue = attributes["listenport"] {
            guard let listenPort = UInt16(listenPortValue) else {
                throw ParseError.invalidListenPort(listenPortValue)
            }
            configuration.listenPort = listenPort
        }

        if let addressValue = attributes["address"] {
            configuration.addresses = try splitCommaSeparated(addressValue).map { value in
                guard let address = IPAddressRange(from: value) else {
                    throw ParseError.invalidAddress(value)
                }
                return address
            }
        }

        if let dnsValue = attributes["dns"] {
            var servers: [DNSServer] = []
            var searchDomains: [String] = []

            for value in splitCommaSeparated(dnsValue) {
                if let server = DNSServer(from: value) {
                    servers.append(server)
                } else if isValidSearchDomain(value) {
                    searchDomains.append(value)
                } else {
                    throw ParseError.invalidDNS(value)
                }
            }

            configuration.dns = servers
            configuration.dnsSearch = searchDomains
        }

        if let mtuValue = attributes["mtu"] {
            guard let mtu = UInt16(mtuValue) else {
                throw ParseError.invalidMTU(mtuValue)
            }
            configuration.mtu = mtu
        }

        return configuration
    }

    private static func makePeer(from attributes: [String: String]) throws -> PeerConfiguration {
        guard let publicKeyValue = attributes["publickey"] else {
            throw ParseError.missingPublicKey
        }
        guard let publicKey = PublicKey(base64Key: publicKeyValue) else {
            throw ParseError.invalidPublicKey
        }

        var peer = PeerConfiguration(publicKey: publicKey)

        if let preSharedKeyValue = attributes["presharedkey"] {
            guard let preSharedKey = PreSharedKey(base64Key: preSharedKeyValue) else {
                throw ParseError.invalidPreSharedKey
            }
            peer.preSharedKey = preSharedKey
        }

        if let allowedIPsValue = attributes["allowedips"] {
            peer.allowedIPs = try splitCommaSeparated(allowedIPsValue).map { value in
                guard let allowedIP = IPAddressRange(from: value) else {
                    throw ParseError.invalidAllowedIP(value)
                }
                return allowedIP
            }
        }

        if let endpointValue = attributes["endpoint"] {
            guard let endpoint = Endpoint(from: endpointValue) else {
                throw ParseError.invalidEndpoint(endpointValue)
            }
            peer.endpoint = endpoint
        }

        if let keepAliveValue = attributes["persistentkeepalive"] {
            guard let keepAlive = UInt16(keepAliveValue) else {
                throw ParseError.invalidPersistentKeepAlive(keepAliveValue)
            }
            peer.persistentKeepAlive = keepAlive
        }

        return peer
    }

    private static func splitCommaSeparated(_ value: String) -> [String] {
        value
            .split(separator: ",", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func isValidSearchDomain(_ value: String) -> Bool {
        guard !value.isEmpty, value.count <= 253 else {
            return false
        }

        let labels = value.split(separator: ".", omittingEmptySubsequences: false)
        guard !labels.isEmpty else {
            return false
        }

        return labels.allSatisfy { label in
            guard !label.isEmpty, label.count <= 63 else {
                return false
            }
            guard label.first != "-", label.last != "-" else {
                return false
            }
            return label.allSatisfy { character in
                character.isLetter || character.isNumber || character == "-"
            }
        }
    }
}
