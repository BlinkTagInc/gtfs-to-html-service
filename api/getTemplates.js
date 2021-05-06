const fs = require('fs-extra')
const path = require('path')

module.exports = request => {
    console.log('Annie F 05-06-2021 process.env.TEMPLATE_DIR: ', process.env.TEMPLATE_DIR)
    const templates = fs.readdirSync(process.env.TEMPLATE_DIR).map((file) => {
        return {
            name: file,
            fullPath: path.join(process.env.TEMPLATE_DIR, file),
        }
    });
    const response = {
        templates
    }
    return JSON.stringify(response)
}
  