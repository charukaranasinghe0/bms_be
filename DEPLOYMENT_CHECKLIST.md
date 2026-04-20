# Railway Deployment Checklist

## ✅ Files Created/Modified

### New Files
- ✅ `Dockerfile` - Multi-stage Docker build for production
- ✅ `railway.toml` - Railway deployment configuration
- ✅ `.dockerignore` - Excludes unnecessary files from Docker build
- ✅ `RAILWAY_DEPLOYMENT.md` - Complete deployment guide
- ✅ `DEPLOYMENT_CHECKLIST.md` - This file

### Modified Files
- ✅ `package.json` - Added `prisma:deploy` script
- ✅ `prisma/schema.prisma` - Already correctly configured for Prisma 7

## 📋 Pre-Deployment Checklist

### Code Quality
- [ ] Run `npm run build` locally to verify build succeeds
- [ ] Run `npm run lint` to check for linting errors
- [ ] Test the app locally with `npm run start:dev`
- [ ] Verify all environment variables are documented in `.env.example`

### Database
- [ ] Verify Prisma schema is valid: `npx prisma validate`
- [ ] Check migrations are up to date: `npx prisma migrate status`
- [ ] Test migrations locally: `npx prisma migrate dev`

### Security
- [ ] Generate strong JWT secrets (use `openssl rand -base64 32`)
- [ ] Review CORS configuration in `src/main.ts`
- [ ] Ensure `.env` is in `.gitignore`
- [ ] Remove any hardcoded secrets from code

### Git
- [ ] Commit all changes
- [ ] Push to your Git repository (GitHub/GitLab/Bitbucket)
- [ ] Verify repository is accessible

## 🚀 Deployment Steps

### 1. Create Railway Project
- [ ] Sign up/login to [Railway](https://railway.app)
- [ ] Create new project
- [ ] Connect your Git repository

### 2. Add PostgreSQL Database
- [ ] Add PostgreSQL database to project
- [ ] Verify `DATABASE_URL` is automatically set

### 3. Configure Environment Variables
Copy from `.env.example` and set in Railway:
- [ ] `PORT=4000`
- [ ] `NODE_ENV=production`
- [ ] `JWT_ACCESS_SECRET` (generate new)
- [ ] `JWT_REFRESH_SECRET` (generate new)
- [ ] `ACCESS_TOKEN_TTL_DAYS=7`
- [ ] `REFRESH_TOKEN_TTL_DAYS=30`
- [ ] `REFRESH_COOKIE_NAME=refresh_token`
- [ ] `FRONTEND_ORIGIN` (your frontend URL)
- [ ] `SMTP_*` variables (if using email)
- [ ] `TWILIO_*` variables (if using SMS)

### 4. Deploy
- [ ] Push to repository (triggers automatic deployment)
- [ ] Monitor build logs in Railway dashboard
- [ ] Wait for deployment to complete

### 5. Verify Deployment
- [ ] Check health endpoint: `https://your-app.up.railway.app/health`
- [ ] Test API endpoints: `https://your-app.up.railway.app/api/...`
- [ ] Review application logs
- [ ] Verify database connection

### 6. (Optional) Seed Database
- [ ] Run: `railway run npm run seed`

## 🔍 Post-Deployment Verification

### API Endpoints to Test
- [ ] `GET /health` - Health check
- [ ] `POST /api/auth/login` - Authentication
- [ ] `POST /api/auth/register` - User registration
- [ ] `GET /api/products` - Products list
- [ ] `POST /api/pos/orders` - Create order

### Monitoring
- [ ] Set up log monitoring in Railway dashboard
- [ ] Check metrics (CPU, memory, requests)
- [ ] Configure alerts (optional)

## 🐛 Troubleshooting

### Build Fails
1. Check build logs in Railway dashboard
2. Verify `npm run build` works locally
3. Ensure all dependencies are in `package.json`

### Database Connection Issues
1. Verify `DATABASE_URL` is set
2. Check PostgreSQL service is running
3. Review Prisma configuration

### App Crashes
1. Check application logs
2. Verify all environment variables are set
3. Test health endpoint

### Migration Errors
1. Check migration files
2. Run `railway run npx prisma migrate deploy`
3. If needed: `railway run npx prisma migrate reset` (⚠️ destroys data)

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [NestJS Deployment Guide](https://docs.nestjs.com/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- Full deployment guide: See `RAILWAY_DEPLOYMENT.md`

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ Health endpoint returns 200 OK
- ✅ Database migrations applied successfully
- ✅ API endpoints respond correctly
- ✅ No errors in application logs
- ✅ Frontend can connect to backend (if applicable)

## 🔐 Security Notes

- Never commit `.env` file
- Use strong, unique secrets for production
- Keep dependencies updated
- Monitor for security vulnerabilities
- Use HTTPS only (Railway provides this automatically)
- Configure CORS properly for your frontend domain

## 💰 Cost Considerations

- Railway free tier: $5 credit/month
- Monitor usage in billing dashboard
- Consider sleep mode for non-production environments
- Upgrade plan if needed for higher traffic

---

**Need Help?**
- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- Create an issue in your repository
