# AI English Speaking Assistant

Medium-level student project using:

- HTML/CSS/JavaScript frontend
- Node.js + Express backend
- Google Gemini API
- MongoDB for history
- Vercel for frontend
- Render for backend

## 1. Backend local setup

Open a terminal:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill:

```env
GEMINI_API_KEY=your_key
MONGODB_URI=your_mongodb_uri
MONGODB_DB=english_assistant
FRONTEND_URL=http://localhost:5500
```

Start:

```bash
npm start
```

Backend:

```text
http://localhost:10000
```

## 2. Frontend local setup

The simplest method is VS Code Live Server.

Open `frontend/index.html` with Live Server.

Then make sure `frontend/config.js` contains:

```js
const API_BASE_URL = "http://localhost:10000";
```

## 3. Deploy backend to Render

Create a Render Web Service from the `backend` directory/repository.

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Set environment variables:

```text
GEMINI_API_KEY
MONGODB_URI
MONGODB_DB
FRONTEND_URL
```

For `FRONTEND_URL`, use your Vercel URL after the frontend is deployed.

## 4. Deploy frontend to Vercel

Before deploying, edit:

```text
frontend/config.js
```

Change:

```js
const API_BASE_URL = "http://localhost:10000";
```

to your Render URL:

```js
const API_BASE_URL = "https://YOUR-BACKEND.onrender.com";
```

Deploy the `frontend` folder to Vercel.

## 5. Final connection

```text
Browser
   |
   v
Vercel Frontend
   |
   | HTTPS API requests
   v
Render Express Backend
   |
   +------> Gemini API
   |
   +------> MongoDB
```

Never put GEMINI_API_KEY in frontend JavaScript.
