import {readdir} from 'node:fs/promises';

module.exports = request => {
    const templates = readdir(process.env.TEMPLATE_DIR).map((file) => {
        return {
            name: file
        }
    });
    const response = {
        templates
    }
    return JSON.stringify(response)
}
  