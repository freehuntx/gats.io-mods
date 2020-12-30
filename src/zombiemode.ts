import { GatsClient, ARMOR, COLOR, WEAPON, SKILL } from './lib/GatsClient'

class ZombieMode {
  started = false
  cleanupCalls = []
  
  async start() {
    if (this.started) return false
    this.started = true

    const servers = await GatsClient.getServerlist()
    const ffaServers = servers.filter(e => e.game_type === 'FFA')
    const zombieMessages = [
      'I WANT EAT YOUR FLESH!!!',
      'Flesh... FLESH... FLESH!!!',
      'I NEED HUMAN BLOOD!!!'
    ]

    for (const { url } of ffaServers) {
      let zombieClients: GatsClient[] = []

      for (let i=0; i<30; i++) {
        const client = new GatsClient({
          server: `wss://${url}`,
          weapon: WEAPON.lmg,
          color: COLOR.purple,
          armor: ARMOR.heavyArmor,
          skills: [SKILL.grip, SKILL.knife, SKILL.extended],
          restartOnDeath: true,
          restartOnDisconnect: true
        })
        zombieClients.push(client)

        const intervals = [
          setInterval(() => {
            const enemy = client.getClosestEnemy(p => zombieClients.findIndex(c => c.localPlayerId === p.id) === -1 && !p.invincible)
            if (!enemy) return client.moveTo({ x: 35000, y: 35000 }) // Move to the middle
            
            client.moveTo(enemy)
            client.shootAt(enemy)
          }, 200),

          setInterval(() => {
            client.useSkill()
          }, 1000),

          setInterval(() => {
            client.chat(zombieMessages[Math.floor(Math.random()*zombieMessages.length)])
          }, 2000)
        ]

        this.cleanupCalls.push(() => {
          zombieClients = []
          intervals.forEach(clearInterval)
          client.stop()
        })
      }
    }

    return true
  }

  stop() {
    if (!this.started) return false

    this.cleanupCalls.forEach(fn => fn())
    this.cleanupCalls = []
    this.started = false

    return true
  }
}

export const zombieMode = new ZombieMode()