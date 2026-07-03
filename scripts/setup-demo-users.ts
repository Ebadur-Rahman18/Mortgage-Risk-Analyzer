/**
 * Setup Demo Users Script
 * 
 * This script creates demo users for testing the application locally.
 * It uses the Supabase Admin API to create users with predefined credentials.
 * 
 * Run with: npx tsx scripts/setup-demo-users.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pgxezxqrlooymhczomen.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Get it from: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/settings/api');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'moderator' | 'user';
}

const demoUsers: DemoUser[] = [
  {
    email: 'admin@collabai.software',
    password: 'Admin@123',
    full_name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'moderator@collabai.software',
    password: 'Moderator@123',
    full_name: 'Moderator User',
    role: 'moderator'
  },
  {
    email: 'demo@collabai.software',
    password: 'Demo@123',
    full_name: 'Demo User',
    role: 'user'
  }
];

async function setupDemoUsers() {
  console.log('🚀 Starting demo user setup...\n');

  for (const user of demoUsers) {
    try {
      console.log(`📝 Creating user: ${user.email} (${user.role})...`);

      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users.find(u => u.email === user.email);

      let userId: string;

      if (userExists) {
        console.log(`   ⚠️  User already exists, updating...`);
        userId = userExists.id;
        
        // Update password
        await supabase.auth.admin.updateUserById(userId, {
          password: user.password,
          email_confirm: true
        });
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name
          }
        });

        if (createError) {
          throw createError;
        }

        userId = newUser.user.id;
        console.log(`   ✅ User created successfully`);
      }

      // Update or create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: user.email,
          full_name: user.full_name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.log(`   ⚠️  Profile error: ${profileError.message}`);
      } else {
        console.log(`   ✅ Profile updated`);
      }

      // Set user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: user.role,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (roleError) {
        console.log(`   ⚠️  Role error: ${roleError.message}`);
      } else {
        console.log(`   ✅ Role set to: ${user.role}`);
      }

      console.log('');
    } catch (error: any) {
      console.error(`   ❌ Error creating user ${user.email}:`, error.message);
      console.log('');
    }
  }

  console.log('✨ Demo user setup complete!\n');
  console.log('You can now login with:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 Admin:     admin@collabai.software / Admin@123');
  console.log('🛡️  Moderator: moderator@collabai.software / Moderator@123');
  console.log('👤 User:      demo@collabai.software / Demo@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the setup
setupDemoUsers().catch(console.error);
