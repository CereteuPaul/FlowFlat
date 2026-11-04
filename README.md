# FlowFlat 🏠✨

FlowFlat is a real-time shared household operations command center. It helps people living together organize chores, waste collection, bills, notes and important home information from one responsive dashboard.

The project is split into a React client and an Express API. PostgreSQL stores the application data through Prisma, while Socket.IO provides the foundation for real-time household updates.

---

## Project Overview 🧭

FlowFlat is designed to replace scattered messages, paper notes and ad-hoc spreadsheets with one shared household workspace.

The application supports:

- Account registration with email verification
- JWT-based login sessions
- Creating or joining one or more households
- Household invite codes and join-request approval
- Household roles and member management
- Shared chore assignment and completion tracking
- Waste collection schedules and put-out tracking
- Shared bills with member splits and payment status
- Shopping lists and household notes
- Securely stored home information such as Wi-Fi details or payment instructions
- Active-household switching for users who belong to multiple households
- Socket.IO household rooms for real-time communication

---

## Main Features ✨

### Household management

- Create a household and automatically become its administrator.
- Join an existing household using an invite code.
- Approve or reject pending join requests.
- Assign household roles such as `HOUSEHOLD_ADMIN`, `MEMBER` and `RESTRICTED_MEMBER`.
- Leave a household while optionally transferring responsibility.
- Switch between households without logging out.

### Chores ✅

- Create chores with notes, due dates and priority.
- Assign chores to household members.
- Toggle chores between pending and completed states.
- View completion statistics and workload distribution.

### Waste schedules ♻️

- Track weekly or biweekly collection schedules.
- Configure waste types and color tags.
- Mark waste as put out.
- Remove schedules that are no longer needed.

### Bills and payment splits 💸

- Create one-time or recurring household bills.
- Choose a currency and due date.
- Split a bill between selected household members.
- Mark individual shares as paid.
- Send reminders for outstanding shares when email delivery is configured.

### Notes and home information 📝

- Create general, shopping or household-supplies notes.
- Add checklist items to notes.
- Pin important notes for quick access.
- Store useful home information such as Wi-Fi, payment, apartment and emergency details.
- Copy secret values such as passwords or IBANs from the dashboard when needed.

### Authentication and email verification 🔐

- Passwords are hashed with `bcryptjs`.
- Sessions use signed JWT tokens with an eight-hour expiration.
- New accounts must verify their email before logging in.
- Verification email delivery supports Brevo HTTP API in production and Nodemailer SMTP locally.
- When no email provider is configured, the verification URL is printed in the server terminal for development.

---

## Technology Stack 🧩

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Lucide React icons

### Backend

- Node.js
- Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- Socket.IO
- JWT
- `bcryptjs`
- Nodemailer and optional Brevo email delivery

### Development infrastructure

- Docker Compose for PostgreSQL
- npm workspaces-style scripts at the repository root
- ESLint and TypeScript checks for the client and server

---

## Architecture 🏗️

```text
┌─────────────────────┐       HTTP / JWT        ┌──────────────────────┐
│ React + Vite client │ ──────────────────────▶ │ Express API server   │
│ localhost:5173      │ ◀────────────────────── │ localhost:4000       │
└─────────────────────┘       Socket.IO        └──────────┬───────────┘
                                                         │ Prisma
                                                         ▼
                                               ┌──────────────────────┐
                                               │ PostgreSQL database   │
                                               │ localhost:5432        │
                                               └──────────────────────┘
```

The backend exposes three main route groups:

- `/api/auth` — registration, email verification, login and current-user data
- `/api/households` — household membership, invitations, roles and requests
- `/api/dashboard` — chores, waste schedules, bills, notes and home information

The health endpoint is available at `/health`.

---

## Prerequisites ✅

Install the following before starting:

- Node.js 20 or newer
- npm
- Docker Desktop or Docker Engine with Docker Compose
- Git

You can run PostgreSQL locally without Docker, but the included Compose file is the quickest development setup.

---

## Quick Start ⚡

1. Clone the repository:

   ```bash
   git clone https://github.com/CereteuPaul/FlowFlat.git
   cd FlowFlat
   ```

2. Install dependencies:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

3. Start PostgreSQL:

   ```bash
   npm run db:up
   ```

4. Create `server/.env` using the configuration below.

5. Apply the Prisma schema and generate the Prisma client:

   ```bash
   cd server
   npx prisma db push
   npx prisma generate
   cd ..
   ```

6. Start the client and server together:

   ```bash
   npm run dev
   ```

7. Open the application:

   ```text
   http://localhost:5173
   ```

The API runs on `http://localhost:4000` by default.

---

## Environment Configuration 🔧

Create `server/.env`:

```env
DATABASE_URL="postgresql://flowflat_admin:flowflat_secure_password@localhost:5432/flowflat?schema=public"
PORT=4000
CLIENT_URL="http://localhost:5173"
JWT_SECRET="replace-this-with-a-long-random-secret"
```

### Optional email configuration

For production-style email delivery through Brevo:

```env
BREVO_API_KEY="your-brevo-api-key"
BREVO_SENDER_EMAIL="verified-sender@example.com"
EMAIL_FROM="FlowFlat <verified-sender@example.com>"
SERVER_URL="https://your-api-domain.example.com"
```

For local SMTP delivery through Gmail/Nodemailer:

```env
SMTP_USER="your-address@example.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="FlowFlat <your-address@example.com>"
SERVER_URL="http://localhost:4000"
```

Email configuration is optional during development. Without it, the backend logs the verification link in the terminal. Never commit `.env` files, API keys, passwords or production JWT secrets.

The credentials in `docker-compose.yml` are intended for local development only. Change them before using a shared or production database.

---

## Available Commands ▶️

Run these commands from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the client and server concurrently |
| `npm run client` | Start only the Vite client |
| `npm run server` | Start only the API server in watch mode |
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop the PostgreSQL container |
| `npm run db:studio` | Open Prisma Studio |

Run client checks from `client`:

```bash
npm run lint
npm run build
```

Build and run the server from `server`:

```bash
npm run build
npm start
```

---

## Database Workflow 🗄️

The Prisma schema is located at `server/prisma/schema.prisma`.

For local development, apply schema changes directly with:

```bash
cd server
npx prisma db push
npx prisma generate
```

To inspect the database visually:

```bash
npm run db:studio
```

The main data models are:

- `User`
- `Household`
- `HouseholdMember`
- `JoinRequest`
- `Chore`
- `WasteSchedule`
- `Bill`
- `BillSplit`
- `Note`
- `HomeInfo`
- `SpaceBooking`

---

## API Overview 🌐

All protected routes require:

```http
Authorization: Bearer <jwt-token>
```

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and send verification |
| `GET` | `/api/auth/verify-email?token=...` | Verify an account |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Load the current authenticated user |

### Households

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/households/create` | Create a household |
| `POST` | `/api/households/join` | Join or request access with an invite code |
| `GET` | `/api/households/current` | Get the active household |
| `PATCH` | `/api/households/switch-active` | Change the active household |
| `GET` | `/api/households/requests` | Review household join requests |
| `PATCH` | `/api/households/requests/:id` | Approve or reject a request |
| `PATCH` | `/api/households/members/:id/role` | Change a member role |
| `DELETE` | `/api/households/members/:targetUserId` | Remove a member |
| `POST` | `/api/households/leave` | Leave the active household |

### Dashboard resources

The `/api/dashboard` route group provides summary data plus create, update, toggle, reminder and delete operations for chores, waste schedules, bills, bill splits, notes and home information.

The summary endpoint is:

```http
GET /api/dashboard/summary
```

### Health check

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

---

## Socket.IO Events 🔄

The server accepts Socket.IO connections and supports household rooms:

- `connection` — a client connects
- `join_household` — the client joins a household room by ID
- `disconnect` — the client leaves

The room structure allows household-specific updates to be added without broadcasting every event to every connected user.

---

## Project Structure 🗂️

```text
FlowFlat/
├── client/
│   ├── src/
│   │   ├── api/client.ts       # API client and JWT storage
│   │   ├── App.tsx             # Main dashboard and application flows
│   │   ├── App.css             # Component styles
│   │   └── index.css           # Tailwind theme and global styles
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL data model
│   ├── src/
│   │   ├── index.ts             # Express and Socket.IO entry point
│   │   ├── middleware/auth.ts  # JWT authentication middleware
│   │   ├── routes/auth.ts      # Authentication endpoints
│   │   ├── routes/household.ts # Household endpoints
│   │   ├── routes/dashboard.ts # Dashboard resource endpoints
│   │   └── utils/              # Password, token and email helpers
│   └── package.json
├── docker-compose.yml          # Local PostgreSQL service
├── package.json                # Root development scripts
└── README.md
```

---

## Troubleshooting 🐛

### Database connection errors

- Confirm Docker is running.
- Check the container with `docker compose ps`.
- Start PostgreSQL with `npm run db:up`.
- Confirm that `DATABASE_URL` matches the credentials and port in `docker-compose.yml`.
- Run `npx prisma db push` from the `server` directory.

### The client cannot reach the API

- Confirm the server is running on port `4000`.
- Set `VITE_API_URL` in `client/.env` if the API is hosted elsewhere:

  ```env
  VITE_API_URL="http://localhost:4000/api"
  ```

- Restart the Vite development server after changing environment variables.

### Login is blocked after registration

Accounts must be email verified before login. If no email provider is configured, copy the verification URL printed by the server and open it in a browser.

### Port already in use

Change `PORT` in `server/.env`, then point the client at the new API URL with `VITE_API_URL`.

### Prisma client errors

Run:

```bash
cd server
npx prisma generate
```

If the database schema is missing or outdated, run `npx prisma db push` as well.

---

## Development Notes 🛠️

- Keep secrets in environment files and never commit them.
- Use a strong random `JWT_SECRET` outside local development.
- Use Brevo or another production-ready email provider for deployed environments.
- Run the client lint/build checks before opening a pull request.
- Keep household authorization checks in the backend; the frontend should not be treated as a security boundary.

---

## Author 👨‍💻

Developed by [@CereteuPaul](https://github.com/CereteuPaul).

Repository: [github.com/CereteuPaul/FlowFlat](https://github.com/CereteuPaul/FlowFlat)
