import { executeQuery } from '../config.js';

export async function getLatestAccessToken() {
  const query = 'SELECT "AccessToken" FROM "ZaloTokens" ORDER BY "ExpireAt" DESC LIMIT 1';
  const result = await executeQuery(query);
  return result.rows[0]?.AccessToken || null;
}