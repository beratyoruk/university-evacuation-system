# University Evacuation System

Real-time indoor evacuation guidance system for universities with 3D floor plan visualization.

## Overview

This system provides real-time evacuation guidance for university buildings using interactive 3D floor plans. During emergencies, it calculates optimal evacuation routes, displays them on a Three.js-powered 3D visualization, and communicates with users via WebSocket for live updates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Web Browser  │  │  Mobile App  │  │  Admin Dashboard     │  │
│  │  (Three.js    │  │  (Future)    │  │  (Floor Plan Editor) │  │
│  │   3D View)    │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (Express)                       │
│                     Port: 3001                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Auth Middleware       │  │
│  │  /api/v1/*   │  │  (Socket.IO) │  │  (JWT)                │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────────────┘  │
│         │                │                                      │
│  ┌──────┴────────────────┴──────────────────────────────────┐  │
│  │                   SERVICE LAYER                           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐    │  │
│  │  │ Building   │ │ Evacuation │ │ User Management    │    │  │
│  │  │ Service    │ │ Service    │ │ Service            │    │  │
│  │  └────────────┘ └────────────┘ └────────────────────┘    │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐    │  │
│  │  │ Sensor     │ │ Route      │ │ Notification       │    │  │
│  │  │ Service    │ │ Calculator │ │ Service            │    │  │
│  │  └────────────┘ └────────────┘ └────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────┬───────────────────────────────────┬───────────────────┘
          │                                   │
          ▼                                   ▼
┌──────────────────┐                ┌──────────────────┐
│   PostgreSQL     │                │     Redis        │
│                  │                │                  │
│  - Buildings     │                │  - Session Cache │
│  - Floor Plans   │                │  - Real-time     │
│  - Users         │                │    Sensor Data   │
│  - Sensors       │                │  - Active Routes │
│  - Evacuation    │                │  - Pub/Sub for   │
│    Routes        │                │    WebSocket     │
│  - Emergency     │                │                  │
│    Events        │                │                  │
└──────────────────┘                └──────────────────┘
```

## Features

- **3D Floor Plan Visualization**: Interactive Three.js-based 3D building floor plans
- **Real-time Evacuation Routes**: Dynamic pathfinding using Dijkstra/A* algorithms
- **Live Sensor Integration**: Smoke, heat, and occupancy sensor data processing
- **WebSocket Communication**: Real-time updates during emergencies
- **Multi-floor Support**: Navigate between floors with 3D transitions
- **Admin Dashboard**: Upload and manage floor plans, configure sensors
- **User Authentication**: JWT-based auth with role-based access control
- **Emergency Notifications**: Push notifications via WebSocket channels

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React, Vite, Three.js, @react-three/fiber     |
| State      | Zustand                                        |
| Styling    | Tailwind CSS                                   |
| Backend    | Node.js, Express, TypeScript                   |
| Real-time  | Socket.IO                                      |
| Database   | PostgreSQL                                     |
| Cache      | Redis                                          |
| Auth       | JWT + bcrypt                                   |
| Container  | Docker & Docker Compose                        |

## Project Structure

```
university-evacuation-system/
├── client/                  # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Route pages
│   │   ├── store/           # Zustand stores
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Utility functions
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── server/                  # Node.js + Express backend
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── services/        # Business logic
│   │   ├── middleware/       # Auth, validation, etc.
│   │   ├── models/          # Database models
│   │   ├── config/          # App configuration
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Entry point
│   ├── tsconfig.json
│   └── package.json
├── shared/                  # Shared types & constants
│   └── types/
│       └── index.ts
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/beratyoruk/university-evacuation-system.git
cd university-evacuation-system
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start with Docker Compose:
```bash
docker-compose up -d
```

4. Or run locally:
```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Start server (from server/)
npm run dev

# Start client (from client/)
npm run dev
```

5. Open your browser:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api/v1

## API Endpoints

| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| POST   | /api/v1/auth/register        | Register a new user            |
| POST   | /api/v1/auth/login           | Login and get JWT token        |
| GET    | /api/v1/buildings            | List all buildings             |
| GET    | /api/v1/buildings/:id        | Get building details           |
| GET    | /api/v1/buildings/:id/floors | Get floors for a building      |
| POST   | /api/v1/floors/:id/plan      | Upload floor plan              |
| GET    | /api/v1/sensors              | List sensors                   |
| POST   | /api/v1/emergency/start      | Trigger emergency evacuation   |
| GET    | /api/v1/emergency/routes     | Get active evacuation routes   |
| POST   | /api/v1/emergency/end        | End emergency                  |

## WebSocket Events

| Event                | Direction       | Description                      |
|----------------------|-----------------|----------------------------------|
| `emergency:start`    | Server → Client | Emergency has been triggered     |
| `emergency:end`      | Server → Client | Emergency has ended              |
| `route:update`       | Server → Client | Evacuation route updated         |
| `sensor:data`        | Server → Client | Real-time sensor data            |
| `user:location`      | Client → Server | User location update             |
| `user:safe`          | Client → Server | User confirmed safe              |

## License

APGL-3.0
