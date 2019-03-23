const _ = require('lodash')
const { RichEmbed } = require('discord.js')
const { Config, User } = require('../../database')
const client = require('../../../client')

const CAKE = '🍰'
const DATA = require('./data')
const DEFAULT_FEE = 50
const DEFAULT_WEAPON = 'Bare Hands'

const message = description => new RichEmbed().setDescription(description)
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

async function getUserProfile(user) {
  return User.findOne({ uuid: user.id }).exec()
}

async function updateUserEquipmentItem(user, item) {
  return User.findOneAndUpdate(
    { uuid: user.id },
    {
      $set: { 'darkSouls.equipment': item },
    },
    { multi: true, new: true },
  ).exec()
}

async function removeUserInventoryItem(user, item) {
  return User.findOneAndUpdate(
    { uuid: user.id },
    {
      $pull: { 'darkSouls.inventory': { name: item } },
    },
    { multi: true, new: true },
  ).exec()
}

async function updateUserVictory(user, { config, update }) {
  await User.findOneAndUpdate(
    { uuid: user.id },
    { ...update },
    { multi: true, upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec()

  await Config.findOneAndUpdate(
    { name: 'Default' },
    { ...config },
    { multi: true, upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec()

  return true
}

async function updateUserLoss(user, { equipment, encounter }) {
  await User.findOneAndUpdate(
    { uuid: user.id },
    {
      $push: {
        'darkSouls.logs': {
          name: encounter.name,
          date: new Date(),
          item: equipment,
          location: encounter.location,
          isWin: false,
        },
      },
    },
    { multi: true, upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec()
}

async function getConfig() {
  const record = await Config.findOne({ name: 'Default' }).exec()

  return _.get(record, 'darkSouls', {
    limit: 0,
    score: 0,
  })
}

function getItemInput(args) {
  const [_command, ...item] = args

  return item.join(' ').toLowerCase()
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
  const location = _.sample(DATA.LOCATIONS)
  const equipment = getEquippedWeapon(user)
  const roll = random(100)

  if (roll > 90) {
    return {
      name: _.sample(DATA.BOSSES),
      location,
      isBoss: true,
      isEquipped: random(100) <= 30,
    }
  }

  if (roll > 20 || equipment.isAllSeeing) {
    return {
      name: _.sample(DATA.ENEMIES),
      location,
      isBoss: false,
      isEquipped: random(100) <= 30,
    }
  }

  return { location }
}

function getLoot(user, encounter, config) {
  const { isBoss } = encounter
  const inventory = getInventory(user)
  const equipment = getEquippedWeapon(user)
  const chance = random(1000)
  const configUpdate = { $set: {} }
  const update = {
    $set: {},
    $push: {
      'darkSouls.logs': {
        name: encounter.name,
        date: new Date(),
        item: equipment,
        location: encounter.location,
        isWin: true,
      },
    },
  }

  if (chance <= 10 && !equipment.isAllSeeing) {
    update.$pull = { 'darkSouls.inventory': { name: equipment.name } }
    update.$push = {
      ...update.$push,
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

  if (chance <= 20 && equipment.name !== DEFAULT_WEAPON) {
    lootLog.push(
      `You scavenged its soul and found a **Soulless ${lootWeapon}**...`,
      `The weapon is Soulless! Its unfathomable essence empowers you, increasing Vitality and Endurance!`,
    )

    lootKeep = true
    update.$set[`darkSouls.inventorySize`] = inventory.size + 10
    update.$push = {
      ...update.$push,
      'darkSouls.inventory': {
        name: `Soulless ${lootWeapon}`,
        value: 0,
        isAllSeeing: false,
        isImbued: isBoss,
        isSoulless: true,
      },
    }
  } else {
    lootLog.push(`You scavenged its soul and found a **${lootWeapon}**.`)

    if (inventory.total + 1 > inventory.size) {
      lootLog.push(`But you were overburdened, so it was left behind...`)
    } else {
      lootLog.push(`It was materialized with **${lootValue.toLocaleString()}** Souls...`)

      lootKeep = true
      update.$push = {
        ...update.$push,
        'darkSouls.inventory': {
          name: lootWeapon,
          value: lootValue,
          isAllSeeing: false,
          isImbued: isBoss,
          isSoulless: false,
        },
      }
    }
  }

  const updateSoulLimit = lootValue > config.limit * 0.9

  configUpdate.$set[`darkSouls.limit`] = updateSoulLimit ? Math.ceil(config.limit * 1.2) : config.limit

  if (lootKeep && lootValue > config.score) {
    lootLog.push(
      ``,
      `The Fire Keeper identifies your **${lootWeapon}** as the darkest of them all... Treasure it well...`,
    )

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

function renderFormula(chances) {
  return chances
    .filter(({ apply }) => apply)
    .reduce(
      (roll, chance) => {
        switch (chance.operator) {
          case '+':
            return [...roll, '+', chance.value]
          case '-':
            return [...roll, '-', chance.value]
          case '/':
            return [...roll, '/', chance.value]
          case '=':
            return [chance.value]
          default:
            return roll
        }
      },
      [0],
    )
}

function calculateFormula(chances) {
  return chances
    .filter(({ apply }) => apply)
    .reduce((roll, chance) => {
      switch (chance.operator) {
        case '+':
          return roll + chance.value
        case '-':
          return roll - chance.value
        case '/':
          return roll / chance.value
        case '=':
          return chance.value
        default:
          return roll
      }
    }, 0)
}

function isWinRoll(chances, winChance) {
  return chances.some(chance => chance >= winChance)
}

function calculateWinChance(user, encounter, record) {
  const { isBoss, isEquipped } = encounter
  const equipment = getEquippedWeapon(user)
  const applySoulBonus = equipment.value > record * 0.7
  const applySoulCount = equipment.value < record * 0.3 && equipment.value > 0

  const chances = [
    {
      apply: true, // BASE
      value: isBoss ? 14 : 50,
      operator: '+',
    },
    {
      apply: equipment.isImbued,
      value: isBoss ? 10 : 14,
      operator: '+',
    },
    {
      apply: applySoulBonus,
      value: isBoss ? 6 : 20,
      operator: '+',
    },
    {
      apply: equipment.isSoulless,
      value: isBoss ? 8 : 0,
      operator: '+',
    },
    {
      apply: applySoulCount,
      value: isBoss ? 8 : 10,
      operator: '-',
    },
    {
      apply: equipment.name === DEFAULT_WEAPON,
      value: isBoss ? 4 : 30,
      operator: '=',
    },
    {
      apply: isEquipped,
      value: 2,
      operator: '/',
    },
  ]

  return {
    roll: calculateFormula(chances),
    math: renderFormula(chances),
  }
}

function findInventoryItem(inventory, item) {
  return inventory.items.find(({ name }) => name.toLowerCase() == item.toLowerCase())
}

async function explore(context) {
  const { author } = context

  const user = await getUserProfile(author)
  const inventory = getInventory(user)

  if (inventory.total > inventory.size) {
    return context.channel.send(
      message(
        `${author}, you are encumbered right now. You can't explore any further until you've dropped some weapons.`,
      ),
    )
  }

  if (await isUnableToPlay(user)) {
    return context.channel.send(
      message(`Sorry ${author}. It costs ${DEFAULT_FEE} ${CAKE} to be embered. Please try again later!`).setColor(
        0xff0000,
      ),
    )
  }

  const equipment = getEquippedWeapon(user)
  const encounter = getEncounter()
  const adventureLog = [
    `${author}, you've been reborn and prepared to die.`,
    `You ventured into the depths of **${encounter.location}**.`,
    ``,
    `...`,
    ``,
  ]

  if (!encounter.name) {
    adventureLog.push(`${author} wasn't lucky and couldn't find any enemies!`)

    return context.channel.send(message(adventureLog.join('\n')).setColor(0xff0000))
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

  if (encounter.isEquipped) {
    const enemyEquipment = _.sample(DATA.WEAPONS)

    adventureLog.push(`Not good! The enemey is using a **${enemyEquipment}**! It'll be hard to kill!`, ``)
  }

  const { limit, score } = await getConfig()
  const { roll: winChance, math: winFormula } = calculateWinChance(user, encounter, score)
  const rolls = [100 - random(100)]
  let isVictory = false

  if (isWinRoll(rolls, winChance)) {
    isVictory = true
  } else if (equipment.isSoulless && equipment.name !== DEFAULT_WEAPON) {
    adventureLog.push(`You missed the enemy, but the Soulless essence allows you to attack again!`)
    rolls.push(100 - random(100))

    isVictory = isWinRoll(rolls, winChance)
  }

  if (isVictory) {
    const { lootLog, update, configUpdate } = getLoot(user, encounter, { limit, score })

    await updateUserVictory(author, { config: configUpdate, update })
    adventureLog.push(``, `You've defeated **${encounter.name}**!`, ...lootLog)
  } else {
    await updateUserLoss(user, { equipment, encounter })
    adventureLog.push(``, `*${author} DIED!*`)
  }

  return context.channel.send(
    message(adventureLog.join('\n'))
      .setColor(isVictory ? 0x008000 : 0xff0000)
      .setFooter(`Roll: ${rolls.join(', ')} | Chance: ${winFormula.join(' ')} = ${winChance}`),
  )
}

async function deleteItem(context, args) {
  const { author } = context

  const user = await getUserProfile(author)
  const inventory = getInventory(user)

  if (inventory.total === 0) {
    return context.channel.send(message(`You don't have any weapons to drop...`))
  }

  const item = getItemInput(args)
  const equipment = findInventoryItem(inventory, item)

  if (!equipment) {
    return context.channel.send(message(`You don't have that item in your inventory!`))
  }

  if (user.darkSouls.equipment === equipment.name) {
    await updateUserEquipmentItem(author, DEFAULT_WEAPON)
  }

  await removeUserInventoryItem(author, equipment.name)

  return context.channel.send(message(`You've dropped your **${equipment.name}**.`))
}

async function updateItem(context, args) {
  const { author } = context

  const user = await getUserProfile(author)
  const inventory = getInventory(user)

  if (inventory.total === 0) {
    return context.channel.send(message(`You don't have any weapons to equip...`))
  }

  const item = getItemInput(args)
  const equipment = findInventoryItem(inventory, item)
  const isBareHanded =
    user.darkSouls.equipment.toLowerCase() === item.toLowerCase() && item.toLowerCase() === DEFAULT_WEAPON.toLowerCase()

  if (isBareHanded) {
    return context.channel.send(message(`You're already using your **${DEFAULT_WEAPON}**!`))
  }

  const useBareHands = item.toLowerCase() === DEFAULT_WEAPON.toLowerCase()

  if (useBareHands) {
    await updateUserEquipmentItem(author, DEFAULT_WEAPON)

    return context.channel.send(message(`You've unequipped your **${user.darkSouls.equipment}**!`))
  }

  if (!equipment) {
    return context.channel.send(message(`You don't have that item in your inventory!`))
  }

  if (user.darkSouls.equipment === equipment.name) {
    return context.channel.send(message(`You already have that weapon equipped!`))
  }

  await updateUserEquipmentItem(author, equipment.name)

  return context.channel.send(message(`You successfully equipped the **${equipment.name}**.`))
}

async function viewInventory(context) {
  const { author } = context

  const user = await getUserProfile(author)
  const inventory = getInventory(user)
  const equipment = getEquippedWeapon(user)
  const currency = _.get(user, 'currency.amount', 0)

  return context.channel.send(
    new RichEmbed()
      .addField('Equipment', `${equipment.name} (${equipment.value.toLocaleString()})`, true)
      .addField(
        'Inventory',
        inventory.items.map(item => `${item.name} (${item.value.toLocaleString()})`).join('\n') || 'Empty',
        true,
      )
      .addField('Weight', `${inventory.total} / ${inventory.size}`, true)
      .addField('Wallet', `${currency} ${CAKE}`, true),
  )
}

async function viewRecord(context) {
  const config = await Config.findOne({ name: 'Default' }).exec()
  const record = _.get(config, 'darkSouls', {
    score: 0,
    item: null,
    user: null,
  })

  if (record.score === 0) {
    return null
  }

  const user = client.users.get(record.user)

  return context.channel.send(
    message(
      `${user} possesses the **${record.item}**, the darkest weapon in existence materialized from ${
        record.score
      } Souls.`,
    ),
  )
}

module.exports = {
  explore,
  deleteItem,
  updateItem,
  viewInventory,
  viewRecord,
}
