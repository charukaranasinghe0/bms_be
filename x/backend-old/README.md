## Backend

Short steps to run in development:

1. **Install deps**: `cd backend && npm install`
2. **Generate Prisma client**: `npx prisma generate`
3. **Prisma migrate**: `npx prisma migrate dev`
4. **Seed**: `npx prisma db seed` (or `npm run seed` if implemented)
5. **Run dev**: `npm run dev`

### Docker Postgres

When running Postgres in Docker and the backend **on your host machine**, set `DATABASE_URL` so that:

- **host** is `localhost`
- **port** is the port you mapped from the container (e.g. `5432` on the host)

Example shape (do **not** copy credentials directly):

`postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public`

When both the backend and Postgres run **inside Docker (docker-compose)**, set `DATABASE_URL` so that:

- **host** is the **service name** of the Postgres container (e.g. `postgres`)
- **port** is the internal Postgres port (commonly `5432`)

Example shape:

`postgresql://USER:PASSWORD@postgres:5432/DBNAME?schema=public`

### One-shot install & dev commands

From the repo root:

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

After you have added models to `schema.prisma`, you will typically run:

```bash
npx prisma migrate dev --name init
npm run seed
```
