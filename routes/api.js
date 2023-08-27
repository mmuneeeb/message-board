'use strict';
const mongoose = require('mongoose');
const mongodb = require('mongodb');

const db = mongoose.connect(process.env.URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

let replySchema = new mongoose.Schema({
  text: {type: String, required: true},
  delete_password: {type: String, required: true},
  created_on: {type: Date, required: true},
  reported: {type: Boolean, required: true}
})
let reply = mongoose.model("reply", replySchema);

let threadSchema = new mongoose.Schema({
  text: {type: String, required: true},
  delete_password: {type: String, required: true},
  board: {type: String, required: true},
  created_on: {type: Date, required: true},
  bumped_on: {type: Date, required: true},
  reported: {type: Boolean, required: true},
  replies: [replySchema]
})
let thread = mongoose.model("thread", threadSchema);

let replyModel = reply;
let threadModel = thread;

module.exports = function (app) {
  
  app.route('/api/threads/:board')

    .post(function(req, res){
      let newThread = new threadModel(req.body);

      if (!newThread.board || newThread.board == ""){
        newThread.board = req.params.board;
      }
      newThread.created_on = new Date().toUTCString();
      newThread.bumped_on = new Date().toUTCString();
      newThread.reported = false;
      newThread.replies = [];

      newThread.save((err, data) => {
        if (!err && data){
          res.redirect('/b/' + data.board + '/' + data.id);
        }
      })
      
    })
    
    .get(function(req, res){
      threadModel.find({board: req.params.board})
      .sort({bumped_on: 'desc'})
      .limit(10)
      .select('-delete_password -reported')
      .lean()
      .exec((err, data) => {
        if (!err && data){
          data.forEach((thread) => {
            thread['replycount'] = thread.replies.length;
            thread.replies.sort((thread1, thread2) => {
              return thread2.created_on - thread1.created_on
            })
            thread.replies.slice(0,3);
            thread.replies.forEach((reply) => {
              reply.delete_password = undefined,
              reply.reported = undefined
            })
          })
          return res.json(data);
        }
      })
    })

    .delete(function(req, res){
      threadModel.findById(req.body.thread_id, 
        (err, data) => {
          if (!err && data){
            if (data.delete_password === req.body.delete_password){
              threadModel.findByIdAndRemove(req.body.thread_id, 
                (err, data) => {
                  if (!err && data){
                    return res.send('success');
                  }
                })
            }else {
              return res.send('incorrect password')
            }
          }
        })
    })

    .put(function(req, res){
      threadModel.findByIdAndUpdate(req.body.thread_id,
        {reported: true},
        {new: true},
        (err, data) => {
          if(!err && data){
            return res.send('reported')
          }
        })
    });
    
  app.route('/api/replies/:board')

  .post(function(req, res){
      let newReply = new replyModel({
        text: req.body.text,
        delete_password: req.body.delete_password
      });
      newReply.created_on = new Date().toUTCString();
      newReply.reported = false;

    threadModel.findByIdAndUpdate(req.body.thread_id, 
      {$push: {replies: newReply}, bumped_on: new Date().toUTCString()}, {new: true},
      (err, data) => {
      if (!err && data) {
        res.redirect('/b/' + data.board + '/' + data.id + '?new_reply_id=' + newReply.id)
        }
      }
     ) 
    })
  .get(function(req, res){
    threadModel.findById(req.query.thread_id, 
      (err, data) => {
       if (!err && data){
         data.delete_password = undefined
         data.reported = undefined
         data.replies.sort((thread1, thread2) => {
            return thread2.created_on - thread1.created_on
            })
            
        data.replies.forEach((reply) => {
              reply.delete_password = undefined
              reply.reported = undefined
            })
         return res.json(data);
          }
       }) 
      })
  
  .delete(function(req, res){
    threadModel.findById(req.body.thread_id, 
        (err, data) => {
          if (!err && data){
            let i
            for (i = 0; i < data.replies.length; i++){
              if(data.replies[i].id === req.body.reply_id){
                if(data.replies[i].delete_password === req.body.delete_password){
                  data.replies[i].text = '[deleted]'
                }else{
                  res.send('incorrect password')
                }
              }
            }

            data.save((err, data) => {
              if (!err && data){
                return res.send('success')
              }
            }) 
          }
        })
    })
  .put(function(req, res){
      threadModel.findById(req.body.thread_id, 
        (err, data) => {
          if (!err && data){
            let i
            for (i = 0; i < data.replies.length; i++){
              if(data.replies[i].id === req.body.reply_id){
                data.replies[i].reported = true;
              }
            }

            data.save((err, data) => {
              if (!err && data){
                return res.send('reported')
              }
            }) 
          }
        })
    });
};
