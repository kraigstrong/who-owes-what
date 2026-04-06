# Who Owes What

Track one round, run multiple golf side games at once, and settle up fast.

## Stack

- Expo + React Native + Expo Router for iOS and web from the start
- TypeScript everywhere
- Zustand + AsyncStorage for local-first persisted state
- Pure domain calculators for match play, Nassau, GIR, FIR, and hole contests
- Managed normalized course catalog with a dev-only Golf Course API fetch workflow
- Jest for calculator and data-layer tests

## Architecture choices

- Shared round and hole data are the source of truth.
- Game logic is computed from round data with pure functions.
- Base hole outcomes are separate from hole contests.
- Nassau is modeled as a set of segment bets so future presses can become additional segment instances.
- Course/provider-specific response models stay isolated in the data layer.
- Default course search uses the managed catalog only.
- Live Golf Course API usage is development-only and explicit.

## Project structure

```text
app/                       Expo Router routes
src/components/            Reusable UI and screen sections
src/data/course/           Managed catalog, repository, fixtures, dev fetch helpers
src/domain/                Core round/course models and calculators
src/screens/               Route-level screen components
src/state/                 Persisted app state
src/utils/                 Small helpers
```

## Environment

The app only reads the Golf Course API key from environment variables.

Required variable:

- `GOLF_COURSE_API_KEY`

Notes:

- `.env` is intentionally ignored and treated as read-only.
- This works with a 1Password-mounted FIFO because Expo reads env values at process startup.
- `EXPO_PUBLIC_GOLF_COURSE_API_KEY` is also accepted as a fallback, but the mounted local key can stay on the non-public `GOLF_COURSE_API_KEY` name.
- The V0 client still bundles the key for local development, so this is not a production security model.

## Development

```bash
npm install
npm run start
npm run ios
npm run web
npm run test
npm run typecheck
npm run course-cache-server
```

## Course catalog

- Default course search only reads the managed normalized catalog bundled in the repo.
- In development, `Fetch from API` writes normalized results to [src/data/course/managedCatalog.overlay.json](/Users/kraig/code/who-owes-what/src/data/course/managedCatalog.overlay.json).
- Raw provider responses are saved under [dev/course-api-raw](/Users/kraig/code/who-owes-what/dev/course-api-raw).
- The dev fetch button requires the local helper server:
  - `npm run course-cache-server`
