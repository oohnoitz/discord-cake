const { RichEmbed } = require('discord.js')

const COMMAND_PREFIXES = ['.']
const PLUGINS = [
  {
    name: 'cake',
    listen: require('./cake'),
  },
  {
    name: 'ember',
    listen: require('./ember'),
  },
]

async function run(message) {
  const { author, content } = message
  const prefix = content.slice(0, 1)

  if (author.bot || !COMMAND_PREFIXES.includes(prefix)) {
    return null
  }

  // convert to !<command> <...args>
  const args = content
    .slice(1)
    .trim()
    .split(/ +/g)
  const command = args.shift().toLowerCase()

  if (command === 'code') {
    return message.channel.send(
      new RichEmbed()
        .setDescription(
          'This Discord bot is writing in **JavaScript** and powered by **discord.js**. Feel free to contribute to the code base.',
        )
        .addField('Source Code', 'https://github.com/oohnoitz/discord-cake'),
    )
  }

  PLUGINS.forEach(plugin => plugin.listen(message, command, args))
}

module.exports = run
