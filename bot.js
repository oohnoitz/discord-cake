const client = require('./client')
const plugins = require('./lib/plugins')

client.on('ready', () => {
  // eslint-disable-next-line no-console
  console.log(`Logged in as ${client.user.tag}`)
})

client.on('message', plugins)

client.login(process.env.DISCORD_TOKEN)
