# Railway Deployment Guide

This guide walks you through deploying your NestJS bakery backend to Railway.

## Prerequisites

1. A [Railway](https://railway.app) account
2. Railway CLI installed (optional but recommended): `npm i -g @railway/cli`
3. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Create a New Railway Project

### Option A: Using Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your repository

### Option B: Using Railway CLI

```bash
railway login
railway init
railway link
```

## Step 2: Add PostgreSQL Database

1. In your Railway project dashboard, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically provision a PostgreSQL database
4. The `DATABASE_URL` environment variable will be automatically added to your service

## Step 3: Configure Environment Variables

In your Railway project dashboard:

1. Click on your service (not the database)
2. Go to the **"Variables"** tab
3. Add the following environment variables:

```env
PORT=4000
NODE_ENV=production
FRONTEND_ORIGIN=https://your-frontend-domain.com

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=your_strong_random_secret_here
JWT_REFRESH_SECRET=your_strong_random_refresh_secret_here

# Token TTL
ACCESS_TOKEN_TTL_DAYS=7
REFRESH_TOKEN_TTL_DAYS=30

# Cookie config
REFRESH_COOKIE_NAME=refresh_token

# Email (SMTP) - Optional
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com

# SMS (Twilio) - Optional
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

**Important Notes:**
- `DATABASE_URL` is automatically set by Railway when you add PostgreSQL
- Generate strong secrets for JWT tokens using: `openssl rand -base64 32`
- Update `FRONTEND_ORIGIN` with your actual frontend URL

## Step 4: Deploy

Railway will automatically deploy your app when you push to your repository.

### Manual Deployment (if needed)

```bash
railway up
```

## Step 5: Run Database Migrations

Migrations run automatically on startup via the `CMD` in the Dockerfile:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

If you need to run migrations manually:

```bash
railway run npx prisma migrate deploy
```

## Step 6: Verify Deployment

1. Check the deployment logs in Railway dashboard
2. Once deployed, Railway will provide a public URL (e.g., `https://your-app.up.railway.app`)
3. Test the health endpoint: `https://your-app.up.railway.app/health`
4. Test the API: `https://your-app.up.railway.app/api/...`

## Step 7: (Optional) Seed the Database

If you want to populate the database with initial data:

```bash
railway run npm run seed
```

## Troubleshooting

### Build Fails

- Check the build logs in Railway dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript compiles locally: `npm run build`

### Database Connection Issues

- Verify `DATABASE_URL` is set in environment variables
- Check that the PostgreSQL service is running
- Ensure Prisma schema is correct: `npx prisma validate`

### Migration Errors

- Check migration files in `prisma/migrations/`
- Reset database (⚠️ destroys data): `railway run npx prisma migrate reset`
- Apply migrations manually: `railway run npx prisma migrate deploy`

### App Crashes on Startup

- Check environment variables are set correctly
- Review logs: Railway dashboard → your service → "Logs" tab
- Verify the health endpoint is accessible

## Custom Domain (Optional)

1. Go to your service in Railway dashboard
2. Click **"Settings"** → **"Domains"**
3. Click **"Generate Domain"** or add a custom domain
4. Update `FRONTEND_ORIGIN` environment variable if needed

## Monitoring

- **Logs**: Railway dashboard → your service → "Logs" tab
- **Metrics**: Railway dashboard → your service → "Metrics" tab
- **Health Check**: Configured in `railway.toml` to check `/health` endpoint

## Scaling

Railway automatically scales based on your plan. To upgrade:

1. Go to project settings
2. Select a higher tier plan for more resources

## Environment-Specific Deployments

To deploy multiple environments (staging, production):

1. Create separate Railway projects for each environment
2. Use different Git branches
3. Configure environment-specific variables in each project

## Useful Commands

```bash
# View logs
railway logs

# Run commands in Railway environment
railway run <command>

# Open Railway dashboard
railway open

# Check service status
railway status
```

## Security Checklist

- ✅ Strong JWT secrets set
- ✅ `NODE_ENV=production` set
- ✅ CORS configured with specific origin (not `*`)
- ✅ Database credentials secured (Railway manages this)
- ✅ `.env` file in `.gitignore`
- ✅ Helmet middleware enabled (already in `main.ts`)

## Cost Optimization

- Railway offers a free tier with $5 credit/month
- Monitor usage in the billing section
- Consider using Railway's sleep feature for non-production environments

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: Create an issue in your repository
