package br.com.wwsoftwares.tunnara.mobile

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.StringReader

class MainActivity : AppCompatActivity() {
    private lateinit var backend: GoBackend
    private lateinit var tunnel: TunnaraTunnel
    private lateinit var status: TextView
    private lateinit var configText: EditText
    private var pendingConnect = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        backend = GoBackend(this)
        status = findViewById(R.id.status)
        configText = findViewById(R.id.config)
        configText.setText(getPreferences(MODE_PRIVATE).getString("wireguard", ""))
        tunnel = TunnaraTunnel { state -> runOnUiThread { renderState(state) } }
        findViewById<Button>(R.id.connect).setOnClickListener { requestVpnAndConnect() }
        findViewById<Button>(R.id.disconnect).setOnClickListener { setTunnelState(Tunnel.State.DOWN) }
    }

    private fun requestVpnAndConnect() {
        val permission = VpnService.prepare(this)
        if (permission != null) {
            pendingConnect = true
            @Suppress("DEPRECATION")
            startActivityForResult(permission, VPN_REQUEST)
        } else connect()
    }

    @Deprecated("Compatibilidade com o fluxo de autorização VpnService")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST && pendingConnect) {
            pendingConnect = false
            if (resultCode == Activity.RESULT_OK) connect() else status.text = "Permissão VPN recusada"
        }
    }

    private fun connect() {
        val raw = configText.text.toString().trim()
        if (raw.isEmpty()) { status.text = "Informe a configuração WireGuard"; return }
        getPreferences(MODE_PRIVATE).edit().putString("wireguard", raw).apply()
        lifecycleScope.launch {
            status.text = "Conectando…"
            try {
                val config = withContext(Dispatchers.IO) { Config.parse(BufferedReader(StringReader(raw))) }
                withContext(Dispatchers.IO) { backend.setState(tunnel, Tunnel.State.UP, config) }
                renderState(Tunnel.State.UP)
            } catch (error: Exception) {
                status.text = "Falha: ${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun setTunnelState(state: Tunnel.State) {
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) { backend.setState(tunnel, state, null) }
                renderState(state)
            } catch (error: Exception) {
                status.text = "Falha: ${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun renderState(state: Tunnel.State) {
        status.text = if (state == Tunnel.State.UP) "Rede privada conectada" else "Desconectado"
    }

    companion object { private const val VPN_REQUEST = 7001 }
}
