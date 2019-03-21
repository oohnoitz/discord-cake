const _ = require('lodash')
const { RichEmbed } = require('discord.js')
const { Config, User } = require('../../database')

const DATA = require('./data')
const DEFAULT_FEE = 50
const DEFAULT_WEAPON = 'Bare Hands'

const random = max => _.random(1, max)

async function isUnableToPlay(user) {
  const currency = _.get(user, 'currency.amount', 0)

  if (currency >= DEFAULT_FEE) {
    await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { 'currency.amount': -DEFAULT_FEE } },
      { multi: true, upsert: true },
    ).exec()

    await Config.findOneAndUpdate(
      { name: 'Default' },
      { $inc: { 'currency.spent': DEFAULT_FEE } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).exec()

    return false
  }

  return true
}

async function getConfig() {
  const record = await Config.findOne({ name: 'Default' }).exec()

  return _.get(record, 'darkSouls', {
    limit: 0,
    score: 0,
  })
}

function getEquippedWeapon(user) {
  const equipment = _.get(user, 'darkSouls.equipment', DEFAULT_WEAPON)
  const inventory = _.get(user, 'darkSouls.inventory', [])
  const weapon = inventory.find(item => item.name === equipment)

  return _.defaults(weapon, {
    name: DEFAULT_WEAPON,
    isAllSeeing: false,
    isImbued: false,
    isSoulless: false,
    value: 0,
  })
}

function getItemInput(content) {
  return content
    .split(' ')
    .slice(2)
    .join(' ')
}

function getInventory(user) {
  const items = _.get(user, 'darkSouls.inventory', [])
  const total = items.length
  const size = _.get(user, 'darkSouls.inventorySize', 10)

  return {
    items,
    total,
    size,
  }
}

function getEncounter(user) {
  const equipment = getEquippedWeapon(user)
  const roll = random(100)

  if (roll > 90) {
    return {
      isBoss: true,
      isEquiped: random(100) <= 30,
      name: _.sample(DATA.BOSSES),
    }
  }

  if (roll > 20 || equipment.isAllSeeing) {
    return {
      isBoss: false,
      isEquiped: random(100) <= 30,
      name: _.sample(DATA.ENEMIES),
    }
  }

  return null
}

function getLoot(user, encounter, config) {
  const { isBoss } = encounter
  const chance = random(1000)
  const configUpdate = { $set: {} }
  const update = { $set: {} }
  const inventory = getInventory(user)
  const equipment = getEquippedWeapon(user)

  if (chance <= 10 && !equipment.isAllSeeing) {
    update.$pull = { 'darkSouls.inventory': { name: equipment.name } }
    update.$push = {
      'darkSouls.inventory': {
        ...equipment,
        name: `All-Seeing ${equipment}`,
        isAllSeeing: true,
      },
    }

    return {
      lootLog: [
        `The remains of the enemy manifests into an All-Seeing spirit...`,
        `It merges into your weapon and bestows the wielder with foresight...`,
      ],
      update,
      configUpdate,
    }
  }

  if (chance <= 10 && equipment.isAllSeeing) {
    return {
      lootLog: [
        `The remains of the enemy manifests into an All-Seeing spirit...`,
        `However, your weapon is already possessed by one...`,
      ],
      update,
      configUpdate,
    }
  }

  const lootLog = []
  const lootValue = random(config.limit)
  let lootKeep = false
  let lootWeapon = _.compact([isBoss ? _.sample(DATA.WEAPONS_PREFIX) : null, _.sample(DATA.WEAPONS)]).join(' ')

  if (chance <= 20) {
    lootKeep = true
    lootLog.push(
      `You scavenged its soul and found a Soulless ${lootWeapon}...`,
      `The weapon is Soulless! Its unfathomable essence empowers you, increasing Vitality and Endurance!`,
    )

    update.$set[`darkSouls.inventorySize`] = inventory.size + 10
    update.$push = {}
    update.$push[`darkSouls.inventory`] = {
      name: `Soulless ${lootWeapon}`,
      value: lootValue,
      isAllSeeing: false,
      isImbued: isBoss,
      isSoulless: true,
    }
  } else {
    lootLog.push(`You scavenged its soul and found a ${lootWeapon}.`)

    if (inventory.total + 1 > inventory.size) {
      lootLog.push(`But you were overburdened, so it was left behind...`)
    } else {
      lootKeep = true
      lootLog.push(`It was materialized with ${lootValue} Souls...`)

      update.$push = {}
      update.$push[`darkSouls.inventory`] = {
        name: lootWeapon,
        value: lootValue,
        isAllSeeing: false,
        isImbued: isBoss,
        isSoulless: false,
      }
    }
  }

  if (lootKeep && lootValue > config.limit) {
    configUpdate.$set[`darkSouls.limit`] = lootValue > config.limit * 0.9 ? Math.ceil(config.limit * 1.2) : config.limit
  }

  if (lootKeep && lootValue > config.score) {
    lootLog.push(``, `The Fire Keeper identifies your ${lootWeapon} as the darkest of them all... Treasure it well...`)

    configUpdate.$set[`darkSouls.score`] = lootValue
    configUpdate.$set[`darkSouls.item`] = lootWeapon
    configUpdate.$set[`darkSouls.user`] = user.uuid
  }

  return {
    lootLog,
    update,
    configUpdate,
  }
}

function calculateWinChance(user, encounter, record) {
  const { isBoss } = encounter
  const equipment = getEquippedWeapon(user)
  const applySoulBonus = equipment.value > record * 0.6
  const applySoulCount = equipment.value < record * 0.3 && equipment.value > 0

  return (
    _.sumBy(
      [
        {
          include: true, // BASE
          value: isBoss ? 14 : 50,
        },
        {
          include: equipment.isImbued,
          value: isBoss ? 10 : 14,
        },
        {
          include: applySoulBonus,
          value: isBoss ? 8 : 0,
        },
        {
          include: applySoulCount,
          value: isBoss ? -8 : -10,
        },
        {
          include: equipment.name === DEFAULT_WEAPON,
          value: isBoss ? 4 : 30,
        },
      ],
      'value',
    ) / 2
  )
}

function findInventoryItem(inventory, item) {
  return inventory.items.find(({ name }) => name.toLowerCase() == item.toLowerCase())
}

async function explore(context) {
  const { author } = context

  const user = await User.findOne({ uuid: author.id }).exec()
  const inventory = getInventory(user)

  if (inventory.total > inventory.size) {
    const message = new RichEmbed().setDescription(
      `${author}, you are encumbered right now. You can't explore any further until you've dropped some weapons.`,
    )

    return context.channel.send(message)
  }

  if (await isUnableToPlay(user)) {
    const message = new RichEmbed()
      .setDescription(`Sorry ${author}. It costs ${DEFAULT_FEE} Cakes to be embered. Please try again later!`)
      .setColor(0xff0000)

    return context.channel.send(message)
  }

  const location = _.sample(DATA.LOCATIONS)
  const equipment = getEquippedWeapon(user)
  const encounter = getEncounter()
  const adventureLog = [
    `${author}, you've been reborn and prepared to die.`,
    `You ventured into the depths of **${location}**.`,
    ``,
    `...`,
    ``,
  ]

  if (!encounter) {
    adventureLog.push(`${author} wasn't lucky and couldn't find any enemies!`)

    const message = new RichEmbed().setDescription(adventureLog.join('\n')).setColor(0xff0000)

    return context.channel.send(message)
  }

  if (encounter.isBoss) {
    adventureLog.push(
      `Boss encountered!`,
      `You've engaged in battle against **${encounter.name}**.`,
      `You attempt to fight against the boss using **${equipment.name}**!`,
      ``,
    )
  } else {
    adventureLog.push(
      `Enemy encountered!`,
      `You've engaged in battle against **${encounter.name}**.`,
      `You attempt to fight against the enemy using **${equipment.name}**!`,
      ``,
    )
  }

  if (encounter.isEquiped) {
    const enemyEquipment = _.sample(DATA.WEAPONS)

    adventureLog.push(`Not good! The enemey is using a **${enemyEquipment}**! It'll be hard to kill!`, ``)
  }

  const { limit, score } = await getConfig()
  const winChance = calculateWinChance(user, encounter, score)
  let isVictory = false

  if (random(100) <= winChance) {
    isVictory = true
  } else if (equipment.isSoulless && equipment.name !== DEFAULT_WEAPON) {
    adventureLog.push(`You missed the enemy, but the Soulless essence allows you to attack again!`)

    isVictory = random(100) <= winChance
  }

  if (isVictory) {
    const { lootLog, update, configUpdate } = getLoot(user, encounter, { limit, score })

    adventureLog.push(``, `You've defeated **${encounter.name}**!`, ...lootLog)

    await Config.findOneAndUpdate(
      { name: 'Default' },
      { ...configUpdate },
      { multi: true, upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec()

    await User.findOneAndUpdate(
      { uuid: author.id },
      { ...update },
      { multi: true, upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec()
  } else {
    adventureLog.push(``, `*${author} DIED!*`)
  }

  const message = new RichEmbed().setDescription(adventureLog.join('\n')).setColor(isVictory ? 0x00ff00 : 0xff0000)

  return context.channel.send(message)
}

async function deleteItem(context) {
  const { author, content } = context

  const user = await User.findOne({ uuid: author.id }).exec()
  const inventory = getInventory(user)

  if (inventory.total === 0) {
    const message = new RichEmbed().setDescription(`You don't have any weapons to drop...`)

    return context.channel.send(message)
  }

  const item = getItemInput(content)
  const equipment = findInventoryItem(inventory, item)

  if (!equipment) {
    const message = new RichEmbed().setDescription(`You don't have that item in your inventory!`)

    return context.channel.send(message)
  }

  if (user.darkSouls.equipment === equipment.name) {
    await User.findOneAndUpdate(
      { uuid: author.id },
      {
        $set: { 'darkSouls.equipment': DEFAULT_WEAPON },
      },
      { multi: true },
    ).exec()
  }

  await User.findOneAndUpdate(
    { uuid: author.id },
    {
      $pull: { 'darkSouls.inventory': { name: equipment.name } },
    },
    { multi: true, new: true },
  ).exec()

  const message = new RichEmbed().setDescription(`You've dropped your **${equipment.name}**.`)

  return context.channel.send(message)
}

async function updateItem(context) {
  const { author, content } = context

  const user = await User.findOne({ uuid: author.id }).exec()
  const inventory = getInventory(user)

  if (inventory.total === 0) {
    const message = new RichEmbed().setDescription(`You don't have any weapons to equip...`)

    return context.channel.send(message)
  }

  const item = getItemInput(content)
  const equipment = findInventoryItem(inventory, item)
  const isBareHanded =
    user.darkSouls.equipment.toLowerCase() === item.toLowerCase() && item.toLowerCase() === DEFAULT_WEAPON.toLowerCase()

  if (isBareHanded) {
    const message = new RichEmbed().setDescription(`You're already using your **${DEFAULT_WEAPON}**!`)

    return context.channel.send(message)
  }

  const useBareHands = item.toLowerCase() === DEFAULT_WEAPON.name.toLowerCase()

  if (useBareHands) {
    await User.findOneAndUpdate(
      { uuid: author.id },
      {
        $set: { 'darkSouls.equipment': DEFAULT_WEAPON },
      },
      { multi: true, new: true },
    ).exec()

    const message = new RichEmbed().setDescription(`You've unequipped your **${user.darkSouls.equipment}**!`)

    return context.channel.send(message)
  }

  if (!equipment) {
    const message = new RichEmbed().setDescription(`You don't have that item in your inventory!`)

    return context.channel.send(message)
  }

  if (user.darkSouls.equipment === equipment.name) {
    const message = new RichEmbed().setDescription(`You already have that weapon equipped!`)

    return context.channel.send(message)
  }

  await User.findOneAndUpdate(
    { uuid: author.id },
    {
      $set: { 'darkSouls.equipment': equipment.name },
    },
    { multi: true, new: true },
  ).exec()

  const message = new RichEmbed().setDescription(`You successfully equiped the **${equipment.name}**.`)

  return context.channel.send(message)
}

async function viewInventory(context) {
  const { author } = context

  const user = await User.findOne({ uuid: author.id }).exec()
  const inventory = getInventory(user)
  const equipment = getEquippedWeapon(user)
  const currency = _.get(user, 'currency.amount', 0)

  const message = new RichEmbed()
    .addField('Equipment', `${equipment.name}\n(${equipment.value})`, true)
    .addField('Inventory', inventory.items.map(item => item.name).join('\n'), true)
    .addField('Weight', `${inventory.total} / ${inventory.size}`, true)
    .addField('Wallet', `${currency} Cakes`, true)

  return context.channel.send(message)
}

module.exports = {
  explore,
  deleteItem,
  updateItem,
  viewInventory,
}