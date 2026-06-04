require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Start background jobs
require('./jobs/scheduler');
require('./jobs/workers');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Force restart again 3
