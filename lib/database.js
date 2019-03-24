const mongoose = require('mongoose')
const { Schema } = mongoose

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })

const ItemSchema = new Schema({
  name: { type: String },
  isAllSeeing: { type: Boolean, default: false },
  isImbued: { type: Boolean, default: false },
  isSoulless: { type: Boolean, default: false },
  enhancement: { type: Number, default: 0 },
  value: { type: Number, default: 0 },
})

const UserSchema = new Schema({
  uuid: { type: String },
  darkSouls: {
    equipment: { type: String, default: 'Bare Hands' },
    inventory: [ItemSchema],
    inventorySize: { type: Number, default: 10 },
    logs: [],
  },
  currency: {
    amount: { type: Number, default: 0 },
    next: { type: Date },
  },
})

const ConfigSchema = new Schema({
  name: { type: String },
  currency: {
    given: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
  },
  darkSouls: {
    limit: { type: Number, default: 1000 },
    score: { type: Number, default: 0 },
    user: { type: String },
    item: { type: String },
  },
})

module.exports = {
  Config: mongoose.model('Config', ConfigSchema),
  Item: mongoose.model('Item', ItemSchema),
  User: mongoose.model('User', UserSchema),
}
