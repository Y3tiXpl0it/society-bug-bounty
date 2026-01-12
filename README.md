# Society Bug Bounty

Society Bug Bounty is an open-source platform designed for the comprehensive management of Bug Bounty programs and responsible disclosure. It enables organizations to autonomously manage the entire lifecycle of their security reports.

## Key Features

- Multi-Organization Management: Host and manage multiple independent institutions or departments within a single platform, each with its own programs and security teams.
- Security Program Hosting: Create and publish security programs with specific rules, guidelines, and defined scopes for researchers to follow.
- Vulnerability Reporting: Submit detailed findings using a rich-text Markdown editor that supports embedding images and attaching multimedia proof-of-concept files.
- Report Lifecycle Tracking: Manage the progress of every finding through custom states (such as New, Triaged, or Resolved) and assign severity levels to prioritize fixes.
- Direct Communication Channel: A dedicated workspace for each report where researchers and organization members can exchange comments and collaborate on validating the vulnerability.
- Asset and Scope Definition: List and manage digital assets (domains, applications, or IPs) to clearly define which systems are authorized for security testing.
- Reward Management: Define and display reward structures or bounty tables based on the criticality of the reported vulnerabilities.
- Real-Time Notifications: Stay updated with instant alerts for new reports, status changes, or messages, ensuring a responsive workflow.
- User Profile Customization: Tools for participants to manage their digital identity, including professional bios, avatars, and participation stats.
- Secure Access via Google OIDC: Simplified and secure login process for all users through their existing Google accounts.
- Administrative Tools: A command-line interface for system administrators to manage settings, perform maintenance, and oversee the platform's general health.
- Audit Trail and Traceability: A complete historical record of all actions taken on a report to ensure transparency and accountability.

## Tech Stack

- **Backend**: fastapi, sqlalchemy, postgresql, redis, celery, socket.io, pydantic, uvicorn, gunicorn, alembic, typer.
- **Frontend**: react, typescript, vite, tailwindcss, axios, react-router-dom, socket.io-client, react-markdown, zod.
- **Infrastructure & Tools**: docker, docker-compose, caddy, flower, eslint, pytest, uv.

## Installation & Setup

1. Configure the environment variables based on `.env.template` (see Environment Variables section).

2. For development:
   ```bash
   make dev
   ```

3. For production:
   ```bash
   make prod
   ```

   **Note:** If `make` is not available on your system, you can run the commands directly:
   - For development: `docker compose up --build`
   - For production: `docker compose -f docker-compose.prod.yml --env-file .env.prod up --build`

4. Manual dependency installation (if not using Docker):
   - Backend: `cd backend && uv sync`
   - Frontend: `cd frontend && pnpm install`.

## Running the Application

- **Development**: `make dev` starts the backend at `http://localhost:8000`, frontend at `http://localhost:5173`, and auxiliary services (DB, Redis).
- **Production**: `make prod` uses Docker Compose with Caddy as reverse proxy.
- Access the app at `http://localhost:5173` (dev) or the configured domain (prod).
- Monitoring: Flower at `http://localhost:5555` for Celery tasks.

## API Documentation

The API is auto-documented with FastAPI. Access `/docs` (Swagger) or `/redoc` on the backend.

Main endpoints: `/auth`, `/users`, `/programs`, `/reports`, `/attachments`, `/notifications`.

## Command Line Interface (CLI)

For administrative tasks, use the CLI to manage organizations.

### Usage

```bash
docker compose exec backend uv run manage-organizations --help
```

### Example

Create a new organization:

```bash
docker compose exec backend uv run manage-organizations create-org --name "Example Corp"
```

Ensure Docker services are running.

## License

This project is licensed under the MIT License. See LICENSE file for details.