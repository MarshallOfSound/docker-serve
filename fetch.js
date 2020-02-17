const Rtorrent = require ('@electorrent/node-rtorrent');
const crypto = require('crypto');
const fs = require('fs');
const got = require('got').default;
const mkdirp = require('mkdirp');
const path = require('path');
const progress = require('progress-stream');
const { promisify } = require('util');

const pipeline = promisify(require('stream').pipeline);

const BASE_URL = process.env.SERVE_URL;

const CRYPTO_SECRET = process.env.CRYPTO_KEY || 'notsafe';
const CRYPTO_KEY = crypto.scryptSync(CRYPTO_SECRET, 'salt', 16);

const chunks = [];
got.stream(`${BASE_URL}/l`, {
  username: process.env.SERVE_USER,
  password: process.env.SERVE_PASSWORD,
}).pipe(crypto.createDecipher('aes128', CRYPTO_KEY)).on('data', (chunk) => {
  chunks.push(chunk);
}).on('end', () => {
  const {paths,real} = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  const rtorrent = new Rtorrent({
    mode: 'xmlrpc',
    host: process.env.RT_URL,
    port: 443,
    path: '/RPC2',
    user: process.env.SERVE_USER,
    pass: process.env.SERVE_PASSWORD,
    ssl: true,
    timeout: 30000
  });

  console.log('Phoning in to rtorrent');
  rtorrent.getAll(function (err, data) {
      if (err) return console.log('err: ', err);

      const pathsToFetch = [];
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const r = real[i];
        const torrent = data.torrents.find(t => r.includes(t.name));
        if (!torrent || torrent.complete) {
          pathsToFetch.push(p);
        } else {
          console.log('Skipping in-progress:', p);
        }
      }

      downloadMissing(pathsToFetch)
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
  });
});

const syncDirs = process.env.SYNC_DIRS.split(',');

function twoDP(n) {
  return `${Math.round(n * 100) / 100}`;
}

async function downloadMissing(paths) {
  const baseDir = process.env.BASE_FETCH_PATH || '/media';
  for (const p of paths) {
    if (!syncDirs.includes(p.split('/')[0])) continue;

    const resolved = path.resolve(baseDir, p);
    if (!fs.existsSync(resolved)) {
      console.log('Downloading missing file:', p);
      await mkdirp(path.dirname(resolved));
      const { body } = await got.get(`${BASE_URL}/s/${encodeURIComponent(p)}`, {
        username: process.env.SERVE_USER,
        password: process.env.SERVE_PASSWORD
      });
      const { size } = JSON.parse(body);
      const progresStream = progress({
        length: size,
        time: 20000,
      });
      progresStream.on('progress', (p) => {
        console.log('Progress:', `${twoDP(p.percentage)}%`, ' - Rate:', `${twoDP(p.speed/1024/1024)} MB/s`);
      });
      if (fs.existsSync(resolved + '.servetmp')) {
        fs.unlinkSync(resolved + '.servetmp');
      }
      await pipeline(
        got.stream(`${BASE_URL}/d/${encodeURIComponent(p)}`, {
          username: process.env.SERVE_USER,
          password: process.env.SERVE_PASSWORD
        }),
        crypto.createDecipher('aes128', CRYPTO_KEY),
        progresStream,
        fs.createWriteStream(resolved + '.servetmp')
      );
      fs.renameSync(resolved + '.servetmp', resolved);
    }
  }
}