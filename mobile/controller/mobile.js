var crypto = require('crypto');
var util = require('util');
var async = require('async');
var multiparty = require("multiparty");
var fs = require('fs');
var http = require('http');
var url = require('url');
var mysql = require('mysql');
var config = require('../../config/global.js');
var connection = mysql.createConnection(config.database.mySQLConfig);
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var md5 = require("MD5");
var dateTime = require('date-time');
var path = require('path');
var Promise = require('bluebird');
var queryAsync = Promise.promisify(connection.query.bind(connection));
var _ = require('underscore');

function isEmpty(obj) {
    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length && obj.length > 0) return false;
    if (obj.length === 0) return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and toValue enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}
// get host name
function get_hostname(req) {
    var hostname = req.headers.host;
    return hostname;
}

function findAndReplace(string, target, replacement) {
    var i = 0, length = string.length;
    for (i; i < length; i++) {
    string = string.replace(target, replacement);
    }
    return string;
}

var mobile = {

    login: function(req, res, next) 
    {

        req.checkBody('email', 'Email does not appear to be valid').isEmail();
        req.checkBody('password', 'Password is required').notEmpty();

        var errors = req.validationErrors();
        if (errors) {
            return res.status(202).json({ success: '0', message: errors, data: {} });
        } 

        // get variable value
        var login_email = req.body.email;
        var login_password = crypto.createHash('md5').update(req.body.password).digest('hex');

          connection.query("select id,user_type,email,mobile from users where email = ? and password = ?",[login_email,login_password],function(err,result){
       
           if(err)
           {
             return res.status(202).json({ success: '0', message: err, data: {} });
           } 
               
            if (isEmpty(result))
             {
                return res.status(202).json({ success: '0', message: 'Invalid Email or Password.', data: {} });
             }

           var manish_simple = {
                id:result[0]['id'],
                email:result[0]['email'],
                mobile:result[0]['mobile']          
           };  


          var token = jwt.sign(manish_simple,'manish_key', 
              {
                expiresIn: 24600
              });

             var query = "INSERT INTO  ?? SET  ?";
              var table = ["access_token"];
              query = mysql.format(query,table);

            var current_user_id = result[0].id;

            var access_token_data  = 
              {
                user_id:result[0].id,
                device_type:'Android',
                access_token:token,
              }


              connection.query(query, access_token_data, function(err,rows)
              {
                    if(err) {
                        return res.json({"Error" : true, "Message" : "Error executing MySQL query"});
                    } 
                    else 
                    {
                     return res.status(200).json({ success: '1', message: 'Token generated',currUser:current_user_id,token:token});

                    } 
              });

          });

    },

    list_user : function(req, res, next)
    {   
         connection.query("select id,name,email,mobile,user_image,status from users",function(err,result){
              if(err)
              {
                return res.status(202).json({ success: '0', message: 'Something Went Wrong', data: {} });
              }      
             
              if(result.length > 0)
               {
                    _.each(result, function(value,key)
                    {
                        if(value['user_image']!="")
                        {
                            var path = 'http://' + get_hostname(req) + '/uploads/user/' + value['user_image'];    
                            var image_physical_path = './public/uploads/user/' + value['user_image'];

                           if (fs.existsSync(image_physical_path)) 
                              {
                                 value['user_image'] = path;
                              }
                              else{
                                value['user_image'] = '';
                              }

                        }  
                    });
                  return res.status(200).json({ success: '1', message: 'Record List',data:result});    
               } 
              else{
                return res.status(200).json({ success: '1', message: 'No Record Found',data:{}});
              } 
          }); 

    },

    list_user_pagination : function(req, res, next)
    {
          var numRows;
          var queryPagination;
          var numPerPage = parseInt(req.query.npp, 10) || 1;
          var page = parseInt(req.query.page, 10) || 0;
          var numPages;
          var skip = page * numPerPage;

           // Here we compute the LIMIT parameter for MySQL query
           var limit = skip + ',' + numPerPage;

           queryAsync('SELECT count(*) as numRows FROM users')
                .then(function(results) {
                  numRows = results[0].numRows;
                  numPages = Math.ceil(numRows / numPerPage);
                  console.log('number of pages:', numPages);
                })
                .then(() => queryAsync('SELECT * FROM users ORDER BY ID DESC LIMIT ' + limit))
                 .then(function(results) 
                 {

                      _.each(results, function(value,key)
                    {
                       if(value['user_image']!="")
                        {
                              var path = 'http://' + get_hostname(req) + '/uploads/user/' + value['user_image'];    
                              var image_physical_path = './public/uploads/user/' + value['user_image'];

                             if (fs.existsSync(image_physical_path)) 
                                {
                                   value['user_image'] = path;
                                }
                                else{
                                  value['user_image'] = '';
                                }
                        }
                    }); 

                        var responsePayload = {
                          results: results
                        };
                        
                        if (page < numPages) {
                          responsePayload.pagination = {
                            current: page,
                            perPage: numPerPage,
                            previous: page > 0 ? page - 1 : undefined,
                            next: page < numPages - 1 ? page + 1 : undefined
                          }
                        }
                        else responsePayload.pagination = {
                          err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
                        }
                        return res.json(responsePayload);
               })
                 .catch(function(err) {
                    console.error(err);
                    return res.json({ err: err });
              });

    },
    add_user : function(req, res, next)
    {
         var userData = {};

         async.series([
             function (callback) {
              var form = new multiparty.Form();
               form.parse(req, function(err, fields, files) 
               {

                        fields = fields || [];

                        for (var key in fields) {
                            if (fields[key].length === 1) 
                            {
                                fields[key] = fields[key][0];
                            }
                        }

                        req.body = fields;
                        req.files = files;

                        req.checkBody('email', 'Email does not appear to be valid').isEmail();
                        req.checkBody('password', 'Password is required').notEmpty();
                        req.checkBody('gender', 'Gender is required').notEmpty();

                         if(req.body.password!='')
                         {
                           req.checkBody('password', 'Password is minimum lenght 5 is required').isLength({ min: 5 });  
                         }
                        

                    var err_check = req.validationErrors();                        
                    if(err_check)
                    {
                         return res.status(202).json({success:'0',message: err_check,data:{} });
                    }

                    userData.name = req.body.name;
                    userData.email = req.body.email;
                    userData.mobile = req.body.mobile;
                    userData.password = crypto.createHash('md5').update(req.body.password).digest('hex');
                    userData.device_id = req.body.device_id;
                    userData.device_type = req.body.device_type;

                    if(req.body.status=='')
                    {
                      userData.status = "0";  
                    }
                    else{
                       userData.status = req.body.status;  
                    } 
                    
                    userData.gender = req.body.gender;
                    userData.created = dateTime();
                    userData.modified = dateTime();


                   callback();
              });

             },
             function (callback) {
                var email_checker = userData.email;

                connection.query("select count(*) as total_record from users where email=?",[email_checker],function(err,result){
                       if(err)
                        {
                           return res.status(202).json({ success: '0', message: err, data: {} });
                        }

                        if(result[0]['total_record']==0)
                        {
                           callback();  
                        }
                        else{
                            return res.status(202).json({ success: '0', message: 'Email already registered', data: {} });
                       }   
                 });

             }, 
             function (callback) {

                 if(!isEmpty(req.files))
                 {
                     var custom_image = req.files;

                     //var image_name_change = new Date().getTime() + findAndReplace(custom_image.file[0]['originalFilename']," ","_"); 
                     
                    var image_name_change = new Date().getTime()+path.extname(custom_image.file[0]['originalFilename']); 

                     var image_temp_path = custom_image.file[0]['path'];

                     //console.log(path.extname(custom_image.file[0]['originalFilename']));

                        fs.readFile(image_temp_path,function(errr,data1){
                           var image_physical_path = './public/uploads/user/' + image_name_change;
                                
                          fs.writeFile(image_physical_path,data1,function(error){
                                if(error)
                                {
                                   console.log(error);  
                                }
                          }); 
                        }); 
                       userData.user_image =  image_name_change; 
                 }

                 callback(); 
             },
             function (callback) {

                connection.query("INSERT INTO users SET ?",userData,function(err,result){
                       if(err)
                        {
                           return res.status(202).json({ success: '0', message: err, data: {} });
                        }

                        if(result)
                        {
                             userData.last_inserted_id = result.insertId; 
                              callback();
                        }
                 }); 
             },
             function (callback) {
                
                 if(!isEmpty(req.files))
                {
                   userData.user_image_link = 'http://' + get_hostname(req) + '/uploads/user/' + userData.user_image;
                   delete userData.user_image;
                }  
                else{
                    userData.user_image_link = '';
                    delete userData.user_image;
                } 
               callback();
             },  

          ],
        function (err, result) 
        {
             return res.status(200).json({ success: '1', message: 'Registration Successfully',data:userData });
        });
          
    },

    edit_user : function(req,res,next)
    {
       var userData = {};
          async.series([

              function (callback)
              {
                var form = new multiparty.Form();
                
                form.parse(req, function(err, fields, files) {

                    fields = fields || [];

                    for (var key in fields) {
                        if (fields[key].length === 1) {
                            fields[key] = fields[key][0];
                        }
                    }

                    req.body = fields;
                    req.files = files;
                    req.checkBody('email', 'Email does not appear to be valid').isEmail();
                    req.checkBody('user_id','User Id is required').notEmpty();

                    var errors = req.validationErrors();

                    if (errors) 
                    {
                        return res.status(202).json({ success: '0', message: errors, data: {} });
                    }
                    callback();  

                });   
                

              },
              function (callback)
              {
                  connection.query("select count(*) as total_user from users where id=?",[req.body.user_id],function(err,result){

                    if(err)
                    {
                         return res.status(202).json({ success: '0', message: err, data: {} });
                    }

                   if(result[0]['total_user']==1)
                   {
                      callback();  
                   }
                   else{
                       return res.status(202).json({ success: '0', message: 'That User Id Not Exists Our System !', data: {} });
                   }  

                 }); 
              },             
              function(callback)
              { 
                  var unique_id = req.body.user_id; 

                   connection.query("select user_image from users where id=?",[unique_id],function(err,result){
                     if(err)
                     {
                         console.log(err);
                     }  

                      userData.user_image_name = result[0]['user_image'];
                       callback();
                });
              },
              function (callback)
              {

                  if(!isEmpty(req.files))
                  {
                      // it mean upload image also set it 
                      var custom_image = req.files;

                    // var image_name_change = new Date().getTime() + findAndReplace(custom_image.file[0]['originalFilename']," ","_"); 
                     
                     var image_name_change = new Date().getTime()+path.extname(custom_image.file[0]['originalFilename']); 

                     var image_temp_path = custom_image.file[0]['path'];

                        fs.readFile(image_temp_path,function(errr,data1)
                        {
                           var image_physical_path = './public/uploads/user/' + image_name_change;
                                
                          fs.writeFile(image_physical_path,data1,function(error){
                                if(error)
                                {
                                   console.log(error);  
                                }
                          }); 
                        }); 
                       userData.user_image =  image_name_change; 

                       // remove file 
                         if(userData.user_image_name!="")
                         {
                            var file_delete_path = './public/uploads/user/'+userData.user_image_name;

                              fs.unlink(file_delete_path, function(error) {
                                    if (error) {
                                        //throw error;
                                        console.log(error);
                                    }
                                  //console.log('Deleted filename', fileName);
                               });
                         }
                  }
                  else{
                       // It is we are not change anything.
                       userData.user_image =  userData.user_image_name; 
                  }
                  callback();
              },
               function (callback)
              {
                var unique_id = req.body.user_id; 
                userData.email = req.body.email;
                userData.mobile = req.body.mobile;
                userData.status = req.body.status;  
                userData.name = req.body.name;
                userData.gender = req.body.gender;
                userData.device_id = req.body.device_id;
                userData.device_type = req.body.device_type;                
                 var image_name = userData.user_image;

                connection.query("UPDATE users set user_image=?,email=?,name=?,mobile=?,status=?,gender=? where id=?",
                                  [
                                    image_name, 
                                    userData.email,
                                    userData.name,
                                    userData.mobile,
                                    userData.status,
                                    userData.gender,
                                  unique_id],function(err,result){
                     if(err)
                     {
                         console.log(err);
                     }  
                     callback();
                });
              },
          ],function(err,result){

              if(err)
              {
                  return res.status(202).json({success:'0',message:err,data:{}});
              }

              return res.status(200).json({ success: '1', message: "Profile has been update successfully"});               

          });  


    },

    delete_user : function(req,res,next)
    {
         var unique_id = req.params.id;
         connection.query('DELETE FROM users WHERE id=?',[unique_id], function(err,rows)
              {
                    if(err) {
                        return res.status(202).json({ success: '0', Error: 'Something went wrong'});
                    } 
                    else 
                    {
                     return res.status(200).json({ success: '1', message: 'Delete record Successfully'});

                    } 
              });
    }
 
};

module.exports = mobile;
