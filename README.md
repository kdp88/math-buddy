# Math Buddy

A React Native (Expo) kids math quiz app. Children answer arithmetic questions through interactive 3D arcade game modes.

## Game Modes

| Mode | Description |
|---|---|
| **Classic** | Type or tap the answer directly |
| **Spaceship** | Move a ship left/right, fire a laser at the correct asteroid |
| **Cockpit** | First-person view — move a crosshair with a D-pad, fire at drifting number targets |
| **Haunted House** | Walk a zombie left/right, knock on mystery doors to reveal numbers (process of elimination) |
| **Maze** | Navigate a 3D maze to the cell labelled with the correct answer |
| **Fishing** | Tap the fish carrying the correct number before it swims past |

## Settings

- **Operations**: any combination of `+`, `−`, `×`, `÷`
- **Difficulty**:
  - `easy` — numbers 1–5
  - `medium` — numbers 1–10
  - `hard` — numbers 1–20
- **Mode**: one of the six game modes above

Settings are chosen at launch via a full-screen modal (mode first, then ops + difficulty).

## Architecture

### Question shape
```js
{ text: '5 + 3', answer: 8, a: 5, b: 3, op: '+' }
```

### Game mode contract
All arcade modes receive three props:
```js
{ question, onCorrect, onWrong }
```
`onCorrect` and `onWrong` are called exactly once per interaction and are handled centrally in `App.js`.

### Key files

| File | Purpose |
|---|---|
| `App.js` | Root component — shared state (question, score, streak, settings, feedback) |
| `SettingsModal.js` | Full-screen modal, 2-page flow: pick mode → pick ops + difficulty |
| `SpaceshipGame.js` | Spaceship shooter game mode |
| `CockpitGame.js` | First-person cockpit game mode |
| `HauntedHouse.js` | Haunted house game mode |
| `MazeGame.js` | 3D maze game mode (Three.js/R3F) |
| `FishingGame.js` | Fishing game mode (Three.js/R3F) |
| `ClassicGame.js` | Classic text input mode |
| `GameLoader.js` | Loading overlay for 3D scenes |
| `HighScoreModal.js` | Leaderboard modal |
| `services/scoresApi.js` | API client — submit scores, fetch leaderboard |
| `utils/buildAnswerChoices.js` | Shared helper — generates 4 unique answer choices including the correct one |
| `lambda/mathBuddy.mjs` | AWS Lambda handler — score submission and leaderboard |

### Shared utilities (`utils/`)

| Export | Purpose | Used by |
|---|---|---|
| `buildAnswerSet(answer)` | Returns a `Set` of 4 unique non-negative integers including `answer` | MazeGame, buildAnswerChoices |
| `buildAnswerChoices(answer)` | Returns shuffled array of `{ num, isCorrect, colorIdx }` | SpaceshipGame, CockpitGame |

## Getting Started

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android emulator / physical device, or iOS simulator

### Install
```bash
npm install
```

### Run
```bash
# Start Expo dev server
npm start

# Android
npm run android

# iOS
npm run ios
```

### Environment

Create a `.env` file in the project root:
```
EXPO_PUBLIC_API_BASE_URL=https://<your-api-gateway-url>
```

The app works offline without this — scores just won't be submitted to the leaderboard.

## Testing

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch

# Coverage report (80% threshold enforced)
npm run test:coverage
```

Tests cover pure game logic only. 3D scene components (Three.js/R3F) cannot render in Jest, so game logic helpers are tested in isolation via inline copies or util imports.

## Backend (AWS)

### Infrastructure
- **API Gateway** (HTTP API) → **Lambda** (`mathBuddy.mjs`) → **DynamoDB** (`high-score` table)
- DynamoDB key schema: `userId` (partition key only)
- GSI: `leaderboard-highScore-index` — partition key `leaderboard`, sort key `highScore`

### API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/math-buddy/scores` | Submit or update a player's high score |
| `GET` | `/math-buddy/scores` | Fetch top scores (leaderboard) |

### Submit score payload
```json
{
  "userId": "uuid-per-player-name",
  "playerName": "Alice",
  "score": 42
}
```

Score is only written if it exceeds the player's existing high score.

### Deploy Lambda
```bash
# Manual deploy
npm run deploy:lambda

# CI deploy — push to master triggers automatic deploy
git push origin master
```

## Project Conventions

- **Immutability**: always use spread (`{...obj}`, `[...arr]`) — never mutate state directly
- **Unmount safety**: all `setTimeout` IDs tracked in refs and cleared in `useEffect` cleanup
- **No magic numbers**: timing constants named (e.g. `HIT_FEEDBACK_MS`, `LASER_DURATION_MS`)
- **testID on every interactive element**: kebab-case, component-scoped prefix (e.g. `spaceship-asteroid-3`)
- **DRY**: shared helpers go in `utils/` — check there before writing new logic in a component
