import { createApp } from './app.js';
import { openDatabase } from './db.js';

const PORT = Number(process.env.PORT) || 3000;
const db = openDatabase(process.env.DB_PATH);

const server = createApp(db).listen(PORT, () => {
  console.log(`Crane drawing generator running at http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
