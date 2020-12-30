if (typeof window === 'undefined') {
  // @ts-ignore
  global.WebSocket = require('websocket').w3cwebsocket
}
import { EventEmitter } from 'events'

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

export class TextWebSocket extends EventEmitter {
  private socket: WebSocket = null

  constructor(serverOrWebsocket: string|WebSocket) {
    super()
    this.on('error', e => console.error(e))
    if (typeof serverOrWebsocket === 'string') {
      // @ts-ignore
      this.socket = new WebSocket(serverOrWebsocket, [], 'https://' + serverOrWebsocket.replace(/^(https?|wss?)?(:\/\/)?(.*?)([^.]+\.[^./]+)(\/.*)?$/, '$4'))
    }
    else {
      this.socket = serverOrWebsocket
    }

    this.socket.addEventListener('open', this.onOpen.bind(this))
    this.socket.addEventListener('close', this.onClose.bind(this))
    this.socket.addEventListener('message', this.onMessage.bind(this))
    this.socket.addEventListener('error', this.onError.bind(this))
  }

  get connected(): boolean {
    return this.socket.readyState === WebSocket.OPEN
  }

  send(message: string): boolean {
    if (!this.connected) return false
    this.socket.send(message)
    return true
  }

  recv(message: string): boolean {
    if (!this.connected) return false
    const data = textEncoder.encode(message)
    const event = new MessageEvent('message', { data })
    if (this.socket.onmessage) this.socket.onmessage(event)
    this.socket.dispatchEvent(event)
  }

  close() {
    if (!this.connected) return false
    this.socket.close()
    return true
  }

  private onOpen() {
    this.emit('connected')
  }

  private onClose() {
    this.emit('disconnected')
  }

  private onMessage({ data }) {
    if (data instanceof ArrayBuffer) {
      data = textDecoder.decode(ArrayBuffer.isView(data) ? data.buffer : data)
    }
    else if (typeof data !== 'string') {
      throw new Error('Unknown type of: ' + typeof data)
    }
    
    this.emit('message', data)
  }

  private onError(error) {
    this.emit('error', error)
  }
}