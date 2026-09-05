const express = require('express');
const router = express.Router();

// Define a sample route
router.get('/', (req, res) => {
    res.send('Welcome to the Node Docker App!');
});

// Additional routes can be defined here

module.exports = router;