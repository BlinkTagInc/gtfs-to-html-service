import {readdir} from 'node:fs/promises';

module.exports = request => {
    const configs = readdir(process.env.CONFIG_DIR)
    const response = {
        configs
    }
    return JSON.stringify(response)
}
  