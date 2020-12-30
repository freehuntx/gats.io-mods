import express from 'express'
import { zombieMode } from './zombiemode'

const app = express()

app.get('/ping', (req, res) => res.send('pong'))

// This way we could protect the endpoints for starting zombieserver
app.use((req, res, next) => {
  const auth = {login: 'admin', password: 'admin'}

  const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

  if (login && password) {
    if (login === auth.login && password === auth.password) return next()
    else {
      return res.status(200).send('')
    }
  }

  res.set('WWW-Authenticate', 'Basic')
  res.status(401).send('')
})

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf8">
      <title></title>
    </head>
    <body>
      <h1>Zombie event</h1>
      <b>Status: </b>${zombieMode.started ? 'Started' : 'Not started'}<br />
      <button id="zombie-event-btn">${zombieMode.started ? 'Stop' : 'Start'}</button>
      <hr />

      <script>
        const error = (location.search.match(/[?&]error=([^&]*)/) || []).pop()

        if (error) alert('Error: ' + error)

        document.getElementById('zombie-event-btn').addEventListener('click', e => {
          location.href = '/zombie/${zombieMode.started ? 'stop': 'start'}'
        })
      </script>
    </body>
  </html>
  `)
})

app.use(express.static(__dirname + '/../public'))

app.get('/zombie/start', async (req, res) => {
  const started = await zombieMode.start()

  res.redirect(`/${started ? '' : '?error=Fail'}`)
})

app.get('/zombie/stop', async (req, res) => {
  const stopped = await zombieMode.stop()

  res.redirect(`/${stopped ? '' : '?error=Fail'}`)
})

app.listen(3000, () => {
  console.log('Server started on port:', 3000)
})
