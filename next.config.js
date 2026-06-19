const path = require('path');
const fs = require('fs');

// Resolve the real (non-symlinked) path to gtfs-to-html so that pnpm's
// virtual store files are included in the Vercel deployment bundle at the
// exact path the library resolves at runtime.
const gtfsToHtmlRoot = path.resolve(
  path.dirname(fs.realpathSync(require.resolve('gtfs-to-html'))),
  '..',
);
const rel = (p) => './' + path.relative(process.cwd(), p);

const nextConfig = {
  outputFileTracingIncludes: {
    '/api/**': [
      rel(path.join(gtfsToHtmlRoot, 'dist/browser')) + '/**',
      rel(path.join(gtfsToHtmlRoot, 'views/default')) + '/**',
    ],
  },
  serverExternalPackages: [
    'gtfs-to-html',
    'gtfs',
    'better-sqlite3',
    'puppeteer',
  ],
};

module.exports = nextConfig;
