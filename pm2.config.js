module.exports = {
  apps : [{
    name      : 'gtfs-to-html-service',
    script    : 'server.mjs',
    node_args : ['-r dotenv/config', '--max_old_space_size=4096']
  }]
}