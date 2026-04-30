# KAI Airbnb Owners App

Beta property and incident management app for KAI Airbnb Owners in Serena del Mar / Cartagena.

## Features

- Google/Firebase login ready
- Role-based UX for Global Admin, Standard Admin, Delegated Admin, and Owner
- Incident workflow: Open → Owner Verification → Resolved
- Smart notifications for owner verification, ready-to-resolve incidents, registrations, SLA aging, and automation suggestions
- Adaptive navigation with priority items and responsive mobile behavior
- Registrations dashboard with pending count and filters
- Interactive workflow filters
- Tooltips designed to stay visible across desktop, tablet, and mobile
- Render deployment ready

## Local development

```bash
npm install
cd client
npm install
cd ..
npm run dev
```

Client runs through Vite. API runs through Express.

## Render deployment

Use `render.yaml` or create a Render Web Service with:

- Build command: `npm install && npm run build`
- Start command: `npm start`

Add environment variables from `.env.example` and `client/.env.example`.

## Firebase

Create a Firebase web app, enable Google sign-in, and add the Vite variables listed in `client/.env.example`.

## Notes

This repository was initialized from the collaborative beta build and cleaned into a GitHub-ready structure. Large binary background assets were replaced with an SVG placeholder so the repo is lightweight and easy to deploy.