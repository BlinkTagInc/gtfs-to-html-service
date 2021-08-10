import {readdir} from 'node:fs/promises';

export default async request => {
    const configs = await readdir(process.env.CONFIG_DIR)
    const response = {
        configs
    }
    return JSON.stringify(response)
}
  