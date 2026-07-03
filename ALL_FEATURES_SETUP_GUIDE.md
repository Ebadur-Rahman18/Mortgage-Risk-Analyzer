

# Complete Features Setup Guide

## Overview
This guide will help you set up **Tasks**, **Knowledge Base**, and **Feedback** features for your Mortgage Control Tower application.

---

## Quick Setup Summary

Run these 3 SQL migrations in order:

1. ✅ **Clients** (Already done): `create-clients-table.sql`  
2. 📋 **Tasks**: `create-tasks-table.sql`
3. 📚 **Knowledge Base**: `create-knowledge-tables.sql`
4. 💬 **Feedback**: `create-feedback-table.sql`

---

## 📋 Feature 1: Tasks Management

### What You Get
- ✅ Create and assign tasks
- ✅ Set priority (low, medium, high, urgent)
- ✅ Set status (todo, in_progress, completed, cancelled)
- ✅ Assign due dates
- ✅ Link tasks to clients and meetings
- ✅ Filter by status, priority, assigned user
- ✅ Quick status updates from list view
- ✅ Track overdue tasks

### Database Migration

**File**: `create-tasks-table.sql`

**What it creates**:
- `public.tasks` table with all task fields
- Indexes for fast filtering and searching
- RLS policies (users see their own tasks + admin/moderator see all)
- Auto-updated timestamps

### How to Run

1. Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql
2. Click **"New query"**
3. Copy entire contents of `create-tasks-table.sql`
4. Click **"Run"** or press Ctrl+Enter
5. Wait for: ✅ "Success. No rows returned"

### Test the Feature

1. Wait 1-2 minutes for deployment
2. Navigate to: `/tasks`
3. Click **"Create Task"**
4. Fill in:
   - Title: "Review mortgage application"
   - Status: To Do
   - Priority: High
   - Due Date: Tomorrow
   - Description: "Complete review by end of day"
5. Click **"Create Task"**
6. Should see: ✅ "Task created successfully"

---

## 📚 Feature 2: Knowledge Base

### What You Get
- ✅ Create knowledge articles with markdown support
- ✅ Upload files (PDF, DOC, DOCX, TXT, MD) up to 10MB
- ✅ Organize with categories
- ✅ Tag articles for easy discovery
- ✅ Full-text search across all content
- ✅ View count tracking
- ✅ Recently added and popular articles
- ✅ Draft/Published/Archived statuses
- ✅ File storage in Supabase bucket

### Database Migration

**File**: `create-knowledge-tables.sql`

**What it creates**:
- `public.knowledge_categories` table
- `public.knowledge_entries` table
- `storage.buckets` for file uploads
- Storage policies for user file access
- Default categories (Getting Started, Documentation, Best Practices, FAQs)
- Full-text search indexes

### How to Run

1. Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql
2. Click **"New query"**
3. Copy entire contents of `create-knowledge-tables.sql`
4. Click **"Run"** or press Ctrl+Enter
5. Wait for: ✅ "Success. No rows returned"

### Test the Feature

**Test 1: Add Entry Manually**
1. Navigate to: `/knowledge/new`
2. Fill in:
   - Title: "Getting Started with Mortgages"
   - Content: "This is a comprehensive guide to mortgages..."
   - Summary: "Learn the basics of mortgage applications"
3. Click **"Create Entry"**
4. Should redirect to `/knowledge` with new article listed

**Test 2: Upload File**
1. Navigate to: `/knowledge/upload`
2. Select a PDF or DOC file
3. Add optional metadata (title, description, category, tags)
4. Click **"Upload Files"**
5. Watch progress bars
6. Should see: ✅ "Successfully uploaded X file(s)"

**Test 3: Browse and Search**
1. Go to: `/knowledge`
2. Try searching for keywords
3. Click on categories to filter
4. View articles to increment view count

---

## 💬 Feature 3: Feedback System

### What You Get
- ✅ Submit feedback from users
- ✅ Categorize as: General, Bug, Feature, Improvement
- ✅ Rate experience (1-5 stars)
- ✅ Track feedback status (pending, reviewed, resolved, closed)
- ✅ Admin notes on feedback items
- ✅ Users see their own feedback history
- ✅ Admins see all feedback

### Database Migration

**File**: `create-feedback-table.sql`

**What it creates**:
- `public.feedback` table
- RLS policies (users see their own feedback, admins see all)
- Auto-timestamp triggers
- Auto-resolve tracking

### How to Run

1. Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql
2. Click **"New query"**
3. Copy entire contents of `create-feedback-table.sql`
4. Click **"Run"** or press Ctrl+Enter
5. Wait for: ✅ "Success. No rows returned"

### Test the Feature

1. Navigate to: `/feedback`
2. Fill in feedback form:
   - Type: Bug Report
   - Subject: "Task creation is slow"
   - Message: "When I create a task, it takes 5 seconds to save"
   - Rating: 4 stars
3. Click **"Submit Feedback"**
4. Should see: ✅ "Feedback submitted successfully!"
5. Your feedback appears in "My Feedback" section on the right

---

## 🔄 Complete Setup Checklist

### Pre-requisites
- [x] Supabase project created
- [x] Users can log in
- [x] Profiles and user_roles tables exist

### Database Migrations

Run in this order:

- [ ] **Step 1**: Run `create-tasks-table.sql`
  - Verify: `SELECT * FROM public.tasks;` returns empty table
  
- [ ] **Step 2**: Run `create-knowledge-tables.sql`
  - Verify: `SELECT * FROM public.knowledge_categories;` shows 4 default categories
  - Verify: `SELECT * FROM storage.buckets WHERE id = 'user-knowledge';` shows bucket
  
- [ ] **Step 3**: Run `create-feedback-table.sql`
  - Verify: `SELECT * FROM public.feedback;` returns empty table

### Testing Each Feature

- [ ] **Tasks**:
  - [ ] Create a task
  - [ ] Edit a task
  - [ ] Delete a task
  - [ ] Filter by status
  - [ ] Filter by priority
  - [ ] Change status from list view

- [ ] **Knowledge Base**:
  - [ ] Create manual entry
  - [ ] Upload a file
  - [ ] Search for content
  - [ ] Filter by category
  - [ ] View an article (check view count increments)

- [ ] **Feedback**:
  - [ ] Submit feedback
  - [ ] View submitted feedback
  - [ ] Check different feedback types work

### Production Deployment

- [ ] **Code Changes Deployed**:
  - [ ] Lovable auto-deployed latest changes
  - [ ] All pages load without errors
  
- [ ] **Database Configured**:
  - [ ] All 3 migrations run successfully
  - [ ] RLS policies active
  - [ ] Storage bucket created

- [ ] **End-to-End Testing**:
  - [ ] Create task as regular user
  - [ ] Create knowledge article as admin
  - [ ] Upload file as regular user
  - [ ] Submit feedback as regular user
  - [ ] All features work on live URL

---

## 📊 Database Schema Summary

### Tables Created

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `tasks` | Task management | Status, priority, assignments, due dates |
| `knowledge_categories` | Organize articles | Hierarchical, icons, colors |
| `knowledge_entries` | Articles & docs | Markdown, tags, view tracking |
| `feedback` | User feedback | Types, ratings, admin notes |

### Storage Buckets

| Bucket | Purpose | Max Size | Allowed Types |
|--------|---------|----------|---------------|
| `user-knowledge` | Document uploads | 10MB | PDF, DOC, DOCX, TXT, MD |

### Permissions (RLS)

| Feature | Read | Create | Update | Delete |
|---------|------|--------|--------|--------|
| Tasks | Own + Admin | All Auth | Own + Admin | Own + Admin |
| Knowledge | Published + Own | All Auth | Own + Admin | Own + Admin |
| Feedback | Own + Admin | All Auth | Own Pending + Admin | Own Pending + Admin |

---

## 🐛 Troubleshooting

### Tasks Issues

**Problem**: "tasks table not found"  
**Solution**: Run `create-tasks-table.sql` migration

**Problem**: Can't see other users' tasks  
**Solution**: This is correct! RLS only shows your own tasks unless you're admin/moderator

**Problem**: Can't assign task to user  
**Solution**: Ensure user exists in `profiles` table

### Knowledge Base Issues

**Problem**: "knowledge_entries table not found"  
**Solution**: Run `create-knowledge-tables.sql` migration

**Problem**: File upload fails  
**Solution**: Check storage bucket exists: `SELECT * FROM storage.buckets WHERE id = 'user-knowledge'`

**Problem**: Can't see uploaded files  
**Solution**: Check file size < 10MB and type is allowed (PDF, DOC, DOCX, TXT, MD)

### Feedback Issues

**Problem**: "feedback table not found"  
**Solution**: Run `create-feedback-table.sql` migration

**Problem**: Can't see other users' feedback  
**Solution**: Only admins can see all feedback. Regular users only see their own

---

## 📝 Notes

### Foreign Key Dependencies

- **Tasks** depend on:
  - `clients` table (run clients migration first)
  - `auth.users` for assignments
  
- **Knowledge** depends on:
  - `auth.users` for authors
  
- **Feedback** depends on:
  - `auth.users` for submitters

### Data Flow

**Tasks**:
1. User creates task → `tasks` table
2. Task assigned to user → links to `auth.users`
3. Task linked to client → links to `clients` table
4. Filter/search uses indexes for performance

**Knowledge**:
1. Manual entry → `knowledge_entries` table
2. File upload → `storage.buckets` → Edge function extracts content → `knowledge_entries`
3. Search uses full-text index
4. Categories organize entries

**Feedback**:
1. User submits → `feedback` table with status "pending"
2. Admin reviews → updates status to "reviewed"
3. Admin resolves → status "resolved", auto-sets `resolved_at` and `resolved_by`

---

## 🎉 Success Indicators

You know it's working when:

✅ **Tasks**:
- Tasks page shows statistics (To Do, In Progress, Completed, Overdue counts)
- Can create, edit, delete tasks
- Filters work
- Status dropdown updates tasks instantly

✅ **Knowledge Base**:
- Categories appear on knowledge page
- Can create articles
- File upload shows progress bars
- Search returns relevant results
- View count increments when viewing articles

✅ **Feedback**:
- Form submits successfully
- Submitted feedback appears in "My Feedback" section
- Status badge shows correctly

---

## 🚀 Next Steps

After all features are working:

1. **Add more data**:
   - Create sample tasks
   - Add documentation articles
   - Encourage users to submit feedback

2. **Monitor usage**:
   - Check which articles are most viewed
   - Review feedback regularly
   - Track overdue tasks

3. **Extend features**:
   - Add task reminders
   - Implement knowledge article versioning
   - Add feedback voting/priority

---

## Need Help?

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check browser console for JavaScript errors
3. Verify RLS policies allow your user to access data
4. Ensure all migrations ran successfully
5. Try logging out and back in

---

**Last Updated**: 2026-02-04  
**Migration Files**: 
- `create-clients-table.sql` ✅
- `create-tasks-table.sql` 📋
- `create-knowledge-tables.sql` 📚
- `create-feedback-table.sql` 💬
