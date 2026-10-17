// Test-only child: real process restarts against the parent's temporary database.
const mongoose = require('mongoose');
const { app } = require('../app');
let server;
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  server = app.listen(0, () => process.send({ port: server.address().port }));
})().catch(() => process.exit(1));
process.on('SIGTERM', async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
});
