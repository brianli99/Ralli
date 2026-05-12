# Squad Database Setup Instructions

## Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - Visit: https://supabase.com/dashboard/projects
   - Select your Ralli project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Schema**
   - Copy the entire contents of `squad-schema-setup.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

4. **Verify Tables**
   - Go to "Table Editor" in the sidebar
   - You should see the new tables: `squads`, `squad_members`, `friendships`, etc.

## Option 2: Using Supabase CLI (If Available)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

## Option 3: Using psql (If You Have PostgreSQL Tools)

```bash
# Replace YOUR_DATABASE_URL with your actual Supabase database URL
psql "YOUR_DATABASE_URL" -f squad-schema-setup.sql
```

## Testing the Integration

After running the schema:

1. **Open the Ralli app**
2. **Navigate to the Squad tab**
3. **The app should show empty states instead of errors**
4. **Try creating a squad** (will work once schema is applied)

## What the Schema Creates

- **Core Tables**: squads, squad_members, friendships, matches, etc.
- **Message Tables**: squad_messages, direct_threads, direct_messages
- **Activity Tables**: feed_activities, activity_likes, activity_comments
- **Security**: Row Level Security (RLS) policies for data protection
- **Indexes**: Optimized database queries

## Troubleshooting

If you see errors like "relation does not exist":
- The database schema hasn't been applied yet
- Follow Option 1 above (Supabase Dashboard) - it's the easiest

If you see authentication errors:
- Make sure you're logged into the app
- Check your Supabase environment variables in `.env`
