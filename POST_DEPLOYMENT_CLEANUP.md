# Post-Deployment Cleanup

## After Lovable deployment is successful:

### Step 1: Re-protect .env file

Run these commands:

```bash
# Edit .gitignore to uncomment .env
# Change this line:  # .env
# Back to:           .env

# Then remove .env from git tracking (keeps local file)
git rm --cached .env

# Commit the change
git commit -m "Re-add .env to .gitignore after Lovable deployment"

# Push to main
git push origin main
```

### Step 2: Verify deployment

1. Visit your Lovable deployment URL
2. Check that Supabase is connected
3. Test login functionality
4. Verify all features work

### Notes:
- The `.env` file will remain on your local machine
- It will no longer be tracked in git
- Lovable deployment will continue to work as it already has the configuration
- For future environment changes, update through Lovable's dashboard or re-commit temporarily

---

## Quick Command to Re-protect .env:

```bash
# All in one line
sed -i 's/# \.env/\.env/' .gitignore && git rm --cached .env && git commit -m "Re-add .env to .gitignore" && git push origin main
```

Or manually:
1. Edit `.gitignore` - uncomment `.env`
2. Run: `git rm --cached .env`
3. Commit and push
