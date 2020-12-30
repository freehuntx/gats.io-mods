import { EventEmitter } from 'events'
import { TextWebSocket } from './TextWebSocket'
import { WEAPON, COLOR, ARMOR, SKILL } from './constants'

interface SelectionOptions {
  armor?: ARMOR
  color?: COLOR
  weapon?: WEAPON
}

export class GatsConnection extends EventEmitter {
  private socket: TextWebSocket = null
  private gameConnected = false
  private lastPingSent: number = null
  private pingInterval: NodeJS.Timeout = null
  private keyPressTimeouts: {[key: number]: NodeJS.Timeout} = {}
  currentPing: number = 0

  constructor(serverOrWebsocket: string|WebSocket) {
    super()
    this.on('error', e => console.error(e))

    this.socket = new TextWebSocket(serverOrWebsocket)
    this.socket.on('disconnected', this.onSocketDisconnected.bind(this))
    this.socket.on('message', this.onSocketMessage.bind(this))
    this.socket.on('error', this.onSocketError.bind(this))
  }

  get connected(): boolean {
    return this.socket !== null && this.socket.connected && this.gameConnected
  }

  sendKeyPress(inputId: number): boolean {
    clearTimeout(this.keyPressTimeouts[inputId])
    this.keyPressTimeouts[inputId] = setTimeout(() => this.sendKey(inputId, false), 150)
    return this.sendKey(inputId, true)
  }

  sendKey(inputId: number, down=true): boolean {
    return this.send('k', inputId, down ? 1 : 0)
  }

  sendMouse(x: number, y: number, angle?: number): boolean {
    if (angle === undefined) angle = Math.atan2(y, x) * 180 / Math.PI + 180
    return this.send('m', x, y, angle)
  }

  sendChat(message: string): boolean {
    return this.send('c', message.replace(/,/g, '~'))
  }

  sendSelection(options?: SelectionOptions): boolean {
    options = {
      armor: ARMOR.noArmor,
      color: COLOR.red,
      weapon: WEAPON.pistol,
      ...options
    }
    
    return this.send('s', options.weapon, options.armor, options.color)
  }

  sendUpgrade(skill: SKILL, level: 1|2|3): boolean {
    return this.send('u', skill, level)
  }

  sendPing(): boolean {
    return this.send('.')
  }

  send(type: string, ...args): boolean {
    return this.socket.send([type, ...args].join(','))
  }

  recv(type: string, ...args): boolean {
    return this.socket.recv([type, ...args].join(','))
  }

  disconnect(): boolean {
    return this.socket.close()
  }

  onMessage(message: string) {
    if (!this.gameConnected) {
      this.gameConnected = true
      this.onConnected()
    }

    const [type, ...args] = message.trim().split(',').map(e => (e === undefined || e === '' || !/^-?\d+$/.test(e)) ? e : parseInt(e))

    if (type === '+') { // Connected
      /*
       * Here you would need to integrate a captcha solver.
       * But since that costs and i dont want to invest money into this fun project i just ditch it.
       */
      const GOOGLE_RECAPTCHA_LOTOKEN = ''
      const GOOGLE_RECAPTCHA_LOTIME = ''
      this.send('q', GOOGLE_RECAPTCHA_LOTOKEN, GOOGLE_RECAPTCHA_LOTIME)
    }
    else if (type === '.') {
      if (this.lastPingSent) {
        this.currentPing = +new Date() - this.lastPingSent
        this.emit('ping', this.currentPing)
      }
    }
    else if (type === 'gameType') {
      this.emit('gameType', args[0])
    }
    else if (type === 'highScores') {
      if (args.length > 2) {
        this.emit('highScores', JSON.parse(args.join(',')))
      }
    }
    else if (type === 'full') {
      this.emit('full')
    }
    else if (type === 'sq') {} // SquareTeams
    else if (type === 'sz') {
      this.emit('mapSize', args[0])
    }
    else if (type === 'sta') {
      const argKeys = Array('score', 'kills', 'time', 'shotsFired', 'shotsHit', 'damageDealt', 'damageReceived', 'distanceCovered', 'shooterName', 'shooterIsPremium', 'shooterWeapon', 'shooterArmor', 'shooterColor', 'shooterKills', 'shooterScore', 'shooterHp', 'shooterArmorAmount', 'shooterLevel1Powerup', 'shooterLevel2Powerup', 'shooterLevel3Powerup')
      const data = this.parseArgs(args, argKeys)
      this.emit('statistic', data)
    }
    else if (type === 're') {} // respawnAdContainer ?!?
    else if (type === 'reco') {} // Full detected?!?
    else if (type === 'a') {
      const argKeys = ['id', 'weapon', 'color', 'x', 'y', 'radius', 'angle', 'armorAmount', 'bullets', 'maxBullets', 'armor', 'hp', 'camWidth', 'camHeight', 'hpMax', 'mapWidth', 'mapHeight', 'name', 'invincible', 'isLeader', 'isPremium', 'team']
      const data = this.parseArgs(args, argKeys)
      this.emit('setupLocalPlayer', data)
    }
    else if (type === 'b') {
      const data = this.parseArgs(args, ['id', 'x', 'y', 'speedX', 'speedY', 'angle'])
      this.emit('updatePlayer', data)
    }
    else if (type === 'c') {
      const argKeys = ['id', 'bullets', 'shooting', 'reloading', 'hp', 'beingHit', 'armorAmount', 'radius', 'ghillie', 'maxBullets', 'invincible', 'dashing', 'chatBoxOpen', 'isLeader', 'color', 'chatMessage']
      const data = this.parseArgs(args, argKeys)
      this.emit('updatePlayer', data)
    }
    else if (type === 'd') {
      const data = this.parseArgs(args, ['id', 'weapon', 'color', 'x', 'y', 'radius', 'angle', 'armorAmount', 'hp', 'maxBullets', 'name', 'ghillie', 'invincible', 'isLeader', 'isPremium', 'team'])
      this.emit('setupPlayer', data)
    }
    else if (type === 'e') {
      this.emit('removePlayer', args[0])
    }
    else if (type === 'f') {
      const data = this.parseArgs(args, ['bullets', 'score', 'kills', 'rechargeTimer', 'maxBullets', 'camera', 'thermal', 'explosivesLeft'])
      this.emit('updateLocalPlayer', data)
    }
    else if (type === 'g') {
      const data = this.parseArgs(args, ['id', 'x', 'y', 'length', 'width', 'angle', 'speedX', 'speedY', 'silenced', 'isKnife', 'isShrapnel', 'ownerId', 'team'])
      this.emit('setupBullet', data)
    }
    else if (type === 'h') {
      const data = this.parseArgs(args, ['id', 'x', 'y'])
      this.emit('updateBullet', data)
    }
    else if (type === 'i') {
      this.emit('removeBullet', args[0])
    }
    else if (type === 'j') {
      const data = this.parseArgs(args, ['id', 'type', 'x', 'y', 'angle', 'parentId', 'hp', 'maxHp', 'isPremium'])
      this.emit('setupItem', data)
    }
    else if (type === 'k') {
      const data = this.parseArgs(args, ['id', 'x', 'y', 'angle', 'hp'])
      this.emit('updateItem', data)
    }
    else if (type === 'l') {
      this.emit('removeItem', args[0])
    }
    else if (type === 'm') {
      const data = this.parseArgs(args, ['id', 'type', 'x', 'y', 'speedX', 'speedY', 'travelTime', 'emitting', 'emissionRadius', 'ownerId', 'team'])
      this.emit('setupBomb', data)
    }
    else if (type === 'n') {
      const data = this.parseArgs(args, ['id', 'x', 'y', 'exploding', 'emitting', 'emissionRadius'])
      this.emit('updateBomb', data)
    }
    else if (type === 'o') {
      this.emit('removeBomb', args[0])
    }
    else if (type === 'p') {
      this.emit('levelUp', args[0])
    }
    else if (type === 'q') {
      const [x, y] = args
      this.emit('hitMarker', { x, y })
    }
    else if (type === 'r') {
      const [type, content] = args
      
      if (type === 1) {
        this.emit('killed', content)
      }
      else if (type === 2) {
        this.emit('died', content)
      }
      else if (type === 3) {
        this.emit('dealDamage', content)
      }
    }
    else if (type === 's') {} // ?
    else if (type === 't') {} // ?
    //else if (type === 'u') {}
    else if (type === 'v') {
      const [playerCount, ...leaderboard] = args
      leaderboard.forEach((player, i) => {
        const [id, isMember, score, kills, team] = (player as string).split('.')
        Object.assign(leaderboard[i], { id, isMember, score, kills, team })
      })
      this.emit('playerCount', playerCount)
      this.emit('leaderboard', leaderboard)
    }
    else if (type === 'w') {} // [name, rememberCookie, isPremium]
    else if (type === 'x') {
      this.emit('error', args[0])
    }
    else if (type === 'y') {} // [name, email, password]
    else if (type === 'z') {} // [status]
    else {
      this.debug('[Connection]', 'Unhandled message:', { type, args })
    }
  }
  
  parseArgs(args=[], argKeys=[]): {[key: string]: any} {
    const data: {[key: string]: any} = {}
    for (let i=0; i<argKeys.length; i++) {
      if (args[i] === undefined || args[i] === '') continue
      data[argKeys[i]] = args[i]
    }
    return data
  }
  
  debug(...args) {
    if (!process?.env?.DEBUG) return
    console.log(...args)
  }

  onConnected() {
    this.emit('connected')

    clearInterval(this.pingInterval)
    this.pingInterval = setInterval(this.sendPing.bind(this), 2000)
  }

  onDisconnected() {
    this.emit('disconnected')

    clearInterval(this.pingInterval)
  }

  ////// Socket callbacks ///////
  onSocketDisconnected() {
    if (this.gameConnected) {
      this.gameConnected = false
      this.onDisconnected()
    }
  }

  onSocketMessage(message: string) {
    message.split('|').filter(Boolean).forEach(message => this.onMessage(message))
  }

  onSocketError(error) {
    this.emit('error', error)
  }
}
