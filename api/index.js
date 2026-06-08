const path = require('path');
const fs = require('fs');
const express = require('express');
const app = require('../server');

const root = path.join(__dirname, '..');

app.use(express.static(root));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const html = path.join(root, 'index.html');
  if (fs.existsSync(html)) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(html);
  } else {
    res.status(404).send('Not found');
  }
});

module.exports = app;
