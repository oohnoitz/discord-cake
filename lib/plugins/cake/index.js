const { getCurrency, giveCurrency } = require('./actions')

async function listen(context, command, args) {
  if (command !== 'cake') {
    return null
  }

  const message = [command, ...args].join(' ')

  if (message === 'cake') {
    await getCurrency(context)
  }

  if (message === 'cake get') {
    await giveCurrency(context)
  }
}

module.exports = listen
