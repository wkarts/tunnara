package br.com.wwsoftwares.tunnara.mobile

import com.wireguard.android.backend.Tunnel

class TunnaraTunnel(private val callback: (Tunnel.State) -> Unit) : Tunnel {
    override fun getName(): String = "tunnara"
    override fun onStateChange(newState: Tunnel.State) = callback(newState)
}
