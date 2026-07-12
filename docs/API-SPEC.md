# FlowFit — REST API Specification

**Base URL:** `http://localhost:3000/api`
**Docs:** `http://localhost:3000/api/docs` (Swagger UI)

---

## Authentication

All endpoints (except `/auth/*`) require `Authorization: Bearer <accessToken>` header.

### POST `/auth/register`
Register a new trainer account.

**Request Body:**
```json
{
  "email": "trainer@example.com",
  "password": "securePassword123",
  "firstName": "Максим",
  "lastName": "Тренер"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": 1,
    "email": "trainer@example.com",
    "firstName": "Максим",
    "lastName": "Тренер",
    "role": "TRAINER"
  }
}
```

### POST `/auth/login`
Authenticate with email and password.

**Request Body:**
```json
{
  "email": "trainer@example.com",
  "password": "securePassword123"
}
```

**Response (200):** Same as register response.

### POST `/auth/refresh`
Refresh access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

---

## Clients

### GET `/clients`
List all clients for the authenticated trainer.

**Query Params:**
- `search` (string, optional) — filter by fullName or phone
- `isActive` (boolean, optional) — filter by active status
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "fullName": "Іван Петренко",
      "phone": "+380991234567",
      "goal": "Схуднення",
      "currentWeight": 85.5,
      "isActive": true,
      "createdAt": "2026-07-12T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### GET `/clients/:id`
Get client profile with latest metrics and notes count.

### POST `/clients`
Create a new client.

**Request Body:**
```json
{
  "fullName": "Іван Петренко",
  "phone": "+380991234567",
  "goal": "Схуднення",
  "personalInfo": "Алергія на лактозу",
  "currentWeight": 85.5,
  "comments": "Новий клієнт, перше заняття"
}
```

### PATCH `/clients/:id`
Update client profile.

### DELETE `/clients/:id`
Soft-delete (archive) a client. Sets `isActive = false`.

---

## Client Notes

### GET `/clients/:clientId/notes`
List notes for a specific client. Ordered by `createdAt` DESC.

### POST `/clients/:clientId/notes`
Add a note to a client.

**Request Body:**
```json
{
  "text": "Клієнт показав гарний прогрес на присіданнях",
  "links": [
    "https://drive.google.com/file/123",
    "https://notion.so/page/456"
  ]
}
```

### DELETE `/clients/:clientId/notes/:noteId`
Delete a specific note.

---

## Client Metrics History

### GET `/clients/:clientId/metrics`
List metrics history for a client. Ordered by `createdAt` DESC.

### POST `/clients/:clientId/metrics`
Add a metrics record.

**Request Body:**
```json
{
  "weight": 83.2,
  "measurements": "Обхват грудей: 100, Талія: 82",
  "note": "Мінус 2 кг за місяць"
}
```

---

## Locations

### GET `/locations`
List all locations for the trainer.

### POST `/locations`
Create a new location.

**Request Body:**
```json
{
  "name": "FitLife Studio",
  "type": "STUDIO",
  "address": "вул. Хрещатик, 1, Київ"
}
```

### PATCH `/locations/:id`
Update a location.

### DELETE `/locations/:id`
Delete a location.

---

## Workout Sessions

### GET `/scheduler`
Get sessions for the scheduler calendar/list view.

**Query Params:**
- `start` (ISO date, required) — period start
- `end` (ISO date, required) — period end
- `locationId` (number, optional) — filter by location
- `type` (string, optional) — INDIVIDUAL or GROUP
- `status` (string, optional) — filter by status
- `clientId` (number, optional) — filter sessions where this client is a participant

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "type": "INDIVIDUAL",
      "startTime": "2026-07-15T10:00:00Z",
      "endTime": "2026-07-15T11:00:00Z",
      "pricePerPerson": 500,
      "status": "UPCOMING",
      "location": { "id": 1, "name": "FitLife Studio" },
      "participants": [
        { "id": 1, "clientId": 1, "clientName": "Іван Петренко", "customName": null }
      ],
      "totalPrice": 500,
      "participantCount": 1
    }
  ]
}
```

### POST `/workout-sessions`
Create a workout session.

**Request Body:**
```json
{
  "locationId": 1,
  "type": "GROUP",
  "startTime": "2026-07-15T10:00:00Z",
  "endTime": "2026-07-15T11:00:00Z",
  "pricePerPerson": 300
}
```

### PATCH `/workout-sessions/:id`
Update session details (time, location, price).

### DELETE `/workout-sessions/:id`
Delete a session (only if status is UPCOMING).

### PATCH `/workout-sessions/:id/status`
Change session status manually.

**Request Body:**
```json
{
  "status": "COMPLETED"
}
```

**Allowed transitions:**
- REQUIRED_ACTION → COMPLETED
- REQUIRED_ACTION → MISSED
- UPCOMING → MISSED

### POST `/workout-sessions/:id/participants`
Add a participant to a session.

**Request Body (registered client):**
```json
{
  "clientId": 1
}
```

**Request Body (guest/unregistered):**
```json
{
  "customName": "Олег (друг Андрія)"
}
```

### DELETE `/workout-sessions/:sessionId/participants/:participantId`
Remove a participant from a session.

### POST `/workout-sessions/duplicate-week`
Duplicate last week's sessions into the current week.

**Request Body:**
```json
{
  "sourceWeekStart": "2026-07-07"
}
```

Creates new sessions with +7 days offset, status UPCOMING, empty participant lists.

---

## Reports

### GET `/reports/income`
Financial summary for a period.

**Query Params:**
- `from` (ISO date, required)
- `to` (ISO date, required)

**Response (200):**
```json
{
  "totalIncome": 15000,
  "totalSessions": 20,
  "completedSessions": 18,
  "missedSessions": 2,
  "individualIncome": 9000,
  "groupIncome": 6000,
  "totalHours": 20
}
```

### GET `/reports/statistics`
General statistics.

**Query Params:**
- `from` (ISO date, required)
- `to` (ISO date, required)

**Response (200):**
```json
{
  "totalClients": 15,
  "activeClients": 12,
  "sessionsPerWeek": 5.2,
  "missedRate": 10.0,
  "averageSessionPrice": 450
}
```

---

## User Profile

### GET `/users/me`
Get current user profile.

### PATCH `/users/me`
Update profile (firstName, lastName).

### PATCH `/users/me/telegram`
Link Telegram chat ID.

**Request Body:**
```json
{
  "tgChatId": "123456789"
}
```

---

## Telegram Bot Endpoints (Internal)

These are handled by the `nestjs-telegraf` module, not REST endpoints:
- `/start` command → links Telegram to user account
- `/upcoming` command → returns today's remaining sessions
- `/today` command → alias for `/upcoming`
