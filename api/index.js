const path = require('path');
const express = require('express');
const app = require('../server');

app.use(express.static(path.join(__dirname, '..', 'dist')));

module.exports = app;
