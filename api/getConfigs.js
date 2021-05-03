const fs = require('fs-extra')

module.exports = request => {
    const configs = fs.readdirSync(process.env.CONFIG_DIR)
    const response = {
        configs
    }
    return JSON.stringify(response)
}
  