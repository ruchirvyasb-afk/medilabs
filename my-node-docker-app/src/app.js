const express = require('express');
const app = express();
const routes = require('./routes/index');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Export the app for testing or further configuration
module.exports = app;