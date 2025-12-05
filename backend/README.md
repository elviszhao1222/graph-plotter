# Graph Plotter Backend API

Backend server for Graph Plotter with database storage and sharing features.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```
PORT=3000
JWT_SECRET=your-secret-key-here
```

3. Start server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires auth)

### Graphs
- `GET /api/graphs` - Get all user's graphs (requires auth)
- `GET /api/graphs/:id` - Get single graph (requires auth)
- `POST /api/graphs` - Create new graph (requires auth)
- `PUT /api/graphs/:id` - Update graph (requires auth)
- `DELETE /api/graphs/:id` - Delete graph (requires auth)
- `POST /api/graphs/:id/share` - Share graph with user (requires auth)
- `GET /api/graphs/share/:token` - Get public graph by share token
- `GET /api/graphs/:id/share-link` - Get shareable link (requires auth)

## Database

Uses SQLite with three tables:
- `users` - User accounts
- `graphs` - Graph configurations
- `shared_graphs` - User-to-user sharing

