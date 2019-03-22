const mongoose = require('mongoose')
const { Schema } = mongoose

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })

const UserSchema = new Schema({
  uuid: { type: String },
  darkSouls: {
    equipment: { type: String, default: 'Bare Hands' },
    inventory: [],
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
  User: mongoose.model('User', UserSchema),
}
