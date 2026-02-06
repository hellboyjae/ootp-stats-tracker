import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for serverless
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Excluded tournaments for DAILY drafts (from the bookmarklet)
const EXCLUDED_DAILY_TOURNAMENTS = [
  '*1*Daily Low Iron',
  '*3*Daily Low Diamond',
  '*3*Daily Open Low Cap',
  '*3*Daily Open High Cap',
  '*3*Daily Wide Open',
  '*2*Daily Super Silver Supper',
  'Monday Up and At Them Bronze',
  'Thursday Live-Plus Cap',
  'Thursday Time Machine Cap',
  'Saturday Low Gold Power to Live Plus',
  'Sunday High Gold Century Cap',
  'Tuesday Time Machine Cap',
  'Daily Jerk Store - Speed',
  'Daily Rocking Chair Lunch',
  'Daily Get in Line Orderly',
  'Daily Hitters First',
  'Daily Evening Rocking Chair',
  'Daily Low of Lows Evening',
  'Daily Mixed Bag Evening',
  'Daily Up Late with Diamond and Gold',
  'Tuesday Rocking Chair'
];

// Star calculation for DAILY drafts (max 128 players)
function getDailyStarsForPosition(size, pos) {
  if (size === 128) {
    if (pos === 0) return 130;
    if (pos === 1) return 90;
    if (pos === 2 || pos === 3) return 60;
    if (pos >= 4 && pos <= 7) return 30;
    if (pos >= 8 && pos <= 15) return 15;
    if (pos >= 16 && pos <= 31) return 10;
    return 0;
  } else if (size === 64) {
    if (pos === 0) return 100;
    if (pos === 1) return 60;
    if (pos === 2 || pos === 3) return 30;
    if (pos >= 4 && pos <= 7) return 15;
    if (pos >= 8 && pos <= 15) return 10;
    return 0;
  } else if (size === 32) {
    if (pos === 0) return 70;
    if (pos === 1) return 40;
    if (pos === 2 || pos === 3) return 10;
    if (pos >= 4 && pos <= 7) return 5;
    return 0;
  }
  return 0;
}

// Star calculation for WEEKLY drafts (up to 256 players)
function getWeeklyStarsForPosition(size, pos) {
  if (size === 256) {
    if (pos === 0) return 550;
    if (pos === 1) return 350;
    if (pos === 2 || pos === 3) return 200;
    if (pos >= 4 && pos <= 7) return 100;
    if (pos >= 8 && pos <= 15) return 50;
    if (pos >= 16 && pos <= 31) return 25;
    if (pos >= 32 && pos <= 63) return 10;
    return 0;
  } else if (size === 128) {
    if (pos === 0) return 400;
    if (pos === 1) return 300;
    if (pos === 2 || pos === 3) return 150;
    if (pos >= 4 && pos <= 7) return 75;
    if (pos >= 8 && pos <= 15) return 25;
    if (pos >= 16 && pos <= 31) return 10;
    return 0;
  } else if (size === 64) {
    if (pos === 0) return 250;
    if (pos === 1) return 150;
    if (pos === 2 || pos === 3) return 75;
    if (pos >= 4 && pos <= 7) return 25;
    if (pos >= 8 && pos <= 15) return 10;
    return 0;
  } else if (size === 32) {
    if (pos === 0) return 70;
    if (pos === 1) return 40;
    if (pos === 2 || pos === 3) return 10;
    if (pos >= 4 && pos <= 7) return 5;
    return 0;
  }
  return 0;
}

// Parse CSV text into array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, idx) => {
      let val = values[idx] || '';
      // Try to parse as number
      const num = parseFloat(val);
      row[header] = isNaN(num) ? val : num;
    });
    
    // Handle placement columns (1st, 2nd, 3rd, etc. and extra columns)
    const placementKeys = headers.filter(k => /^\d+(st|nd|rd|th)$/.test(k) || k === '...');
    const placements = placementKeys.map(k => row[k]).filter(v => v != null && String(v).trim() !== '');
    
    // Also check for extra values beyond headers
    if (values.length > headers.length) {
      for (let j = headers.length; j < values.length; j++) {
        if (values[j] && values[j].trim()) {
          placements.push(values[j].trim());
        }
      }
    }
    
    row.placements = placements.map(p => String(p).trim()).filter(Boolean);
    rows.push(row);
  }
  
  return rows;
}

// Fetch the CSV URL from the competitive page
async function fetchDraftCSVUrl() {
  const pageUrl = 'https://pt26.ootpdevelopments.com/competitive/';
  const response = await fetch(pageUrl);
  const html = await response.text();
  
  // Find the drafts link - look for href containing "draft_dump"
  const match = html.match(/href=["']([^"']*draft_dump[^"']*)["']/i);
  if (match) {
    let url = match[1];
    // Make absolute if relative
    if (url.startsWith('/')) {
      url = 'https://pt26.ootpdevelopments.com' + url;
    } else if (!url.startsWith('http')) {
      url = 'https://pt26.ootpdevelopments.com/competitive/' + url;
    }
    return url;
  }
  
  throw new Error('Could not find draft CSV link on page');
}

// Process leaderboard for a specific type (daily or weekly)
function processLeaderboardType(rows, isDaily) {
  // Group by tournament title
  const grouped = {};
  rows.forEach(row => {
    if (!row || !row.title) return;
    const title = row.title.trim();
    
    // Filter based on type
    const titleIsDaily = /daily/i.test(title);
    if (isDaily && !titleIsDaily) return; // Want daily, but this isn't
    if (!isDaily && titleIsDaily) return; // Want weekly, but this is daily
    
    // Exclude specific tournaments (only for daily)
    if (isDaily && EXCLUDED_DAILY_TOURNAMENTS.includes(title)) return;
    
    if (!grouped[title]) grouped[title] = [];
    grouped[title].push(row);
  });
  
  // Process each tournament group
  const finalResults = [];
  Object.entries(grouped).forEach(([title, tournamentRows]) => {
    // Sort by num descending (most recent instances first)
    tournamentRows.sort((a, b) => (b.num || 0) - (a.num || 0));
    
    // For daily tournaments, take last 7 instances; for weekly, take 1
    const countNeeded = isDaily ? 7 : 1;
    const chosen = tournamentRows.slice(0, countNeeded);
    
    // Get max placement size
    const size = chosen.reduce((max, r) => {
      const len = Array.isArray(r.placements) ? r.placements.length : 0;
      return Math.max(max, len);
    }, 0);
    
    finalResults.push({
      title,
      size,
      instances: chosen
    });
  });
  
  // Calculate stars per user
  const userStars = {};
  const getStars = isDaily ? getDailyStarsForPosition : getWeeklyStarsForPosition;
  
  finalResults.forEach(tournament => {
    const size = tournament.size;
    
    tournament.instances.forEach(instance => {
      if (!Array.isArray(instance.placements)) return;
      
      instance.placements.forEach((user, idx) => {
        if (!user) return;
        const username = String(user).trim();
        if (!username) return;
        
        const stars = getStars(size, idx);
        if (stars === 0) return;
        
        if (!userStars[username]) userStars[username] = 0;
        userStars[username] += stars;
      });
    });
  });
  
  // Sort by stars
  return Object.entries(userStars)
    .map(([username, stars]) => ({ username, stars }))
    .sort((a, b) => b.stars - a.stars);
}

// Main processing function
async function processLeaderboard() {
  console.log('Starting leaderboard update...');
  
  // Fetch CSV URL
  const csvUrl = await fetchDraftCSVUrl();
  console.log('Found CSV URL:', csvUrl);
  
  // Extract date from URL
  const dateMatch = csvUrl.match(/(\d{8})/);
  const dumpDate = dateMatch ? dateMatch[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : new Date().toISOString().split('T')[0];
  console.log('Dump date:', dumpDate);
  
  // Fetch CSV
  const csvResponse = await fetch(csvUrl);
  let csvText = await csvResponse.text();
  
  // Skip first line if it's metadata
  const firstNewline = csvText.indexOf('\n');
  if (firstNewline !== -1) {
    const firstLine = csvText.slice(0, firstNewline);
    // Check if first line looks like metadata (not headers)
    if (!firstLine.includes('title') && !firstLine.includes('starttime')) {
      csvText = csvText.slice(firstNewline + 1);
    }
  }
  
  // Parse CSV
  const rows = parseCSV(csvText);
  console.log('Parsed rows:', rows.length);
  
  // Filter to recent data (starttime filter from bookmarklet)
  const minStartTime = 1759169668;
  const filteredRows = rows.filter(row => 
    row && typeof row.starttime === 'number' && row.starttime >= minStartTime
  );
  console.log('Filtered rows (recent):', filteredRows.length);
  
  // Process DAILY drafts
  const dailyUsers = processLeaderboardType(filteredRows, true);
  console.log('Daily users with stars:', dailyUsers.length);
  console.log('Daily Top 5:', dailyUsers.slice(0, 5));
  
  // Process WEEKLY drafts
  const weeklyUsers = processLeaderboardType(filteredRows, false);
  console.log('Weekly users with stars:', weeklyUsers.length);
  console.log('Weekly Top 5:', weeklyUsers.slice(0, 5));
  
  // Calculate week_of date (the Tuesday of this week)
  const now = new Date();
  const weekOf = new Date(now);
  // Adjust to Tuesday
  const dayOfWeek = weekOf.getDay();
  const daysToTuesday = (dayOfWeek >= 2) ? (dayOfWeek - 2) : (dayOfWeek + 5);
  weekOf.setDate(weekOf.getDate() - daysToTuesday);
  const weekOfStr = weekOf.toISOString().split('T')[0];
  
  console.log('Week of:', weekOfStr);
  
  // ============ SAVE DAILY DATA ============
  
  // Check if we already have daily data for this week
  const { data: existingDailyWeek } = await supabase
    .from('weekly_draft_leaderboard')
    .select('id')
    .eq('week_of', weekOfStr)
    .limit(1);
  
  if (existingDailyWeek && existingDailyWeek.length > 0) {
    await supabase
      .from('weekly_draft_leaderboard')
      .delete()
      .eq('week_of', weekOfStr);
    console.log('Deleted existing daily data for week:', weekOfStr);
  }
  
  // Insert daily leaderboard data
  const dailyLeaderboardRows = dailyUsers.map((user, idx) => ({
    week_of: weekOfStr,
    username: user.username,
    stars: user.stars,
    rank: idx + 1
  }));
  
  if (dailyLeaderboardRows.length > 0) {
    for (let i = 0; i < dailyLeaderboardRows.length; i += 100) {
      const batch = dailyLeaderboardRows.slice(i, i + 100);
      const { error } = await supabase
        .from('weekly_draft_leaderboard')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting daily leaderboard batch:', error);
        throw error;
      }
    }
    console.log('Inserted daily leaderboard rows:', dailyLeaderboardRows.length);
  }
  
  // Update daily all-time points for top 20
  const dailyTop20 = dailyUsers.slice(0, 20);
  for (let i = 0; i < dailyTop20.length; i++) {
    const user = dailyTop20[i];
    const points = 20 - i;
    const rank = i + 1;
    
    const { data: existing } = await supabase
      .from('alltime_drafter_points')
      .select('*')
      .eq('username', user.username)
      .single();
    
    if (existing) {
      const newBestFinish = existing.best_finish ? Math.min(existing.best_finish, rank) : rank;
      await supabase
        .from('alltime_drafter_points')
        .update({
          total_points: existing.total_points + points,
          weeks_participated: existing.weeks_participated + 1,
          best_finish: newBestFinish,
          last_updated: new Date().toISOString()
        })
        .eq('username', user.username);
    } else {
      await supabase
        .from('alltime_drafter_points')
        .insert({
          username: user.username,
          total_points: points,
          weeks_participated: 1,
          best_finish: rank,
          last_updated: new Date().toISOString()
        });
    }
  }
  console.log('Updated daily all-time points for top 20');
  
  // ============ SAVE WEEKLY DATA ============
  
  // Check if we already have weekly data for this week
  const { data: existingWeeklyWeek } = await supabase
    .from('weekly_draft_leaderboard_weekly')
    .select('id')
    .eq('week_of', weekOfStr)
    .limit(1);
  
  if (existingWeeklyWeek && existingWeeklyWeek.length > 0) {
    await supabase
      .from('weekly_draft_leaderboard_weekly')
      .delete()
      .eq('week_of', weekOfStr);
    console.log('Deleted existing weekly data for week:', weekOfStr);
  }
  
  // Insert weekly leaderboard data
  const weeklyLeaderboardRows = weeklyUsers.map((user, idx) => ({
    week_of: weekOfStr,
    username: user.username,
    stars: user.stars,
    rank: idx + 1
  }));
  
  if (weeklyLeaderboardRows.length > 0) {
    for (let i = 0; i < weeklyLeaderboardRows.length; i += 100) {
      const batch = weeklyLeaderboardRows.slice(i, i + 100);
      const { error } = await supabase
        .from('weekly_draft_leaderboard_weekly')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting weekly leaderboard batch:', error);
        throw error;
      }
    }
    console.log('Inserted weekly leaderboard rows:', weeklyLeaderboardRows.length);
  }
  
  // Update weekly all-time points for top 20
  const weeklyTop20 = weeklyUsers.slice(0, 20);
  for (let i = 0; i < weeklyTop20.length; i++) {
    const user = weeklyTop20[i];
    const points = 20 - i;
    const rank = i + 1;
    
    const { data: existing } = await supabase
      .from('alltime_drafter_points_weekly')
      .select('*')
      .eq('username', user.username)
      .single();
    
    if (existing) {
      const newBestFinish = existing.best_finish ? Math.min(existing.best_finish, rank) : rank;
      await supabase
        .from('alltime_drafter_points_weekly')
        .update({
          total_points: existing.total_points + points,
          weeks_participated: existing.weeks_participated + 1,
          best_finish: newBestFinish,
          last_updated: new Date().toISOString()
        })
        .eq('username', user.username);
    } else {
      await supabase
        .from('alltime_drafter_points_weekly')
        .insert({
          username: user.username,
          total_points: points,
          weeks_participated: 1,
          best_finish: rank,
          last_updated: new Date().toISOString()
        });
    }
  }
  console.log('Updated weekly all-time points for top 20');
  
  return {
    success: true,
    weekOf: weekOfStr,
    daily: {
      totalUsers: dailyUsers.length,
      top5: dailyUsers.slice(0, 5)
    },
    weekly: {
      totalUsers: weeklyUsers.length,
      top5: weeklyUsers.slice(0, 5)
    }
  };
}

// Vercel serverless handler
export default async function handler(req, res) {
  // Check for secret key to prevent unauthorized access
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow if it's a cron job (Vercel adds this header) or has correct secret
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  if (!isVercelCron && !hasValidSecret) {
    // For manual testing, allow GET without auth in development
    if (process.env.NODE_ENV === 'production' && req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  try {
    const result = await processLeaderboard();
    res.status(200).json(result);
  } catch (error) {
    console.error('Leaderboard update failed:', error);
    res.status(500).json({ error: error.message });
  }
}
