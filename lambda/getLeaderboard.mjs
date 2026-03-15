import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = "MathBuddyHighScores";

export const handler = async (event) => {
  const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? "20", 10) || 20, 100);

  try {
    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "ScoreIndex",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": "LEADERBOARD" },
      ScanIndexForward: false,
      Limit: limit,
    }));

    const data = (result.Items ?? []).map(item => ({
      playerName: item.playerName,
      bestScore: item.bestScore,
    }));

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
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { code: "internal_error", message: "Failed to fetch leaderboard" } }),
    };
  }
};
