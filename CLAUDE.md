# Math Buddy - Project Context

## What this is
A React Native (Expo) kids math quiz app. Children answer math questions through different interactive game modes.

## Key files
- `App.js` - root component, holds all shared state (question, score, streak, settings, feedback)
- `SettingsModal.js` - full-screen modal, 2-page flow: page 1 pick game mode, page 2 pick ops + difficulty
- `SpaceshipGame.js` - side-view shooter: move ship left/right, fire laser up at correct asteroid
- `CockpitGame.js` - first-person POV: move crosshair with D-pad, fire at drifting number targets
- `HauntedHouse.js` - walk zombie left/right, knock on mystery doors to reveal numbers (process of elimination)

## Architecture

### Settings (`DEFAULT_SETTINGS` in App.js)
```js
{ ops: ['+', '-'], difficulty: 'medium', mode: 'classic' }
```
- `ops`: any combo of `+`, `-`, `×`, `÷`
- `difficulty`: `easy` (1-5), `medium` (1-10), `hard` (1-20)
- `mode`: `classic` | `spaceship` | `cockpit` | `haunted-house`

### Question shape
```js
{ text: '5 + 3', answer: 8, a: 5, b: 3, op: '+' }
```

### Shared arcade callbacks (App.js)
All non-classic game modes call `onCorrect` / `onWrong` props.
- `handleArcadeCorrect` - updates score/streak, animates question box, calls `nextQuestion` after 1500ms
- `handleArcadeWrong` - resets streak, shakes question box, clears feedback after 1200ms

### Settings flow
- Modal opens on launch (`useState(true)`)
- Re-opens via gear button (top-right header)
- Page 1: choose game mode (4 cards)
- Page 2: choose ops + difficulty, then "Let's Play!" saves and closes

### CockpitGame internals (most complex)
- Uses `requestAnimationFrame` game loop + `Animated.Value.setValue()` for smooth 60fps target drift
- `targetsRef` holds mutable `{ x, y, vx, vy }` data; `targets` state holds render metadata (`num`, `color`, `isCorrect`)
- Derived Animated nodes (`Animated.subtract`) created once in `useRef` for left/top positioning
- Lock detection runs at 20fps via `setInterval` to avoid re-renders every frame
- `phaseRef` guards the game loop; set to `'done'` on correct hit to stop loop

## What was last worked on
- Full-screen SettingsModal (covers entire screen, no game visible until mode chosen)
- CockpitGame added as 4th game mode
- Two-step settings flow: mode selection first, then ops/difficulty

## Skills — Always Use These (.agents/skills/)

Every development session MUST consult the applicable skill(s) in `.agents/skills/` before writing code. Skim the folder and apply the relevant skill for the task at hand.

| Skill | When to use |
|---|---|
| `tdd-workflow` | Writing any new feature, fixing bugs, refactoring — write tests first |
| `verification-loop` | After completing a feature or before a PR — run build/type/lint/test/security checks |
| `security-review` | Handling user input, secrets, API endpoints, auth, payments |
| `frontend-patterns` | React/React Native components, hooks, animation, memoization |
| `coding-standards` | General code quality — KISS/DRY/YAGNI, naming, error handling |
| `e2e-testing` | End-to-end test coverage with Playwright |
| `api-design` | Creating or modifying API routes |
| `backend-patterns` | Server-side logic, database, services |

Skills are in `.agents/skills/<skill-name>/SKILL.md`. Read the relevant one before starting work.

## Potential next steps (ideas discussed)
- More arcade game modes could be added following the same pattern (`question`, `onCorrect`, `onWrong` props)
- Score persistence across sessions (AsyncStorage)
- Sound effects
- Difficulty auto-scaling based on streak
- Timer / timed challenge mode
