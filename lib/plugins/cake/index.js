const { getCurrency, giveCurrency } = require('./actions')

async function listen(message) {
  if (message.content === '!cake') {
    await getCurrency(message)
  }

  if (message.content === '!cake get') {
    await giveCurrency(message)
  }
}

module.exports = listen
