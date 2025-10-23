'use client'

import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'

// Note: This is a simple MetaMask example using ethers v6.
// Projects can replace this with their preferred login solution (Privy, RainbowKit, Wagmi, etc.).

export default function ConnectWalletButton() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Attempt eager connection if already authorized
    const init = async () => {
      try {
        const anyWindow = window as any
        if (!anyWindow.ethereum) return
        const provider = new ethers.BrowserProvider(anyWindow.ethereum)
        const accounts = await provider.listAccounts()
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0].address)
        }
        const net = await provider.getNetwork()
        setChainId(net.chainId.toString())
        anyWindow.ethereum.on?.('accountsChanged', (accs: string[]) => {
          setAccount(accs?.[0] ?? null)
        })
        anyWindow.ethereum.on?.('chainChanged', () => {
          window.location.reload()
        })
      } catch (e: any) {
        // ignore eager connect errors
      }
    }
    init()
  }, [])

  const connect = async () => {
    try {
      setError(null)
      const anyWindow = window as any
      if (!anyWindow.ethereum) {
        setError('MetaMask not found. Please install it to connect.')
        return
      }
      const provider = new ethers.BrowserProvider(anyWindow.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setAccount(addr)
      const net = await provider.getNetwork()
      setChainId(net.chainId.toString())
    } catch (e: any) {
      setError(e?.message ?? 'Failed to connect wallet')
    }
  }

  const disconnect = () => {
    // MetaMask does not support programmatic disconnect.
    // Clear local state to "simulate" disconnect; users can disconnect from MetaMask UI.
    setAccount(null)
    setChainId(null)
  }

  return (
    <div className="space-y-2">
      {account ? (
        <div className="text-xs text-gray-300 break-all">
          <div>Connected</div>
          <div className="font-mono">{account}</div>
          {chainId && <div className="opacity-80">Chain: {chainId}</div>}
          <button
            className="mt-2 w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            onClick={disconnect}
          >
            Disconnect (local)
          </button>
        </div>
      ) : (
        <button
          className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          onClick={connect}
        >
          Connect Wallet (MetaMask)
        </button>
      )}
      {error && <div className="text-[11px] text-red-400">{error}</div>}
      <div className="text-[11px] text-gray-400">
        Note: Replace this with your preferred login method (e.g. Privy, Wagmi, RainbowKit).
      </div>
    </div>
  )
}


