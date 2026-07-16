# CitySante Rider App

React Native (Expo) app for CitySante delivery riders.

## Quick Start

### 1. Install dependencies
```bash
cd mobile/rider
npm install
```

### 2. Set your backend IP
Edit `src/api/api.ts` line 4:
```ts
// If running on physical device, use your Mac's local IP:
export const API_BASE = 'http://192.168.1.XXX:5000/api'

// If running on iOS Simulator (same Mac):
export const API_BASE = 'http://localhost:5000/api'

// If running on Android Emulator:
export const API_BASE = 'http://10.0.2.2:5000/api'
```

To find your Mac's local IP: `ipconfig getifaddr en0`

### 3. Start the app
```bash
npx expo start
```

Then:
- **Physical device** → Install [Expo Go](https://expo.dev/go) → scan the QR code
- **iOS Simulator** → press `i`
- **Android Emulator** → press `a`

---

## Test Login

Use seeded rider credentials:
- **Email:** `rider1@citysante.com`
- **Password:** `password123`

---

## App Screens

| Screen | Description |
|---|---|
| **Login** | Rider-only login (rejects other roles) |
| **Home (Deliveries)** | Duty toggle + live active order card with auto-poll |
| **Active Delivery** | Full order detail — pickup/delivery info, call buttons, directions, status advance |
| **History** | All completed deliveries |
| **Profile** | Account info, duty status badge, logout |

## Workflow

1. Rider logs in → toggles **On Duty**
2. Shop owner assigns order → app polls every 15s → order card appears on Home
3. Tap card → Active Delivery screen
4. **Mark Picked Up** → **Out for Delivery** → **Mark Delivered**
5. Live location sent to backend every 5s while on duty (stored in Redis)

## Project Structure

```
src/
├── api/api.ts          ← Axios client + all API calls
├── store/
│   ├── authStore.ts    ← User, token, duty status (SecureStore)
│   └── orderStore.ts   ← Active order state
├── navigation/index.tsx ← Stack + Bottom Tab navigation
├── screens/
│   ├── LoginScreen.tsx
│   ├── HomeScreen.tsx        ← Duty toggle + active order
│   ├── ActiveOrderScreen.tsx ← Manage live delivery
│   ├── HistoryScreen.tsx
│   └── ProfileScreen.tsx
└── types/index.ts
```
