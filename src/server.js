const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8090;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hermes-alphaclaw-site' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Hermes site listening on port ${port}`);
});
