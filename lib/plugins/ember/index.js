const { explore, viewInventory, viewRecord, deleteItem, updateItem } = require('./actions')

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

  if (message.content.startsWith('ember drop')) {
    await deleteItem(context)
  }

  if (message.content.startsWith('ember equip')) {
    await updateItem(context)
  }
}

module.exports = listen
