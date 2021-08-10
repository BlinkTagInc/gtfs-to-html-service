import {readdir} from 'node:fs/promises';

export default async request => {
    const templates = await readdir(process.env.TEMPLATE_DIR)
    const response = {
        templates: templates.map(t => ({ name: t }))
    }
    return JSON.stringify(response)
}
  