// const express = require('express');
// const router = express.Router();
// // Welcome Page
// router.get('/', (req, res) => res.render('index'));
// module.exports = router;
import express from 'express';
const router = express.Router();
// Welcome Page
router.get('/', (req, res) => res.render('index'));
export default router;
