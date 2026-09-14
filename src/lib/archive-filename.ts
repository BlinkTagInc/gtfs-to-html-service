// The generator's agency list is comma-separated; punctuation becomes a
// separator so concatenated names are safe on common filesystems.
export const archiveFilename = (agencies: string) => {
  const slug = agencies
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  let name = '';
  const encoder = new TextEncoder();
  for (const character of slug) {
    if (encoder.encode(name + character).length > 160) {
      break;
    }
    name += character;
  }
  name = name.replace(/-+$/, '');
  return name ? `${name}-timetables.zip` : 'timetables.zip';
};

export const archiveDisposition = (filename: string) => {
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  const fallback = /^[a-z0-9-]+\.zip$/.test(filename)
    ? filename
    : 'timetables.zip';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};
