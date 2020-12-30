if (typeof window === 'undefined') var fetch = require('node-fetch')
import { EventEmitter } from 'events'
import { ARMOR, COLOR, SKILL, WEAPON } from './constants'
import { GatsConnection } from './GatsConnection'
import { GatsPlayer } from './GatsPlayer'

type CardinalDir = 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'|''

interface GatsClientOptions {
  server?: string
  socket?: WebSocket
  armor?: ARMOR
  color?: COLOR
  weapon?: WEAPON
  skills?: SKILL[]
  autoJoin?: boolean
  autoStart?: boolean
  restartOnDisconnect?: boolean
  restartOnDeath?: boolean
}

export class GatsClient extends EventEmitter {
  private options: GatsClientOptions = null
  private connection: GatsConnection = null
  private tickInterval: NodeJS.Timeout = null
  localPlayerId: number = null
  players: { [id: number]: GatsPlayer } = {}

  constructor(options: GatsClientOptions = {}) {
    super()
    this.on('error', e => console.error(e))

    this.options = {
      armor: ARMOR.noArmor,
      color: COLOR.red,
      weapon: WEAPON.pistol,
      skills: [/*SKILL.longRange, SKILL.knife, SKILL.armorPiercing*/],
      autoJoin: true,
      autoStart: true,
      restartOnDisconnect: false,
      restartOnDeath: false,
      ...options
    }

    if (options.socket) {
      this.options.autoJoin = false
      this.options.autoStart = true
      this.options.restartOnDeath = false
      this.options.restartOnDisconnect = false
    }

    if (this.options.autoStart) this.start()
  }

  get connected(): boolean {
    return this.connection !== null && this.connection.connected
  }

  get currentPing(): number {
    if (!this.connected) return null
    return this.connection.currentPing
  }

  get localPlayer(): GatsPlayer {
    if (!this.connected || this.localPlayerId === null) return null
    return this.players[this.localPlayerId] || null
  }
  
  private reset() {
    this.localPlayerId = null
    this.players = {}
  }

  getEnemys(filter?: (player: GatsPlayer) => boolean): GatsPlayer[] {
    if (!this.connected) return []
    return Object.values(this.players).filter(p => {
      if (filter && !filter(p)) return false
      if (!this.localPlayer) return true
      if (p.id === this.localPlayerId) return false
      if (p.team === 0) return true
      return p.team !== this.localPlayer.team
    })
  }

  getClosestEnemy(filter?: (player: GatsPlayer) => boolean): GatsPlayer {
    if (!this.connected || !this.localPlayer) return null
    const { x, y } = this.localPlayer
    const enemys = this.getEnemys(filter)
    let closestEnemy: GatsPlayer = null, closestC: number

    for (const enemy of enemys) {
      const a = enemy.x - x
      const b = enemy.y - y
      const c = a*a + b*b
      if (!closestEnemy || c <= closestC) {
        closestEnemy = enemy
        closestC = c
      }
    }
    
    return closestEnemy
  }

  move(cardinalDir: CardinalDir = ''): boolean {
    if (!this.connected) return false
    let up=false, right=false, down=false, left=false
    if (/^N[EW]?$/i.test(cardinalDir)) up = true
    if (/^[NS]?E$/i.test(cardinalDir)) right = true
    if (/^S[WE]?$/i.test(cardinalDir)) down = true
    if (/^[NS]?W$/i.test(cardinalDir)) left = true
    
    this.connection.sendKey(0, left)
    this.connection.sendKey(1, right)
    this.connection.sendKey(2, up)
    return this.connection.sendKey(3, down)
  }

  moveTo({ x: destX, y: destY }: { x: number, y: number }): boolean {
    if (!this.connection || !this.localPlayer) return false
    const { x, y } = this.localPlayer
    return this.move(((destY<y?'N':'S') + (destX>x?'E':'W')) as CardinalDir)
  }

  setAngle(angle: number): boolean {
    if (!this.connected) return false
    // TODO: Calculate x,y using angle instead
    return this.connection.sendMouse(5000, 5000, Math.floor(angle))
  }

  lookAt(player: GatsPlayer, predict = true): boolean {
    if (!this.connected || !this.localPlayer) return false

    let { x, y, speedX, speedY } = this.localPlayer
    let { x: tX, y: tY, speedX: tSpeedX, speedY: tSpeedY } = player
    const dx = x-tX
    const dy = y-tY
    const dist = Math.sqrt(dx*dx + dy*dy)

    if (predict) {
      //x += speedX*(dist*0.001)
      //y += speedY*(dist*0.001)
      tX += tSpeedX*(dist*0.001)
      tY += tSpeedY*(dist*0.001)
    }

    return this.setAngle(Math.atan2(y - tY, x - tX) * 180 / Math.PI + 180)
  }

  shootAt(player: GatsPlayer): boolean {
    this.lookAt(player)
    return this.shoot()
  }

  shoot(): boolean {
    if (!this.connected) return false
    return this.connection.sendKeyPress(6)
  }
  
  startShoot(): boolean {
    if (!this.connected) return false
    return this.connection.sendKey(6, true)
  }
  
  stopShoot(): boolean {
    if (!this.connected) return false
    return this.connection.sendKey(6, false)
  }

  reload(): boolean {
    if (!this.connected) return false
    return this.connection.sendKeyPress(4)
  }

  useSkill(): boolean {
    if (!this.connected) return false
    return this.connection.sendKeyPress(5)
  }

  chat(message): boolean {
    if (!this.connected) return false
    return this.connection.sendChat(message)
  }

  start() {
    if (this.connection) throw new Error('There is already a connection')

    this.connection = new GatsConnection(this.options.server || this.options.socket)
    this.connection.on('connected', this.onConnected.bind(this))
    this.connection.on('disconnected', this.onDisconnected.bind(this))
    this.connection.on('setupLocalPlayer', this.onSetupLocalPlayer.bind(this))
    this.connection.on('setupPlayer', this.onSetupPlayer.bind(this))
    this.connection.on('updateLocalPlayer', this.onUpdateLocalPlayer.bind(this))
    this.connection.on('updatePlayer', this.onUpdatePlayer.bind(this))
    this.connection.on('removePlayer', this.onRemovePlayer.bind(this))
    this.connection.on('levelUp', this.onLevelUp.bind(this))
    this.connection.on('died', this.onDied.bind(this))
  }

  stop() {
    if (!this.connection) throw new Error('There is no connection')

    this.cleanupConnection()
    this.reset()
  }

  restart() {
    if (this.connection) this.stop()
    this.start()
  }

  join() {
    if (!this.connected) return false
    return this.connection.sendSelection(this.options)
  }

  private cleanupConnection() {
    if (!this.connection) return
    this.connection.removeAllListeners()

    if (this.connection.connected) {
      this.connection.disconnect()
      this.emit('disconnected')
    }

    this.connection = null
  }

  private onSetupLocalPlayer(data) {
    this.localPlayerId = data.id
    this.onSetupPlayer(data)
    this.emit('addLocalPlayer', this.players[data.id])
  }

  private onSetupPlayer(data) {
    const player = new GatsPlayer(data.id)
    player.update(data)
    this.players[player.id] = player
    this.emit('addPlayer', this.players[data.id])
  }

  private onUpdateLocalPlayer(data) {
    if (!this.localPlayer) return
    data.id = this.localPlayer.id
    this.onUpdatePlayer(data)
  }

  private onUpdatePlayer(data) {
    const player = this.players[data.id]
    if (!player) return
    player.update(data)
  }

  private onRemovePlayer(id) {
    if (!this.players[id]) return
    this.emit('removePlayer', this.players[id])
    this.players[id].removeAllListeners()
    delete this.players[id]
  }

  private onLevelUp(level) {
    if (!this.localPlayer) return
    this.localPlayer.level = level

    if (this.options.skills[level-1] !== undefined) {
      this.connection.sendUpgrade(this.options.skills[level-1], level)
    }
  }

  private onDied(killerName) {
    this.emit('died')
    if (this.options.restartOnDeath) this.restart()
  }

  private onTick() {
    this.emit('tick')
  }

  private onConnected() {
    this.emit('connected')

    this.tickInterval = setInterval(this.onTick.bind(this), 1000/30)

    if (this.options.autoJoin) this.join()
  }

  private onDisconnected() {
    clearInterval(this.tickInterval)
    this.cleanupConnection()
    if (this.options.restartOnDisconnect) this.restart()
  }

  static getServerlist() {
    return fetch('https://io-8.com/find_instances', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        game: 'gats.io'
      })
    }).then(res => res.json())
  }
}
