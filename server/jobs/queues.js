const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

// Welcome / New-Lead drip sequence (Day 0 / 2 / 5)
const welcomeEmailQueue = new Queue('welcomeEmailQueue', {
  connection: redisClient,
});

// Demo-Requested drip sequence (Day 0 / 3 / 7)
const demoEmailQueue = new Queue('demoEmailQueue', {
  connection: redisClient,
});

module.exports = {
  welcomeEmailQueue,
  demoEmailQueue,
};
