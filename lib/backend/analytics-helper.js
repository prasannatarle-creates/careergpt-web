import { v4 as uuidv4 } from 'uuid';

export async function logAnalytics(db, type, data = {}) {
  const { userId, ...rest } = data;
  await db.collection('analytics').insertOne({
    id: uuidv4(), type, userId: userId || null, metadata: rest, createdAt: new Date().toISOString(),
  });
}
