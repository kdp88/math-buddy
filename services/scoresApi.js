import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const USER_ID_KEY  = 'mathbuddy_userid';

// Returns existing UUID or generates and stores a new one
async function getUserId() {
  let id = await AsyncStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await AsyncStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

async function callApi(path, options = {}) {
  if (!API_BASE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function submitScoreRemote(playerName, score) {
  const userId = await getUserId();
  return callApi('/math-buddy/scores', {
    method: 'POST',
    body: JSON.stringify({ userId, playerName, score }),
  });
}

export async function fetchLeaderboard(limit = 20) {
  const data = await callApi(`/math-buddy/scores?limit=${limit}`);
  if (!Array.isArray(data)) return null;
  // Convert array to { playerName: highScore } object matching existing highScores state shape
  return Object.fromEntries(data.map(({ playerName, highScore }) => [playerName, highScore]));
}
