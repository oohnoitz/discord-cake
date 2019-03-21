const { Client } = require('discord.js')
const plugins = require('./lib/plugins')

const client = new Client()

client.on('ready', () => {
  // eslint-disable-next-line no-console
  console.log(`Logged in as ${client.user.tag}`)
})

client.on('message', plugins)

client.login(process.env.DISCORD_TOKEN)
