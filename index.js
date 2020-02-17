const crypto = require('crypto');
const fast = require('fastify')();
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const url = require('url');

const basePath = process.env.BASE_SERVE_PATH || path.resolve('/servedata');
const CRYPTO_SECRET = process.env.CRYPTO_KEY || 'notsafe';
const CRYPTO_KEY = crypto.scryptSync(CRYPTO_SECRET, 'salt', 16);

fast.get('/l', async (req, reply) => {
  const paths = glob.sync('**/*', {
    cwd: basePath,
    nodir: true,
  });
  const cipher = crypto.createCipher('aes128', CRYPTO_KEY);
  const real = [];
  for (const p of paths) {
    real.push(path.relative(basePath, fs.realpathSync(path.resolve(basePath, p))));
  }
  reply.send(Buffer.concat([cipher.update(Buffer.from(JSON.stringify({paths,real}))), cipher.final()]));
});

fast.get('/s/*', (req, reply) => {
  const parsed = url.parse(req.req.url);
  const targetPath = path.resolve(basePath, decodeURIComponent(parsed.pathname).substr(3));
  if (!targetPath.startsWith(basePath)) return reply.status(400).send();
  if (!fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) return reply.status(404).send();
  reply.send({
    size: fs.statSync(targetPath).size,
  });
});

fast.get('/d/*', (req, reply) => {
  const parsed = url.parse(req.req.url);
  const targetPath = path.resolve(basePath, decodeURIComponent(parsed.pathname).substr(3));
  if (!targetPath.startsWith(basePath)) return reply.status(400).send();
  if (!fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) return reply.status(404).send();
  reply.send(fs.createReadStream(targetPath).pipe(crypto.createCipher('aes128', CRYPTO_KEY)));
});

fast.listen(process.env.PORT || 8085)