const _ = require('lodash')
const dateFns = require('date-fns')
const { RichEmbed } = require('discord.js')
const { Config, User } = require('../../database')

// CAKE GAME
const CAKE = '🍰'
const COOLDOWN = 10

function generateCurrency() {
  const chance = _.random(1, 100)

  return chance > 90 ? _.random(101, 150) : _.random(2, 100)
}

async function getUserProfile(user) {
  return User.findOne({ uuid: user.id }).exec()
}

async function setCurrency(user, amount, updateTime = true) {
  const update = {
    $inc: { 'currency.amount': amount },
  }

  if (updateTime) {
    update.$set = { 'currency.next': dateFns.addMinutes(new Date(), COOLDOWN) }
  }

  await User.findOneAndUpdate(
    { uuid: user.id },
    { ...update },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).exec()

  await Config.findOneAndUpdate(
    { name: 'Default' },
    {
      $inc: { 'currency.given': amount },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).exec()

  return true
}

async function getCurrency(context) {
  const { author } = context

  const user = await getUserProfile(author)
  const currency = _.get(user, 'currency.amount', 0)

  return context.channel.send(
    new RichEmbed().setDescription(
      currency === 0
        ? `Sorry ${author}, you don't have any ${CAKE}!`
        : `${author}, you current have ${user.currency.amount} ${CAKE}!`,
    ),
  )
}

async function giveCurrency(context) {
  const { author } = context

  const user = await getUserProfile(author)
  const isGreedy = user && dateFns.isFuture(user.currency.next)
  const amount = generateCurrency()

  if (isGreedy) {
    const countdown = dateFns.distanceInWordsToNow(user.currency.next, { includeSeconds: true })

    return context.channel.send(
      new RichEmbed().setDescription(
        `Don't be greedy ${author}. You can only ask for ${CAKE} ones every ${COOLDOWN} minutes. The next time you can ask for ${CAKE} is in ${countdown}.`,
      ),
    )
  }

  await setCurrency(author, amount)

  return context.channel.send(
    new RichEmbed().setDescription(
      `Okay ${author}, I'll give you some ${CAKE}.\nBased ${author}. ${amount} ${CAKE} GET!!`,
    ),
  )
}

module.exports = {
  getCurrency,
  setCurrency,
  giveCurrency,
}
