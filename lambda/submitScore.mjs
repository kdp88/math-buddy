import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = "MathBuddyHighScores";

export const handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body ?? "{}"); } catch {
    return respond(400, { error: { code: "invalid_json", message: "Request body must be valid JSON" } });
  }

  const { playerName, score } = body;

  if (typeof playerName !== "string" || playerName.trim().length === 0 || playerName.trim().length > 20) {
    return respond(400, { error: { code: "validation_error", message: "playerName must be 1–20 characters" } });
  }
  if (!Number.isInteger(score) || score < 0) {
    return respond(400, { error: { code: "validation_error", message: "score must be a non-negative integer" } });
  }

  const name = playerName.trim();

  try {
    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: "LEADERBOARD", SK: `PLAYER#${name}` },
      UpdateExpression: "SET playerName = :n, bestScore = :s, updatedAt = :t",
      ConditionExpression: "attribute_not_exists(SK) OR bestScore < :s",
      ExpressionAttributeValues: { ":n": name, ":s": score, ":t": new Date().toISOString() },
    }));
    return respond(200, { data: { playerName: name, bestScore: score, isNewBest: true } });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return respond(200, { data: { playerName: name, isNewBest: false } });
    }
    console.error(err);
    return respond(500, { error: { code: "internal_error", message: "Failed to save score" } });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}
