const { RichEmbed } = require('discord.js')
const { explore, viewInventory, viewRecord, deleteItem, updateItem, upgradeItem } = require('./actions')

async function listen(context, command, args) {
  if (command !== 'ember') {
    return null
  }

  const message = [command, ...args].join(' ')

  if (message === 'ember') {
    await explore(context)
  }

  if (message === 'ember inventory') {
    await viewInventory(context)
  }

  if (message === 'ember record') {
    await viewRecord(context)
  }

  if (message === 'ember upgrade') {
    await upgradeItem(context)
  }

  if (message.startsWith('ember drop')) {
    await deleteItem(context, args)
  }

  if (message.startsWith('ember equip')) {
    await updateItem(context, args)
  }

  if (message === 'ember help') {
    return message.channel.send(
      new RichEmbed()
        .addField('.ember', 'Explore the depths of...')
        .addField('.ember equip <item>', 'Equips the specified item.')
        .addField('.ember drop <item>', 'Sells the specified item.')
        .addField('.ember upgrade', 'Performs an enhancement/upgrade to the item currently equipped.')
        .addField('.ember inventory', 'Displays your current inventory and status.')
        .addField('.ember record', 'Displays the darkest weapon recorded and identified by the Fire Keeper.'),
    )
  }
}

module.exports = listen
