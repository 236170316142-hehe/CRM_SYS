const mongoose = require('mongoose');
const uri = 'mongodb://vidhithakkar287_db_user:Lfxk5NKhNQIsNaAA@ac-hbwvea1-shard-00-00.mapaqxd.mongodb.net:27017/?tls=true&authSource=admin';

async function test() {
  try {
    console.log('Connecting directly to primary node...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}
test();
