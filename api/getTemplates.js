const fs = require('fs-extra')
const path = require('path')

module.exports = request => {
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
  