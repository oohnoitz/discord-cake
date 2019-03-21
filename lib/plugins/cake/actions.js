const _ = require('lodash')
const dateFns = require('date-fns')
const { RichEmbed } = require('discord.js')
const { Config, User } = require('../../database')

// CAKE GAME
const COOLDOWN = 10

function generateCurrency() {
  const chance = _.random(1, 100)

  return chance > 90 ? _.random(101, 150) : _.random(2, 100)
}

async function getCurrency(context) {
  const { author } = context

  const user = await User.findOne({ uuid: author.id }).exec()
  const currency = _.get(user, 'currency.amount', 0)

  const message = new RichEmbed().setDescription(
    currency === 0
      ? `Sorry ${author}, you don't have any Cakes!`
      : `${author}, you current have ${user.currency.amount} Cake(s)!`,
  )

  return context.channel.send(message)
}

async function giveCurrency(context) {
  const { author } = context

  const userExists = await User.findOne({ uuid: author.id }).exec()
  const isGreedy = userExists && dateFns.isFuture(userExists.currency.next)
  const amount = generateCurrency()

  if (isGreedy) {
    const countdown = dateFns.differenceInMinutes(userExists.currency.next, new Date())
    const message = new RichEmbed().setDescription(
      `Don't be greedy ${author}. You can only ask for cake ones every ${COOLDOWN} minutes. The next time you can ask for Cake is in ${countdown} minutes.`,
    )

    return context.channel.send(message)
  }

  await User.findOneAndUpdate(
    { uuid: author.id },
    {
      $inc: { 'currency.amount': amount },
      $set: { 'currency.next': dateFns.addMinutes(new Date(), COOLDOWN) },
    },
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

  const message = new RichEmbed().setDescription(
    `Okay ${author}, I'll give you some Cake.\nBased ${author}. ${amount} Cakes GET!!`,
  )

  return context.channel.send(message)
}

module.exports = {
  getCurrency,
  giveCurrency,
}