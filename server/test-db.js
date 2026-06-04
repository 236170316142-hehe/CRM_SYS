const mongoose = require('mongoose');
const uri = 'mongodb://vidhithakkar287_db_user:Lfxk5NKhNQIsNaAA@ac-hbwvea1-shard-00-00.mapaqxd.mongodb.net:27017,ac-hbwvea1-shard-00-01.mapaqxd.mongodb.net:27017,ac-hbwvea1-shard-00-02.mapaqxd.mongodb.net:27017/?ssl=true&replicaSet=atlas-13y04g-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function test() {
  try {
    await mongoose.connect(uri);
    console.log('Connected successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}
test();
