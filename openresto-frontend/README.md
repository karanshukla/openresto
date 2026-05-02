# OpenResto Frontend

The mobile and web frontend for OpenResto, built with Expo and React Native.

## Features

- **Multi-platform:** Runs on Android, iOS, and Web.
- **Modern UI:** Built with custom themed components and a responsive layout.
- **Fast Navigation:** Uses `expo-router` for file-based routing with smooth animations.
- **Intelligent Loading:** Features a rich branded initial loading screen and high-performance skeleton loaders for subsequent page transitions.
- **Admin Dashboard:** Comprehensive management interface for restaurant owners.

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

   Update the `.env` file with your API URL.

3. Start the development server:
   ```bash
   npx expo start
   ```

## Testing

The project aims for 100% test coverage. To run tests:

```bash
npm test
```

To view coverage report:

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
