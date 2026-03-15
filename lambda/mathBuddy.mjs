import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = "high-score";
const GSI   = "leaderboard-highScore-index";

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const path   = event.rawPath ?? event.path ?? '';

  if (path === '/math-buddy/scores' && method === 'POST') {
    return submitScore(event);
  }
  if (path === '/math-buddy/scores' && method === 'GET') {
    return getLeaderboard(event);
  }
  return respond(404, { error: { code: "not_found", message: "Route not found" } });
};

async function submitScore(event) {
  let body;
  try { body = JSON.parse(event.body ?? "{}"); } catch {
    return respond(400, { error: { code: "invalid_json", message: "Request body must be valid JSON" } });
  }

  const { userId, playerName, score } = body;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return respond(400, { error: { code: "validation_error", message: "userId is required" } });
  }
  if (typeof playerName !== "string" || playerName.trim().length === 0 || playerName.trim().length > 20) {
    return respond(400, { error: { code: "validation_error", message: "playerName must be 1–20 characters" } });
  }
  if (!Number.isInteger(score) || score < 0) {
    return respond(400, { error: { code: "validation_error", message: "score must be a non-negative integer" } });
  }

  const name = playerName.trim();

  console.log(`[submitScore] Inserting record — userId: ${userId.trim()}, playerName: ${name}, score: ${score}`);

  try {
    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: userId.trim(), highScore: score },
      UpdateExpression: "SET playerName = :n, leaderboard = :lb, updatedAt = :t",
      ConditionExpression: "attribute_not_exists(userId) OR highScore < :s",
      ExpressionAttributeValues: {
        ":n":  name,
        ":lb": "ALL",
        ":t":  new Date().toISOString(),
        ":s":  score,
      },
    }));
    console.log(`[submitScore] New best score saved — playerName: ${name}, score: ${score}`);
    return respond(200, { data: { userId, playerName: name, highScore: score, isNewBest: true } });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      console.log(`[submitScore] Score not a new best — playerName: ${name}, score: ${score}`);
      return respond(200, { data: { userId, playerName: name, isNewBest: false } });
    }
    console.error("[submitScore] DynamoDB error:", err);
    return respond(500, { error: { code: "internal_error", message: "Failed to save score" } });
  }
}

async function getLeaderboard(event) {
  const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? "20", 10) || 20, 100);

  console.log(`[getLeaderboard] Fetching top ${limit} scores`);

  try {
    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      IndexName: GSI,
      KeyConditionExpression: "leaderboard = :lb",
      ExpressionAttributeValues: { ":lb": "ALL" },
      ScanIndexForward: false,
      Limit: limit,
    }));

    const data = (result.Items ?? []).map(item => ({
      playerName: item.playerName,
      highScore:  item.highScore,
    }));

    console.log(`[getLeaderboard] Returning ${data.length} records`);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30",
      },
      body: JSON.stringify({ data }),
    };
  } catch (err) {
    console.error("[getLeaderboard] DynamoDB error:", err);
    return respond(500, { error: { code: "internal_error", message: "Failed to fetch leaderboard" } });
  }
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}
