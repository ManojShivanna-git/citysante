import { io, Socket } from 'socket.io-client'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })
  }
  return socket
}

export function connectSocket(userId: string) {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit('join', userId)
}

export function disconnectSocket() {
  socket?.disconnect()
}
