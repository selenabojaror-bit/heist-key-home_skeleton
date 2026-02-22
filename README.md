# Heist Key Home — Full-Stack Web Game

**Course:** Open Web (קורס פתוח Web)  
**Live Demo:** https://heist-key-home-frontend.onrender.com/levels

## Overview
Heist Key Home is a full-stack web game developed as part of the Open Web course. The project is built with a **React (Vite)** frontend and a **Node.js/Express** backend, featuring RESTful API communication and persistent storage with **SQLite**.

## Tech Stack
**Frontend:** React + Vite, JavaScript, HTML, CSS  
**Backend:** Node.js + Express, SQLite

## Repository Structure
- `client/` — Frontend application (UI, game screens, API integration)
- `server/` — Backend application (REST API, logic, database layer)
- `server/data/` — SQLite database location (generated automatically)

## Key Features
- Interactive gameplay experience with levels flow
- Clear separation between client (UI) and server (logic + persistence)
- REST API communication with JSON responses
- Persistent data storage using SQLite

## How to Run Locally
### Backend
```bash
cd server
npm install
npm run dev
Default backend URL: http://127.0.0.1:4000

Frontend
cd client
npm install
npm run dev
Default frontend URL: http://127.0.0.1:5173

API
The frontend communicates with the backend through REST endpoints under /api/*.

Notes
Run both client and server simultaneously.

If you encounter connection/CORS issues, verify the backend URL and allowed origin configuration.

Authors
Selen Mahajna, Shaima Nigem

