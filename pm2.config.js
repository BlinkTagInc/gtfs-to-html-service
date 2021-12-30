module.exports = {
  apps : [{
    name      : 'gtfs-to-html-service',
    script    : 'server.mjs',
    node_args : '-r dotenv/config'
  }]
}