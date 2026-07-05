import SwiftUI

struct ContentView: View {
    @StateObject private var vpn = TunnaraVPNManager()
    @State private var configuration = UserDefaults.standard.string(forKey: "tunnara.wireguard") ?? ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Status") { Text(vpn.statusText) }
                Section("Configuração WireGuard") {
                    TextEditor(text: $configuration).font(.system(.caption, design: .monospaced)).frame(minHeight: 280)
                }
                Button("Instalar e conectar") {
                    UserDefaults.standard.set(configuration, forKey: "tunnara.wireguard")
                    Task { await vpn.installAndStart(configuration: configuration) }
                }
                Button("Desconectar", role: .destructive) { vpn.stop() }
            }
            .navigationTitle("Tunnara")
        }
    }
}
