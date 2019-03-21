const PLUGINS = [
  {
    name: 'cake',
    listen: require('./cake'),
  },
  {
    name: 'ember',
    listen: require('./ember'),
  },
]

async function run(message) {
  PLUGINS.forEach(plugin => plugin.listen(message))
}

module.exports = run
