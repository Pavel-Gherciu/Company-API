const express = require('express');
const MatchController = require('../controllers/matchController');

const router = express.Router();
const matchController = new MatchController();

router.post('/search', (req, res) => matchController.search(req, res));
router.post('/match', (req, res) => matchController.match(req, res));
router.post('/batch-match', (req, res) => matchController.batchMatch(req, res));

module.exports = router;
