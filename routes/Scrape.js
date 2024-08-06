const express=require('express');
const router=express.Router();
const {getXml} =require('../controllers/Scrape')
router.get('/scrape',getXml);
module.exports=router;