import NetworkExtension
import WireGuardKit

final class PacketTunnelProvider: NEPacketTunnelProvider {
    private lazy var adapter = WireGuardAdapter(with: self) { _, message in
        NSLog("Tunnara WireGuard: %@", message)
    }

    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        guard
            let tunnelProtocol = protocolConfiguration as? NETunnelProviderProtocol,
            let raw = tunnelProtocol.providerConfiguration?["wgQuickConfig"] as? String
        else {
            completionHandler(NSError(domain: "Tunnara", code: 1, userInfo: [NSLocalizedDescriptionKey: "Configuração WireGuard ausente"]))
            return
        }
        do {
            let configuration = try TunnelConfiguration(fromWgQuickConfig: raw, called: "Tunnara")
            adapter.start(tunnelConfiguration: configuration) { error in completionHandler(error) }
        } catch { completionHandler(error) }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        adapter.stop { _ in completionHandler() }
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        adapter.getRuntimeConfiguration { value in completionHandler?(value?.data(using: .utf8)) }
    }
}
