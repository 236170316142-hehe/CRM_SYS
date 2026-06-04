const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

// Create the welcome email queue
const welcomeEmailQueue = new Queue('welcomeEmailQueue', {
  connection: redisClient,
});

module.exports = {
  welcomeEmailQueue,
};
