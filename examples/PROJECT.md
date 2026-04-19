# Project: Sample Web Application

## Overview
- Description: A simple task management web application
- Tech Stack: React, Node.js, Express, SQLite
- Architecture: REST API + React SPA

## Architecture Details
- Frontend: React 18 with Vite
- Backend: Express.js REST API
- Database: SQLite with better-sqlite3
- State: React Context API

## Key Components
- `/src/client` - React frontend application
- `/src/server` - Express.js API server
- `/src/server/db` - SQLite database files
- `/src/shared` - Shared types and utilities

## Development Notes
- Frontend runs on port 5173 (Vite dev server)
- Backend runs on port 3000
- Run `npm install` in both client and server directories
- Use `npm run dev` to start development servers

## TODO
- [ ] Initialize Express server with basic routes `test: npm test`
- [ ] Create SQLite database schema `test: node src/server/db/init.js`
- [ ] Implement CRUD API for tasks `test: npm run test:api`
- [ ] Build React task list component `test: npm run test:client`
- [ ] Add create task form `test: npm run test:forms`
- [ ] Implement task editing `test: npm run test:edit`
- [ ] Add task deletion with confirmation `test: npm run test:delete`
- [ ] Style the application `test: npm run test:styles`