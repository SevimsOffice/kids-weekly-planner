# Kids Weekly Planner

https://kidsplanner.space/

<img width="800" height="687" alt="image" src="https://github.com/user-attachments/assets/7410c215-27cc-427b-8dfc-1715ae4aeb52" />


A simple, offline-first Expo React Native app to help kids plan their week: set daily tasks, check them off, and keep progress saved on the device.

## Features

- **Weekly planner**: Days of the week with tasks/activities
- **Checklists**: Mark tasks as done
- **Local persistence**: Data saved with `@react-native-async-storage/async-storage`
- **Cross-platform**: iOS, Android, and Web via Expo

## Tech Stack

- **Expo** `~54`
- **React** `19`
- **React Native** `0.81`
- **TypeScript** `~5.9`

## Getting Started

### Prerequisites
- Node.js 18+ and npm (or yarn/pnpm)
- Expo CLI (installed automatically via `npx` commands)
- iOS Simulator (Xcode) or Android Emulator (Android Studio) for native testing

### Install
```bash
npm install
```

### Run
- **Start dev server**:
```bash
npm run start
```
- **Android** (emulator or device):
```bash
npm run android
```
- **iOS** (simulator):
```bash	npm run ios
```
- **Web**:
```bash
npm run web
```

When the Expo DevTools open, you can press `a` for Android, `i` for iOS, or `w` for Web.

## Project Structure
```
.
├── App.tsx                     # App entry (root component)
├── index.ts                    # Expo entry point
├── KidsWeeklyPlanner.tsx       # Main screen / components
├── assets/                     # App icons, splash
├── app.json                    # Expo app configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Scripts & dependencies
```

## Configuration
- App name, slug, icons, and splash are configured in `app.json`.
- TypeScript config is in `tsconfig.json`.

## Persistence
- Uses `@react-native-async-storage/async-storage` for storing planner state locally.
- No backend is required; all data remains on device.

## Building
- You can build binaries with Expo Application Services (EAS). First install EAS CLI:
```bash
npm i -g eas-cli
```
- Configure and start a build:
```bash
eas build --platform android
# or
eas build --platform ios
```

See Expo docs for detailed signing/credentials.

## Scripts
- **start**: `expo start`
- **android**: `expo start --android`
- **ios**: `expo start --ios`
- **web**: `expo start --web`

## Contributing
1. Fork the repo
2. Create a feature branch: `git checkout -b feat/awesome`
3. Commit changes: `git commit -m "feat: add awesome"`
4. Push branch: `git push origin feat/awesome`
5. Open a Pull Request

## License
MIT
