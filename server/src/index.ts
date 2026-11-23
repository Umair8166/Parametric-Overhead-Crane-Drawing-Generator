import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, () => {
  console.log(`Crane drawing generator running at http://localhost:${PORT}`);
});

