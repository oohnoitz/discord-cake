const { explore, viewInventory, deleteItem, updateItem } = require('./actions')

async function listen(message) {
  if (message.content === '!ember') {
    await explore(message)
  }

  if (message.content === '!ember inventory') {
    await viewInventory(message)
  }

  if (message.content.startsWith('!ember drop')) {
    await deleteItem(message)
  }

  if (message.content.startsWith('!ember equip')) {
    await updateItem(message)
  }
}

module.exports = listen
