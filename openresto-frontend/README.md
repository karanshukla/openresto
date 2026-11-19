# OpenResto Frontend

The mobile and web frontend for OpenResto, built with Expo and React Native.

## Features

- **Multi-platform:** Runs on Android, iOS, and Web from one codebase.
- **Themed UI:** Custom themed components with responsive layouts.
- **File-based routing:** Uses `expo-router` for navigation.
- **Loading states:** Branded initial loading screen and skeleton loaders for page transitions.
- **Admin dashboard:** Management interface for restaurant owners and managers.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo Go (for mobile testing)

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.template .env
   ```

   Update `.env` with your backend API URL.

3. Start the development server:

   ```bash
   npx expo start
   ```

## Testing

This package targets 100% test coverage. Run the test suite:

```bash
npm test
```

Run with a coverage report:

```bash
npm test -- --coverage
```

## Project Structure

- `app/`: Expo Router pages and layouts.
- `components/`: Reusable UI components.
- `api/`: API client and service functions.
- `context/`: React context providers (Theme, Brand).
- `hooks/`: Custom React hooks.
- `theme/`: Theme configuration and color constants.
- `utils/`: Helper utilities and formatting functions.

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
