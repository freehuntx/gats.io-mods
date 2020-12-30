import { EventEmitter } from 'events'
import { ARMOR, COLOR, WEAPON, PLAYERNAMES } from './constants'

export class GatsPlayer extends EventEmitter {
  private chatMessageTimeout: NodeJS.Timeout = null
  id = -1
  name: string = null
  armor: ARMOR = ARMOR.noArmor
  color: COLOR = COLOR.red
  weapon: WEAPON = WEAPON.pistol
  chatMessage: string = null
  x = 0
  y = 0
  speedX = 0
  speedY = 0
  radius = 0
  bullets = 0
  maxBullets = 0
  beingHit = 0
  angle = 0
  hp = 0
  hpMax = 0
  armorAmount = 0
  team = 0
  level = 0
  camWidth = 0
  camHeight = 0
  invincible = 0
  isLeader = 0
  isPremium = 0
  shooting = 0
  reloading = 0
  ghillie = 0
  dashing = 0
  chatBoxOpen = 0
  score = 0
  kills = 0
  rechargeTimer = 0
  camera = 0
  thermal = 0
  explosivesLeft = 0

  constructor(id: number) {
    super()
    this.id = id
  }

  update(data) {
    if (data.name && data.name[0] === '#') data.name = PLAYERNAMES[data.id] || 'Mystery Creature'

    if (this.hp > 0 && data.hp === 0) {
      this.hp = 0
      this.emit('died')
    }

    if (data.x !== undefined && (this.x !== data.x ||  this.y !== data.y)) {
      this.x = data.x
      this.y = data.y
      this.emit('move')
    }

    for (const [key, value] of Object.entries(data)) {
      this[key] = value
    }

    if (data.chatMessage) {
      clearTimeout(this.chatMessageTimeout)

      this.chatMessageTimeout = setTimeout(() => {
        this.chatMessage = null
      }, 5000)
    }
  }
}
