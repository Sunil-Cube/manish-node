var express = require('express');
var router = express.Router();
var mobileController = require('../controller/mobile');
var verifyToken = require('../../middleware/verifyToken.js');



/* route information */
router.post('/login',mobileController.login); 
router.get('/list_user',verifyToken,mobileController.list_user);
//router.get('/list_user',mobileController.list_user);
router.post('/add_user',verifyToken,mobileController.add_user);
router.post('/edit_user',verifyToken,mobileController.edit_user);

router.get('/delete_user/:id',mobileController.delete_user);
router.get('/list_user_pagination',mobileController.list_user_pagination);


module.exports = router;
