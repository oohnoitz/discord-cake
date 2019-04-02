const client = require('./client')
const plugins = require('./lib/plugins')

// eslint-disable-next-line no-console
client.on('ready', () => console.log(`Logged in as ${client.user.tag}`))
// eslint-disable-next-line no-console
client.on('error', error => console.error(`WS encountered an error: ${error}`))
client.on('message', plugins)
client.login(process.env.DISCORD_TOKEN)
