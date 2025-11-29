import mongoose from 'mongoose';

// Connect to MongoDB with basic retry/backoff logic
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  mongoose.set('strictQuery', false);

  const maxRetries = parseInt(process.env.DB_CONNECT_RETRIES || '5', 10);
  let attempts = 0;
  const connectOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  };

  while (attempts < maxRetries) {
    try {
      await mongoose.connect(uri, connectOptions);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      attempts += 1;
      console.error(`MongoDB connection attempt ${attempts} failed:`, err.message);
      const delay = Math.min(5000 * attempts, 30000);
      // Wait before retrying
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error('Failed to connect to MongoDB after retries, exiting process');
  process.exit(1);
};

export default connectDB;
