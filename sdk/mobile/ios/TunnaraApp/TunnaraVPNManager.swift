import Foundation
import NetworkExtension

@MainActor
final class TunnaraVPNManager: ObservableObject {
    @Published var statusText = "Desconectado"
    private var manager: NETunnelProviderManager?

    func installAndStart(configuration: String) async {
        guard !configuration.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            statusText = "Informe a configuração WireGuard"; return
        }
        do {
            let managers = try await NETunnelProviderManager.loadAllFromPreferences()
            let manager = managers.first ?? NETunnelProviderManager()
            let protocolConfiguration = NETunnelProviderProtocol()
            protocolConfiguration.providerBundleIdentifier = "br.com.wwsoftwares.tunnara.mobile.packet-tunnel"
            protocolConfiguration.serverAddress = "Tunnara Private Network"
            protocolConfiguration.providerConfiguration = ["wgQuickConfig": configuration]
            manager.protocolConfiguration = protocolConfiguration
            manager.localizedDescription = "Tunnara"
            manager.isEnabled = true
            try await manager.saveToPreferences()
            try await manager.loadFromPreferences()
            try manager.connection.startVPNTunnel()
            self.manager = manager
            statusText = "Conectando…"
        } catch { statusText = "Falha: \(error.localizedDescription)" }
    }

    func stop() {
        manager?.connection.stopVPNTunnel()
        statusText = "Desconectado"
    }
}
