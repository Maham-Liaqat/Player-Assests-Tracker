# Basketball Assist Tracker - Backend

A lightweight Node.js backend for tracking basketball player assists and visualizing progress toward records.

## Features

- RESTful API for player and assist data
- SQLite database (file-based, no server required)
- CORS enabled for frontend integration
- Assist history tracking with undo functionality
- Simple manual updates as requested

## Setup Instructions (Clean Machine)

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the API
   ```bash
   npm start
   ```
   - Default port: 3001
   - Health check: http://localhost:3001/api/health

### Environment Variables (optional)
Create `.env` in this folder if you want to override defaults:
```
PORT=3001
```

## Endpoints
- GET `/api/players` – list players sorted by assists
- GET `/api/players/:id` – player by id
- PUT `/api/players/:id/assists` – set player assists (optionally logs a game)
- POST `/api/players/:id/add-assists` – increment and log assists; returns `assistLogId`
- DELETE `/api/assists/:id` – undo/delete a specific assist log and subtract from player
- GET `/api/assists` – list assist logs
- GET `/api/assists/recent` – recent 10 logs
- GET `/api/assists/stats/summary` – basic stats

## Notes
- SQLite file is at `database/basketball.db`
- If you deploy, ensure persistent storage for the DB file
