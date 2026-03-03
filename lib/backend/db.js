import { MongoClient } from 'mongodb';
import { MONGO_URL, DB_NAME } from './config.js';

// Mock DB fallback for local development
let MockDB;
try {
  const mockdbModule = require('../../lib/mockdb.js');
  MockDB = mockdbModule.MockDB;
} catch (e) {
  MockDB = null;
}

let cachedDb = null;
let usingMockDb = false;

export function isUsingMockDb() {
  return usingMockDb;
}

export async function getDb() {
  if (cachedDb) return cachedDb;
  
  // Validate MONGO_URL before attempting connection
  if (!MONGO_URL) {
    console.error('MONGO_URL environment variable is not set. Cannot connect to database.');
    if (!MockDB) {
      throw new Error('MONGO_URL not configured and MockDB not available. Please set MONGO_URL in .env.local or ensure local MongoDB is running.');
    }
    cachedDb = new MockDB();
    usingMockDb = true;
    console.log('✓ Using mock database for development (MONGO_URL not set)');
    return cachedDb;
  }
  
  // Try real MongoDB first
  try {
    const isLocal = MONGO_URL.includes('localhost');
    const connectOptions = isLocal
      ? { 
          serverSelectionTimeoutMS: 5000,
          retryWrites: false,
          ssl: false,
          tls: false
        }
      : {
          serverSelectionTimeoutMS: 5000,
          family: 4
        };

    const client = await MongoClient.connect(MONGO_URL, connectOptions);
    cachedDb = client.db(DB_NAME);
    usingMockDb = false;
    
    // Create indexes
    try {
      await cachedDb.collection('users').createIndex({ email: 1 }, { unique: true });
      await cachedDb.collection('sessions').createIndex({ userId: 1, updatedAt: -1 });
      await cachedDb.collection('resumes').createIndex({ userId: 1, createdAt: -1 });
      await cachedDb.collection('career_paths').createIndex({ userId: 1 });
      await cachedDb.collection('job_matches').createIndex({ userId: 1 });
      await cachedDb.collection('analytics').createIndex({ type: 1, createdAt: -1 });
      await cachedDb.collection('analytics').createIndex({ userId: 1, createdAt: -1 });
      await cachedDb.collection('saved_jobs').createIndex({ userId: 1 });
      await cachedDb.collection('job_alerts').createIndex({ userId: 1 });
      await cachedDb.collection('learning_paths').createIndex({ userId: 1 });
      await cachedDb.collection('shared_chats').createIndex({ shareCode: 1 }, { unique: true, sparse: true });
    } catch (e) { /* indexes may already exist */ }
    
    console.log('✓ Connected to real MongoDB');
    return cachedDb;
  } catch (mongoError) {
    console.warn('MongoDB connection failed, using mock database for development:', mongoError.message);
    
    // Fallback to mock database
    if (!MockDB) {
      throw new Error('MongoDB not available and MockDB not loaded. Please install MongoDB or use local MongoDB.');
    }
    
    cachedDb = new MockDB();
    usingMockDb = true;
    console.log('✓ Using mock database for development');
    return cachedDb;
  }
}
