import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from './supabase.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ThemeContext = createContext();

// Helper to lighten/darken colors
const adjustColor = (hex, amount) => {
  const c = hex.replace('#', '');
  let r = parseInt(c.substr(0, 2), 16);
  let g = parseInt(c.substr(2, 2), 16);
  let b = parseInt(c.substr(4, 2), 16);
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Helper to add transparency to hex color
const withAlpha = (hex, alpha) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// MLB Team color schemes - primary is main color, secondary is accent
// Team colors: primary = DARK (backgrounds, sidebar, table headers)
//              secondary = BRIGHT (accent text, buttons, highlights, gold)
const teamColors = {
  default: { primary: '#1e3a5f', secondary: '#fbbf24', name: 'Default' },
  // AL East
  yankees: { primary: '#003087', secondary: '#C4CED4', name: 'Yankees' },
  redsox: { primary: '#0C2340', secondary: '#BD3039', name: 'Red Sox' },
  rays: { primary: '#092C5C', secondary: '#8FBCE6', name: 'Rays' },
  bluejays: { primary: '#134A8E', secondary: '#5CB8F0', name: 'Blue Jays' },
  orioles: { primary: '#1A1110', secondary: '#DF4601', name: 'Orioles' },
  // AL Central
  guardians: { primary: '#00385D', secondary: '#E50022', name: 'Guardians' },
  twins: { primary: '#002B5C', secondary: '#D31145', name: 'Twins' },
  whitesox: { primary: '#27251F', secondary: '#C4CED4', name: 'White Sox' },
  tigers: { primary: '#0C2340', secondary: '#FA4616', name: 'Tigers' },
  royals: { primary: '#004687', secondary: '#BD9B60', name: 'Royals' },
  // AL West
  astros: { primary: '#002D62', secondary: '#EB6E1F', name: 'Astros' },
  rangers: { primary: '#003278', secondary: '#C0111F', name: 'Rangers' },
  mariners: { primary: '#0C2C56', secondary: '#00C9C9', name: 'Mariners' },
  angels: { primary: '#003263', secondary: '#E4002B', name: 'Angels' },
  athletics: { primary: '#003831', secondary: '#EFB21E', name: 'Athletics' },
  // NL East
  braves: { primary: '#13274F', secondary: '#CE1141', name: 'Braves' },
  phillies: { primary: '#002D72', secondary: '#E81828', name: 'Phillies' },
  mets: { primary: '#002D72', secondary: '#FF5910', name: 'Mets' },
  marlins: { primary: '#0A1E3D', secondary: '#00A3E0', name: 'Marlins' },
  nationals: { primary: '#14225A', secondary: '#E4002B', name: 'Nationals' },
  // NL Central
  brewers: { primary: '#12284B', secondary: '#FFC52F', name: 'Brewers' },
  cardinals: { primary: '#0C2340', secondary: '#C41E3A', name: 'Cardinals' },
  cubs: { primary: '#0E3386', secondary: '#CC3433', name: 'Cubs' },
  reds: { primary: '#1A1114', secondary: '#E4002B', name: 'Reds' },
  pirates: { primary: '#27251F', secondary: '#FDB827', name: 'Pirates' },
  // NL West
  dodgers: { primary: '#005A9C', secondary: '#EF3E42', name: 'Dodgers' },
  padres: { primary: '#2F241D', secondary: '#FFC425', name: 'Padres' },
  giants: { primary: '#1E1710', secondary: '#FD5A1E', name: 'Giants' },
  dbacks: { primary: '#1E0C12', secondary: '#E4002B', name: 'D-backs' },
  rockies: { primary: '#333366', secondary: '#C4CED4', name: 'Rockies' },
};

// Generate a full theme from team colors
const generateTeamTheme = (teamKey, isDark) => {
  const team = teamColors[teamKey] || teamColors.default;
  const primary = team.primary;
  const secondary = team.secondary;
  
  if (isDark) {
    // Dark mode - use team's TRUE primary color prominently
    return {
      // Main backgrounds stay dark for readability
      mainBg: '#0a0e17',
      cardBg: '#0f1419',
      tableBg: '#111827',
      inputBg: '#0f1419',
      
      // Header and sidebar use TRUE primary color
      sidebarBg: primary,
      panelBg: '#141a23',
      
      // Table header uses primary color
      tableHeaderBg: primary,
      tableRowBg: '#111827',
      tableRowHover: withAlpha(primary, 0.15),
      tableBorder: withAlpha(primary, 0.3),
      
      // Text colors
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      textMuted: '#94a3b8',
      textDim: '#64748b',
      
      // Accent uses secondary color for contrast
      accent: secondary,
      accentHover: adjustColor(secondary, -20),
      
      // Status colors
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      
      // Gold uses secondary
      gold: secondary,
      
      // Borders mix both colors
      border: withAlpha(primary, 0.4),
      borderLight: withAlpha(secondary, 0.3),
      inputBorder: withAlpha(primary, 0.4),
      
      // Store original colors for special use
      teamPrimary: primary,
      teamSecondary: secondary,
    };
  } else {
    // Light mode - use team colors as accents on white backgrounds
    return {
      // Main backgrounds stay light for readability
      mainBg: '#f8fafc',
      cardBg: '#ffffff',
      tableBg: '#ffffff',
      inputBg: '#ffffff',
      
      // Header and sidebar use primary color
      sidebarBg: primary,
      panelBg: withAlpha(primary, 0.08),
      
      // Table header uses primary
      tableHeaderBg: primary,
      tableRowBg: '#ffffff',
      tableRowHover: withAlpha(primary, 0.05),
      tableBorder: withAlpha(primary, 0.2),
      
      // Text colors
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      textDim: '#94a3b8',
      
      // Accent uses secondary for buttons etc
      accent: secondary,
      accentHover: adjustColor(secondary, -20),
      
      // Status colors
      success: '#16a34a',
      warning: '#d97706',
      error: '#dc2626',
      
      // Gold uses secondary
      gold: secondary,
      
      // Borders
      border: withAlpha(primary, 0.2),
      borderLight: withAlpha(primary, 0.15),
      inputBorder: withAlpha(primary, 0.25),
      
      // Store original colors for special use
      teamPrimary: primary,
      teamSecondary: secondary,
    };
  }
};

function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  
  const [team, setTeam] = useState(() => {
    return localStorage.getItem('teamTheme') || 'default';
  });
  
  // Inject keyframes for news banner animation and select dropdown styles
  useEffect(() => {
    const styleId = 'news-banner-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes scrollBanner {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        select option, select optgroup {
          background: #1a1a2e;
          color: #e2e8f0;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  useEffect(() => { localStorage.setItem('theme', isDark ? 'dark' : 'light'); }, [isDark]);
  useEffect(() => { localStorage.setItem('teamTheme', team); }, [team]);
  
  const toggle = () => setIsDark(!isDark);
  const setTeamTheme = (teamKey) => setTeam(teamKey);
  
  // Generate full theme based on team and dark/light mode
  let theme;
  if (team === 'default') {
    theme = isDark ? darkTheme : lightTheme;
  } else {
    theme = generateTeamTheme(team, isDark);
  }
  
  return <ThemeContext.Provider value={{ isDark, toggle, theme, team, setTeamTheme, teamColors }}>{children}</ThemeContext.Provider>;
}

function useTheme() { return useContext(ThemeContext); }

const AuthContext = createContext();

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function AuthProvider({ children }) {
  const { theme } = useTheme();
  const [authLevel, setAuthLevel] = useState('none');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [requiredLevel, setRequiredLevel] = useState('upload');
  const [authError, setAuthError] = useState('');

  useEffect(() => { 
    const saved = sessionStorage.getItem('authLevel');
    if (saved === 'master' || saved === 'upload') setAuthLevel(saved);
  }, []);

  const hasAccess = (required) => {
    if (authLevel === 'master') return true;
    if (authLevel === 'upload' && required === 'upload') return true;
    return false;
  };

  const requestAuth = (onSuccess, level = 'upload') => {
    if (hasAccess(level)) { onSuccess(); } 
    else { setPendingAction(() => onSuccess); setRequiredLevel(level); setShowPasswordModal(true); setAuthError(''); }
  };

  const handlePasswordSubmit = async () => {
    try {
      const hashedInput = await hashPassword(passwordInput);
      const { data, error } = await supabase.from('site_content').select('content').eq('id', 'auth').single();
      if (error || !data?.content) { setAuthError('Auth not configured'); setPasswordInput(''); return; }
      const { passwordHash, uploadPasswordHash } = data.content;
      if (passwordHash && hashedInput === passwordHash) {
        setAuthLevel('master'); sessionStorage.setItem('authLevel', 'master');
        setShowPasswordModal(false); setPasswordInput(''); setAuthError('');
        if (pendingAction) { pendingAction(); setPendingAction(null); }
        return;
      }
      if (uploadPasswordHash && hashedInput === uploadPasswordHash) {
        if (requiredLevel === 'upload') {
          setAuthLevel('upload'); sessionStorage.setItem('authLevel', 'upload');
          setShowPasswordModal(false); setPasswordInput(''); setAuthError('');
          if (pendingAction) { pendingAction(); setPendingAction(null); }
        } else { setAuthError('This action requires master password'); setPasswordInput(''); }
        return;
      }
      setAuthError('Incorrect password'); setPasswordInput('');
    } catch (e) { setAuthError('Authentication failed'); setPasswordInput(''); }
  };

  const logout = () => {
    setAuthLevel('none');
    sessionStorage.removeItem('authLevel');
  };

  const styles = getStyles(theme);
  return (
    <AuthContext.Provider value={{ authLevel, hasAccess, requestAuth, logout }}>
      {children}
      {showPasswordModal && (
        <div style={styles.modalOverlay}><div style={styles.modal}>
          <h3 style={styles.modalTitle}>Enter Password</h3>
          <p style={styles.modalText}>{requiredLevel === 'master' ? 'Master password required.' : 'Enter password to continue.'}</p>
          {authError && <p style={styles.authError}>{authError}</p>}
          <input type="password" placeholder="Password..." value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} style={styles.input} autoFocus />
          <div style={styles.modalBtns}>
            <button onClick={handlePasswordSubmit} style={styles.saveBtn}>Submit</button>
            <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPendingAction(null); setAuthError(''); }} style={styles.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}
    </AuthContext.Provider>
  );
}

function useAuth() { return useContext(AuthContext); }

// Helper: Update position counts and get primary position
function updatePositionTracking(existing, instancePos) {
  const positionCounts = { ...(existing._positionCounts || {}) };
  const pos = (instancePos || '').toUpperCase().trim();
  if (pos) {
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  }
  const positions = Object.keys(positionCounts).sort((a, b) => positionCounts[b] - positionCounts[a]);
  const primaryPos = positions[0] || existing.pos || pos;
  return { _positionCounts: positionCounts, positions, pos: primaryPos };
}

// Helper: Initialize position tracking for new player
function initPositionTracking(instancePos) {
  const pos = (instancePos || '').toUpperCase().trim();
  return {
    _positionCounts: pos ? { [pos]: 1 } : {},
    positions: pos ? [pos] : [],
    pos: pos
  };
}

function parseVariant(v) { 
  if (!v) return 'N';
  const val = String(v).toUpperCase().trim();
  return (val === 'Y' || val === 'YES' || val === '1' || val === 'TRUE') ? 'Y' : 'N';
}

function getOvrColor(ovr) {
  const val = parseInt(ovr) || 0;
  if (val >= 100) return '#E82D07';
  if (val >= 90) return '#32EBFC';
  if (val >= 80) return '#FFE61F';
  if (val >= 70) return '#E0E0E0';
  if (val >= 60) return '#664300';
  return '#FFFFFF';
}

function getDefColor(def) {
  const val = parseInt(def) || 0;
  if (val >= 100) return '#a855f7'; // Purple - elite defense
  if (val >= 80) return '#3b82f6';  // Blue - great defense
  if (val >= 50) return '#22c55e';  // Green - good defense
  return '#fbbf24';                  // Yellow - poor defense
}

function NewsBanner({ theme, styles }) {
  const { hasAccess, requestAuth } = useAuth();
  const [bannerText, setBannerText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadBanner();
  }, []);

  const loadBanner = async () => {
    try {
      const { data } = await supabase.from('site_content').select('*').eq('id', 'news_banner').single();
      if (data?.content?.text) setBannerText(data.content.text);
      else setBannerText("Try our live draft assistant and get early access when OOTP 27 releases! Reach out to hellboyjae98 on discord to get started!");
    } catch (e) {
      setBannerText("Try our live draft assistant and get early access when OOTP 27 releases! Reach out to hellboyjae98 on discord to get started!");
    }
  };

  const saveBanner = async () => {
    try {
      await supabase.from('site_content').upsert({ id: 'news_banner', content: { text: editText }, updated_at: new Date().toISOString() });
      setBannerText(editText);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save banner', e);
    }
  };

  const startEditing = () => {
    requestAuth(() => {
      setEditText(bannerText);
      setIsEditing(true);
    }, 'master');
  };

  if (!bannerText && !isEditing) return null;

  return (
    <div style={styles.newsBannerContainer}>
      {isEditing ? (
        <div style={styles.newsBannerEdit}>
          <input 
            type="text" 
            value={editText} 
            onChange={(e) => setEditText(e.target.value)} 
            style={styles.newsBannerInput}
            placeholder="Enter banner text..."
          />
          <button onClick={saveBanner} style={styles.newsBannerSaveBtn}>Save</button>
          <button onClick={() => setIsEditing(false)} style={styles.newsBannerCancelBtn}>Cancel</button>
        </div>
      ) : (
        <div style={styles.newsBannerScroll}>
          <div style={styles.newsBannerText}>
            {bannerText}
          </div>
          {hasAccess('master') && (
            <button onClick={startEditing} style={styles.newsBannerEditBtn}>✎</button>
          )}
        </div>
      )}
    </div>
  );
}

function Layout({ children, notification, pendingCount = 0 }) {
  const { isDark, toggle, theme, team, setTeamTheme, teamColors } = useTheme();
  const { hasAccess } = useAuth();
  const styles = getStyles(theme);
  
  // Group teams by division for the dropdown
  const teamGroups = {
    'AL East': ['yankees', 'redsox', 'rays', 'bluejays', 'orioles'],
    'AL Central': ['guardians', 'twins', 'whitesox', 'tigers', 'royals'],
    'AL West': ['astros', 'rangers', 'mariners', 'angels', 'athletics'],
    'NL East': ['braves', 'phillies', 'mets', 'marlins', 'nationals'],
    'NL Central': ['brewers', 'cardinals', 'cubs', 'reds', 'pirates'],
    'NL West': ['dodgers', 'padres', 'giants', 'dbacks', 'rockies'],
  };
  
  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? theme.error : theme.success}}>{notification.message}</div>}
      <header style={styles.header}><div style={styles.headerContent}>
        <div><h1 style={styles.title}>BeaneCounter</h1><p style={styles.subtitle}>OOTP Baseball Statistics by ItsHellboy</p></div>
        <div style={styles.headerRight}>
          <nav style={styles.nav}>
            <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})} end>Stats</NavLink>
            <NavLink to="/leaderboards" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Leaderboards</NavLink>
            <NavLink to="/draft-assistant" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Draft Assistant</NavLink>
            <NavLink to="/videos" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Videos</NavLink>
            <NavLink to="/articles" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Articles</NavLink>
            <NavLink to="/info" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Info</NavLink>
            <NavLink to="/submit" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Submit Data</NavLink>
            {hasAccess('master') && (
              <NavLink to="/review" style={({isActive}) => ({...styles.navLink, ...styles.navLinkReview, ...(isActive ? styles.navLinkActive : {})})}>
                Review {pendingCount > 0 && <span style={styles.navBadge}>{pendingCount}</span>}
              </NavLink>
            )}
          </nav>
          <div style={styles.themeControls}>
            <select 
              value={team} 
              onChange={(e) => setTeamTheme(e.target.value)} 
              style={styles.teamSelect}
              title="Team Colors"
            >
              <option value="default">⚾ Default</option>
              {Object.entries(teamGroups).map(([division, teams]) => (
                <optgroup key={division} label={division}>
                  {teams.map(t => (
                    <option key={t} value={t}>{teamColors[t].name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button onClick={toggle} style={styles.themeToggle} title={isDark ? 'Light' : 'Dark'}>{isDark ? '☀' : '☾'}</button>
          </div>
        </div>
      </div></header>
      <NewsBanner theme={theme} styles={styles} />
      {children}
    </div>
  );
}

function StatsPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth } = useAuth();
  const fileInputRef = React.useRef(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('pitching');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentType, setNewTournamentType] = useState('daily');
  const [filters, setFilters] = useState({ 
    search: '', 
    position: 'all', 
    sortBy: 'war', 
    sortDir: 'desc', 
    gFilter: { enabled: false, operator: '>=', value: 0 }, 
    paFilter: { enabled: false, operator: '>=', value: 0 }, 
    abFilter: { enabled: false, operator: '>=', value: 0 }, 
    ipFilter: { enabled: false, operator: '>=', value: 0 },
    // Card tier filters (all enabled by default)
    cardTiers: { perfect: true, diamond: true, gold: true, silver: true, bronze: true, iron: true },
    // Variant filter: 'all', 'yes', 'no'
    variantFilter: 'all',
    // Defense filter (batting only)
    defFilter: { enabled: false, operator: '>=', value: 0 }
  });
  const [showPer9, setShowPer9] = useState(false);
  const [showTraditional, setShowTraditional] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tournaments');
  const [tournamentSearch, setTournamentSearch] = useState('');
  const [showMissingData, setShowMissingData] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedPlayerType, setSelectedPlayerType] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 100;

  const handlePlayerClick = (player, playerType) => {
    setSelectedPlayer(player);
    setSelectedPlayerType(playerType);
  };

  const closePlayerModal = () => {
    setSelectedPlayer(null);
    setSelectedPlayerType(null);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.position, filters.gFilter.enabled, filters.paFilter.enabled, filters.abFilter.enabled, filters.ipFilter.enabled, filters.defFilter.enabled, filters.variantFilter, filters.cardTiers]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const parsed = (data || []).map(t => ({ 
        id: t.id, 
        name: t.name, 
        createdAt: t.created_at, 
        category: t.category || 'tournaments', 
        batting: t.batting || [], 
        pitching: t.pitching || [], 
        uploadedHashes: t.uploaded_hashes || [],
        eventType: t.event_type || 'daily',
        uploadedDates: t.uploaded_dates || [],
        rotatingFormat: t.rotating_format || false
      }));
      setTournaments(parsed);
      const lastSelectedId = localStorage.getItem('selectedTournamentId');
      if (lastSelectedId) { 
        const found = parsed.find(t => t.id === lastSelectedId); 
        if (found) { 
          setSelectedTournament(found);
          setSidebarTab(found.category || 'tournaments');
        } 
      }
    } catch (e) { console.error('Load error:', e); showNotif('Failed to load', 'error'); }
    setIsLoading(false);
  };

  const saveTournament = async (tournament) => {
    try { 
      const payload = { 
        id: tournament.id, 
        name: tournament.name, 
        created_at: tournament.createdAt, 
        category: tournament.category, 
        batting: tournament.batting, 
        pitching: tournament.pitching,
        event_type: tournament.eventType || 'daily',
        uploaded_dates: tournament.uploadedDates || []
      };
      if (tournament.uploadedHashes !== undefined) payload.uploaded_hashes = tournament.uploadedHashes;
      const { error } = await supabase.from('tournaments').upsert(payload);
      if (error) {
        console.error('Save error:', error);
        // Fallback without new columns if they don't exist yet
        const fallbackPayload = { id: tournament.id, name: tournament.name, created_at: tournament.createdAt, category: tournament.category, batting: tournament.batting, pitching: tournament.pitching };
        if (tournament.uploadedHashes !== undefined) fallbackPayload.uploaded_hashes = tournament.uploadedHashes;
        const { error: retryError } = await supabase.from('tournaments').upsert(fallbackPayload);
        if (retryError) showNotif('Save failed', 'error');
      }
    } catch (e) { showNotif('Save failed', 'error'); }
  };

  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };

  const createTournament = () => {
    if (!newTournamentName.trim()) return;
    requestAuth(async () => {
      const typeLabel = newTournamentType === 'daily' ? '[Daily]' : '[Weekly]';
      const fullName = `${typeLabel} ${newTournamentName.trim()}`;
      const newT = { 
        id: crypto.randomUUID(), 
        name: fullName, 
        createdAt: new Date().toISOString(), 
        category: sidebarTab, 
        batting: [], 
        pitching: [], 
        uploadedHashes: [],
        eventType: newTournamentType,
        uploadedDates: []
      };
      await saveTournament(newT); 
      setTournaments([newT, ...tournaments]); 
      setSelectedTournament(newT);
      localStorage.setItem('selectedTournamentId', newT.id); 
      setNewTournamentName(''); 
      setNewTournamentType('daily');
      setShowNewTournament(false);
      showNotif('Created!');
    }, 'upload');
  };

  const deleteTournament = (id) => {
    requestAuth(async () => {
      if (!confirm('Delete this tournament?')) return;
      try { await supabase.from('tournaments').delete().eq('id', id);
        setTournaments(tournaments.filter(t => t.id !== id));
        if (selectedTournament?.id === id) { setSelectedTournament(null); localStorage.removeItem('selectedTournamentId'); }
        showNotif('Deleted');
      } catch (e) { showNotif('Delete failed', 'error'); }
    }, 'master');
  };

  const toggleLegacy = (tournament) => {
    requestAuth(async () => {
      const isCurrentlyLegacy = tournament.category === 'legacy';
      // If moving FROM legacy, we need to determine if it was originally a tournament or draft
      // We'll check the name for [Daily] or [Weekly] prefix - drafts typically don't have these
      const originalCategory = isCurrentlyLegacy 
        ? (tournament.name.includes('[Daily]') || tournament.name.includes('[Weekly]') ? 'tournaments' : 'drafts')
        : 'legacy';
      
      const updatedTournament = { ...tournament, category: originalCategory };
      await saveTournament(updatedTournament);
      setTournaments(tournaments.map(t => t.id === tournament.id ? updatedTournament : t));
      if (selectedTournament?.id === tournament.id) {
        setSelectedTournament(updatedTournament);
      }
      setSidebarTab(originalCategory);
      showNotif(isCurrentlyLegacy ? 'Restored from Legacy' : 'Moved to Legacy');
    }, 'master');
  };

  const selectTournament = (t) => { 
    setSelectedTournament(t); 
    localStorage.setItem('selectedTournamentId', t.id);
    setCurrentPage(1); // Reset pagination
    // Reset any pending upload state from previous tournament
    setShowDatePicker(false);
    setPendingUploadFiles(null);
    setIsUploading(false);
  };
  const parseIP = (ip) => { if (!ip) return 0; const str = String(ip); if (str.includes('.')) { const [w, f] = str.split('.'); return parseFloat(w) + (parseFloat(f) / 3); } return parseFloat(ip) || 0; };
  const formatIP = (d) => { const w = Math.floor(d), f = Math.round((d - w) * 3); return f === 0 ? w.toString() : f === 3 ? (w + 1).toString() : `${w}.${f}`; };
  const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };

  const combinePlayerStats = (existing, newP, type) => {
    // Include variant in player key so variants are treated as separate cards
    const getPlayerKey = (p) => `${p.name}|${p.ovr}|${p.vari || 'N'}`;
    const playerMap = new Map();
    (existing || []).forEach(p => { playerMap.set(getPlayerKey(p), { ...p }); });
    newP.forEach(p => {
      const key = getPlayerKey(p);
      if (playerMap.has(key)) {
        const ex = playerMap.get(key);
        if (type === 'pitching') {
          const totalIP = parseIP(ex.ip) + parseIP(p.ip);
          const exIP = parseIP(ex.ip), pIP = parseIP(p.ip);
          playerMap.set(key, { ...ex, g: ex.g + p.g, gs: ex.gs + p.gs, ip: formatIP(totalIP), bf: ex.bf + p.bf,
            era: totalIP > 0 ? ((parseFloat(ex.era) * exIP + parseFloat(p.era) * pIP) / totalIP).toFixed(2) : '0.00',
            avg: totalIP > 0 ? ((parseFloat(ex.avg) * exIP + parseFloat(p.avg) * pIP) / totalIP).toFixed(3) : '.000',
            obp: totalIP > 0 ? ((parseFloat(ex.obp) * exIP + parseFloat(p.obp) * pIP) / totalIP).toFixed(3) : '.000',
            babip: totalIP > 0 ? ((parseFloat(ex.babip) * exIP + parseFloat(p.babip) * pIP) / totalIP).toFixed(3) : '.000',
            whip: totalIP > 0 ? ((parseFloat(ex.whip) * exIP + parseFloat(p.whip) * pIP) / totalIP).toFixed(2) : '0.00',
            braPer9: totalIP > 0 ? ((parseFloat(ex.braPer9) * exIP + parseFloat(p.braPer9) * pIP) / totalIP).toFixed(2) : '0.00',
            hrPer9: totalIP > 0 ? ((parseFloat(ex.hrPer9) * exIP + parseFloat(p.hrPer9) * pIP) / totalIP).toFixed(2) : '0.00',
            hPer9: totalIP > 0 ? ((parseFloat(ex.hPer9) * exIP + parseFloat(p.hPer9) * pIP) / totalIP).toFixed(2) : '0.00',
            bbPer9: totalIP > 0 ? ((parseFloat(ex.bbPer9) * exIP + parseFloat(p.bbPer9) * pIP) / totalIP).toFixed(2) : '0.00',
            kPer9: totalIP > 0 ? ((parseFloat(ex.kPer9) * exIP + parseFloat(p.kPer9) * pIP) / totalIP).toFixed(2) : '0.00',
            lobPct: totalIP > 0 ? ((parseFloat(ex.lobPct) * exIP + parseFloat(p.lobPct) * pIP) / totalIP).toFixed(1) : '0.0',
            eraPlus: totalIP > 0 ? Math.round((ex.eraPlus * exIP + p.eraPlus * pIP) / totalIP) : 0,
            fip: totalIP > 0 ? ((parseFloat(ex.fip) * exIP + parseFloat(p.fip) * pIP) / totalIP).toFixed(2) : '0.00',
            fipMinus: totalIP > 0 ? Math.round((ex.fipMinus * exIP + p.fipMinus * pIP) / totalIP) : 0,
            war: (parseFloat(ex.war) + parseFloat(p.war)).toFixed(1),
            siera: totalIP > 0 ? ((parseFloat(ex.siera) * exIP + parseFloat(p.siera) * pIP) / totalIP).toFixed(2) : '0.00'
          });
        } else {
          const totalPA = ex.pa + p.pa;
          playerMap.set(key, { ...ex, g: ex.g + p.g, gs: ex.gs + p.gs, pa: totalPA, ab: ex.ab + p.ab,
            h: ex.h + p.h, doubles: ex.doubles + p.doubles, triples: ex.triples + p.triples, hr: ex.hr + p.hr,
            so: ex.so + p.so, gidp: ex.gidp + p.gidp,
            bbPct: totalPA > 0 ? ((parseFloat(ex.bbPct) * ex.pa + parseFloat(p.bbPct) * p.pa) / totalPA).toFixed(1) : '0.0',
            avg: totalPA > 0 ? ((parseFloat(ex.avg) * ex.pa + parseFloat(p.avg) * p.pa) / totalPA).toFixed(3) : '.000',
            obp: totalPA > 0 ? ((parseFloat(ex.obp) * ex.pa + parseFloat(p.obp) * p.pa) / totalPA).toFixed(3) : '.000',
            slg: totalPA > 0 ? ((parseFloat(ex.slg) * ex.pa + parseFloat(p.slg) * p.pa) / totalPA).toFixed(3) : '.000',
            woba: totalPA > 0 ? ((parseFloat(ex.woba) * ex.pa + parseFloat(p.woba) * p.pa) / totalPA).toFixed(3) : '.000',
            ops: totalPA > 0 ? ((parseFloat(ex.ops) * ex.pa + parseFloat(p.ops) * p.pa) / totalPA).toFixed(3) : '.000',
            opsPlus: totalPA > 0 ? Math.round((ex.opsPlus * ex.pa + p.opsPlus * p.pa) / totalPA) : 0,
            babip: totalPA > 0 ? ((parseFloat(ex.babip) * ex.pa + parseFloat(p.babip) * p.pa) / totalPA).toFixed(3) : '.000',
            wrcPlus: totalPA > 0 ? Math.round((ex.wrcPlus * ex.pa + p.wrcPlus * p.pa) / totalPA) : 0,
            wraa: (parseFloat(ex.wraa) + parseFloat(p.wraa)).toFixed(1),
            war: (parseFloat(ex.war) + parseFloat(p.war)).toFixed(1),
            sbPct: totalPA > 0 ? ((parseFloat(ex.sbPct) * ex.pa + parseFloat(p.sbPct) * p.pa) / totalPA).toFixed(1) : '0.0',
            bsr: (parseFloat(ex.bsr) + parseFloat(p.bsr)).toFixed(1)
          });
        }
      } else { playerMap.set(key, { ...p }); }
    });
    return Array.from(playerMap.values());
  };

  const normalizePlayerData = (row, type) => {
    if (type === 'pitching') {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', throws: row.T || '',
        ovr: parseNum(row.OVR), vari: parseVariant(row.VAR), g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
        era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000', babip: row.BABIP || '.000',
        whip: row.WHIP || '0.00', braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00', hPer9: row['H/9'] || '0.00',
        bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00', lobPct: parsePct(row['LOB%']),
        eraPlus: parseNum(row['ERA+']), fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
        war: row.WAR || '0.0', siera: row.SIERA || '0.00'
      };
    } else {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', bats: row.B || '',
        ovr: parseNum(row.OVR), vari: parseVariant(row.VAR), def: parseNum(row.DEF), g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
        h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR), bbPct: parsePct(row['BB%']),
        so: parseNum(row.SO), gidp: parseNum(row.GIDP), avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
        woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']), babip: row.BABIP || '.000',
        wrcPlus: parseNum(row['wRC+']), wraa: row.wRAA || '0.0', war: row.WAR || '0.0', sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
      };
    }
  };

  const PITCHING_HEADERS = ['POS', 'Name', 'T', 'OVR', 'VAR', 'G', 'GS', 'IP', 'BF', 'ERA', 'AVG', 'OBP', 'BABIP', 'WHIP', 'BRA/9', 'HR/9', 'H/9', 'BB/9', 'K/9', 'LOB%', 'ERA+', 'FIP', 'FIP-', 'WAR', 'SIERA'];
  const BATTING_HEADERS = ['POS', 'Name', 'B', 'OVR', 'VAR', 'DEF', 'G', 'GS', 'PA', 'AB', 'H', '2B', '3B', 'HR', 'BB%', 'SO', 'GIDP', 'AVG', 'OBP', 'SLG', 'wOBA', 'OPS', 'OPS+', 'BABIP', 'wRC+', 'wRAA', 'WAR', 'SB%', 'BsR'];
  const MAX_FILE_SIZE = 1024 * 1024;

  const hashContent = async (content) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const validateHeaders = (headers) => {
    const h = headers.map(x => x.trim());
    if (h.length === PITCHING_HEADERS.length && PITCHING_HEADERS.every((x, i) => x === h[i])) return { valid: true, type: 'pitching' };
    if (h.length === BATTING_HEADERS.length && BATTING_HEADERS.every((x, i) => x === h[i])) return { valid: true, type: 'batting' };
    const isPitch = h.includes('IP') || h.includes('ERA');
    const isBat = h.includes('AB') || h.includes('PA');
    if (isPitch) { const missing = PITCHING_HEADERS.filter(x => !h.includes(x)); return { valid: false, error: `Pitching mismatch. Missing: ${missing.join(', ')}` }; }
    if (isBat) { const missing = BATTING_HEADERS.filter(x => !h.includes(x)); return { valid: false, error: `Batting mismatch. Missing: ${missing.join(', ')}` }; }
    return { valid: false, error: 'Unrecognized CSV format.' };
  };

  const handleFileUpload = (event) => {
    const input = event.target;
    const files = Array.from(input.files || []); 
    
    // Always reset the input value immediately so the same file can be selected again
    // This is critical - must happen before any early returns
    input.value = '';
    
    // Validate
    if (!files.length) {
      console.log('No files selected');
      return;
    }
    if (!selectedTournament) {
      showNotif('Please select a tournament first', 'error');
      return;
    }
    
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) { 
        showNotif('File too large', 'error'); 
        return; 
      }
      if (!file.name.toLowerCase().endsWith('.csv')) { 
        showNotif('Not a CSV', 'error'); 
        return; 
      }
    }
    
    // Store files and show date picker
    console.log('Setting pending files:', files.length);
    setPendingUploadFiles(files);
    setShowDatePicker(true);
  };
  
  const triggerFileUpload = () => {
    const input = fileInputRef.current;
    if (!input) {
      console.error('File input ref not found');
      showNotif('Upload error - please refresh the page', 'error');
      return;
    }
    // Reset value before clicking to ensure change event fires even for same file
    input.value = '';
    input.click();
  };

  const processUploadWithDate = async (selectedDate) => {
    if (!pendingUploadFiles || !selectedTournament || isUploading) return;
    
    const doUpload = async () => {
      setIsUploading(true);
      try {
        let currentTournament = { ...selectedTournament };
        let uploadedHashes = [...(currentTournament.uploadedHashes || [])];
        let uploadedDates = [...(currentTournament.uploadedDates || [])];
        let totalBatting = 0, totalPitching = 0, skippedDupes = 0;
        
        for (const file of pendingUploadFiles) {
          const fileContent = await file.text();
          const fileHash = await hashContent(fileContent);
          if (uploadedHashes.includes(fileHash)) { skippedDupes++; continue; }
          const parseResult = await new Promise((resolve) => { Papa.parse(fileContent, { header: true, skipEmptyLines: true, complete: resolve }); });
          if (!parseResult.meta.fields?.length || !parseResult.data.length) continue;
          const validation = validateHeaders(parseResult.meta.fields);
          if (!validation.valid) { showNotif(validation.error, 'error'); continue; }
          const validRows = parseResult.data.filter(r => r.Name?.trim());
          if (!validRows.length) continue;
          const processed = validRows.map(r => normalizePlayerData(r, validation.type));
          const combined = combinePlayerStats(currentTournament[validation.type], processed, validation.type);
          currentTournament = { ...currentTournament, [validation.type]: combined };
          uploadedHashes.push(fileHash);
          if (validation.type === 'batting') totalBatting += processed.length;
          else totalPitching += processed.length;
        }
        
        // Add the selected date to uploadedDates if not already present
        if (selectedDate && !uploadedDates.includes(selectedDate)) {
          uploadedDates.push(selectedDate);
        }
        
        currentTournament.uploadedHashes = uploadedHashes;
        currentTournament.uploadedDates = uploadedDates;
        await saveTournament(currentTournament);
        setTournaments(tournaments.map(t => t.id === selectedTournament.id ? currentTournament : t));
        setSelectedTournament(currentTournament);
        let msg = totalBatting || totalPitching ? `✓ ${totalBatting ? totalBatting + ' batters' : ''}${totalPitching ? (totalBatting ? ', ' : '') + totalPitching + ' pitchers' : ''}` : 'No new data';
        if (skippedDupes) msg += ` (${skippedDupes} dupes skipped)`;
        showNotif(msg, (!totalBatting && !totalPitching) ? 'error' : undefined);
      } catch (e) { 
        console.error('Upload error:', e);
        showNotif('Upload error', 'error'); 
      } finally {
        setPendingUploadFiles(null);
        setShowDatePicker(false);
        setIsUploading(false);
      }
    };
    
    requestAuth(doUpload);
  };

  // Helper to get Pacific Time date
  const getPacificDate = (date = new Date()) => {
    // Get current time in Pacific timezone
    const pacificTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pacificTime;
  };

  // Generate 21-day calendar going BACKWARDS from today (Pacific Time) - exactly 3 weeks
  const generate21DayCalendar = () => {
    const now = new Date();
    // Get today's date in Pacific timezone
    const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayYear = pacificNow.getFullYear();
    const todayMonth = pacificNow.getMonth();
    const todayDate = pacificNow.getDate();
    
    // Create a date object for today at midnight Pacific
    const today = new Date(todayYear, todayMonth, todayDate);
    
    const days = [];
    // Start from 20 days ago and go forward to today (21 days total)
    for (let i = 20; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      days.push({
        date: date,
        dateStr: dateStr,
        dayOfMonth: date.getDate(),
        dayOfWeek: date.getDay(),
        weekNum: Math.floor((20 - i) / 7),
        isToday: i === 0
      });
    }
    return days;
  };

  // Check if a date has data uploaded
  const hasDataForDate = (dateStr, uploadedDates, eventType) => {
    if (!uploadedDates || uploadedDates.length === 0) return false;
    if (eventType === 'weekly') {
      // For weekly events, check if any date in the same week has been uploaded
      const targetDate = new Date(dateStr + 'T12:00:00');
      const targetWeekStart = new Date(targetDate);
      targetWeekStart.setDate(targetDate.getDate() - targetDate.getDay());
      
      return uploadedDates.some(ud => {
        const uploadDate = new Date(ud + 'T12:00:00');
        const uploadWeekStart = new Date(uploadDate);
        uploadWeekStart.setDate(uploadDate.getDate() - uploadDate.getDay());
        return uploadWeekStart.toDateString() === targetWeekStart.toDateString();
      });
    }
    return uploadedDates.includes(dateStr);
  };

  // Admin function to toggle date status
  const toggleDateStatus = async (dateStr) => {
    if (!hasAccess('master')) return;
    
    let currentTournament = { ...selectedTournament };
    let uploadedDates = [...(currentTournament.uploadedDates || [])];
    
    if (uploadedDates.includes(dateStr)) {
      // Remove the date
      uploadedDates = uploadedDates.filter(d => d !== dateStr);
    } else {
      // Add the date
      uploadedDates.push(dateStr);
    }
    
    currentTournament.uploadedDates = uploadedDates;
    await saveTournament(currentTournament);
    setTournaments(tournaments.map(t => t.id === selectedTournament.id ? currentTournament : t));
    setSelectedTournament(currentTournament);
    showNotif(uploadedDates.includes(dateStr) ? 'Date marked as uploaded' : 'Date marked as missing');
  };

  const passesFilter = (v, f) => { if (!f.enabled) return true; const nv = parseFloat(v) || 0, fv = parseFloat(f.value) || 0; return f.operator === '>' ? nv > fv : f.operator === '>=' ? nv >= fv : f.operator === '=' ? nv === fv : f.operator === '<=' ? nv <= fv : nv < fv; };

  const getFilteredData = (data, type) => {
    if (!data) return [];
    let f = [...data];
    
    // Search filter
    if (filters.search) f = f.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
    
    // Position filter
    if (filters.position !== 'all') {
      const filterPos = filters.position.toUpperCase();
      f = f.filter(p => {
        if (p.positions && p.positions.length > 0) {
          return p.positions.includes(filterPos);
        }
        return (p.pos || '').toUpperCase() === filterPos;
      });
    }
    
    // Card tier filter
    f = f.filter(p => {
      const tier = getCardTier(p.ovr);
      return filters.cardTiers[tier];
    });
    
    // Variant filter
    if (filters.variantFilter !== 'all') {
      f = f.filter(p => {
        const isVariant = p.vari === 'Y';
        return filters.variantFilter === 'yes' ? isVariant : !isVariant;
      });
    }
    
    // Stat filters
    f = f.filter(p => passesFilter(p.g, filters.gFilter));
    if (type === 'batting') {
      f = f.filter(p => passesFilter(p.pa, filters.paFilter) && passesFilter(p.ab, filters.abFilter));
      // Defense filter (batting only)
      if (filters.defFilter.enabled) {
        f = f.filter(p => passesFilter(parseInt(p.def) || 0, filters.defFilter));
      }
    } else {
      f = f.filter(p => passesFilter(parseIP(p.ip), filters.ipFilter));
    }
    
    const calcPer600PA = (val, pa) => { const paNum = parseFloat(pa) || 0; return paNum === 0 ? 0 : parseFloat(val || 0) / paNum * 600; };
    const calcWarPer200IP = (war, ip) => { const ipNum = parseIP(ip); return ipNum === 0 ? 0 : parseFloat(war || 0) / ipNum * 200; };
    f.sort((a, b) => {
      let av, bv;
      if (filters.sortBy === 'warPer600PA' && type === 'batting') { av = calcPer600PA(a.war, a.pa); bv = calcPer600PA(b.war, b.pa); }
      else if (filters.sortBy === 'bsrPer600PA' && type === 'batting') { av = calcPer600PA(a.bsr, a.pa); bv = calcPer600PA(b.bsr, b.pa); }
      else if (filters.sortBy === 'wraaPer600PA' && type === 'batting') { av = calcPer600PA(a.wraa, a.pa); bv = calcPer600PA(b.wraa, b.pa); }
      else if (filters.sortBy === 'warPer200IP' && type === 'pitching') { av = calcWarPer200IP(a.war, a.ip); bv = calcWarPer200IP(b.war, b.ip); }
      else { av = a[filters.sortBy]; bv = b[filters.sortBy]; }
      if (!isNaN(parseFloat(av)) && !isNaN(parseFloat(bv))) { av = parseFloat(av); bv = parseFloat(bv); return filters.sortDir === 'asc' ? av - bv : bv - av; }
      return filters.sortDir === 'asc' ? String(av||'').localeCompare(String(bv||'')) : String(bv||'').localeCompare(String(av||''));
    });
    return f;
  };

  const toggleSort = (field) => { if (filters.sortBy === field) setFilters(f => ({ ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' })); else setFilters(f => ({ ...f, sortBy: field, sortDir: 'desc' })); };
  const updateStatFilter = (name, updates) => setFilters(f => ({ ...f, [name]: { ...f[name], ...updates } }));
  const resetFilters = () => setFilters({ 
    search: '', 
    position: 'all', 
    sortBy: 'war', 
    sortDir: 'desc', 
    gFilter: { enabled: false, operator: '>=', value: 0 }, 
    paFilter: { enabled: false, operator: '>=', value: 0 }, 
    abFilter: { enabled: false, operator: '>=', value: 0 }, 
    ipFilter: { enabled: false, operator: '>=', value: 0 },
    cardTiers: { perfect: true, diamond: true, gold: true, silver: true, bronze: true, iron: true },
    variantFilter: 'all',
    defFilter: { enabled: false, operator: '>=', value: 0 }
  });
  const getActiveFilterCount = () => { 
    let c = 0; 
    if (filters.position !== 'all') c++; 
    ['gFilter', 'paFilter', 'abFilter', 'ipFilter', 'defFilter'].forEach(f => { if (filters[f].enabled) c++; }); 
    // Count disabled card tiers
    const disabledTiers = Object.values(filters.cardTiers).filter(v => !v).length;
    if (disabledTiers > 0) c++;
    if (filters.variantFilter !== 'all') c++;
    return c; 
  };
  
  const getCardTier = (ovr) => {
    const val = parseInt(ovr) || 0;
    if (val >= 100) return 'perfect';
    if (val >= 90) return 'diamond';
    if (val >= 80) return 'gold';
    if (val >= 70) return 'silver';
    if (val >= 60) return 'bronze';
    return 'iron';
  };
  
  const toggleCardTier = (tier) => {
    setFilters(f => ({
      ...f,
      cardTiers: { ...f.cardTiers, [tier]: !f.cardTiers[tier] }
    }));
  };

  const pitchingPositions = ['all', 'SP', 'RP', 'CL'];
  const battingPositions = ['all', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const getHandednessStats = (players, field) => {
    if (!players?.length) return { L: 0, S: 0, R: 0 };
    const total = players.length, counts = { L: 0, S: 0, R: 0 };
    players.forEach(p => { const v = (p[field] || '').toUpperCase(); if (counts[v] !== undefined) counts[v]++; });
    return { L: ((counts.L / total) * 100).toFixed(0), S: ((counts.S / total) * 100).toFixed(0), R: ((counts.R / total) * 100).toFixed(0) };
  };

  const getCsvCount = (t) => (t.uploadedHashes?.length || 0);
  const getDataQuality = (count) => {
    if (count >= 31) return { label: 'HIGH', color: '#22C55E' };
    if (count >= 14) return { label: 'MED', color: '#F59E0B' };
    return { label: 'LOW', color: '#EF4444' };
  };

  const filteredTournaments = tournaments.filter(t => (t.category || 'tournaments') === sidebarTab).filter(t => !tournamentSearch || t.name.toLowerCase().includes(tournamentSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;
  const filteredData = selectedTournament ? getFilteredData(selectedTournament[activeTab] || [], activeTab) : [];
  const totalData = selectedTournament ? (selectedTournament[activeTab]?.length || 0) : 0;

  return (
    <Layout notification={notification}>
      {/* File input at root level - never unmounts, keeps ref stable across tournament switches */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".csv" 
        multiple 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} 
      />
      <main style={styles.main}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTabs}>
            <button style={{...styles.sidebarTabBtn, ...(sidebarTab === 'tournaments' ? styles.sidebarTabActive : {})}} onClick={() => setSidebarTab('tournaments')}>Tournaments</button>
            <button style={{...styles.sidebarTabBtn, ...(sidebarTab === 'drafts' ? styles.sidebarTabActive : {})}} onClick={() => setSidebarTab('drafts')}>Drafts</button>
            <button style={{...styles.sidebarTabBtn, ...(sidebarTab === 'legacy' ? styles.sidebarTabActive : {})}} onClick={() => setSidebarTab('legacy')}>Legacy</button>
          </div>
          <input type="text" placeholder="Search..." value={tournamentSearch} onChange={(e) => setTournamentSearch(e.target.value)} style={styles.sidebarSearch} />
          {showNewTournament && (<div style={styles.newForm}>
            <input type="text" placeholder="Event name..." value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTournament()} style={styles.input} autoFocus />
            <div style={styles.eventTypeSelector}>
              <button 
                style={{...styles.eventTypeBtn, ...(newTournamentType === 'daily' ? styles.eventTypeBtnActive : {})}} 
                onClick={() => setNewTournamentType('daily')}
              >Daily</button>
              <button 
                style={{...styles.eventTypeBtn, ...(newTournamentType === 'weekly' ? styles.eventTypeBtnActive : {})}} 
                onClick={() => setNewTournamentType('weekly')}
              >Weekly</button>
            </div>
            <div style={styles.formBtns}><button onClick={createTournament} style={styles.saveBtn}>Create</button><button onClick={() => { setShowNewTournament(false); setNewTournamentType('daily'); }} style={styles.cancelBtn}>Cancel</button></div>
          </div>)}
          <div style={styles.tournamentList}>
            {filteredTournaments.length === 0 ? <p style={styles.emptyMsg}>No {sidebarTab} yet</p> :
              filteredTournaments.map(t => {
                const quality = getDataQuality(getCsvCount(t));
                const isSelected = selectedTournament?.id === t.id;
                const isLegacy = t.category === 'legacy';
                return (<div key={t.id} style={{...styles.tournamentItem, ...(isSelected ? styles.tournamentActive : {})}} onClick={() => selectTournament(t)}>
                  <div style={styles.tournamentInfo}>
                    <span style={{...styles.tournamentName, ...(isSelected ? styles.tournamentNameActive : {})}}>{t.name}</span>
                    <span style={styles.tournamentStats}>
                      <span style={{color: quality.color, fontWeight: 600}}>{quality.label}</span>
                      {` · ${t.batting?.length || 0}B / ${t.pitching?.length || 0}P`}
                    </span>
                  </div>
                  <div style={styles.tournamentActions}>
                    {hasAccess('master') && (
                    <button 
                      style={styles.legacyBtn} 
                      onClick={(e) => { e.stopPropagation(); toggleLegacy(t); }}
                      title={isLegacy ? 'Restore from Legacy' : 'Move to Legacy'}
                    >
                      {isLegacy ? '↩' : '📦'}
                    </button>
                  )}
                    {hasAccess('master') && <button style={styles.delBtn} onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}>×</button>}
                  </div>
                </div>);
              })}
          </div>
          {sidebarTab !== 'legacy' && hasAccess('upload') && (
            <button style={styles.newTournamentBtn} onClick={() => setShowNewTournament(true)}>+ New</button>
          )}
        </aside>
        <div style={styles.content}>
          {!selectedTournament ? (<div style={styles.welcome}><h2 style={styles.welcomeTitle}>Select a Tournament</h2><p style={styles.welcomeText}>Choose from the sidebar or create a new one.</p></div>) : (<>
            <div style={styles.tournamentHeader}>
              <div style={styles.tournamentMeta}>
                <h2 style={styles.tournamentTitleMain}>{selectedTournament.name}</h2>
                {((selectedTournament.pitching?.length || 0) > 0 || (selectedTournament.batting?.length || 0) > 0) && (
                  <div style={styles.handednessContainer}>
                    {(selectedTournament.pitching?.length || 0) > 0 && (() => { const s = getHandednessStats(selectedTournament.pitching, 'throws'); return <span style={styles.handednessGroup}>T: L{s.L}% S{s.S}% R{s.R}%</span>; })()}
                    {(selectedTournament.batting?.length || 0) > 0 && (() => { const s = getHandednessStats(selectedTournament.batting, 'bats'); return <span style={styles.handednessGroup}>B: L{s.L}% S{s.S}% R{s.R}%</span>; })()}
                  </div>
                )}
              </div>
              <div style={styles.headerActions}>
                <button style={styles.missingDataBtn} onClick={() => setShowMissingData(true)} title="View missing data calendar">📅 Missing Data</button>
                {hasAccess('upload') && (
                  <button style={styles.uploadBtn} onClick={triggerFileUpload}>↑ Upload CSV</button>
                )}
              </div>
            </div>
            
            {/* Date Picker Modal */}
            {showDatePicker && selectedTournament && pendingUploadFiles && (
              <div style={styles.modalOverlay}>
                <div style={styles.datePickerModal}>
                  <h3 style={styles.modalTitle}>Select Data Date</h3>
                  <p style={styles.modalText}>What date is this CSV data for?</p>
                  <div style={styles.datePickerGrid}>
                    {generate21DayCalendar().map((day, idx) => {
                      const isUploaded = hasDataForDate(day.dateStr, selectedTournament.uploadedDates, selectedTournament.eventType);
                      return (
                        <button 
                          key={idx} 
                          style={{
                            ...styles.datePickerDay,
                            ...(day.dayOfWeek === 0 ? styles.datePickerSunday : {}),
                            ...(isUploaded ? styles.datePickerDayUploaded : {})
                          }}
                          onClick={() => !isUploading && processUploadWithDate(day.dateStr)}
                          disabled={isUploading}
                        >
                          <span style={styles.datePickerDayNum}>{day.dayOfMonth}</span>
                          <span style={styles.datePickerDayLabel}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.dayOfWeek]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isUploading && (
                    <div style={{ textAlign: 'center', padding: 12, color: theme.accent }}>
                      Uploading...
                    </div>
                  )}
                  <div style={styles.modalBtns}>
                    <button 
                      onClick={() => { setShowDatePicker(false); setPendingUploadFiles(null); setIsUploading(false); }} 
                      style={styles.cancelBtn}
                      disabled={isUploading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Missing Data Calendar Modal */}
            {showMissingData && (
              <div style={styles.modalOverlay}>
                <div style={styles.missingDataModal}>
                  <h3 style={styles.modalTitle}>📅 Missing Data Calendar</h3>
                  <p style={styles.modalText}>
                    {selectedTournament.eventType === 'weekly' ? 'Weekly event - one upload covers entire week' : 'Daily event - one upload per day'}
                    {hasAccess('master') && <span style={styles.adminHint}> • Click dates to toggle status</span>}
                  </p>
                  {hasAccess('master') && (
                    <label style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, 
                      marginBottom: 12, padding: '8px 12px', 
                      background: selectedTournament.rotatingFormat ? theme.warning + '22' : theme.bgSecondary,
                      borderRadius: 6, cursor: 'pointer', fontSize: 12, color: theme.textPrimary
                    }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTournament.rotatingFormat || false}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          const updated = { ...selectedTournament, rotatingFormat: newValue };
                          setSelectedTournament(updated);
                          setTournaments(tournaments.map(t => t.id === selectedTournament.id ? updated : t));
                          await supabase.from('tournaments').update({ rotating_format: newValue }).eq('id', selectedTournament.id);
                          showNotif(newValue ? 'Marked as rotating format' : 'Removed rotating format');
                        }}
                      />
                      🔄 Rotating Format {selectedTournament.rotatingFormat && '(enabled)'}
                    </label>
                  )}
                  <div style={styles.calendarContainer}>
                    <div style={styles.calendarHeader}>
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>
                    {(() => {
                      const days = generate21DayCalendar();
                      const firstDayOfWeek = days[0].dayOfWeek;
                      
                      // Pad beginning with empty slots to align with day of week
                      const paddedDays = [...Array(firstDayOfWeek).fill(null), ...days];
                      
                      // Split into weeks (rows of 7)
                      const weeks = [];
                      for (let i = 0; i < paddedDays.length; i += 7) {
                        weeks.push(paddedDays.slice(i, i + 7));
                      }
                      // Pad last week if needed
                      const lastWeek = weeks[weeks.length - 1];
                      while (lastWeek.length < 7) lastWeek.push(null);
                      
                      const weekLabels = ['3 Weeks Ago', '2 Weeks Ago', 'Last Week', 'This Week'];
                      
                      return weeks.map((week, weekIdx) => (
                        <div key={`week-${weekIdx}`}>
                          <div style={styles.weekLabel}>
                            {weekLabels[Math.max(0, weekLabels.length - weeks.length + weekIdx)]}
                            {weekIdx === weeks.length - 1 && ' (Current)'}
                          </div>
                          <div style={styles.calendarGrid}>
                            {week.map((day, dayIdx) => {
                              if (!day) return <div key={`w${weekIdx}-${dayIdx}`} style={styles.calendarDayEmpty}></div>;
                              const isUploaded = hasDataForDate(day.dateStr, selectedTournament.uploadedDates, selectedTournament.eventType);
                              return (
                                <div 
                                  key={`w${weekIdx}-${dayIdx}`} 
                                  style={{
                                    ...styles.calendarDay,
                                    ...(isUploaded ? styles.calendarDayComplete : styles.calendarDayMissing),
                                    ...(day.isToday ? styles.calendarDayToday : {}),
                                    ...(hasAccess('master') ? styles.calendarDayClickable : {})
                                  }}
                                  title={isUploaded ? 'Data uploaded' + (hasAccess('master') ? ' - Click to mark as missing' : '') : "Missing this day's data. Please submit a CSV if you have history for this event." + (hasAccess('master') ? ' - Click to mark as uploaded' : '')}
                                  onClick={() => hasAccess('master') && toggleDateStatus(day.dateStr)}
                                >
                                  <span style={styles.calendarDayNum}>{day.dayOfMonth}</span>
                                  <span style={{...styles.calendarDayStatus, color: isUploaded ? theme.success : theme.warning}}>{isUploaded ? '✓' : '??'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={styles.calendarLegend}>
                    <span style={styles.legendItem}><span style={{...styles.legendDot, background: theme.success}}/> Uploaded</span>
                    <span style={styles.legendItem}><span style={{...styles.legendDot, background: theme.warning}}/> Missing</span>
                    <span style={styles.legendItem}><span style={{...styles.legendDot, background: theme.accent}}/> Today</span>
                  </div>
                  <div style={styles.modalBtns}>
                    <button onClick={() => setShowMissingData(false)} style={styles.saveBtn}>Close</button>
                  </div>
                </div>
              </div>
            )}
            <div style={styles.tabRow}>
              <div style={styles.tabs}>
                <button style={{...styles.tab, ...(activeTab === 'pitching' ? styles.tabActive : {})}} onClick={() => { setActiveTab('pitching'); setFilters(f => ({...f, position: 'all'})); setCurrentPage(1); }}>Pitching <span style={styles.tabCount}>{selectedTournament.pitching?.length || 0}</span></button>
                <button style={{...styles.tab, ...(activeTab === 'batting' ? styles.tabActive : {})}} onClick={() => { setActiveTab('batting'); setFilters(f => ({...f, position: 'all'})); setCurrentPage(1); }}>Batting <span style={styles.tabCount}>{selectedTournament.batting?.length || 0}</span></button>
              </div>
            </div>
            <div style={styles.controlBar}>
              {selectedTournament.rotatingFormat && (
                <div 
                  onClick={() => alert('🔄 Rotating Format\n\nThis tournament/draft rotates its park and era runtime settings frequently.\n\nThis means player performance may vary significantly between uploads due to changing environmental factors, not just player skill.\n\nComparing stats across different dates should account for these runtime changes.')}
                  style={{
                    background: theme.warning + '22',
                    border: `1px solid ${theme.warning}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: theme.warning,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Click for more info"
                >
                  🔄 Rotating Format
                </div>
              )}
              <div style={styles.controlGroup}>
                <input type="text" placeholder="Search player..." value={filters.search} onChange={(e) => setFilters(f => ({...f, search: e.target.value}))} style={styles.searchInput} />
                <select value={filters.position} onChange={(e) => setFilters(f => ({...f, position: e.target.value}))} style={styles.filterSelect}>
                  {(activeTab === 'pitching' ? pitchingPositions : battingPositions).map(pos => <option key={pos} value={pos}>{pos === 'all' ? 'All POS' : pos}</option>)}
                </select>
              </div>
              <div style={styles.controlDivider} />
              <div style={styles.controlGroup}>
                <button style={{...styles.controlBtn, ...(showAdvancedFilters ? styles.controlBtnActive : {}), ...(getActiveFilterCount() > 0 ? styles.controlBtnHighlight : {})}} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                  Filters {getActiveFilterCount() > 0 && <span style={styles.filterBadge}>{getActiveFilterCount()}</span>}
                </button>
              </div>
              <div style={styles.controlDivider} />
              <div style={styles.controlGroup}>
                <button style={{...styles.controlBtn, ...(showPer9 ? styles.controlBtnActive : {})}} onClick={() => setShowPer9(!showPer9)} title="Show advanced rate statistics (WAR/200IP, WAR/600PA, wRAA/600PA, BsR/600PA)">Advanced Stats</button>
                <button style={{...styles.controlBtn, ...(!showTraditional ? styles.controlBtnActive : {})}} onClick={() => setShowTraditional(!showTraditional)} title="Hide traditional counting stats (G, GS, AB, H, 2B, 3B, HR, BF, ERA, AVG, OBP, WHIP, H/9)">Hide Traditional</button>
                {getActiveFilterCount() > 0 && <button style={styles.resetBtn} onClick={resetFilters}>Reset</button>}
              </div>
              <div style={styles.resultsCount}>{filteredData.length} / {totalData}</div>
            </div>
            {showAdvancedFilters && (
              <div style={styles.advancedFilters}>
                {/* Stat Filters Row */}
                <div style={styles.filterGroup}>
                  <StatFilter label="G" filter={filters.gFilter} onChange={(u) => updateStatFilter('gFilter', u)} theme={theme} />
                  {activeTab === 'batting' ? (
                    <>
                      <StatFilter label="PA" filter={filters.paFilter} onChange={(u) => updateStatFilter('paFilter', u)} theme={theme} />
                      <StatFilter label="AB" filter={filters.abFilter} onChange={(u) => updateStatFilter('abFilter', u)} theme={theme} />
                      <StatFilter label="DEF" filter={filters.defFilter} onChange={(u) => updateStatFilter('defFilter', u)} theme={theme} />
                    </>
                  ) : (
                    <StatFilter label="IP" filter={filters.ipFilter} onChange={(u) => updateStatFilter('ipFilter', u)} theme={theme} />
                  )}
                </div>
                
                {/* Card Tier Toggles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>Card Tiers:</span>
                  {[
                    { key: 'perfect', label: 'Perfect', color: '#a855f7', min: 100 },
                    { key: 'diamond', label: 'Diamond', color: '#32EBFC', min: 90 },
                    { key: 'gold', label: 'Gold', color: '#FFE61F', min: 80 },
                    { key: 'silver', label: 'Silver', color: '#E0E0E0', min: 70 },
                    { key: 'bronze', label: 'Bronze', color: '#cd7f32', min: 60 },
                    { key: 'iron', label: 'Iron', color: '#888', min: 0 }
                  ].map(tier => (
                    <button
                      key={tier.key}
                      onClick={() => toggleCardTier(tier.key)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${filters.cardTiers[tier.key] ? tier.color : theme.border}`,
                        background: filters.cardTiers[tier.key] ? tier.color + '22' : 'transparent',
                        color: filters.cardTiers[tier.key] ? tier.color : theme.textMuted,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        opacity: filters.cardTiers[tier.key] ? 1 : 0.5
                      }}
                      title={`${tier.label} (${tier.min}+ OVR) - Click to ${filters.cardTiers[tier.key] ? 'hide' : 'show'}`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
                
                {/* Variant Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>Variants:</span>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'no', label: 'No Variants' },
                    { value: 'yes', label: 'Only Variants' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters(f => ({ ...f, variantFilter: opt.value }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${filters.variantFilter === opt.value ? theme.accent : theme.border}`,
                        background: filters.variantFilter === opt.value ? theme.accent + '22' : 'transparent',
                        color: filters.variantFilter === opt.value ? theme.accent : theme.textMuted,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={styles.tableContainer}>
              {activeTab === 'pitching' 
                ? <PitchingTable data={filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} showTraditional={showTraditional} onPlayerClick={handlePlayerClick} /> 
                : <BattingTable data={filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} showTraditional={showTraditional} onPlayerClick={handlePlayerClick} />}
            </div>
            {filteredData.length > ROWS_PER_PAGE && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${theme.border}` }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: currentPage === 1 ? theme.bgSecondary : theme.cardBg, color: currentPage === 1 ? theme.textMuted : theme.textPrimary, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ color: theme.textMuted, fontSize: 13 }}>
                  Page {currentPage} of {Math.ceil(filteredData.length / ROWS_PER_PAGE)} ({filteredData.length} total)
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredData.length / ROWS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredData.length / ROWS_PER_PAGE)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`, background: currentPage >= Math.ceil(filteredData.length / ROWS_PER_PAGE) ? theme.bgSecondary : theme.cardBg, color: currentPage >= Math.ceil(filteredData.length / ROWS_PER_PAGE) ? theme.textMuted : theme.textPrimary, cursor: currentPage >= Math.ceil(filteredData.length / ROWS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            )}
          </>)}
        </div>
      </main>
      {selectedPlayer && selectedTournament && (
        <PlayerTrendModal 
          player={selectedPlayer} 
          playerType={selectedPlayerType} 
          tournamentId={selectedTournament.id}
          theme={theme} 
          onClose={closePlayerModal} 
        />
      )}
    </Layout>
  );
}

function parseMarkdown(text) {
  if (!text) return '';
  return text.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>').replace(/\n/g, '<br />');
}

function InfoPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth, logout } = useAuth();
  const [content, setContent] = useState({ title: 'Info & FAQ', sections: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState({ title: '', sections: [] });
  const [notification, setNotification] = useState(null);
  const [isRebuilding, setIsRebuilding] = useState(false);

  useEffect(() => { loadContent(); }, []);
  const loadContent = async () => { setIsLoading(true); try { const { data } = await supabase.from('site_content').select('*').eq('id', 'info').single(); if (data?.content) setContent(data.content); } catch (e) {} setIsLoading(false); };
  const saveContent = async () => { try { await supabase.from('site_content').upsert({ id: 'info', content: editContent, updated_at: new Date().toISOString() }); setContent(editContent); setIsEditing(false); showNotif('Saved!'); } catch (e) { showNotif('Failed', 'error'); } };
  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };
  const startEditing = () => { requestAuth(() => { setEditContent(JSON.parse(JSON.stringify(content))); setIsEditing(true); }, 'master'); };
  const addSection = () => { setEditContent(c => ({ ...c, sections: [...c.sections, { heading: 'New Section', body: 'Content...' }] })); };
  const updateSection = (i, field, value) => { setEditContent(c => { const s = [...c.sections]; s[i] = { ...s[i], [field]: value }; return { ...c, sections: s }; }); };
  const removeSection = (i) => { setEditContent(c => ({ ...c, sections: c.sections.filter((_, idx) => idx !== i) })); };
  const moveSection = (i, dir) => { const ni = i + dir; if (ni < 0 || ni >= editContent.sections.length) return; setEditContent(c => { const s = [...c.sections]; [s[i], s[ni]] = [s[ni], s[i]]; return { ...c, sections: s }; }); };

  const rebuildAllStats = async () => {
    if (!confirm('This will rebuild ALL tournament stats from upload history. Continue?')) return;
    
    setIsRebuilding(true);
    showNotif('Rebuilding stats... This may take a moment.');
    
    try {
      // Get all tournaments
      const { data: tournaments, error: tError } = await supabase.from('tournaments').select('*');
      if (tError) throw tError;
      
      // Get all upload history
      const { data: uploads, error: uError } = await supabase.from('upload_history').select('*').order('created_at', { ascending: true });
      if (uError) throw uError;
      
      const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
      const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };
      const parseIP = (ip) => { const str = String(ip); if (str.includes('.')) { const [whole, frac] = str.split('.'); return parseFloat(whole) + (parseFloat(frac) / 3); } return parseFloat(ip) || 0; };
      const formatIP = (ipDecimal) => { const whole = Math.floor(ipDecimal); const frac = Math.round((ipDecimal - whole) * 3); return frac === 0 ? String(whole) : `${whole}.${frac}`; };
      
      let rebuiltCount = 0;
      
      for (const tournament of tournaments) {
        const tournamentUploads = uploads.filter(u => u.tournament_id === tournament.id);
        if (tournamentUploads.length === 0) continue;
        
        const battingMap = new Map();
        const pitchingMap = new Map();
        
        // Get unique upload dates for calendar
        const uploadDates = [...new Set(tournamentUploads.map(u => u.upload_date))];
        
        // Process each upload
        for (const upload of tournamentUploads) {
          const playerData = upload.player_data || [];
          
          // Process each row as an individual instance
          for (const row of playerData) {
            const name = (row.Name || '').trim();
            const ovr = parseNum(row.OVR);
            const vari = parseVariant(row.VAR);
            const key = `${name}|${ovr}|${vari}`;
            
            if (upload.file_type === 'batting') {
              const instance = {
                id: crypto.randomUUID(),
                name, pos: row.POS?.trim() || '', bats: row.B || '', ovr, vari,
                def: parseNum(row.DEF),
                g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
                h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR),
                so: parseNum(row.SO), gidp: parseNum(row.GIDP),
                avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
                woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']),
                babip: row.BABIP || '.000', wrcPlus: parseNum(row['wRC+']),
                wraa: row.wRAA || '0.0', war: row.WAR || '0.0',
                bbPct: parsePct(row['BB%']), sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
              };
              
              if (battingMap.has(key)) {
                const existing = battingMap.get(key);
                const oldCount = existing._instanceCount || 1;
                const newCount = oldCount + 1;
                
                // Track position counts
                const positionCounts = { ...(existing._positionCounts || {}) };
                const instancePos = instance.pos?.toUpperCase() || '';
                if (instancePos) {
                  positionCounts[instancePos] = (positionCounts[instancePos] || 0) + 1;
                }
                
                // Get all positions and primary (most played)
                const positions = Object.keys(positionCounts).sort((a, b) => positionCounts[b] - positionCounts[a]);
                const primaryPos = positions[0] || existing.pos;
                
                battingMap.set(key, {
                  ...existing,
                  _instanceCount: newCount,
                  _positionCounts: positionCounts,
                  positions: positions,
                  pos: primaryPos,
                  g: existing.g + instance.g,
                  gs: existing.gs + instance.gs,
                  pa: existing.pa + instance.pa,
                  ab: existing.ab + instance.ab,
                  war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
                  wraa: (parseFloat(existing.wraa || 0) + parseFloat(instance.wraa || 0)).toFixed(1),
                  bsr: (parseFloat(existing.bsr || 0) + parseFloat(instance.bsr || 0)).toFixed(1),
                  ovr: instance.ovr, vari: instance.vari,
                  def: instance.def || existing.def, // Update DEF if new value exists, else keep existing
                  bats: instance.bats || existing.bats,
                  h: Math.round(((existing.h * oldCount) + instance.h) / newCount),
                  doubles: Math.round(((existing.doubles * oldCount) + instance.doubles) / newCount),
                  triples: Math.round(((existing.triples * oldCount) + instance.triples) / newCount),
                  hr: Math.round(((existing.hr * oldCount) + instance.hr) / newCount),
                  so: Math.round(((existing.so * oldCount) + instance.so) / newCount),
                  gidp: Math.round(((existing.gidp * oldCount) + instance.gidp) / newCount),
                  avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
                  obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
                  slg: (((parseFloat(existing.slg || 0) * oldCount) + parseFloat(instance.slg || 0)) / newCount).toFixed(3),
                  ops: (((parseFloat(existing.ops || 0) * oldCount) + parseFloat(instance.ops || 0)) / newCount).toFixed(3),
                  woba: (((parseFloat(existing.woba || 0) * oldCount) + parseFloat(instance.woba || 0)) / newCount).toFixed(3),
                  babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
                  opsPlus: Math.round(((parseFloat(existing.opsPlus || 0) * oldCount) + parseFloat(instance.opsPlus || 0)) / newCount),
                  wrcPlus: Math.round(((parseFloat(existing.wrcPlus || 0) * oldCount) + parseFloat(instance.wrcPlus || 0)) / newCount),
                  bbPct: (((parseFloat(existing.bbPct || 0) * oldCount) + parseFloat(instance.bbPct || 0)) / newCount).toFixed(1),
                  sbPct: (((parseFloat(existing.sbPct || 0) * oldCount) + parseFloat(instance.sbPct || 0)) / newCount).toFixed(1)
                });
              } else {
                const instancePos = instance.pos?.toUpperCase() || '';
                instance._instanceCount = 1;
                instance._positionCounts = instancePos ? { [instancePos]: 1 } : {};
                instance.positions = instancePos ? [instancePos] : [];
                instance.pos = instancePos;
                battingMap.set(key, instance);
              }
            } else {
              // Pitching
              const instance = {
                id: crypto.randomUUID(),
                name, pos: row.POS?.trim() || '', throws: row.T || '', ovr, vari,
                g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
                era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000',
                babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
                braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00',
                hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
                lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']),
                fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
                war: row.WAR || '0.0', siera: row.SIERA || '0.00'
              };
              
              if (pitchingMap.has(key)) {
                const existing = pitchingMap.get(key);
                const oldCount = existing._instanceCount || 1;
                const newCount = oldCount + 1;
                
                // Track position counts
                const positionCounts = { ...(existing._positionCounts || {}) };
                const instancePos = instance.pos?.toUpperCase() || '';
                if (instancePos) {
                  positionCounts[instancePos] = (positionCounts[instancePos] || 0) + 1;
                }
                
                // Get all positions and primary (most played)
                const positions = Object.keys(positionCounts).sort((a, b) => positionCounts[b] - positionCounts[a]);
                const primaryPos = positions[0] || existing.pos;
                
                pitchingMap.set(key, {
                  ...existing,
                  _instanceCount: newCount,
                  _positionCounts: positionCounts,
                  positions: positions,
                  pos: primaryPos,
                  g: existing.g + instance.g,
                  gs: existing.gs + instance.gs,
                  ip: formatIP(parseIP(existing.ip) + parseIP(instance.ip)),
                  bf: existing.bf + instance.bf,
                  war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
                  ovr: instance.ovr, vari: instance.vari,
                  throws: instance.throws || existing.throws,
                  era: (((parseFloat(existing.era || 0) * oldCount) + parseFloat(instance.era || 0)) / newCount).toFixed(2),
                  avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
                  obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
                  babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
                  whip: (((parseFloat(existing.whip || 0) * oldCount) + parseFloat(instance.whip || 0)) / newCount).toFixed(2),
                  braPer9: (((parseFloat(existing.braPer9 || 0) * oldCount) + parseFloat(instance.braPer9 || 0)) / newCount).toFixed(2),
                  hrPer9: (((parseFloat(existing.hrPer9 || 0) * oldCount) + parseFloat(instance.hrPer9 || 0)) / newCount).toFixed(2),
                  hPer9: (((parseFloat(existing.hPer9 || 0) * oldCount) + parseFloat(instance.hPer9 || 0)) / newCount).toFixed(2),
                  bbPer9: (((parseFloat(existing.bbPer9 || 0) * oldCount) + parseFloat(instance.bbPer9 || 0)) / newCount).toFixed(2),
                  kPer9: (((parseFloat(existing.kPer9 || 0) * oldCount) + parseFloat(instance.kPer9 || 0)) / newCount).toFixed(2),
                  lobPct: (((parseFloat(existing.lobPct || 0) * oldCount) + parseFloat(instance.lobPct || 0)) / newCount).toFixed(1),
                  eraPlus: Math.round(((parseFloat(existing.eraPlus || 0) * oldCount) + parseFloat(instance.eraPlus || 0)) / newCount),
                  fip: (((parseFloat(existing.fip || 0) * oldCount) + parseFloat(instance.fip || 0)) / newCount).toFixed(2),
                  fipMinus: Math.round(((parseFloat(existing.fipMinus || 0) * oldCount) + parseFloat(instance.fipMinus || 0)) / newCount),
                  siera: (((parseFloat(existing.siera || 0) * oldCount) + parseFloat(instance.siera || 0)) / newCount).toFixed(2)
                });
              } else {
                const instancePos = instance.pos?.toUpperCase() || '';
                instance._instanceCount = 1;
                instance._positionCounts = instancePos ? { [instancePos]: 1 } : {};
                instance.positions = instancePos ? [instancePos] : [];
                instance.pos = instancePos;
                pitchingMap.set(key, instance);
              }
            }
          }
        }
        
        // Update tournament with rebuilt data and upload dates
        const battingData = Array.from(battingMap.values());
        const pitchingData = Array.from(pitchingMap.values());
        
        const { error: updateError } = await supabase.from('tournaments').update({
          batting: battingData,
          pitching: pitchingData,
          uploaded_dates: uploadDates
        }).eq('id', tournament.id);
        
        if (updateError) {
          console.error(`Failed to update ${tournament.name}:`, updateError);
        } else {
          rebuiltCount++;
        }
      }
      
      showNotif(`Rebuilt ${rebuiltCount} tournaments!`);
    } catch (e) {
      console.error('Rebuild error:', e);
      showNotif('Rebuild failed: ' + e.message, 'error');
    }
    
    setIsRebuilding(false);
  };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>{isEditing ? 'Edit Info' : content.title}</h2>
          {!isEditing && hasAccess('master') && <button onClick={startEditing} style={styles.editBtn}>Edit</button>}
        </div>
        {isEditing ? (<div style={styles.editContainer}>
          <div style={styles.editField}><label style={styles.editLabel}>Title</label><input type="text" value={editContent.title} onChange={(e) => setEditContent(c => ({ ...c, title: e.target.value }))} style={styles.input} /></div>
          {editContent.sections.map((section, i) => (<div key={i} style={styles.editSection}>
            <div style={styles.editSectionHeader}><span style={styles.editSectionNum}>#{i + 1}</span>
              <div style={styles.editSectionBtns}><button onClick={() => moveSection(i, -1)} style={styles.moveBtn}>↑</button><button onClick={() => moveSection(i, 1)} style={styles.moveBtn}>↓</button><button onClick={() => removeSection(i)} style={styles.removeBtn}>✕</button></div>
            </div>
            <input type="text" value={section.heading} onChange={(e) => updateSection(i, 'heading', e.target.value)} style={styles.input} placeholder="Heading" />
            <textarea value={section.body} onChange={(e) => updateSection(i, 'body', e.target.value)} style={styles.textareaLarge} rows={6} placeholder="Content..." />
          </div>))}
          <button onClick={addSection} style={styles.addSectionBtn}>+ Add Section</button>
          <div style={styles.editActions}><button onClick={saveContent} style={styles.saveBtn}>Save</button><button onClick={() => setIsEditing(false)} style={styles.cancelBtn}>Cancel</button></div>
        </div>) : (<div style={styles.infoContent}>
          {content.sections.length === 0 ? <p style={styles.emptyMsg}>No content yet.</p> :
            content.sections.map((s, i) => <div key={i} style={styles.infoSection}><h3 style={styles.infoHeading}>{s.heading}</h3><div style={styles.infoBody} dangerouslySetInnerHTML={{ __html: parseMarkdown(s.body) }} /></div>)}
        </div>)}
        
        {/* Admin Login Section */}
        <div style={styles.adminLoginSection}>
          <h3 style={styles.adminLoginTitle}>🔐 Admin Access</h3>
          {hasAccess('master') ? (
            <div style={styles.adminLoginStatus}>
              <span style={styles.adminLoginBadge}>✓ Logged in as Admin</span>
              <button onClick={logout} style={styles.adminLogoutBtn}>Logout</button>
              <button 
                onClick={() => requestAuth(rebuildAllStats, 'master')} 
                disabled={isRebuilding}
                style={{...styles.adminLogoutBtn, background: '#f59e0b', marginLeft: 8}}
              >
                {isRebuilding ? 'Rebuilding...' : '🔧 Rebuild All Stats'}
              </button>
            </div>
          ) : hasAccess('upload') ? (
            <div style={styles.adminLoginStatus}>
              <span style={{...styles.adminLoginBadge, background: theme.warning}}>✓ Upload Access</span>
              <button onClick={() => requestAuth(() => {}, 'master')} style={styles.adminUpgradeBtn}>Upgrade to Admin</button>
              <button onClick={logout} style={styles.adminLogoutBtn}>Logout</button>
            </div>
          ) : (
            <div style={styles.adminLoginPrompt}>
              <p style={styles.adminLoginText}>Admins can log in here to access additional features.</p>
              <button onClick={() => requestAuth(() => {}, 'master')} style={styles.adminLoginBtn}>Admin Login</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function VideosPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth } = useAuth();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [notification, setNotification] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => { loadVideos(); }, []);
  const loadVideos = async () => { setIsLoading(true); try { const { data } = await supabase.from('site_content').select('*').eq('id', 'videos').single(); if (data?.content?.videos) setVideos(data.content.videos); } catch (e) {} setIsLoading(false); };
  const saveVideos = async (newVideos) => { try { await supabase.from('site_content').upsert({ id: 'videos', content: { videos: newVideos }, updated_at: new Date().toISOString() }); setVideos(newVideos); } catch (e) { showNotif('Failed', 'error'); } };
  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };
  const extractVideoId = (url) => {
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return { platform: 'youtube', id: ytMatch[1] };
    const twitchClip = url.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/);
    if (twitchClip) return { platform: 'twitch-clip', id: twitchClip[1] };
    const twitchVideo = url.match(/twitch\.tv\/videos\/(\d+)/);
    if (twitchVideo) return { platform: 'twitch-video', id: twitchVideo[1] };
    return null;
  };
  const getThumbnail = (v) => v.platform === 'youtube' ? `https://img.youtube.com/vi/${v.id}/mqdefault.jpg` : null;
  const getEmbedUrl = (v) => v.platform === 'youtube' ? `https://www.youtube.com/embed/${v.id}` : v.platform === 'twitch-clip' ? `https://clips.twitch.tv/embed?clip=${v.id}&parent=${window.location.hostname}` : `https://player.twitch.tv/?video=${v.id}&parent=${window.location.hostname}`;
  const addVideo = () => { requestAuth(() => { const info = extractVideoId(newVideoUrl); if (!info) { showNotif('Invalid URL', 'error'); return; } saveVideos([{ ...info, title: newVideoTitle || 'Untitled', addedAt: new Date().toISOString() }, ...videos]); setNewVideoUrl(''); setNewVideoTitle(''); setShowAddForm(false); showNotif('Added!'); }, 'master'); };
  const removeVideo = (i) => { requestAuth(() => { if (!confirm('Remove?')) return; saveVideos(videos.filter((_, idx) => idx !== i)); showNotif('Removed'); }, 'master'); };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>Videos</h2>
          {hasAccess('master') && <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>+ Add</button>}
        </div>
        {showAddForm && (<div style={styles.addVideoForm}>
          <input type="text" placeholder="Title" value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} style={styles.input} />
          <input type="text" placeholder="YouTube/Twitch URL" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} style={styles.input} />
          <div style={styles.formBtns}><button onClick={addVideo} style={styles.saveBtn}>Add</button><button onClick={() => { setShowAddForm(false); setNewVideoUrl(''); setNewVideoTitle(''); }} style={styles.cancelBtn}>Cancel</button></div>
        </div>)}
        {playingVideo !== null && (<div style={styles.videoPlayerOverlay} onClick={() => setPlayingVideo(null)}>
          <div style={styles.videoPlayerContainer} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPlayingVideo(null)} style={styles.closePlayerBtn}>✕</button>
            <iframe src={getEmbedUrl(videos[playingVideo])} style={styles.videoPlayer} frameBorder="0" allowFullScreen />
          </div>
        </div>)}
        {videos.length === 0 ? <p style={styles.emptyMsg}>No videos yet.</p> : (
          <div style={styles.videoGrid}>
            {videos.map((v, i) => (<div key={i} style={styles.videoCard}>
              <div style={styles.thumbnailContainer} onClick={() => setPlayingVideo(i)}>
                {getThumbnail(v) ? <img src={getThumbnail(v)} alt={v.title} style={styles.thumbnail} /> : <div style={styles.thumbnailPlaceholder}>▶</div>}
              </div>
              <div style={styles.videoInfo}><span style={styles.videoTitle}>{v.title}</span><span style={styles.videoPlatform}>{v.platform === 'youtube' ? 'YouTube' : 'Twitch'}</span></div>
              {hasAccess('master') && <button onClick={() => removeVideo(i)} style={styles.removeVideoBtn}>✕</button>}
            </div>))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ArticlesPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth } = useAuth();
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleDescription, setNewArticleDescription] = useState('');
  const [newArticleFile, setNewArticleFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewingArticle, setViewingArticle] = useState(null);

  useEffect(() => { loadArticles(); }, []);

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('site_content').select('*').eq('id', 'articles').single();
      if (data?.content?.articles) setArticles(data.content.articles);
    } catch (e) {}
    setIsLoading(false);
  };

  const saveArticles = async (newArticles) => {
    try {
      await supabase.from('site_content').upsert({ 
        id: 'articles', 
        content: { articles: newArticles }, 
        updated_at: new Date().toISOString() 
      });
      setArticles(newArticles);
    } catch (e) {
      showNotif('Failed to save', 'error');
    }
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addArticle = async () => {
    requestAuth(async () => {
      if (!newArticleFile || !newArticleTitle) {
        showNotif('Please provide a title and PDF file', 'error');
        return;
      }

      setUploading(true);
      try {
        // Upload PDF to Supabase Storage
        const fileName = `${Date.now()}_${newArticleFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('articles')
          .upload(fileName, newArticleFile, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage.from('articles').getPublicUrl(fileName);

        const newArticle = {
          id: crypto.randomUUID(),
          title: newArticleTitle,
          description: newArticleDescription || '',
          fileName: fileName,
          fileUrl: urlData.publicUrl,
          addedAt: new Date().toISOString()
        };

        await saveArticles([newArticle, ...articles]);
        setNewArticleTitle('');
        setNewArticleDescription('');
        setNewArticleFile(null);
        setShowAddForm(false);
        showNotif('Article added!');
      } catch (e) {
        console.error('Upload error:', e);
        showNotif('Failed to upload PDF', 'error');
      }
      setUploading(false);
    }, 'master');
  };

  const removeArticle = (articleId) => {
    requestAuth(async () => {
      if (!confirm('Remove this article?')) return;
      const article = articles.find(a => a.id === articleId);
      if (article?.fileName) {
        // Delete from storage
        await supabase.storage.from('articles').remove([article.fileName]);
      }
      await saveArticles(articles.filter(a => a.id !== articleId));
      showNotif('Article removed');
    }, 'master');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>📄 Articles</h2>
          {hasAccess('master') && <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>+ Add Article</button>}
        </div>

        {showAddForm && (
          <div style={styles.addArticleForm}>
            <input 
              type="text" 
              placeholder="Article Title *" 
              value={newArticleTitle} 
              onChange={(e) => setNewArticleTitle(e.target.value)} 
              style={styles.input} 
            />
            <textarea 
              placeholder="Description (optional)" 
              value={newArticleDescription} 
              onChange={(e) => setNewArticleDescription(e.target.value)} 
              style={{...styles.input, minHeight: 80, resize: 'vertical'}} 
            />
            <label style={styles.fileDropzone}>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={(e) => setNewArticleFile(e.target.files[0])} 
                style={{display:'none'}} 
              />
              {newArticleFile ? (
                <div style={styles.fileSelected}>
                  📄 {newArticleFile.name}
                  <button style={styles.fileClearBtn} onClick={(e) => { e.preventDefault(); setNewArticleFile(null); }}>✕</button>
                </div>
              ) : (
                <div style={styles.filePrompt}><span style={styles.fileIcon}>📎</span>Click to upload PDF</div>
              )}
            </label>
            <div style={styles.formBtns}>
              <button onClick={addArticle} style={styles.saveBtn} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Add Article'}
              </button>
              <button onClick={() => { setShowAddForm(false); setNewArticleTitle(''); setNewArticleDescription(''); setNewArticleFile(null); }} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {viewingArticle && (
          <div style={styles.articleViewerOverlay} onClick={() => setViewingArticle(null)}>
            <div style={styles.articleViewerContainer} onClick={(e) => e.stopPropagation()}>
              <div style={styles.articleViewerHeader}>
                <h3 style={styles.articleViewerTitle}>{viewingArticle.title}</h3>
                <button onClick={() => setViewingArticle(null)} style={styles.closePlayerBtn}>✕</button>
              </div>
              <iframe 
                src={viewingArticle.fileUrl} 
                style={styles.articleViewer} 
                title={viewingArticle.title}
              />
            </div>
          </div>
        )}

        {articles.length === 0 ? (
          <p style={styles.emptyMsg}>No articles yet.</p>
        ) : (
          <div style={styles.articleGrid}>
            {articles.map((article) => (
              <div key={article.id} style={styles.articleCard}>
                <div style={styles.articleCardContent} onClick={() => setViewingArticle(article)}>
                  <div style={styles.articleIcon}>📄</div>
                  <div style={styles.articleInfo}>
                    <h3 style={styles.articleTitle}>{article.title}</h3>
                    {article.description && <p style={styles.articleDescription}>{article.description}</p>}
                    <span style={styles.articleDate}>{formatDate(article.addedAt)}</span>
                  </div>
                </div>
                <div style={styles.articleActions}>
                  <button 
                    onClick={() => setViewingArticle(article)} 
                    style={styles.articleDownloadBtn}
                  >
                    📖 Read
                  </button>
                  {hasAccess('master') && <button onClick={() => removeArticle(article.id)} style={styles.articleRemoveBtn}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatFilter({ label, filter, onChange, theme }) {
  const styles = getStyles(theme);
  return (<div style={styles.statFilter}>
    <label style={styles.statFilterLabel}><input type="checkbox" checked={filter.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} style={styles.checkbox} />{label}</label>
    <div style={styles.statFilterControls}>
      <select value={filter.operator} onChange={(e) => onChange({ operator: e.target.value })} style={styles.operatorSelect} disabled={!filter.enabled}>
        <option value=">">{'>'}</option><option value=">=">{'>='}</option><option value="=">=</option><option value="<=">{'<='}</option><option value="<">{'<'}</option>
      </select>
      <input type="number" value={filter.value} onChange={(e) => onChange({ value: e.target.value })} style={styles.valueInput} disabled={!filter.enabled} min="0" />
    </div>
  </div>);
}

// Player Trend Modal - shows performance over time
function PlayerTrendModal({ player, playerType, tournamentId, theme, onClose }) {
  const styles = getStyles(theme);
  const [trendData, setTrendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTrendData();
  }, [player, tournamentId]);

  const loadTrendData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get upload history for this tournament
      const { data: history, error: historyError } = await supabase
        .from('upload_history')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('file_type', playerType)
        .order('created_at', { ascending: true });

      if (historyError) throw historyError;

      if (!history || history.length === 0) {
        setTrendData([]);
        setIsLoading(false);
        return;
      }

      // Find this player in each upload by name|ovr key
      const playerKey = `${player.name}|${player.ovr}`;
      const dataPoints = [];

      history.forEach((upload, index) => {
        const playerData = upload.player_data || [];
        // Find ALL instances of this player in the upload (not just the first)
        const allMatches = playerData.filter(p => {
          const name = (p.Name || p.name || '').trim();
          const ovr = parseFloat(p.OVR || p.ovr) || 0;
          return `${name}|${ovr}` === playerKey;
        });

        if (allMatches.length > 0) {
          if (playerType === 'pitching') {
            // Average all instances for this upload
            const avgSiera = allMatches.reduce((sum, p) => sum + (parseFloat(p.SIERA || p.siera) || 0), 0) / allMatches.length;
            const avgFipMinus = allMatches.reduce((sum, p) => sum + (parseFloat(p['FIP-'] || p.fipMinus) || 0), 0) / allMatches.length;
            const avgLobPct = allMatches.reduce((sum, p) => {
              const val = p['LOB%'] || p.lobPct || p.LOB || '0';
              return sum + (parseFloat(String(val).replace('%', '')) || 0);
            }, 0) / allMatches.length;
            dataPoints.push({
              upload: `#${index + 1}`,
              siera: Math.round(avgSiera * 100) / 100,
              fipMinus: Math.round(avgFipMinus),
              lobPct: Math.round(avgLobPct * 10) / 10,
              instances: allMatches.length,
            });
          } else {
            // Average all instances for this upload
            const avgWoba = allMatches.reduce((sum, p) => {
              const val = p.wOBA || p.woba || '0';
              return sum + (parseFloat(String(val).replace('.', '0.')) || 0);
            }, 0) / allMatches.length;
            const avgOpsPlus = allMatches.reduce((sum, p) => sum + (parseFloat(p['OPS+'] || p.opsPlus) || 0), 0) / allMatches.length;
            const avgWrcPlus = allMatches.reduce((sum, p) => sum + (parseFloat(p['wRC+'] || p.wrcPlus) || 0), 0) / allMatches.length;
            dataPoints.push({
              upload: `#${index + 1}`,
              woba: Math.round(avgWoba * 1000) / 1000,
              opsPlus: Math.round(avgOpsPlus),
              wrcPlus: Math.round(avgWrcPlus),
              instances: allMatches.length,
            });
          }
        }
      });

      setTrendData(dataPoints);
    } catch (e) {
      console.error('Error loading trend data:', e);
      setError('Failed to load trend data');
    }
    setIsLoading(false);
  };

  const formatDate = (dateStr) => dateStr;

  const modalStyles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modal: {
      background: theme.cardBg,
      borderRadius: 12,
      padding: 24,
      maxWidth: 700,
      width: '95%',
      maxHeight: '90vh',
      overflow: 'auto',
      border: `1px solid ${theme.border}`,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    playerInfo: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    playerName: {
      fontSize: 22,
      fontWeight: 700,
      color: theme.textPrimary,
      margin: 0,
    },
    playerMeta: {
      fontSize: 14,
      color: theme.textMuted,
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: theme.textMuted,
      fontSize: 24,
      cursor: 'pointer',
      padding: 4,
    },
    chartContainer: {
      background: theme.panelBg,
      borderRadius: 8,
      padding: 20,
      marginBottom: 16,
    },
    chartTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    noData: {
      textAlign: 'center',
      padding: 40,
      color: theme.textMuted,
    },
    statRow: {
      display: 'flex',
      gap: 20,
      marginTop: 16,
    },
    statBox: {
      flex: 1,
      background: theme.panelBg,
      borderRadius: 8,
      padding: 16,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 11,
      color: theme.textMuted,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 700,
      color: theme.textPrimary,
    },
    legend: {
      display: 'flex',
      justifyContent: 'center',
      gap: 24,
      marginTop: 12,
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: theme.textMuted,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: '50%',
    },
  };

  const primaryColor = theme.teamPrimary || '#3b82f6';
  const secondaryColor = theme.teamSecondary || '#f59e0b';

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div style={modalStyles.playerInfo}>
            <h2 style={modalStyles.playerName}>{player.name}</h2>
            <span style={modalStyles.playerMeta}>
              {player.pos} • OVR {player.ovr}{playerType === 'batting' && player.def ? ` • DEF ${player.def}` : ''} • {playerType === 'pitching' ? `${player.throws || 'R'}HP` : `Bats ${player.bats || 'R'}`}
            </span>
          </div>
          <button style={modalStyles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {isLoading ? (
          <div style={modalStyles.noData}>Loading trend data...</div>
        ) : error ? (
          <div style={modalStyles.noData}>{error}</div>
        ) : trendData.length < 2 ? (
          <div style={modalStyles.noData}>
            Not enough data points to show trends.<br />
            <span style={{fontSize: 12, marginTop: 8, display: 'block'}}>
              Player needs to appear in at least 2 uploads.
            </span>
          </div>
        ) : (
          <>
            <div style={modalStyles.chartContainer}>
              <div style={modalStyles.chartTitle}>
                Showing {trendData.length} Upload{trendData.length !== 1 ? 's' : ''} 
                <span style={{fontSize: 11, color: theme.textDim, marginLeft: 8}}>(number in parentheses = draft instances averaged)</span>
              </div>
              <div style={{fontSize: 10, color: theme.textMuted, marginBottom: 8, fontStyle: 'italic'}}>
                Showing {trendData.length} tracked upload{trendData.length !== 1 ? 's' : ''}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData.map((d, i) => ({...d, label: `Upl. ${i + 1} (${d.instances})`}))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: theme.textMuted, fontSize: 10 }}
                    axisLine={{ stroke: theme.border }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: theme.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: theme.border }}
                    domain={playerType === 'pitching' ? ['auto', 'auto'] : [0, 'auto']}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fill: theme.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: theme.border }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: theme.cardBg, 
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      color: theme.textPrimary 
                    }}
                    labelStyle={{ color: theme.textMuted }}
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => {
                      const match = label.match(/Upl\. (\d+) \((\d+)\)/);
                      if (match) {
                        return `Upload ${match[1]} — ${match[2]} draft instance${match[2] !== '1' ? 's' : ''} averaged`;
                      }
                      return label;
                    }}
                  />
                  {playerType === 'pitching' ? (
                    <>
                      <Line 
                        yAxisId="left"
                        type="linear" 
                        dataKey="siera" 
                        stroke={primaryColor}
                        strokeWidth={2}
                        dot={{ fill: primaryColor, strokeWidth: 2, r: 4 }}
                        name="SIERA"
                      />
                      <Line 
                        yAxisId="right"
                        type="linear" 
                        dataKey="fipMinus" 
                        stroke={secondaryColor}
                        strokeWidth={2}
                        dot={{ fill: secondaryColor, strokeWidth: 2, r: 4 }}
                        name="FIP-"
                      />
                    </>
                  ) : (
                    <>
                      <Line 
                        yAxisId="left"
                        type="linear" 
                        dataKey="woba" 
                        stroke={primaryColor}
                        strokeWidth={2}
                        dot={{ fill: primaryColor, strokeWidth: 2, r: 4 }}
                        name="wOBA"
                      />
                      <Line 
                        yAxisId="right"
                        type="linear" 
                        dataKey="opsPlus" 
                        stroke={secondaryColor}
                        strokeWidth={2}
                        dot={{ fill: secondaryColor, strokeWidth: 2, r: 4 }}
                        name="OPS+"
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div style={modalStyles.legend}>
                <div style={modalStyles.legendItem}>
                  <div style={{...modalStyles.legendDot, background: primaryColor}}></div>
                  {playerType === 'pitching' ? 'SIERA' : 'wOBA'}
                </div>
                <div style={modalStyles.legendItem}>
                  <div style={{...modalStyles.legendDot, background: secondaryColor}}></div>
                  {playerType === 'pitching' ? 'FIP-' : 'OPS+'}
                </div>
              </div>
            </div>

            <div style={modalStyles.statRow}>
              {playerType === 'pitching' ? (
                <>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg SIERA</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? (trendData.reduce((sum, d) => sum + d.siera, 0) / trendData.length).toFixed(2) : '-'}</div>
                  </div>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg FIP-</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? Math.round(trendData.reduce((sum, d) => sum + d.fipMinus, 0) / trendData.length) : '-'}</div>
                  </div>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg LOB%</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? (trendData.reduce((sum, d) => sum + d.lobPct, 0) / trendData.length).toFixed(1) + '%' : '-'}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg wOBA</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? (trendData.reduce((sum, d) => sum + d.woba, 0) / trendData.length).toFixed(3) : '-'}</div>
                  </div>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg OPS+</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? Math.round(trendData.reduce((sum, d) => sum + d.opsPlus, 0) / trendData.length) : '-'}</div>
                  </div>
                  <div style={modalStyles.statBox}>
                    <div style={modalStyles.statLabel}>Avg wRC+</div>
                    <div style={modalStyles.statValue}>{trendData.length > 0 ? Math.round(trendData.reduce((sum, d) => sum + d.wrcPlus, 0) / trendData.length) : '-'}</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PitchingTable({ data, sortBy, sortDir, onSort, theme, showPer9, showTraditional, onPlayerClick }) {
  const styles = getStyles(theme);
  const SortHeader = ({ field, children, isRate }) => (
    <th style={{...styles.th, ...(isRate ? styles.thRate : {}), ...(sortBy === field ? styles.thSorted : {})}} onClick={() => onSort(field)}>
      {children}{sortBy === field && <span style={styles.sortIndicator}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
  const calcIPperG = (ip, g) => { if (!g) return '0.00'; const str = String(ip); let n = str.includes('.') ? parseFloat(str.split('.')[0]) + (parseFloat(str.split('.')[1]) / 3) : parseFloat(ip) || 0; return (n / g).toFixed(2); };
  const parseIPVal = (ip) => { const str = String(ip); return str.includes('.') ? parseFloat(str.split('.')[0]) + (parseFloat(str.split('.')[1]) / 3) : parseFloat(ip) || 0; };
  const calcWarPer200IP = (war, ip) => { const ipNum = parseIPVal(ip); return ipNum === 0 ? '0.00' : (parseFloat(war || 0) / ipNum * 200).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No pitching data</div>;
  return (<div style={styles.tableWrapper}><table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="throws">T</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader>
    {showTraditional && <SortHeader field="g">G</SortHeader>}{showTraditional && <SortHeader field="gs">GS</SortHeader>}<SortHeader field="ip">IP</SortHeader><SortHeader field="ipPerG">IP/G</SortHeader>
    {showTraditional && <SortHeader field="bf">BF</SortHeader>}{showTraditional && <SortHeader field="era">ERA</SortHeader>}{showTraditional && <SortHeader field="avg">AVG</SortHeader>}{showTraditional && <SortHeader field="obp">OBP</SortHeader>}
    <SortHeader field="babip">BABIP</SortHeader>{showTraditional && <SortHeader field="whip">WHIP</SortHeader>}<SortHeader field="braPer9">BRA/9</SortHeader><SortHeader field="hrPer9">HR/9</SortHeader>
    {showTraditional && <SortHeader field="hPer9">H/9</SortHeader>}<SortHeader field="bbPer9">BB/9</SortHeader><SortHeader field="kPer9">K/9</SortHeader><SortHeader field="lobPct">LOB%</SortHeader>
    <SortHeader field="eraPlus">ERA+</SortHeader><SortHeader field="fip">FIP</SortHeader><SortHeader field="fipMinus">FIP-</SortHeader><SortHeader field="war">WAR</SortHeader>
    {showPer9 && <SortHeader field="warPer200IP" isRate>WAR/200</SortHeader>}<SortHeader field="siera">SIERA</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td>
      <td style={{...styles.tdName, cursor: onPlayerClick ? 'pointer' : 'default', color: onPlayerClick ? theme.accent : styles.tdName.color}} onClick={() => onPlayerClick && onPlayerClick(p, 'pitching')}>{p.name}</td>
      <td style={styles.td}>{p.throws}</td>
      <td style={{...styles.tdOvr, color: getOvrColor(p.ovr)}}>{p.ovr}</td><td style={styles.td}>{p.vari}</td>
      {showTraditional && <td style={styles.td}>{p.g}</td>}{showTraditional && <td style={styles.td}>{p.gs}</td>}<td style={styles.td}>{p.ip}</td><td style={styles.td}>{calcIPperG(p.ip, p.g)}</td>
      {showTraditional && <td style={styles.td}>{p.bf}</td>}{showTraditional && <td style={styles.td}>{p.era}</td>}{showTraditional && <td style={styles.td}>{p.avg}</td>}{showTraditional && <td style={styles.td}>{p.obp}</td>}
      <td style={styles.td}>{p.babip}</td>{showTraditional && <td style={styles.td}>{p.whip}</td>}<td style={styles.td}>{p.braPer9}</td><td style={styles.td}>{p.hrPer9}</td>
      {showTraditional && <td style={styles.td}>{p.hPer9}</td>}<td style={styles.td}>{p.bbPer9}</td><td style={styles.td}>{p.kPer9}</td><td style={styles.td}>{p.lobPct}</td>
      <td style={styles.td}>{p.eraPlus}</td><td style={styles.td}>{p.fip}</td><td style={styles.td}>{p.fipMinus}</td>
      <td style={{...styles.td, color: parseFloat(p.war) >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600}}>{p.war}</td>
      {showPer9 && <td style={styles.tdRate}>{calcWarPer200IP(p.war, p.ip)}</td>}
      <td style={{...styles.td, color: parseFloat(p.siera) < 3.90 ? '#22C55E' : parseFloat(p.siera) > 3.90 ? '#EF4444' : undefined}}>{p.siera}</td>
    </tr>))}
  </tbody></table></div>);
}

function BattingTable({ data, sortBy, sortDir, onSort, theme, showPer9, showTraditional, onPlayerClick }) {
  const styles = getStyles(theme);
  const SortHeader = ({ field, children, isRate }) => (
    <th style={{...styles.th, ...(isRate ? styles.thRate : {}), ...(sortBy === field ? styles.thSorted : {})}} onClick={() => onSort(field)}>
      {children}{sortBy === field && <span style={styles.sortIndicator}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
  const calcPer600PA = (val, pa) => { const paNum = parseFloat(pa) || 0; return paNum === 0 ? '0.00' : (parseFloat(val || 0) / paNum * 600).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No batting data</div>;
  return (<div style={styles.tableWrapper}><table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="bats">B</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader><SortHeader field="def">DEF</SortHeader>
    {showTraditional && <SortHeader field="g">G</SortHeader>}{showTraditional && <SortHeader field="gs">GS</SortHeader>}<SortHeader field="pa">PA</SortHeader>
    {showTraditional && <SortHeader field="ab">AB</SortHeader>}{showTraditional && <SortHeader field="h">H</SortHeader>}{showTraditional && <SortHeader field="doubles">2B</SortHeader>}
    {showTraditional && <SortHeader field="triples">3B</SortHeader>}{showTraditional && <SortHeader field="hr">HR</SortHeader>}<SortHeader field="bbPct">BB%</SortHeader>
    <SortHeader field="so">SO</SortHeader><SortHeader field="gidp">GIDP</SortHeader><SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="slg">SLG</SortHeader>
    <SortHeader field="woba">wOBA</SortHeader><SortHeader field="ops">OPS</SortHeader><SortHeader field="opsPlus">OPS+</SortHeader><SortHeader field="babip">BABIP</SortHeader>
    <SortHeader field="wrcPlus">wRC+</SortHeader><SortHeader field="wraa">wRAA</SortHeader>{showPer9 && <SortHeader field="wraaPer600PA" isRate>wRAA/600</SortHeader>}
    <SortHeader field="war">WAR</SortHeader>{showPer9 && <SortHeader field="warPer600PA" isRate>WAR/600</SortHeader>}
    <SortHeader field="sbPct">SB%</SortHeader><SortHeader field="bsr">BsR</SortHeader>{showPer9 && <SortHeader field="bsrPer600PA" isRate>BsR/600</SortHeader>}
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td>
      <td style={{...styles.tdName, cursor: onPlayerClick ? 'pointer' : 'default', color: onPlayerClick ? theme.accent : styles.tdName.color}} onClick={() => onPlayerClick && onPlayerClick(p, 'batting')}>{p.name}</td>
      <td style={styles.td}>{p.bats}</td>
      <td style={{...styles.tdOvr, color: getOvrColor(p.ovr)}}>{p.ovr}</td><td style={styles.td}>{p.vari}</td><td style={{...styles.td, color: p.def ? getDefColor(p.def) : theme.textMuted}}>{p.def || '—'}</td>
      {showTraditional && <td style={styles.td}>{p.g}</td>}{showTraditional && <td style={styles.td}>{p.gs}</td>}<td style={styles.td}>{p.pa}</td>
      {showTraditional && <td style={styles.td}>{p.ab}</td>}{showTraditional && <td style={styles.td}>{p.h}</td>}{showTraditional && <td style={styles.td}>{p.doubles}</td>}
      {showTraditional && <td style={styles.td}>{p.triples}</td>}{showTraditional && <td style={styles.td}>{p.hr}</td>}<td style={styles.td}>{p.bbPct}</td>
      <td style={styles.td}>{p.so}</td><td style={styles.td}>{p.gidp}</td><td style={styles.td}>{p.avg}</td><td style={styles.td}>{p.obp}</td><td style={styles.td}>{p.slg}</td>
      <td style={{...styles.td, color: parseFloat(p.woba) > 0.320 ? '#22C55E' : parseFloat(p.woba) < 0.320 ? '#EF4444' : undefined}}>{p.woba}</td>
      <td style={styles.td}>{p.ops}</td><td style={styles.td}>{p.opsPlus}</td><td style={styles.td}>{p.babip}</td>
      <td style={styles.td}>{p.wrcPlus}</td><td style={styles.td}>{p.wraa}</td>{showPer9 && <td style={styles.tdRate}>{calcPer600PA(p.wraa, p.pa)}</td>}
      <td style={{...styles.td, color: parseFloat(p.war) >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600}}>{p.war}</td>
      {showPer9 && <td style={styles.tdRate}>{calcPer600PA(p.war, p.pa)}</td>}
      <td style={styles.td}>{p.sbPct}</td><td style={styles.td}>{p.bsr}</td>{showPer9 && <td style={styles.tdRate}>{calcPer600PA(p.bsr, p.pa)}</td>}
    </tr>))}
  </tbody></table></div>);
}

// CSV Validation Logic
function validateCSV(content, filename) {
  const issues = [];
  const stats = { rows: 0, players: 0, type: 'unknown' };
  
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length > 0) {
    issues.push({ type: 'critical', title: 'CSV Parse Errors', details: 'The file has structural issues.', data: parsed.errors.map(e => `Row ${e.row}: ${e.message}`).join('\n') });
  }
  
  const headers = parsed.meta.fields || [];
  const rows = parsed.data || [];
  stats.rows = rows.length;
  
  const battingHeaders = ['PA', 'AB', 'H', '2B', '3B', 'HR', 'wOBA', 'wRC+', 'OPS'];
  const pitchingHeaders = ['IP', 'ERA', 'WHIP', 'FIP', 'K/9', 'BB/9', 'SIERA'];
  
  const hasBatting = battingHeaders.filter(h => headers.includes(h)).length >= 4;
  const hasPitching = pitchingHeaders.filter(h => headers.includes(h)).length >= 4;
  
  if (hasBatting && hasPitching) {
    issues.push({ type: 'critical', title: 'Mixed Data Type', details: 'File contains both batting AND pitching headers.' });
    stats.type = 'mixed';
  } else if (hasBatting) {
    stats.type = 'batting';
  } else if (hasPitching) {
    stats.type = 'pitching';
  } else {
    issues.push({ type: 'critical', title: 'Unrecognized Format', details: 'Could not identify as batting or pitching CSV.', data: `Headers: ${headers.join(', ')}` });
  }
  
  const requiredHeaders = ['Name', 'OVR', 'POS'];
  const missingRequired = requiredHeaders.filter(h => !headers.includes(h));
  if (missingRequired.length > 0) {
    issues.push({ type: 'critical', title: 'Missing Required Headers', details: `Missing: ${missingRequired.join(', ')}` });
  }
  
  const cleanRows = [];
  const removedRows = [];
  
  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const name = (row.Name || '').trim();
    const ovr = parseInt(row.OVR) || 0;
    
    if (!name) return;
    stats.players++;
    
    const rowIssues = [];
    
    // OVR validation
    if (ovr < 1 || ovr > 125) {
      rowIssues.push(`Invalid OVR: ${ovr}`);
    }
    
    if (stats.type === 'batting') {
      const pa = parseInt(row.PA) || 0, ab = parseInt(row.AB) || 0, h = parseInt(row.H) || 0;
      const hr = parseInt(row.HR) || 0, doubles = parseInt(row['2B']) || 0, triples = parseInt(row['3B']) || 0;
      const avg = parseFloat(row.AVG) || 0, obp = parseFloat(row.OBP) || 0, slg = parseFloat(row.SLG) || 0;
      const wrcPlus = parseInt(row['wRC+']) || 0, war = parseFloat(row.WAR) || 0;
      
      if (h > ab && ab > 0) rowIssues.push(`H > AB (${h} > ${ab})`);
      if (hr > h && h > 0) rowIssues.push(`HR > H (${hr} > ${h})`);
      if (doubles + triples + hr > h) rowIssues.push(`XBH > H`);
      if (ab > pa) rowIssues.push(`AB > PA (${ab} > ${pa})`);
      if (avg > 0.500 && pa > 100) rowIssues.push(`AVG too high: ${avg}`);
      if (obp > 0.600 && pa > 100) rowIssues.push(`OBP too high: ${obp}`);
      if (slg > 1.000 && pa > 100) rowIssues.push(`SLG too high: ${slg}`);
      if (wrcPlus > 250 && pa > 100) rowIssues.push(`wRC+ too high: ${wrcPlus}`);
      if (war > 15 || war < -5) rowIssues.push(`WAR unrealistic: ${war}`);
      if (obp < avg && pa > 50) rowIssues.push(`OBP < AVG (impossible)`);
    } else if (stats.type === 'pitching') {
      const ip = parseFloat(row.IP) || 0, era = parseFloat(row.ERA) || 0, whip = parseFloat(row.WHIP) || 0;
      const kPer9 = parseFloat(row['K/9']) || 0, bbPer9 = parseFloat(row['BB/9']) || 0;
      const war = parseFloat(row.WAR) || 0, g = parseInt(row.G) || 0, gs = parseInt(row.GS) || 0;
      
      if (era < 0) rowIssues.push(`Negative ERA: ${era}`);
      if (era > 20 && ip > 20) rowIssues.push(`ERA too high: ${era}`);
      if (whip < 0) rowIssues.push(`Negative WHIP: ${whip}`);
      if (whip > 3.0 && ip > 20) rowIssues.push(`WHIP too high: ${whip}`);
      if (kPer9 > 18) rowIssues.push(`K/9 impossible: ${kPer9}`);
      if (bbPer9 > 15 && ip > 20) rowIssues.push(`BB/9 too high: ${bbPer9}`);
      if (war > 12 || war < -4) rowIssues.push(`WAR unrealistic: ${war}`);
      if (gs > g) rowIssues.push(`GS > G (impossible)`);
    }
    
    if (rowIssues.length > 0) {
      removedRows.push({ row: rowNum, name, ovr, reasons: rowIssues, data: row });
    } else {
      cleanRows.push(row);
    }
  });
  
  // Check wrong file type
  if (stats.type === 'batting') {
    const pitcherPositions = rows.filter(r => ['SP', 'RP', 'CL', 'MR'].includes((r.POS || '').toUpperCase())).length;
    if (pitcherPositions / stats.players > 0.5) {
      issues.push({ type: 'critical', title: 'Wrong File Type?', details: `${Math.round(pitcherPositions / stats.players * 100)}% pitcher positions in batting file.` });
    }
  }
  
  const hasCritical = issues.some(i => i.type === 'critical');
  
  return { issues, stats, headers, cleanRows, removedRows, hasCritical, rawRows: rows };
}

function calculatePlayerMatch(csvRows, tournamentPlayers, fileType) {
  if (!csvRows || csvRows.length === 0) return 0;
  if (!tournamentPlayers || tournamentPlayers.length === 0) return 0;
  
  // Create set of tournament player names (lowercase for case-insensitive matching)
  const tournamentNames = new Set(tournamentPlayers.map(p => (p.name || '').toLowerCase().trim()));
  
  // Get unique player names from CSV (since same player may appear multiple times)
  const csvPlayerNames = new Set();
  csvRows.forEach(row => {
    const name = (row.Name || '').toLowerCase().trim();
    if (name) csvPlayerNames.add(name);
  });
  
  // Count how many unique CSV players exist in tournament
  let matches = 0;
  csvPlayerNames.forEach(name => {
    if (tournamentNames.has(name)) matches++;
  });
  
  return Math.round((matches / csvPlayerNames.size) * 100);
}

function SubmitDataPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [suggestNewEvent, setSuggestNewEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [pitchingFile, setPitchingFile] = useState(null);
  const [battingFile, setBattingFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Bulk upload state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPitchingFiles, setBulkPitchingFiles] = useState([]); // Array of { id, file, date }
  const [bulkBattingFiles, setBulkBattingFiles] = useState([]); // Array of { id, file, date }
  
  // Admin direct upload state
  const [adminConfirmData, setAdminConfirmData] = useState(null);
  
  // Info panel state
  const [infoContent, setInfoContent] = useState({ sections: [] });
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editInfoContent, setEditInfoContent] = useState({ sections: [] });

  useEffect(() => {
    loadTournaments();
    loadInfoContent();
  }, []);

  const loadTournaments = async () => {
    const { data } = await supabase.from('tournaments').select('id, name, category, uploaded_dates, event_type').order('name');
    setTournaments(data || []);
  };

  const loadInfoContent = async () => {
    try {
      const { data } = await supabase.from('site_content').select('*').eq('id', 'submit_info').single();
      if (data?.content) setInfoContent(data.content);
    } catch (e) {}
  };

  const saveInfoContent = async () => {
    try {
      await supabase.from('site_content').upsert({ id: 'submit_info', content: editInfoContent, updated_at: new Date().toISOString() });
      setInfoContent(editInfoContent);
      setIsEditingInfo(false);
      showNotif('Info saved!');
    } catch (e) {
      showNotif('Failed to save', 'error');
    }
  };

  const startEditingInfo = () => {
    requestAuth(() => {
      setEditInfoContent(JSON.parse(JSON.stringify(infoContent)));
      setIsEditingInfo(true);
    }, 'master');
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const getPacificDate = () => {
    const now = new Date();
    const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pacific;
  };

  const generate21DayCalendar = () => {
    const today = getPacificDate();
    const days = [];
    for (let i = 20; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      days.push({ dateStr: `${year}-${month}-${day}`, dayOfMonth: date.getDate(), dayOfWeek: date.getDay(), isToday: i === 0 });
    }
    return days;
  };

  // Get the selected tournament's data
  const getSelectedTournament = () => {
    if (!selectedTournamentId) return null;
    return tournaments.find(t => t.id === selectedTournamentId);
  };

  // Check if a date has data uploaded for the selected tournament
  const hasDataForDate = (dateStr) => {
    const tournament = getSelectedTournament();
    if (!tournament || !tournament.uploaded_dates || tournament.uploaded_dates.length === 0) return false;
    
    const eventType = tournament.event_type || 'daily';
    if (eventType === 'weekly') {
      const targetDate = new Date(dateStr + 'T12:00:00');
      const targetWeekStart = new Date(targetDate);
      targetWeekStart.setDate(targetDate.getDate() - targetDate.getDay());
      
      return tournament.uploaded_dates.some(ud => {
        const uploadDate = new Date(ud + 'T12:00:00');
        const uploadWeekStart = new Date(uploadDate);
        uploadWeekStart.setDate(uploadDate.getDate() - uploadDate.getDay());
        return uploadWeekStart.toDateString() === targetWeekStart.toDateString();
      });
    }
    return tournament.uploaded_dates.includes(dateStr);
  };

  // Detect file type from CSV content
  const detectFileType = async (file) => {
    const content = await file.text();
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields || [];
    
    const battingHeaders = ['PA', 'AB', 'H', '2B', '3B', 'HR', 'wOBA', 'wRC+', 'OPS'];
    const pitchingHeaders = ['IP', 'ERA', 'WHIP', 'FIP', 'K/9', 'BB/9', 'SIERA'];
    
    const hasBatting = battingHeaders.filter(h => headers.includes(h)).length >= 4;
    const hasPitching = pitchingHeaders.filter(h => headers.includes(h)).length >= 4;
    
    if (hasBatting && !hasPitching) return 'batting';
    if (hasPitching && !hasBatting) return 'pitching';
    return 'unknown';
  };

  const handlePitchingFileChange = async (e) => {
    const f = e.target.files[0];
    if (f && f.name.endsWith('.csv')) {
      // Detect actual file type
      const detectedType = await detectFileType(f);
      
      if (detectedType === 'batting') {
        // User put batting file in pitching slot - swap it
        setBattingFile(f);
        setPitchingFile(null);
        showNotif('📋 That looks like a Batting file - we moved it to the correct slot for you!', 'success');
      } else {
        setPitchingFile(f);
      }
      setSubmitResult(null);
    } else if (f) {
      showNotif('Please select a CSV file', 'error');
    }
  };

  const handleBattingFileChange = async (e) => {
    const f = e.target.files[0];
    if (f && f.name.endsWith('.csv')) {
      // Detect actual file type
      const detectedType = await detectFileType(f);
      
      if (detectedType === 'pitching') {
        // User put pitching file in batting slot - swap it
        setPitchingFile(f);
        setBattingFile(null);
        showNotif('📋 That looks like a Pitching file - we moved it to the correct slot for you!', 'success');
      } else {
        setBattingFile(f);
      }
      setSubmitResult(null);
    } else if (f) {
      showNotif('Please select a CSV file', 'error');
    }
  };

  // Bulk upload functions
  const handleBulkFileDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      showNotif('No CSV files found', 'error');
      return;
    }
    
    if (csvFiles.length > 20) {
      showNotif('Maximum 20 files at once (10 pitching + 10 batting)', 'error');
      return;
    }

    const pitching = [];
    const batting = [];

    for (const file of csvFiles) {
      const type = await detectFileType(file);
      const entry = { id: Date.now() + Math.random(), file, date: '' };
      
      if (type === 'pitching') {
        if (pitching.length < 10) pitching.push(entry);
      } else {
        if (batting.length < 10) batting.push(entry);
      }
    }

    setBulkPitchingFiles([...bulkPitchingFiles, ...pitching].slice(0, 10));
    setBulkBattingFiles([...bulkBattingFiles, ...batting].slice(0, 10));
    showNotif(`Sorted: ${pitching.length} pitching, ${batting.length} batting files`);
  };

  const updateBulkFileDate = (type, id, date) => {
    if (type === 'pitching') {
      setBulkPitchingFiles(bulkPitchingFiles.map(f => f.id === id ? { ...f, date } : f));
    } else {
      setBulkBattingFiles(bulkBattingFiles.map(f => f.id === id ? { ...f, date } : f));
    }
  };

  const removeBulkFile = (type, id) => {
    if (type === 'pitching') {
      setBulkPitchingFiles(bulkPitchingFiles.filter(f => f.id !== id));
    } else {
      setBulkBattingFiles(bulkBattingFiles.filter(f => f.id !== id));
    }
  };

  const clearBulkFiles = () => {
    setBulkPitchingFiles([]);
    setBulkBattingFiles([]);
  };

  const handleBulkSubmit = async () => {
    if (!selectedTournamentId) {
      showNotif('Please select a tournament', 'error');
      return;
    }
    
    const validPitching = bulkPitchingFiles.filter(f => f.date);
    const validBatting = bulkBattingFiles.filter(f => f.date);
    
    if (validPitching.length === 0 && validBatting.length === 0) {
      showNotif('Please assign dates to at least one file', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: selectedTournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', selectedTournamentId)
        .single();

      if (!selectedTournament) throw new Error('Tournament not found');

      let totalSubmitted = { pitching: 0, batting: 0 };

      // Process pitching files
      for (const item of validPitching) {
        const content = await item.file.text();
        const validation = validateCSV(content, item.file.name);
        const matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.pitching, 'pitching');
        const dateAlreadyUploaded = selectedTournament?.uploaded_dates?.includes(item.date);

        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId,
          suggested_tournament_name: selectedTournament.name,
          suggested_date: item.date,
          user_notes: `Bulk upload: ${item.file.name}`,
          file_type: 'pitching',
          file_name: item.file.name,
          raw_data: validation.rawRows,
          clean_data: validation.cleanRows,
          removed_rows: validation.removedRows,
          validation_issues: validation.issues,
          player_match_percent: matchPercent,
          date_already_uploaded: dateAlreadyUploaded,
          has_critical_issues: validation.hasCritical,
          status: 'pending'
        });
        if (error) throw error;
        totalSubmitted.pitching++;
      }

      // Process batting files
      for (const item of validBatting) {
        const content = await item.file.text();
        const validation = validateCSV(content, item.file.name);
        const matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.batting, 'batting');
        const dateAlreadyUploaded = selectedTournament?.uploaded_dates?.includes(item.date);

        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId,
          suggested_tournament_name: selectedTournament.name,
          suggested_date: item.date,
          user_notes: `Bulk upload: ${item.file.name}`,
          file_type: 'batting',
          file_name: item.file.name,
          raw_data: validation.rawRows,
          clean_data: validation.cleanRows,
          removed_rows: validation.removedRows,
          validation_issues: validation.issues,
          player_match_percent: matchPercent,
          date_already_uploaded: dateAlreadyUploaded,
          has_critical_issues: validation.hasCritical,
          status: 'pending'
        });
        if (error) throw error;
        totalSubmitted.batting++;
      }

      showNotif(`✓ Submitted ${totalSubmitted.pitching} pitching + ${totalSubmitted.batting} batting files for review`);
      clearBulkFiles();
      setBulkMode(false);
      
    } catch (e) {
      console.error('Bulk submit error:', e);
      showNotif('Failed to submit: ' + e.message, 'error');
    }
    setIsSubmitting(false);
  };

  // Admin bulk direct upload
  const handleAdminBulkUpload = async () => {
    if (!selectedTournamentId) {
      showNotif('Please select a tournament', 'error');
      return;
    }
    
    const validPitching = bulkPitchingFiles.filter(f => f.date);
    const validBatting = bulkBattingFiles.filter(f => f.date);
    
    if (validPitching.length === 0 && validBatting.length === 0) {
      showNotif('Please assign dates to at least one file', 'error');
      return;
    }

    setIsSubmitting(true);
    
    const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };
    const parseIP = (ip) => { const str = String(ip); if (str.includes('.')) { const [whole, frac] = str.split('.'); return parseFloat(whole) + (parseFloat(frac) / 3); } return parseFloat(ip) || 0; };
    const formatIP = (ipDecimal) => { const whole = Math.floor(ipDecimal); const frac = Math.round((ipDecimal - whole) * 3); return frac === 0 ? String(whole) : `${whole}.${frac}`; };
    
    try {
      let { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', selectedTournamentId)
        .single();

      if (!tournament) throw new Error('Tournament not found');

      let totalAdded = { pitching: 0, batting: 0 };
      let uploadedDates = [...(tournament.uploaded_dates || [])];
      let battingData = [...(tournament.batting || [])];
      let pitchingData = [...(tournament.pitching || [])];

      // Process pitching files
      for (const item of validPitching) {
        const content = await item.file.text();
        const validation = validateCSV(content, item.file.name);
        const newData = validation.cleanRows;
        
        const playerMap = new Map();
        pitchingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}|${p.vari || 'N'}`, p));
        
        newData.forEach(row => {
          const name = (row.Name || '').trim();
          const ovr = parseNum(row.OVR);
          const vari = parseVariant(row.VAR);
          const key = `${name}|${ovr}|${vari}`;
          
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', throws: row.T || '', ovr, vari,
            g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
            era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000',
            babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
            braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00',
            hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
            lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']),
            fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
            war: row.WAR || '0.0', siera: row.SIERA || '0.00'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            playerMap.set(key, {
              ...existing, _instanceCount: newCount,
              ...posTracking,
              g: existing.g + instance.g, gs: existing.gs + instance.gs,
              ip: formatIP(parseIP(existing.ip) + parseIP(instance.ip)),
              bf: existing.bf + instance.bf,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              ovr: instance.ovr, vari: instance.vari,
              throws: instance.throws || existing.throws,
              era: (((parseFloat(existing.era || 0) * oldCount) + parseFloat(instance.era || 0)) / newCount).toFixed(2),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              whip: (((parseFloat(existing.whip || 0) * oldCount) + parseFloat(instance.whip || 0)) / newCount).toFixed(2),
              braPer9: (((parseFloat(existing.braPer9 || 0) * oldCount) + parseFloat(instance.braPer9 || 0)) / newCount).toFixed(2),
              hrPer9: (((parseFloat(existing.hrPer9 || 0) * oldCount) + parseFloat(instance.hrPer9 || 0)) / newCount).toFixed(2),
              hPer9: (((parseFloat(existing.hPer9 || 0) * oldCount) + parseFloat(instance.hPer9 || 0)) / newCount).toFixed(2),
              bbPer9: (((parseFloat(existing.bbPer9 || 0) * oldCount) + parseFloat(instance.bbPer9 || 0)) / newCount).toFixed(2),
              kPer9: (((parseFloat(existing.kPer9 || 0) * oldCount) + parseFloat(instance.kPer9 || 0)) / newCount).toFixed(2),
              lobPct: (((parseFloat(existing.lobPct || 0) * oldCount) + parseFloat(instance.lobPct || 0)) / newCount).toFixed(1),
              eraPlus: Math.round(((parseFloat(existing.eraPlus || 0) * oldCount) + parseFloat(instance.eraPlus || 0)) / newCount),
              fip: (((parseFloat(existing.fip || 0) * oldCount) + parseFloat(instance.fip || 0)) / newCount).toFixed(2),
              fipMinus: Math.round(((parseFloat(existing.fipMinus || 0) * oldCount) + parseFloat(instance.fipMinus || 0)) / newCount),
              siera: (((parseFloat(existing.siera || 0) * oldCount) + parseFloat(instance.siera || 0)) / newCount).toFixed(2)
            });
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        });
        
        pitchingData = Array.from(playerMap.values());
        totalAdded.pitching += newData.length;
        
        await supabase.from('upload_history').insert({
          tournament_id: selectedTournamentId,
          tournament_name: tournament.name,
          file_type: 'pitching',
          upload_date: item.date,
          player_count: newData.length,
          player_data: newData,
          source: 'admin_bulk'
        });

        if (!uploadedDates.includes(item.date)) {
          uploadedDates.push(item.date);
        }
      }

      // Process batting files
      for (const item of validBatting) {
        const content = await item.file.text();
        const validation = validateCSV(content, item.file.name);
        const newData = validation.cleanRows;
        
        const playerMap = new Map();
        battingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}|${p.vari || 'N'}`, p));
        
        newData.forEach(row => {
          const name = (row.Name || '').trim();
          const ovr = parseNum(row.OVR);
          const vari = parseVariant(row.VAR);
          const key = `${name}|${ovr}|${vari}`;
          
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', bats: row.B || '', ovr, vari,
            def: parseNum(row.DEF),
            g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
            h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR),
            so: parseNum(row.SO), gidp: parseNum(row.GIDP),
            avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
            woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']),
            babip: row.BABIP || '.000', wrcPlus: parseNum(row['wRC+']),
            wraa: row.wRAA || '0.0', war: row.WAR || '0.0',
            bbPct: parsePct(row['BB%']), sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            playerMap.set(key, {
              ...existing, _instanceCount: newCount,
              ...posTracking,
              g: existing.g + instance.g, gs: existing.gs + instance.gs,
              pa: existing.pa + instance.pa, ab: existing.ab + instance.ab,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              wraa: (parseFloat(existing.wraa || 0) + parseFloat(instance.wraa || 0)).toFixed(1),
              bsr: (parseFloat(existing.bsr || 0) + parseFloat(instance.bsr || 0)).toFixed(1),
              ovr: instance.ovr, vari: instance.vari,
              def: instance.def || existing.def,
              bats: instance.bats || existing.bats,
              h: Math.round(((existing.h * oldCount) + instance.h) / newCount),
              doubles: Math.round(((existing.doubles * oldCount) + instance.doubles) / newCount),
              triples: Math.round(((existing.triples * oldCount) + instance.triples) / newCount),
              hr: Math.round(((existing.hr * oldCount) + instance.hr) / newCount),
              so: Math.round(((existing.so * oldCount) + instance.so) / newCount),
              gidp: Math.round(((existing.gidp * oldCount) + instance.gidp) / newCount),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              slg: (((parseFloat(existing.slg || 0) * oldCount) + parseFloat(instance.slg || 0)) / newCount).toFixed(3),
              ops: (((parseFloat(existing.ops || 0) * oldCount) + parseFloat(instance.ops || 0)) / newCount).toFixed(3),
              woba: (((parseFloat(existing.woba || 0) * oldCount) + parseFloat(instance.woba || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              opsPlus: Math.round(((parseFloat(existing.opsPlus || 0) * oldCount) + parseFloat(instance.opsPlus || 0)) / newCount),
              wrcPlus: Math.round(((parseFloat(existing.wrcPlus || 0) * oldCount) + parseFloat(instance.wrcPlus || 0)) / newCount),
              bbPct: (((parseFloat(existing.bbPct || 0) * oldCount) + parseFloat(instance.bbPct || 0)) / newCount).toFixed(1),
              sbPct: (((parseFloat(existing.sbPct || 0) * oldCount) + parseFloat(instance.sbPct || 0)) / newCount).toFixed(1)
            });
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        });
        
        battingData = Array.from(playerMap.values());
        totalAdded.batting += newData.length;
        
        await supabase.from('upload_history').insert({
          tournament_id: selectedTournamentId,
          tournament_name: tournament.name,
          file_type: 'batting',
          upload_date: item.date,
          player_count: newData.length,
          player_data: newData,
          source: 'admin_bulk'
        });

        if (!uploadedDates.includes(item.date)) {
          uploadedDates.push(item.date);
        }
      }

      // Save tournament
      const { error: updateError } = await supabase.from('tournaments').update({
        batting: battingData,
        pitching: pitchingData,
        uploaded_dates: uploadedDates
      }).eq('id', selectedTournamentId);

      if (updateError) throw updateError;

      showNotif(`✓ Bulk upload complete: ${totalAdded.pitching} pitchers, ${totalAdded.batting} batters`);
      clearBulkFiles();
      setBulkMode(false);
      
    } catch (e) {
      console.error('Admin bulk upload error:', e);
      showNotif('Failed: ' + e.message, 'error');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!pitchingFile && !battingFile) { showNotif('Please select at least one CSV file', 'error'); return; }
    if (!selectedDate) { showNotif('Please select a date', 'error'); return; }
    if (!selectedTournamentId && !suggestNewEvent) { showNotif('Please select a tournament or suggest a new event', 'error'); return; }
    if (suggestNewEvent && !newEventName.trim()) { showNotif('Please enter a name for the new event', 'error'); return; }

    setIsSubmitting(true);
    
    try {
      // Get tournament for player matching
      let selectedTournament = null;
      if (selectedTournamentId) {
        const { data: tournamentData } = await supabase.from('tournaments').select('*').eq('id', selectedTournamentId).single();
        if (tournamentData) selectedTournament = tournamentData;
      }

      // Check if date already has data
      let dateAlreadyUploaded = false;
      if (selectedTournament?.uploaded_dates?.includes(selectedDate)) {
        dateAlreadyUploaded = true;
      }

      // Process files and get validation data
      const fileData = { pitching: null, batting: null };
      
      if (pitchingFile) {
        const content = await pitchingFile.text();
        const validation = validateCSV(content, pitchingFile.name);
        let matchPercent = 0;
        if (selectedTournament) {
          matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.pitching, 'pitching');
        }
        fileData.pitching = { validation, matchPercent, fileName: pitchingFile.name };
      }

      if (battingFile) {
        const content = await battingFile.text();
        const validation = validateCSV(content, battingFile.name);
        let matchPercent = 0;
        if (selectedTournament) {
          matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.batting, 'batting');
        }
        fileData.batting = { validation, matchPercent, fileName: battingFile.name };
      }

      // If admin, show confirmation dialog instead of submitting to pending
      if (hasAccess('master')) {
        setAdminConfirmData({
          tournament: selectedTournament,
          tournamentId: selectedTournamentId,
          date: selectedDate,
          dateAlreadyUploaded,
          pitching: fileData.pitching,
          batting: fileData.batting
        });
        setIsSubmitting(false);
        return;
      }

      // Non-admin: submit to pending_uploads as before
      const results = { pitching: null, batting: null };

      if (fileData.pitching) {
        const { validation, matchPercent, fileName } = fileData.pitching;
        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId || null,
          suggested_tournament_name: suggestNewEvent ? newEventName.trim() : (selectedTournament?.name || ''),
          suggested_date: selectedDate,
          user_notes: userNotes.trim() || null,
          file_type: 'pitching',
          file_name: fileName,
          raw_data: validation.rawRows,
          clean_data: validation.cleanRows,
          removed_rows: validation.removedRows,
          validation_issues: validation.issues,
          player_match_percent: matchPercent,
          date_already_uploaded: dateAlreadyUploaded,
          has_critical_issues: validation.hasCritical,
          status: 'pending'
        });
        if (error) throw error;
        results.pitching = { playerCount: validation.cleanRows.length, removedCount: validation.removedRows.length, hasCritical: validation.hasCritical };
      }

      if (fileData.batting) {
        const { validation, matchPercent, fileName } = fileData.batting;
        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId || null,
          suggested_tournament_name: suggestNewEvent ? newEventName.trim() : (selectedTournament?.name || ''),
          suggested_date: selectedDate,
          user_notes: userNotes.trim() || null,
          file_type: 'batting',
          file_name: fileName,
          raw_data: validation.rawRows,
          clean_data: validation.cleanRows,
          removed_rows: validation.removedRows,
          validation_issues: validation.issues,
          player_match_percent: matchPercent,
          date_already_uploaded: dateAlreadyUploaded,
          has_critical_issues: validation.hasCritical,
          status: 'pending'
        });
        if (error) throw error;
        results.batting = { playerCount: validation.cleanRows.length, removedCount: validation.removedRows.length, hasCritical: validation.hasCritical };
      }

      setSubmitResult({
        success: true,
        pitching: results.pitching,
        batting: results.batting,
        hasCritical: (results.pitching?.hasCritical || results.batting?.hasCritical)
      });

      // Reset form
      setPitchingFile(null);
      setBattingFile(null);
      setSelectedDate('');
      setUserNotes('');
      setSelectedTournamentId('');
      setSuggestNewEvent(false);
      setNewEventName('');
      
    } catch (e) {
      console.error('Submit error:', e);
      showNotif('Failed to submit', 'error');
    }
    setIsSubmitting(false);
  };

  // Admin direct upload - process files directly
  const handleAdminDirectUpload = async () => {
    if (!adminConfirmData) return;
    
    setIsSubmitting(true);
    const { tournament, tournamentId, date, pitching, batting } = adminConfirmData;
    
    const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };
    const parseIP = (ip) => { const str = String(ip); if (str.includes('.')) { const [whole, frac] = str.split('.'); return parseFloat(whole) + (parseFloat(frac) / 3); } return parseFloat(ip) || 0; };
    const formatIP = (ipDecimal) => { const whole = Math.floor(ipDecimal); const frac = Math.round((ipDecimal - whole) * 3); return frac === 0 ? String(whole) : `${whole}.${frac}`; };
    
    try {
      let updatedTournament = { ...tournament };
      let totalAdded = { pitching: 0, batting: 0 };
      
      // Process pitching
      if (pitching) {
        const existingData = updatedTournament.pitching || [];
        const newData = pitching.validation.cleanRows;
        const playerMap = new Map();
        existingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}|${p.vari || 'N'}`, p));
        
        newData.forEach(row => {
          const name = (row.Name || '').trim();
          const ovr = parseNum(row.OVR);
          const vari = parseVariant(row.VAR);
          const key = `${name}|${ovr}|${vari}`;
          
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', throws: row.T || '', ovr, vari,
            g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
            era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000',
            babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
            braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00',
            hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
            lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']),
            fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
            war: row.WAR || '0.0', siera: row.SIERA || '0.00'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            playerMap.set(key, {
              ...existing,
              _instanceCount: newCount,
              ...posTracking,
              g: existing.g + instance.g,
              gs: existing.gs + instance.gs,
              ip: formatIP(parseIP(existing.ip) + parseIP(instance.ip)),
              bf: existing.bf + instance.bf,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              ovr: instance.ovr, vari: instance.vari,
              throws: instance.throws || existing.throws,
              era: (((parseFloat(existing.era || 0) * oldCount) + parseFloat(instance.era || 0)) / newCount).toFixed(2),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              whip: (((parseFloat(existing.whip || 0) * oldCount) + parseFloat(instance.whip || 0)) / newCount).toFixed(2),
              braPer9: (((parseFloat(existing.braPer9 || 0) * oldCount) + parseFloat(instance.braPer9 || 0)) / newCount).toFixed(2),
              hrPer9: (((parseFloat(existing.hrPer9 || 0) * oldCount) + parseFloat(instance.hrPer9 || 0)) / newCount).toFixed(2),
              hPer9: (((parseFloat(existing.hPer9 || 0) * oldCount) + parseFloat(instance.hPer9 || 0)) / newCount).toFixed(2),
              bbPer9: (((parseFloat(existing.bbPer9 || 0) * oldCount) + parseFloat(instance.bbPer9 || 0)) / newCount).toFixed(2),
              kPer9: (((parseFloat(existing.kPer9 || 0) * oldCount) + parseFloat(instance.kPer9 || 0)) / newCount).toFixed(2),
              lobPct: (((parseFloat(existing.lobPct || 0) * oldCount) + parseFloat(instance.lobPct || 0)) / newCount).toFixed(1),
              eraPlus: Math.round(((parseFloat(existing.eraPlus || 0) * oldCount) + parseFloat(instance.eraPlus || 0)) / newCount),
              fip: (((parseFloat(existing.fip || 0) * oldCount) + parseFloat(instance.fip || 0)) / newCount).toFixed(2),
              fipMinus: Math.round(((parseFloat(existing.fipMinus || 0) * oldCount) + parseFloat(instance.fipMinus || 0)) / newCount),
              siera: (((parseFloat(existing.siera || 0) * oldCount) + parseFloat(instance.siera || 0)) / newCount).toFixed(2)
            });
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        });
        
        updatedTournament.pitching = Array.from(playerMap.values());
        totalAdded.pitching = newData.length;
        
        // Save to upload_history
        await supabase.from('upload_history').insert({
          tournament_id: tournamentId,
          tournament_name: tournament.name,
          file_type: 'pitching',
          upload_date: date,
          player_count: newData.length,
          player_data: newData,
          source: 'admin_direct'
        });
      }
      
      // Process batting
      if (batting) {
        const existingData = updatedTournament.batting || [];
        const newData = batting.validation.cleanRows;
        const playerMap = new Map();
        existingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}|${p.vari || 'N'}`, p));
        
        newData.forEach(row => {
          const name = (row.Name || '').trim();
          const ovr = parseNum(row.OVR);
          const vari = parseVariant(row.VAR);
          const key = `${name}|${ovr}|${vari}`;
          
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', bats: row.B || '', ovr, vari,
            def: parseNum(row.DEF),
            g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
            h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR),
            so: parseNum(row.SO), gidp: parseNum(row.GIDP),
            avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
            woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']),
            babip: row.BABIP || '.000', wrcPlus: parseNum(row['wRC+']),
            wraa: row.wRAA || '0.0', war: row.WAR || '0.0',
            bbPct: parsePct(row['BB%']), sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            playerMap.set(key, {
              ...existing,
              _instanceCount: newCount,
              ...posTracking,
              g: existing.g + instance.g,
              gs: existing.gs + instance.gs,
              pa: existing.pa + instance.pa,
              ab: existing.ab + instance.ab,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              wraa: (parseFloat(existing.wraa || 0) + parseFloat(instance.wraa || 0)).toFixed(1),
              bsr: (parseFloat(existing.bsr || 0) + parseFloat(instance.bsr || 0)).toFixed(1),
              ovr: instance.ovr, vari: instance.vari,
              def: instance.def || existing.def,
              bats: instance.bats || existing.bats,
              h: Math.round(((existing.h * oldCount) + instance.h) / newCount),
              doubles: Math.round(((existing.doubles * oldCount) + instance.doubles) / newCount),
              triples: Math.round(((existing.triples * oldCount) + instance.triples) / newCount),
              hr: Math.round(((existing.hr * oldCount) + instance.hr) / newCount),
              so: Math.round(((existing.so * oldCount) + instance.so) / newCount),
              gidp: Math.round(((existing.gidp * oldCount) + instance.gidp) / newCount),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              slg: (((parseFloat(existing.slg || 0) * oldCount) + parseFloat(instance.slg || 0)) / newCount).toFixed(3),
              ops: (((parseFloat(existing.ops || 0) * oldCount) + parseFloat(instance.ops || 0)) / newCount).toFixed(3),
              woba: (((parseFloat(existing.woba || 0) * oldCount) + parseFloat(instance.woba || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              opsPlus: Math.round(((parseFloat(existing.opsPlus || 0) * oldCount) + parseFloat(instance.opsPlus || 0)) / newCount),
              wrcPlus: Math.round(((parseFloat(existing.wrcPlus || 0) * oldCount) + parseFloat(instance.wrcPlus || 0)) / newCount),
              bbPct: (((parseFloat(existing.bbPct || 0) * oldCount) + parseFloat(instance.bbPct || 0)) / newCount).toFixed(1),
              sbPct: (((parseFloat(existing.sbPct || 0) * oldCount) + parseFloat(instance.sbPct || 0)) / newCount).toFixed(1)
            });
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        });
        
        updatedTournament.batting = Array.from(playerMap.values());
        totalAdded.batting = newData.length;
        
        // Save to upload_history
        await supabase.from('upload_history').insert({
          tournament_id: tournamentId,
          tournament_name: tournament.name,
          file_type: 'batting',
          upload_date: date,
          player_count: newData.length,
          player_data: newData,
          source: 'admin_direct'
        });
      }
      
      // Update uploaded_dates
      const uploadedDates = [...(updatedTournament.uploaded_dates || [])];
      if (!uploadedDates.includes(date)) {
        uploadedDates.push(date);
      }
      
      // Save tournament
      const { error: updateError } = await supabase.from('tournaments').update({
        batting: updatedTournament.batting,
        pitching: updatedTournament.pitching,
        uploaded_dates: uploadedDates
      }).eq('id', tournamentId);
      
      if (updateError) throw updateError;
      
      showNotif(`✓ Direct upload: ${totalAdded.pitching ? totalAdded.pitching + ' pitchers' : ''}${totalAdded.pitching && totalAdded.batting ? ', ' : ''}${totalAdded.batting ? totalAdded.batting + ' batters' : ''}`);
      
      // Reset form
      setAdminConfirmData(null);
      setPitchingFile(null);
      setBattingFile(null);
      setSelectedDate('');
      setUserNotes('');
      setSelectedTournamentId('');
      setSuggestNewEvent(false);
      setNewEventName('');
      
    } catch (e) {
      console.error('Admin direct upload error:', e);
      showNotif('Failed to upload: ' + e.message, 'error');
    }
    setIsSubmitting(false);
  };

  const groupedTournaments = {
    tournaments: tournaments.filter(t => t.category === 'tournaments' || !t.category),
    drafts: tournaments.filter(t => t.category === 'drafts')
  };

  return (
    <Layout notification={notification}>
      <div style={styles.submitPageLayout}>
        {/* Left: Upload Form */}
        <div style={styles.submitFormPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{...styles.submitTitle, margin: 0}}>📤 Submit CSV Data</h2>
            <button 
              onClick={() => { setBulkMode(!bulkMode); clearBulkFiles(); }}
              style={{
                background: bulkMode ? theme.accent : 'transparent',
                color: bulkMode ? '#fff' : theme.textMuted,
                border: `1px solid ${bulkMode ? theme.accent : theme.border}`,
                borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer'
              }}
            >
              {bulkMode ? '✓ Bulk Mode' : '📦 Bulk Upload'}
            </button>
          </div>
          <p style={styles.submitSubtitle}>
            {bulkMode 
              ? 'Upload multiple files at once for the same tournament. Each row = one date.'
              : 'Submit one event at a time — include both Pitching and Batting CSVs for that event.'}
          </p>

          {submitResult ? (
            <div style={{...styles.submitResult, borderColor: submitResult.hasCritical ? theme.warning : theme.success}}>
              <div style={styles.submitResultIcon}>{submitResult.hasCritical ? '⚠️' : '✅'}</div>
              <div style={styles.submitResultTitle}>
                {submitResult.hasCritical ? 'Submitted with Issues' : 'Submitted Successfully!'}
              </div>
              <div style={styles.submitResultDetails}>
                {submitResult.pitching && (
                  <div>Pitching: {submitResult.pitching.playerCount} players{submitResult.pitching.removedCount > 0 && ` (${submitResult.pitching.removedCount} flagged)`}</div>
                )}
                {submitResult.batting && (
                  <div>Batting: {submitResult.batting.playerCount} players{submitResult.batting.removedCount > 0 && ` (${submitResult.batting.removedCount} flagged)`}</div>
                )}
              </div>
              <p style={styles.submitResultNote}>An admin will review and approve your submission shortly.</p>
              <button style={styles.submitAnotherBtn} onClick={() => setSubmitResult(null)}>Submit Another Event</button>
            </div>
          ) : bulkMode ? (
            /* Bulk Upload Form */
            <div style={styles.submitForm}>
              {/* Tournament Selection for Bulk */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Tournament / Draft *</label>
                <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} style={styles.formSelect}>
                  <option value="">Select tournament...</option>
                  {groupedTournaments.tournaments.length > 0 && (
                    <optgroup label="Tournaments">
                      {groupedTournaments.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  )}
                  {groupedTournaments.drafts.length > 0 && (
                    <optgroup label="Drafts">
                      {groupedTournaments.drafts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Drop Zone */}
              {bulkPitchingFiles.length === 0 && bulkBattingFiles.length === 0 ? (
                <div 
                  onDrop={handleBulkFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: `2px dashed ${theme.border}`,
                    borderRadius: 12,
                    padding: 40,
                    textAlign: 'center',
                    background: theme.bgSecondary,
                    cursor: 'pointer',
                    marginBottom: 16
                  }}
                  onClick={() => document.getElementById('bulk-file-input').click()}
                >
                  <input 
                    id="bulk-file-input"
                    type="file" 
                    accept=".csv" 
                    multiple 
                    style={{ display: 'none' }}
                    onChange={handleBulkFileDrop}
                  />
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ color: theme.textPrimary, fontWeight: 600, marginBottom: 4 }}>
                    Drop all CSV files here
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: 12 }}>
                    Up to 10 pitching + 10 batting files. They'll be auto-sorted.
                  </div>
                </div>
              ) : (
                <>
                  {/* File Lists with Date Assignment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {/* Pitching Files */}
                    <div>
                      <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 8, padding: '8px 12px', background: theme.accent, borderRadius: '8px 8px 0 0'
                      }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>⚾ Pitching ({bulkPitchingFiles.length})</span>
                      </div>
                      <div style={{ 
                        background: theme.bgSecondary, borderRadius: '0 0 8px 8px', 
                        border: `1px solid ${theme.border}`, borderTop: 'none',
                        maxHeight: 300, overflowY: 'auto'
                      }}>
                        {bulkPitchingFiles.length === 0 ? (
                          <div style={{ padding: 16, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
                            No pitching files
                          </div>
                        ) : bulkPitchingFiles.map((item, idx) => (
                          <div key={item.id} style={{ 
                            padding: 8, borderBottom: idx < bulkPitchingFiles.length - 1 ? `1px solid ${theme.border}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 8
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: 11, color: theme.textPrimary, 
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {item.file.name}
                              </div>
                              <input 
                                type="date"
                                value={item.date}
                                onChange={(e) => updateBulkFileDate('pitching', item.id, e.target.value)}
                                style={{
                                  width: '100%', padding: 4, marginTop: 4,
                                  borderRadius: 4, border: `1px solid ${item.date ? theme.success : theme.border}`,
                                  background: theme.cardBg, color: theme.textPrimary, fontSize: 11
                                }}
                              />
                            </div>
                            <button 
                              onClick={() => removeBulkFile('pitching', item.id)}
                              style={{ background: 'transparent', border: 'none', color: theme.danger, cursor: 'pointer', padding: 4 }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Batting Files */}
                    <div>
                      <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 8, padding: '8px 12px', background: theme.success, borderRadius: '8px 8px 0 0'
                      }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>🏏 Batting ({bulkBattingFiles.length})</span>
                      </div>
                      <div style={{ 
                        background: theme.bgSecondary, borderRadius: '0 0 8px 8px', 
                        border: `1px solid ${theme.border}`, borderTop: 'none',
                        maxHeight: 300, overflowY: 'auto'
                      }}>
                        {bulkBattingFiles.length === 0 ? (
                          <div style={{ padding: 16, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
                            No batting files
                          </div>
                        ) : bulkBattingFiles.map((item, idx) => (
                          <div key={item.id} style={{ 
                            padding: 8, borderBottom: idx < bulkBattingFiles.length - 1 ? `1px solid ${theme.border}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 8
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: 11, color: theme.textPrimary, 
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {item.file.name}
                              </div>
                              <input 
                                type="date"
                                value={item.date}
                                onChange={(e) => updateBulkFileDate('batting', item.id, e.target.value)}
                                style={{
                                  width: '100%', padding: 4, marginTop: 4,
                                  borderRadius: 4, border: `1px solid ${item.date ? theme.success : theme.border}`,
                                  background: theme.cardBg, color: theme.textPrimary, fontSize: 11
                                }}
                              />
                            </div>
                            <button 
                              onClick={() => removeBulkFile('batting', item.id)}
                              style={{ background: 'transparent', border: 'none', color: theme.danger, cursor: 'pointer', padding: 4 }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Add more files + Clear */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <label style={{
                      flex: 1, padding: 8, textAlign: 'center', borderRadius: 6,
                      border: `1px dashed ${theme.border}`, cursor: 'pointer',
                      color: theme.textMuted, fontSize: 12
                    }}>
                      <input 
                        type="file" 
                        accept=".csv" 
                        multiple 
                        style={{ display: 'none' }}
                        onChange={handleBulkFileDrop}
                      />
                      + Add more files
                    </label>
                    <button 
                      onClick={clearBulkFiles}
                      style={{
                        padding: '8px 16px', borderRadius: 6, border: `1px solid ${theme.border}`,
                        background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: 12
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                </>
              )}

              {/* Submit Buttons */}
              {(bulkPitchingFiles.length > 0 || bulkBattingFiles.length > 0) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {hasAccess('master') ? (
                    <button 
                      onClick={handleAdminBulkUpload}
                      disabled={isSubmitting || (bulkPitchingFiles.filter(f => f.date).length === 0 && bulkBattingFiles.filter(f => f.date).length === 0)}
                      style={{
                        ...styles.submitBtn,
                        flex: 1,
                        background: theme.accent,
                        opacity: isSubmitting || (bulkPitchingFiles.filter(f => f.date).length === 0 && bulkBattingFiles.filter(f => f.date).length === 0) ? 0.5 : 1
                      }}
                    >
                      {isSubmitting ? 'Uploading...' : `⚡ Direct Upload (${bulkPitchingFiles.filter(f => f.date).length + bulkBattingFiles.filter(f => f.date).length} files)`}
                    </button>
                  ) : (
                    <button 
                      onClick={handleBulkSubmit}
                      disabled={isSubmitting || (bulkPitchingFiles.filter(f => f.date).length === 0 && bulkBattingFiles.filter(f => f.date).length === 0)}
                      style={{
                        ...styles.submitBtn,
                        flex: 1,
                        opacity: isSubmitting || (bulkPitchingFiles.filter(f => f.date).length === 0 && bulkBattingFiles.filter(f => f.date).length === 0) ? 0.5 : 1
                      }}
                    >
                      {isSubmitting ? 'Processing...' : `📤 Submit ${bulkPitchingFiles.filter(f => f.date).length + bulkBattingFiles.filter(f => f.date).length} for Review`}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.submitForm}>
              {/* Pitching File Upload */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Pitching CSV</label>
                <label style={styles.fileDropzone}>
                  <input type="file" accept=".csv" onChange={handlePitchingFileChange} style={{display:'none'}} />
                  {pitchingFile ? (
                    <div style={styles.fileSelected}>
                      <span style={styles.fileTypeTag}>PITCHING</span>
                      📄 {pitchingFile.name} <span style={styles.fileSize}>({(pitchingFile.size/1024).toFixed(1)} KB)</span>
                      <button style={styles.fileClearBtn} onClick={(e) => { e.preventDefault(); setPitchingFile(null); }}>✕</button>
                    </div>
                  ) : (
                    <div style={styles.filePrompt}><span style={styles.fileIcon}>⚾</span>Click to upload Pitching CSV</div>
                  )}
                </label>
              </div>

              {/* Batting File Upload */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Batting CSV</label>
                <label style={styles.fileDropzone}>
                  <input type="file" accept=".csv" onChange={handleBattingFileChange} style={{display:'none'}} />
                  {battingFile ? (
                    <div style={styles.fileSelected}>
                      <span style={{...styles.fileTypeTag, background: theme.success}}>BATTING</span>
                      📄 {battingFile.name} <span style={styles.fileSize}>({(battingFile.size/1024).toFixed(1)} KB)</span>
                      <button style={styles.fileClearBtn} onClick={(e) => { e.preventDefault(); setBattingFile(null); }}>✕</button>
                    </div>
                  ) : (
                    <div style={styles.filePrompt}><span style={styles.fileIcon}>🏏</span>Click to upload Batting CSV</div>
                  )}
                </label>
              </div>

              {/* Tournament Selection */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Tournament / Draft *</label>
                <div style={styles.tournamentOptions}>
                  <label style={styles.radioOption}>
                    <input type="radio" checked={!suggestNewEvent} onChange={() => setSuggestNewEvent(false)} />
                    <span>Select Existing</span>
                  </label>
                  <label style={styles.radioOption}>
                    <input type="radio" checked={suggestNewEvent} onChange={() => setSuggestNewEvent(true)} />
                    <span>Suggest New Event</span>
                  </label>
                </div>
                
                {!suggestNewEvent ? (
                  <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} style={styles.formSelect}>
                    <option value="">-- Select Tournament --</option>
                    {groupedTournaments.tournaments.length > 0 && (
                      <optgroup label="Tournaments">
                        {groupedTournaments.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </optgroup>
                    )}
                    {groupedTournaments.drafts.length > 0 && (
                      <optgroup label="Drafts">
                        {groupedTournaments.drafts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <div>
                    <input 
                      type="text" 
                      value={newEventName} 
                      onChange={(e) => setNewEventName(e.target.value)} 
                      placeholder="e.g., Tournament Daily Spring League 2025"
                      style={styles.formInput}
                    />
                    <p style={styles.formHint}>Include: Tournament/Draft, Daily/Weekly, and event name</p>
                  </div>
                )}
              </div>

              {/* Date Selection */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Data Date *</label>
                <p style={styles.formHint}>What date is this CSV data for? {selectedTournamentId && <span style={{color: theme.success}}>✓ = already has data</span>}</p>
                <div style={styles.dateGrid}>
                  {generate21DayCalendar().map((day, idx) => {
                    const isUploaded = hasDataForDate(day.dateStr);
                    return (
                      <button
                        key={idx}
                        type="button"
                        style={{
                          ...styles.dateBtn,
                          ...(selectedDate === day.dateStr ? styles.dateBtnSelected : {}),
                          ...(day.isToday ? styles.dateBtnToday : {}),
                          ...(isUploaded && selectedDate !== day.dateStr ? styles.dateBtnUploaded : {})
                        }}
                        onClick={() => setSelectedDate(day.dateStr)}
                      >
                        <span style={styles.dateBtnDay}>{day.dayOfMonth}</span>
                        <span style={styles.dateBtnLabel}>
                          {isUploaded ? '✓' : ['S','M','T','W','T','F','S'][day.dayOfWeek]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Notes (optional)</label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Any context for the admin (e.g., 'Week 3 Monday game')"
                  style={styles.formTextarea}
                  rows={2}
                />
              </div>

              {/* Submit Button */}
              <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || (!pitchingFile && !battingFile)}
                style={{...styles.submitBtn, ...(isSubmitting || (!pitchingFile && !battingFile) ? styles.submitBtnDisabled : {})}}
              >
                {isSubmitting ? 'Processing...' : '📤 Submit for Review'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div style={styles.submitInfoPanel}>
          <div style={styles.infoPanelHeader}>
            <h3 style={styles.infoPanelTitle}>📋 Submission Guidelines</h3>
            {!isEditingInfo && hasAccess('master') && (
              <button onClick={startEditingInfo} style={styles.infoPanelEditBtn}>✎ Edit</button>
            )}
          </div>
          
          {isEditingInfo ? (
            <div style={styles.infoPanelEdit}>
              {editInfoContent.sections.map((section, i) => (
                <div key={i} style={styles.infoPanelEditSection}>
                  <div style={styles.infoPanelEditHeader}>
                    <input 
                      type="text" 
                      value={section.heading} 
                      onChange={(e) => {
                        const newSections = [...editInfoContent.sections];
                        newSections[i] = { ...newSections[i], heading: e.target.value };
                        setEditInfoContent({ ...editInfoContent, sections: newSections });
                      }}
                      style={styles.infoPanelEditInput}
                      placeholder="Section heading..."
                    />
                    <button 
                      onClick={() => setEditInfoContent({ ...editInfoContent, sections: editInfoContent.sections.filter((_, idx) => idx !== i) })}
                      style={styles.infoPanelRemoveBtn}
                    >✕</button>
                  </div>
                  <textarea
                    value={section.body}
                    onChange={(e) => {
                      const newSections = [...editInfoContent.sections];
                      newSections[i] = { ...newSections[i], body: e.target.value };
                      setEditInfoContent({ ...editInfoContent, sections: newSections });
                    }}
                    style={styles.infoPanelEditTextarea}
                    rows={4}
                    placeholder="Content (supports **bold**, *italic*, [links](url))..."
                  />
                </div>
              ))}
              <button 
                onClick={() => setEditInfoContent({ ...editInfoContent, sections: [...editInfoContent.sections, { heading: '', body: '' }] })}
                style={styles.infoPanelAddBtn}
              >+ Add Section</button>
              <div style={styles.infoPanelEditActions}>
                <button onClick={saveInfoContent} style={styles.saveBtn}>Save</button>
                <button onClick={() => setIsEditingInfo(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={styles.infoPanelContent}>
              {infoContent.sections.length === 0 ? (
                <p style={styles.infoPanelEmpty}>No guidelines added yet. {hasAccess('master') && 'Click Edit to add content.'}</p>
              ) : (
                infoContent.sections.map((section, i) => (
                  <div key={i} style={styles.infoPanelSection}>
                    {section.heading && <h4 style={styles.infoPanelHeading}>{section.heading}</h4>}
                    <div style={styles.infoPanelBody} dangerouslySetInnerHTML={{ __html: parseMarkdown(section.body) }} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Direct Upload Confirmation Modal */}
      {adminConfirmData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: theme.cardBg, borderRadius: 12, padding: 24, maxWidth: 500, width: '95%',
            border: `1px solid ${theme.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: theme.textPrimary, margin: '0 0 16px 0' }}>⚡ Admin Direct Upload</h3>
            
            <div style={{ background: theme.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4 }}>Tournament</div>
              <div style={{ color: theme.textPrimary, fontWeight: 600 }}>{adminConfirmData.tournament?.name}</div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8, marginBottom: 4 }}>Date</div>
              <div style={{ color: theme.textPrimary }}>{adminConfirmData.date}</div>
              {adminConfirmData.dateAlreadyUploaded && (
                <div style={{ color: theme.warning, fontSize: 12, marginTop: 8 }}>⚠️ Data already exists for this date</div>
              )}
            </div>
            
            {adminConfirmData.pitching && (
              <div style={{ background: theme.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme.textPrimary, fontWeight: 600 }}>⚾ Pitching</span>
                  <span style={{ 
                    color: adminConfirmData.pitching.matchPercent >= 70 ? theme.success : 
                           adminConfirmData.pitching.matchPercent >= 40 ? theme.warning : theme.danger,
                    fontWeight: 600
                  }}>
                    {adminConfirmData.pitching.matchPercent}% match
                  </span>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                  {adminConfirmData.pitching.validation.cleanRows.length} players
                  {adminConfirmData.pitching.validation.removedRows.length > 0 && 
                    ` (${adminConfirmData.pitching.validation.removedRows.length} flagged)`}
                </div>
              </div>
            )}
            
            {adminConfirmData.batting && (
              <div style={{ background: theme.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme.textPrimary, fontWeight: 600 }}>🏏 Batting</span>
                  <span style={{ 
                    color: adminConfirmData.batting.matchPercent >= 70 ? theme.success : 
                           adminConfirmData.batting.matchPercent >= 40 ? theme.warning : theme.danger,
                    fontWeight: 600
                  }}>
                    {adminConfirmData.batting.matchPercent}% match
                  </span>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                  {adminConfirmData.batting.validation.cleanRows.length} players
                  {adminConfirmData.batting.validation.removedRows.length > 0 && 
                    ` (${adminConfirmData.batting.validation.removedRows.length} flagged)`}
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setAdminConfirmData(null)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: `1px solid ${theme.border}`,
                  background: 'transparent', color: theme.textPrimary, cursor: 'pointer', fontSize: 14
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAdminDirectUpload}
                disabled={isSubmitting}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none',
                  background: theme.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                {isSubmitting ? 'Uploading...' : '✓ Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ReviewQueuePage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { hasAccess, requestAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingUploads, setPendingUploads] = useState([]);
  const [criticalUploads, setCriticalUploads] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [selectedUploads, setSelectedUploads] = useState(new Set()); // Batch selection
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  
  // New event creation state
  const [creatingNewFor, setCreatingNewFor] = useState(null);
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState('daily');
  const [newEventCategory, setNewEventCategory] = useState('tournaments');
  const [newEventRotating, setNewEventRotating] = useState(false);

  useEffect(() => {
    if (hasAccess('master')) {
      loadData();
    }
  }, [hasAccess]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load pending uploads
      const { data: pending } = await supabase
        .from('pending_uploads')
        .select('*')
        .eq('status', 'pending')
        .eq('has_critical_issues', false)
        .order('created_at', { ascending: false });
      setPendingUploads(pending || []);

      // Load critical uploads
      const { data: critical } = await supabase
        .from('pending_uploads')
        .select('*')
        .eq('status', 'pending')
        .eq('has_critical_issues', true)
        .order('created_at', { ascending: false });
      setCriticalUploads(critical || []);

      // Load upload history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: history } = await supabase
        .from('upload_history')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      setUploadHistory(history || []);

      // Load tournaments for dropdown
      const { data: tourns } = await supabase.from('tournaments').select('*').order('name');
      setTournaments(tourns || []);
    } catch (e) {
      console.error('Load error:', e);
    }
    setIsLoading(false);
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const getMatchColor = (percent) => {
    if (percent >= 80) return theme.success;
    if (percent >= 40) return theme.warning;
    return theme.error;
  };

  const getMatchLabel = (percent) => {
    if (percent >= 80) return 'Good';
    if (percent >= 40) return 'Check';
    return 'Low';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleApprove = async (upload, assignedTournamentId, assignedDate) => {
    if (!assignedTournamentId) {
      showNotif('Please select a tournament', 'error');
      return;
    }
    if (!assignedDate) {
      showNotif('Please select a date', 'error');
      return;
    }

    try {
      // Get the tournament
      const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', assignedTournamentId).single();
      if (!tournament) throw new Error('Tournament not found');

      // Add the clean data to the tournament
      const existingData = upload.file_type === 'batting' ? (tournament.batting || []) : (tournament.pitching || []);
      const newData = upload.clean_data || [];
      
      // Helper functions for parsing
      const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
      const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };
      const parseIP = (ip) => { const str = String(ip); if (str.includes('.')) { const [whole, frac] = str.split('.'); return parseFloat(whole) + (parseFloat(frac) / 3); } return parseFloat(ip) || 0; };
      const formatIP = (ipDecimal) => { const whole = Math.floor(ipDecimal); const frac = Math.round((ipDecimal - whole) * 3); return frac === 0 ? String(whole) : `${whole}.${frac}`; };
      
      // Build player map from existing data
      const playerMap = new Map();
      existingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}|${p.vari || 'N'}`, p));
      
      // Process each row as an individual instance
      newData.forEach(row => {
        const name = (row.Name || '').trim();
        const ovr = parseNum(row.OVR);
        const vari = parseVariant(row.VAR);
        const key = `${name}|${ovr}|${vari}`;
        
        if (upload.file_type === 'batting') {
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', bats: row.B || '', ovr, vari,
            def: parseNum(row.DEF),
            g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
            h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR),
            so: parseNum(row.SO), gidp: parseNum(row.GIDP),
            avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
            woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']),
            babip: row.BABIP || '.000', wrcPlus: parseNum(row['wRC+']),
            wraa: row.wRAA || '0.0', war: row.WAR || '0.0',
            bbPct: parsePct(row['BB%']), sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            const merged = {
              ...existing,
              _instanceCount: newCount,
              ...posTracking,
              // Cumulative stats - add
              g: existing.g + instance.g,
              gs: existing.gs + instance.gs,
              pa: existing.pa + instance.pa,
              ab: existing.ab + instance.ab,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              wraa: (parseFloat(existing.wraa || 0) + parseFloat(instance.wraa || 0)).toFixed(1),
              bsr: (parseFloat(existing.bsr || 0) + parseFloat(instance.bsr || 0)).toFixed(1),
              // Keep latest OVR, VAR, DEF (update if new value exists)
              ovr: instance.ovr, vari: instance.vari,
              def: instance.def || existing.def,
              bats: instance.bats || existing.bats,
              // Average stats - running average
              h: Math.round(((existing.h * oldCount) + instance.h) / newCount),
              doubles: Math.round(((existing.doubles * oldCount) + instance.doubles) / newCount),
              triples: Math.round(((existing.triples * oldCount) + instance.triples) / newCount),
              hr: Math.round(((existing.hr * oldCount) + instance.hr) / newCount),
              so: Math.round(((existing.so * oldCount) + instance.so) / newCount),
              gidp: Math.round(((existing.gidp * oldCount) + instance.gidp) / newCount),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              slg: (((parseFloat(existing.slg || 0) * oldCount) + parseFloat(instance.slg || 0)) / newCount).toFixed(3),
              ops: (((parseFloat(existing.ops || 0) * oldCount) + parseFloat(instance.ops || 0)) / newCount).toFixed(3),
              woba: (((parseFloat(existing.woba || 0) * oldCount) + parseFloat(instance.woba || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              opsPlus: Math.round(((parseFloat(existing.opsPlus || 0) * oldCount) + parseFloat(instance.opsPlus || 0)) / newCount),
              wrcPlus: Math.round(((parseFloat(existing.wrcPlus || 0) * oldCount) + parseFloat(instance.wrcPlus || 0)) / newCount),
              bbPct: (((parseFloat(existing.bbPct || 0) * oldCount) + parseFloat(instance.bbPct || 0)) / newCount).toFixed(1),
              sbPct: (((parseFloat(existing.sbPct || 0) * oldCount) + parseFloat(instance.sbPct || 0)) / newCount).toFixed(1)
            };
            playerMap.set(key, merged);
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        } else {
          // Pitching
          const instance = {
            id: crypto.randomUUID(),
            name, pos: row.POS?.trim() || '', throws: row.T || '', ovr, vari,
            g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
            era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000',
            babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
            braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00',
            hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
            lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']),
            fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
            war: row.WAR || '0.0', siera: row.SIERA || '0.00'
          };
          
          if (playerMap.has(key)) {
            const existing = playerMap.get(key);
            const oldCount = existing._instanceCount || 1;
            const newCount = oldCount + 1;
            const posTracking = updatePositionTracking(existing, instance.pos);
            
            const merged = {
              ...existing,
              _instanceCount: newCount,
              ...posTracking,
              // Cumulative stats - add
              g: existing.g + instance.g,
              gs: existing.gs + instance.gs,
              ip: formatIP(parseIP(existing.ip) + parseIP(instance.ip)),
              bf: existing.bf + instance.bf,
              war: (parseFloat(existing.war || 0) + parseFloat(instance.war || 0)).toFixed(1),
              // Keep latest OVR, VAR
              ovr: instance.ovr, vari: instance.vari,
              throws: instance.throws || existing.throws,
              // Average stats - running average
              era: (((parseFloat(existing.era || 0) * oldCount) + parseFloat(instance.era || 0)) / newCount).toFixed(2),
              avg: (((parseFloat(existing.avg || 0) * oldCount) + parseFloat(instance.avg || 0)) / newCount).toFixed(3),
              obp: (((parseFloat(existing.obp || 0) * oldCount) + parseFloat(instance.obp || 0)) / newCount).toFixed(3),
              babip: (((parseFloat(existing.babip || 0) * oldCount) + parseFloat(instance.babip || 0)) / newCount).toFixed(3),
              whip: (((parseFloat(existing.whip || 0) * oldCount) + parseFloat(instance.whip || 0)) / newCount).toFixed(2),
              braPer9: (((parseFloat(existing.braPer9 || 0) * oldCount) + parseFloat(instance.braPer9 || 0)) / newCount).toFixed(2),
              hrPer9: (((parseFloat(existing.hrPer9 || 0) * oldCount) + parseFloat(instance.hrPer9 || 0)) / newCount).toFixed(2),
              hPer9: (((parseFloat(existing.hPer9 || 0) * oldCount) + parseFloat(instance.hPer9 || 0)) / newCount).toFixed(2),
              bbPer9: (((parseFloat(existing.bbPer9 || 0) * oldCount) + parseFloat(instance.bbPer9 || 0)) / newCount).toFixed(2),
              kPer9: (((parseFloat(existing.kPer9 || 0) * oldCount) + parseFloat(instance.kPer9 || 0)) / newCount).toFixed(2),
              lobPct: (((parseFloat(existing.lobPct || 0) * oldCount) + parseFloat(instance.lobPct || 0)) / newCount).toFixed(1),
              eraPlus: Math.round(((parseFloat(existing.eraPlus || 0) * oldCount) + parseFloat(instance.eraPlus || 0)) / newCount),
              fip: (((parseFloat(existing.fip || 0) * oldCount) + parseFloat(instance.fip || 0)) / newCount).toFixed(2),
              fipMinus: Math.round(((parseFloat(existing.fipMinus || 0) * oldCount) + parseFloat(instance.fipMinus || 0)) / newCount),
              siera: (((parseFloat(existing.siera || 0) * oldCount) + parseFloat(instance.siera || 0)) / newCount).toFixed(2)
            };
            playerMap.set(key, merged);
          } else {
            const posTracking = initPositionTracking(instance.pos);
            playerMap.set(key, { ...instance, _instanceCount: 1, ...posTracking });
          }
        }
      });

      const updatedData = Array.from(playerMap.values());
      
      // Update uploaded_dates
      const uploadedDates = [...(tournament.uploaded_dates || [])];
      if (!uploadedDates.includes(assignedDate)) {
        uploadedDates.push(assignedDate);
      }

      // Save tournament
      const updatePayload = upload.file_type === 'batting' 
        ? { batting: updatedData, uploaded_dates: uploadedDates }
        : { pitching: updatedData, uploaded_dates: uploadedDates };
      
      const { error: updateError } = await supabase.from('tournaments').update(updatePayload).eq('id', assignedTournamentId);
      if (updateError) throw updateError;

      // Save to upload history
      await supabase.from('upload_history').insert({
        tournament_id: assignedTournamentId,
        tournament_name: tournament.name,
        file_type: upload.file_type,
        upload_date: assignedDate,
        player_count: newData.length,
        player_data: newData,
        source: 'user_submission'
      });

      // Mark upload as approved
      await supabase.from('pending_uploads').update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        assigned_tournament_id: assignedTournamentId,
        assigned_date: assignedDate
      }).eq('id', upload.id);

      showNotif(`✓ Approved! Added ${newData.length} ${upload.file_type} to ${tournament.name}`);
      loadData();
    } catch (e) {
      console.error('Approve error:', e);
      showNotif('Failed to approve', 'error');
    }
  };

  // Group uploads by tournament suggestion + date for batch selection
  const getUploadGroups = () => {
    const groups = new Map();
    pendingUploads.forEach(upload => {
      const key = `${upload.suggested_tournament_name || 'Unknown'}|${upload.suggested_date || 'Unknown'}`;
      if (!groups.has(key)) {
        groups.set(key, { 
          key, 
          tournamentName: upload.suggested_tournament_name || 'Unknown', 
          date: upload.suggested_date || 'Unknown',
          uploads: [] 
        });
      }
      groups.get(key).uploads.push(upload);
    });
    return Array.from(groups.values());
  };

  const toggleUploadSelection = (uploadId) => {
    setSelectedUploads(prev => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else if (next.size < 10) {
        next.add(uploadId);
      } else {
        showNotif('Maximum 10 uploads can be selected at once', 'error');
      }
      return next;
    });
  };

  const toggleGroupSelection = (group) => {
    const groupIds = group.uploads.map(u => u.id);
    const allSelected = groupIds.every(id => selectedUploads.has(id));
    
    setSelectedUploads(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in group
        groupIds.forEach(id => next.delete(id));
      } else {
        // Select all in group (up to limit)
        groupIds.forEach(id => {
          if (next.size < 10) next.add(id);
        });
        if (next.size >= 10 && !groupIds.every(id => next.has(id))) {
          showNotif('Maximum 10 uploads reached', 'error');
        }
      }
      return next;
    });
  };

  const handleBatchApprove = async () => {
    if (selectedUploads.size === 0) {
      showNotif('No uploads selected', 'error');
      return;
    }

    // Get selected uploads
    const uploadsToApprove = pendingUploads.filter(u => selectedUploads.has(u.id));
    
    // Check that all have matching tournaments
    const missingTournament = uploadsToApprove.find(u => {
      const selectEl = document.getElementById(`tournament-${u.id}`);
      return !selectEl?.value;
    });
    if (missingTournament) {
      showNotif('Please select tournaments for all selected uploads', 'error');
      return;
    }

    if (!confirm(`Approve ${uploadsToApprove.length} uploads?`)) return;

    setIsBatchApproving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const upload of uploadsToApprove) {
      try {
        const selectEl = document.getElementById(`tournament-${upload.id}`);
        const tournamentId = selectEl?.value;
        if (!tournamentId) continue;
        
        await handleApprove(upload, tournamentId, upload.suggested_date);
        successCount++;
      } catch (e) {
        console.error('Batch approve error:', e);
        errorCount++;
      }
    }

    setIsBatchApproving(false);
    setSelectedUploads(new Set());
    
    if (errorCount > 0) {
      showNotif(`Approved ${successCount}, failed ${errorCount}`, 'error');
    } else {
      showNotif(`✓ Batch approved ${successCount} uploads!`);
    }
  };

  const handleReject = async (uploadId) => {
    if (!confirm('Reject this submission?')) return;
    try {
      await supabase.from('pending_uploads').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', uploadId);
      showNotif('Submission rejected');
      loadData();
    } catch (e) {
      showNotif('Failed to reject', 'error');
    }
  };

  const handleUndo = async (historyItem) => {
    if (!confirm(`Undo this upload? This will remove ${historyItem.player_count} ${historyItem.file_type} from ${historyItem.tournament_name}.`)) return;
    
    try {
      // Get tournament
      const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', historyItem.tournament_id).single();
      if (!tournament) throw new Error('Tournament not found');

      // Remove the players that were added
      // player_data has raw CSV format (Name, OVR, VAR) with capital letters
      const existingData = historyItem.file_type === 'batting' ? (tournament.batting || []) : (tournament.pitching || []);
      const addedPlayerKeys = new Set((historyItem.player_data || []).map(p => {
        const name = p.Name || p.name || '';
        const ovr = p.OVR || p.ovr || '';
        const vari = parseVariant(p.VAR || p.vari);
        return `${name}|${ovr}|${vari}`;
      }));
      const filteredData = existingData.filter(p => !addedPlayerKeys.has(`${p.name}|${p.ovr}|${p.vari || 'N'}`));

      // Remove date from uploaded_dates
      const uploadedDates = (tournament.uploaded_dates || tournament.uploadedDates || []).filter(d => d !== historyItem.upload_date);

      // Update tournament
      const updatePayload = historyItem.file_type === 'batting'
        ? { batting: filteredData, uploaded_dates: uploadedDates, uploadedDates: uploadedDates }
        : { pitching: filteredData, uploaded_dates: uploadedDates, uploadedDates: uploadedDates };
      
      await supabase.from('tournaments').update(updatePayload).eq('id', historyItem.tournament_id);

      // Mark history as undone
      await supabase.from('upload_history').update({ undone: true, undone_at: new Date().toISOString() }).eq('id', historyItem.id);

      showNotif(`Undone! Removed ${historyItem.player_count} ${historyItem.file_type}`);
      loadData();
    } catch (e) {
      console.error('Undo error:', e);
      showNotif('Failed to undo', 'error');
    }
  };

  const handleCreateAndApprove = async (upload) => {
    if (!newEventName.trim()) {
      showNotif('Please enter event name', 'error');
      return;
    }

    try {
      const typeLabel = newEventType === 'daily' ? '[Daily]' : '[Weekly]';
      const fullName = `${typeLabel} ${newEventName.trim()}`;
      
      // Create new tournament
      const newTournament = {
        id: crypto.randomUUID(),
        name: fullName,
        created_at: new Date().toISOString(),
        category: newEventCategory,
        batting: [],
        pitching: [],
        uploaded_hashes: [],
        event_type: newEventType,
        uploaded_dates: [],
        rotating_format: newEventRotating
      };

      const { error: createError } = await supabase.from('tournaments').insert(newTournament);
      if (createError) throw createError;

      // Now approve with the new tournament
      await handleApprove(upload, newTournament.id, upload.suggested_date);
      
      setCreatingNewFor(null);
      setNewEventName('');
      setNewEventType('daily');
      setNewEventCategory('tournaments');
      setNewEventRotating(false);
    } catch (e) {
      console.error('Create error:', e);
      showNotif('Failed to create event', 'error');
    }
  };

  if (!hasAccess('master')) {
    return (
      <Layout notification={notification}>
        <div style={styles.submitPage}>
          <div style={styles.submitContainer}>
            <h2 style={styles.submitTitle}>🔒 Admin Access Required</h2>
            <p style={styles.submitSubtitle}>You need master access to view the review queue.</p>
            <button style={styles.submitBtn} onClick={() => requestAuth(() => loadData(), 'master')}>Enter Password</button>
          </div>
        </div>
      </Layout>
    );
  }

  const pendingCount = pendingUploads.length + criticalUploads.length;

  return (
    <Layout notification={notification} pendingCount={pendingCount}>
      <div style={styles.reviewPage}>
        <div style={styles.reviewContainer}>
          <h2 style={styles.reviewTitle}>📋 Review Queue</h2>
          
          <div style={styles.reviewTabs}>
            <button 
              style={{...styles.reviewTab, ...(activeTab === 'pending' ? styles.reviewTabActive : {})}}
              onClick={() => setActiveTab('pending')}
            >
              Pending Review {pendingUploads.length > 0 && <span style={styles.reviewTabBadge}>{pendingUploads.length}</span>}
            </button>
            <button 
              style={{...styles.reviewTab, ...(activeTab === 'critical' ? styles.reviewTabActive : {}), ...(criticalUploads.length > 0 ? {color: theme.error} : {})}}
              onClick={() => setActiveTab('critical')}
            >
              Needs Attention {criticalUploads.length > 0 && <span style={{...styles.reviewTabBadge, background: theme.error}}>{criticalUploads.length}</span>}
            </button>
            <button 
              style={{...styles.reviewTab, ...(activeTab === 'history' ? styles.reviewTabActive : {})}}
              onClick={() => setActiveTab('history')}
            >
              Upload History
            </button>
          </div>

          {isLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <>
              {/* Pending Tab */}
              {activeTab === 'pending' && (
                <div style={styles.reviewList}>
                  {pendingUploads.length === 0 ? (
                    <div style={styles.emptyState}>✓ No pending submissions</div>
                  ) : (
                    <>
                      {/* Batch Controls */}
                      {pendingUploads.length > 1 && (
                        <div style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: 12, background: theme.panelBg, borderRadius: 8, marginBottom: 16,
                          border: `1px solid ${theme.border}`
                        }}>
                          <div style={{ color: theme.textSecondary, fontSize: 13 }}>
                            {selectedUploads.size > 0 
                              ? `${selectedUploads.size} selected (max 10)`
                              : 'Select uploads to batch approve'}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button 
                              onClick={() => setSelectedUploads(new Set())}
                              disabled={selectedUploads.size === 0}
                              style={{
                                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                                background: 'transparent', color: theme.textMuted,
                                border: `1px solid ${theme.border}`, cursor: 'pointer',
                                opacity: selectedUploads.size === 0 ? 0.5 : 1
                              }}
                            >
                              Clear
                            </button>
                            <button 
                              onClick={handleBatchApprove}
                              disabled={selectedUploads.size === 0 || isBatchApproving}
                              style={{
                                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: selectedUploads.size > 0 ? theme.success : theme.inputBg,
                                color: selectedUploads.size > 0 ? '#fff' : theme.textMuted,
                                border: 'none', cursor: 'pointer',
                                opacity: selectedUploads.size === 0 || isBatchApproving ? 0.5 : 1
                              }}
                            >
                              {isBatchApproving ? 'Approving...' : `✓ Batch Approve (${selectedUploads.size})`}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Group headers for paired uploads */}
                      {getUploadGroups().map(group => (
                        <div key={group.key} style={{ marginBottom: 16 }}>
                          {/* Group Header */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            background: theme.panelBg, borderRadius: '8px 8px 0 0',
                            borderBottom: `1px solid ${theme.border}`
                          }}>
                            <input 
                              type="checkbox"
                              checked={group.uploads.every(u => selectedUploads.has(u.id))}
                              onChange={() => toggleGroupSelection(group)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: 13 }}>
                              {group.tournamentName}
                            </span>
                            <span style={{ color: theme.textMuted, fontSize: 12 }}>
                              {formatDate(group.date)} · {group.uploads.length} file{group.uploads.length > 1 ? 's' : ''}
                            </span>
                            {group.uploads.length === 2 && (
                              <span style={{ 
                                background: theme.accent + '22', color: theme.accent, 
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 
                              }}>
                                PAIR
                              </span>
                            )}
                          </div>
                          
                          {/* Group Items */}
                          {group.uploads.map(upload => (
                    <div key={upload.id} style={{
                      ...styles.reviewCard,
                      marginBottom: 0,
                      borderRadius: group.uploads.indexOf(upload) === group.uploads.length - 1 ? '0 0 8px 8px' : 0,
                      borderTop: group.uploads.indexOf(upload) > 0 ? 'none' : undefined,
                      background: selectedUploads.has(upload.id) ? theme.accent + '11' : styles.reviewCard.background
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <input 
                          type="checkbox"
                          checked={selectedUploads.has(upload.id)}
                          onChange={() => toggleUploadSelection(upload.id)}
                          style={{ cursor: 'pointer', marginTop: 4 }}
                        />
                        <div style={{ flex: 1 }}>
                      <div style={styles.reviewCardHeader}>
                        <span style={styles.reviewCardFile}>📄 {upload.file_name}</span>
                        <span style={styles.reviewCardTime}>{timeAgo(upload.created_at)}</span>
                      </div>
                      
                      <div style={styles.reviewCardBody}>
                        <div style={styles.reviewCardRow}>
                          <span style={styles.reviewCardLabel}>Type:</span>
                          <span style={styles.reviewCardValue}>{upload.file_type?.toUpperCase()} ({(upload.clean_data || []).length} players)</span>
                        </div>
                        {upload.user_notes && (
                          <div style={styles.reviewCardRow}>
                            <span style={styles.reviewCardLabel}>Notes:</span>
                            <span style={styles.reviewCardValue}>"{upload.user_notes}"</span>
                          </div>
                        )}
                        
                        {/* Player Match */}
                        {upload.suggested_tournament_id && (
                          <div style={styles.reviewCardRow}>
                            <span style={styles.reviewCardLabel}>Player Match:</span>
                            <span style={{...styles.reviewCardMatch, color: getMatchColor(upload.player_match_percent)}}>
                              {upload.player_match_percent}% - {getMatchLabel(upload.player_match_percent)}
                            </span>
                          </div>
                        )}

                        {/* Warnings */}
                        {(upload.removed_rows?.length > 0 || upload.date_already_uploaded) && (
                          <div style={styles.reviewCardWarnings}>
                            {upload.date_already_uploaded && (
                              <div style={styles.warningItem}>⚠️ Date already has data for this tournament</div>
                            )}
                            {upload.removed_rows?.length > 0 && (
                              <div style={styles.warningItem} onClick={() => setExpandedId(expandedId === upload.id ? null : upload.id)}>
                                ⚠️ {upload.removed_rows.length} rows auto-removed (click to view)
                              </div>
                            )}
                            {expandedId === upload.id && upload.removed_rows?.length > 0 && (
                              <div style={styles.removedRowsList}>
                                {upload.removed_rows.map((r, i) => (
                                  <div key={i} style={styles.removedRow}>Row {r.row}: {r.name} - {r.reasons.join(', ')}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={styles.reviewCardActions}>
                        {upload.suggested_tournament_id ? (
                          <>
                            <select 
                              defaultValue={upload.suggested_tournament_id}
                              style={styles.reviewSelect}
                              id={`tournament-${upload.id}`}
                            >
                              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <button 
                              style={styles.approveBtn}
                              onClick={() => handleApprove(upload, document.getElementById(`tournament-${upload.id}`).value, upload.suggested_date)}
                            >✓ Approve</button>
                          </>
                        ) : (
                          <>
                            {creatingNewFor === upload.id ? (
                              <div style={styles.newEventForm}>
                                <input 
                                  type="text" 
                                  value={newEventName} 
                                  onChange={(e) => setNewEventName(e.target.value)}
                                  placeholder="Event name..."
                                  style={styles.newEventInput}
                                />
                                <select value={newEventType} onChange={(e) => setNewEventType(e.target.value)} style={styles.newEventSelect}>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                </select>
                                <select value={newEventCategory} onChange={(e) => setNewEventCategory(e.target.value)} style={styles.newEventSelect}>
                                  <option value="tournaments">Tournament</option>
                                  <option value="drafts">Draft</option>
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: theme.textMuted, fontSize: 11, cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={newEventRotating} 
                                    onChange={(e) => setNewEventRotating(e.target.checked)}
                                  />
                                  Rotating
                                </label>
                                <button style={styles.approveBtn} onClick={() => handleCreateAndApprove(upload)}>Create & Approve</button>
                                <button style={styles.cancelSmallBtn} onClick={() => setCreatingNewFor(null)}>Cancel</button>
                              </div>
                            ) : (
                              <>
                                <select style={styles.reviewSelect} id={`tournament-${upload.id}`}>
                                  <option value="">-- Select Existing --</option>
                                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <button 
                                  style={styles.approveBtn}
                                  onClick={() => {
                                    const selected = document.getElementById(`tournament-${upload.id}`).value;
                                    if (selected) {
                                      handleApprove(upload, selected, upload.suggested_date);
                                    } else {
                                      setCreatingNewFor(upload.id);
                                      setNewEventName(upload.suggested_tournament_name || '');
                                    }
                                  }}
                                >✓ Approve</button>
                                <button style={styles.newEventBtn} onClick={() => { setCreatingNewFor(upload.id); setNewEventName(upload.suggested_tournament_name || ''); }}>+ New Event</button>
                              </>
                            )}
                          </>
                        )}
                        <button style={styles.previewBtn} onClick={() => setPreviewId(previewId === upload.id ? null : upload.id)}>👁 Preview</button>
                        <button style={styles.rejectBtn} onClick={() => handleReject(upload.id)}>✗</button>
                      </div>

                      {/* Preview */}
                      {previewId === upload.id && (
                        <div style={styles.previewTable}>
                          <table style={{width:'100%', fontSize: 11, borderCollapse: 'collapse'}}>
                            <thead>
                              <tr>{Object.keys((upload.clean_data || [])[0] || {}).slice(0, 10).map(h => <th key={h} style={{padding: '4px 6px', background: theme.panelBg, textAlign: 'left'}}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {(upload.clean_data || []).slice(0, 10).map((row, i) => (
                                <tr key={i}>{Object.values(row).slice(0, 10).map((v, j) => <td key={j} style={{padding: '4px 6px', borderTop: `1px solid ${theme.border}`}}>{v}</td>)}</tr>
                              ))}
                            </tbody>
                          </table>
                          {(upload.clean_data || []).length > 10 && <div style={{padding: 8, color: theme.textMuted}}>... and {upload.clean_data.length - 10} more rows</div>}
                        </div>
                      )}
                        </div>{/* close flex: 1 div */}
                      </div>{/* close flex wrapper div */}
                    </div>
                  ))}
                </div>
              ))}
                    </>
                  )}
                </div>
              )}

              {/* Critical Tab */}
              {activeTab === 'critical' && (
                <div style={styles.reviewList}>
                  {criticalUploads.length === 0 ? (
                    <div style={styles.emptyState}>✓ No critical issues</div>
                  ) : criticalUploads.map(upload => (
                    <div key={upload.id} style={{...styles.reviewCard, borderColor: theme.error}}>
                      <div style={styles.reviewCardHeader}>
                        <span style={styles.reviewCardFile}>🚨 {upload.file_name}</span>
                        <span style={styles.reviewCardTime}>{timeAgo(upload.created_at)}</span>
                      </div>
                      
                      <div style={styles.criticalIssues}>
                        <div style={styles.criticalTitle}>Critical Issues:</div>
                        {(upload.validation_issues || []).filter(i => i.type === 'critical').map((issue, i) => (
                          <div key={i} style={styles.criticalItem}>• {issue.title}: {issue.details}</div>
                        ))}
                      </div>

                      <div style={styles.reviewCardBody}>
                        <div style={styles.reviewCardRow}>
                          <span style={styles.reviewCardLabel}>User Selected:</span>
                          <span style={styles.reviewCardValue}>{upload.suggested_tournament_name || 'New Event'}</span>
                        </div>
                        <div style={styles.reviewCardRow}>
                          <span style={styles.reviewCardLabel}>Date:</span>
                          <span style={styles.reviewCardValue}>{formatDate(upload.suggested_date)}</span>
                        </div>
                        {upload.user_notes && (
                          <div style={styles.reviewCardRow}>
                            <span style={styles.reviewCardLabel}>Notes:</span>
                            <span style={styles.reviewCardValue}>"{upload.user_notes}"</span>
                          </div>
                        )}
                      </div>

                      <div style={styles.reviewCardActions}>
                        <button style={styles.previewBtn} onClick={() => setPreviewId(previewId === upload.id ? null : upload.id)}>👁 View Raw Data</button>
                        <button style={styles.rejectBtn} onClick={() => handleReject(upload.id)}>✗ Reject</button>
                      </div>

                      {previewId === upload.id && (
                        <div style={styles.previewTable}>
                          <pre style={{fontSize: 10, overflow: 'auto', maxHeight: 200}}>{JSON.stringify(upload.raw_data?.slice(0, 5), null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div style={styles.reviewList}>
                  {uploadHistory.length === 0 ? (
                    <div style={styles.emptyState}>No upload history (last 30 days)</div>
                  ) : (
                    <table style={styles.historyTable}>
                      <thead>
                        <tr>
                          <th style={styles.historyTh}>Date</th>
                          <th style={styles.historyTh}>Tournament</th>
                          <th style={styles.historyTh}>Type</th>
                          <th style={styles.historyTh}>Players</th>
                          <th style={styles.historyTh}>Source</th>
                          <th style={styles.historyTh}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadHistory.map(h => (
                          <tr key={h.id} style={h.undone ? {opacity: 0.5} : {}}>
                            <td style={styles.historyTd}>{formatDate(h.upload_date)}</td>
                            <td style={styles.historyTd}>{h.tournament_name}</td>
                            <td style={styles.historyTd}>{h.file_type}</td>
                            <td style={styles.historyTd}>{h.player_count}</td>
                            <td style={styles.historyTd}>
                              <span style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: h.source === 'admin_direct' ? theme.accent + '22' : 
                                           h.source === 'admin_bulk' ? theme.warning + '22' : 
                                           theme.success + '22',
                                color: h.source === 'admin_direct' ? theme.accent : 
                                       h.source === 'admin_bulk' ? theme.warning : 
                                       theme.success
                              }}>
                                {h.source === 'admin_direct' ? 'Admin' : 
                                 h.source === 'admin_bulk' ? 'Bulk' : 
                                 h.source === 'user_submission' ? 'User' : 
                                 'Legacy'}
                              </span>
                            </td>
                            <td style={styles.historyTd}>
                              {h.undone ? (
                                <span style={{color: theme.textMuted}}>UNDONE</span>
                              ) : (
                                <button style={styles.undoBtn} onClick={() => handleUndo(h)}>↶ Undo</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function LeaderboardsPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [activeTab, setActiveTab] = useState('weekly');
  const [dailyWeeklyData, setDailyWeeklyData] = useState([]);
  const [weeklyWeeklyData, setWeeklyWeeklyData] = useState([]);
  const [dailyAllTimeData, setDailyAllTimeData] = useState([]);
  const [weeklyAllTimeData, setWeeklyAllTimeData] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData(selectedWeek);
    }
  }, [selectedWeek]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get available weeks (from daily table, should be same as weekly)
      const { data: weeks } = await supabase
        .from('weekly_draft_leaderboard')
        .select('week_of')
        .order('week_of', { ascending: false });
      
      const uniqueWeeks = [...new Set((weeks || []).map(w => w.week_of))];
      setAvailableWeeks(uniqueWeeks);
      
      if (uniqueWeeks.length > 0) {
        setSelectedWeek(uniqueWeeks[0]);
      }

      // Load daily all-time data (top 50)
      const { data: dailyAllTime } = await supabase
        .from('alltime_drafter_points')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(50);
      setDailyAllTimeData(dailyAllTime || []);

      // Load weekly all-time data (top 50)
      const { data: weeklyAllTime } = await supabase
        .from('alltime_drafter_points_weekly')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(50);
      setWeeklyAllTimeData(weeklyAllTime || []);
    } catch (e) {
      console.error('Load error:', e);
    }
    setIsLoading(false);
  };

  const loadWeekData = async (weekOf) => {
    try {
      // Load daily stars for the week
      const { data: dailyData } = await supabase
        .from('weekly_draft_leaderboard')
        .select('*')
        .eq('week_of', weekOf)
        .order('rank', { ascending: true });
      setDailyWeeklyData(dailyData || []);

      // Load weekly stars for the week
      const { data: weeklyData } = await supabase
        .from('weekly_draft_leaderboard_weekly')
        .select('*')
        .eq('week_of', weekOf)
        .order('rank', { ascending: true });
      setWeeklyWeeklyData(weeklyData || []);
    } catch (e) {
      console.error('Load week error:', e);
    }
  };

  const formatWeekLabel = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRankStyle = (rank) => {
    if (rank === 1) return { color: '#FFD700', fontWeight: 700 };
    if (rank === 2) return { color: '#C0C0C0', fontWeight: 700 };
    if (rank === 3) return { color: '#CD7F32', fontWeight: 700 };
    return {};
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderStarsTable = (data, title, starColor) => (
    <div style={styles.leaderboardCard}>
      <h3 style={styles.leaderboardCardTitle}>{title}</h3>
      {data.length === 0 ? (
        <div style={styles.emptyState}>No data yet</div>
      ) : (
        <div style={styles.leaderboardTableWrapper}>
          <table style={styles.leaderboardTable}>
            <thead>
              <tr>
                <th style={styles.leaderboardTh}>Rank</th>
                <th style={{...styles.leaderboardTh, textAlign: 'left'}}>Username</th>
                <th style={styles.leaderboardTh}>Stars</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((row, idx) => (
                <tr key={row.id || row.username} style={idx < 3 ? {background: `${theme.gold}10`} : {}}>
                  <td style={{...styles.leaderboardTd, ...getRankStyle(row.rank || idx + 1)}}>
                    {getRankEmoji(row.rank || idx + 1)}
                  </td>
                  <td style={{...styles.leaderboardTd, textAlign: 'left', fontWeight: idx < 3 ? 600 : 400}}>
                    {row.username}
                  </td>
                  <td style={{...styles.leaderboardTd, color: starColor, fontWeight: 600}}>
                    {row.stars.toLocaleString()} ⭐
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderAllTimeTable = (data, title, accentColor) => (
    <div style={styles.leaderboardCard}>
      <h3 style={styles.leaderboardCardTitle}>{title}</h3>
      <p style={styles.allTimeExplainerSmall}>Top 50 weekly finishers earn points (1st = 50pts, 50th = 1pt)</p>
      {data.length === 0 ? (
        <div style={styles.emptyState}>No data yet</div>
      ) : (
        <div style={styles.leaderboardTableWrapper}>
          <table style={styles.leaderboardTable}>
            <thead>
              <tr>
                <th style={styles.leaderboardTh}>Rank</th>
                <th style={{...styles.leaderboardTh, textAlign: 'left'}}>Username</th>
                <th style={styles.leaderboardTh}>Points</th>
                <th style={styles.leaderboardTh}>Weeks</th>
                <th style={styles.leaderboardTh}>Best</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.username} style={idx < 3 ? {background: `${theme.gold}10`} : {}}>
                  <td style={{...styles.leaderboardTd, ...getRankStyle(idx + 1)}}>
                    {getRankEmoji(idx + 1)}
                  </td>
                  <td style={{...styles.leaderboardTd, textAlign: 'left', fontWeight: idx < 3 ? 600 : 400}}>
                    {row.username}
                  </td>
                  <td style={{...styles.leaderboardTd, color: accentColor, fontWeight: 600}}>
                    {row.total_points.toLocaleString()}
                  </td>
                  <td style={styles.leaderboardTd}>
                    {row.weeks_participated}
                  </td>
                  <td style={styles.leaderboardTd}>
                    {row.best_finish ? getRankEmoji(row.best_finish) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Layout notification={notification}>
        <div style={styles.loading}><p>Loading leaderboards...</p></div>
      </Layout>
    );
  }

  return (
    <Layout notification={notification}>
      <div style={styles.leaderboardPage}>
        <div style={styles.leaderboardContainerWide}>
          <h2 style={styles.leaderboardTitle}>🏆 Draft Leaderboards</h2>
          <p style={styles.leaderboardSubtitle}>Daily and weekly draft star rankings</p>

          <div style={styles.leaderboardTabs}>
            <button 
              style={{...styles.leaderboardTab, ...(activeTab === 'weekly' ? styles.leaderboardTabActive : {})}}
              onClick={() => setActiveTab('weekly')}
            >
              Weekly Stars
            </button>
            <button 
              style={{...styles.leaderboardTab, ...(activeTab === 'alltime' ? styles.leaderboardTabActive : {})}}
              onClick={() => setActiveTab('alltime')}
            >
              All-Time Top 50
            </button>
          </div>

          {activeTab === 'weekly' && (
            <>
              <div style={styles.weekSelectorCentered}>
                <label style={styles.leaderboardWeekLabel}>Week of:</label>
                <select 
                  value={selectedWeek} 
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  style={styles.weekSelect}
                >
                  {availableWeeks.map(week => (
                    <option key={week} value={week}>{formatWeekLabel(week)}</option>
                  ))}
                </select>
              </div>

              <div style={styles.leaderboardSideBySide}>
                {renderStarsTable(dailyWeeklyData, '📅 Daily Drafts', theme.gold)}
                {renderStarsTable(weeklyWeeklyData, '📆 Weekly Drafts', theme.accent)}
              </div>
            </>
          )}

          {activeTab === 'alltime' && (
            <div style={styles.leaderboardSideBySide}>
              {renderAllTimeTable(dailyAllTimeData, '📅 Daily Drafts - All Time', theme.gold)}
              {renderAllTimeTable(weeklyAllTimeData, '📆 Weekly Drafts - All Time', theme.accent)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function DraftAssistantPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // Check if in compact/popout mode via URL parameter
  const isCompactMode = new URLSearchParams(window.location.search).get('compact') === '1';
  
  // Setup state
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [draftSize, setDraftSize] = useState(26);
  const [hasDH, setHasDH] = useState(true);
  const [cardPool, setCardPool] = useState({
    perfect: true,   // 100+
    diamond: true,   // 90-99
    gold: true,      // 80-89
    silver: true,    // 70-79
    bronze: true,    // 60-69
    iron: false      // <60
  });
  
  // Draft state
  const [draftStarted, setDraftStarted] = useState(false);
  const [tournamentData, setTournamentData] = useState(null);
  const [roster, setRoster] = useState({});
  const [activePositionTab, setActivePositionTab] = useState('C');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [notification, setNotification] = useState(null);
  const [showPlayerModal, setShowPlayerModal] = useState(null); // Player to show in modal
  const [editingSlot, setEditingSlot] = useState(null); // For position switching
  const [showQuickGuide, setShowQuickGuide] = useState(false); // Quick start guide popup
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(null); // Slot to add placeholder to
  const [placeholderName, setPlaceholderName] = useState(''); // Name input for placeholder
  const [lowDataMode, setLowDataMode] = useState(false); // Low Data Support mode
  
  // Pop out to new window
  const popOutWindow = () => {
    const width = 500;
    const height = 800;
    const left = window.screen.width - width - 50;
    const top = 50;
    window.open(
      '/draft-assistant?compact=1',
      'DraftAssistant',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };
  
  // Position definitions
  const battingPositions = hasDH ? ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const pitchingPositions = ['SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'CL'];
  const benchCount = draftSize - battingPositions.length - pitchingPositions.length;
  const benchSlots = Array.from({ length: benchCount }, (_, i) => `BENCH${i + 1}`);
  const allSlots = [...battingPositions, ...pitchingPositions, ...benchSlots];
  
  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, category')
      .order('name');
    setTournaments(data || []);
  };

  const getCardTier = (ovr) => {
    if (ovr >= 100) return 'perfect';
    if (ovr >= 90) return 'diamond';
    if (ovr >= 80) return 'gold';
    if (ovr >= 70) return 'silver';
    if (ovr >= 60) return 'bronze';
    return 'iron';
  };

  const getCardTierLabel = (ovr) => {
    if (ovr >= 100) return { label: '★', color: '#a855f7' };     // Purple - Perfect
    if (ovr >= 90) return { label: '◆', color: '#32EBFC' };      // Cyan - Diamond
    if (ovr >= 80) return { label: '●', color: '#FFE61F' };      // Yellow - Gold
    if (ovr >= 70) return { label: '●', color: '#E0E0E0' };      // Gray - Silver
    if (ovr >= 60) return { label: '●', color: '#664300' };      // Brown - Bronze
    return { label: '○', color: '#4a4a4a' };                      // Dark gray - Iron
  };

  // === HEURISTICS: Sample Size Confidence ===
  // Based on PD Data Interpretation Guide thresholds
  // Low Data Support mode uses lower thresholds (99 AB / 20 IP)
  const getSampleConfidence = (player, isPitching) => {
    if (isPitching) {
      // Parse IP (handles "123.2" format)
      const ip = parseFloat(player.ip) || 0;
      if (lowDataMode) {
        // LDS mode: lower thresholds
        if (ip >= 100) return { level: 'trusted', label: '◆', color: '#22c55e', desc: 'Trusted (100+ IP)' };
        if (ip >= 20) return { level: 'high', label: '●', color: '#86efac', desc: 'LDS High (20-99 IP)' };
        return { level: 'low', label: '○', color: '#f87171', desc: 'Low confidence (<20 IP)' };
      }
      if (ip >= 200) return { level: 'trusted', label: '◆', color: '#22c55e', desc: 'Trusted (200+ IP)' };
      if (ip >= 100) return { level: 'high', label: '●', color: '#86efac', desc: 'High confidence (100-199 IP)' };
      return { level: 'low', label: '○', color: '#f87171', desc: 'Low confidence (<100 IP)' };
    } else {
      const ab = parseInt(player.ab) || 0;
      if (lowDataMode) {
        // LDS mode: lower thresholds
        if (ab >= 450) return { level: 'trusted', label: '◆', color: '#22c55e', desc: 'Trusted (450+ AB)' };
        if (ab >= 99) return { level: 'high', label: '●', color: '#86efac', desc: 'LDS High (99-449 AB)' };
        return { level: 'low', label: '○', color: '#f87171', desc: 'Low confidence (<99 AB)' };
      }
      if (ab >= 801) return { level: 'trusted', label: '◆', color: '#22c55e', desc: 'Trusted (801+ AB)' };
      if (ab >= 450) return { level: 'high', label: '●', color: '#86efac', desc: 'High confidence (450-800 AB)' };
      return { level: 'low', label: '○', color: '#f87171', desc: 'Low confidence (<450 AB)' };
    }
  };

  // === HEURISTICS: Calculate Performance Tiers ===
  // Groups players into tiers based on wOBA (batters) or SIERA (pitchers)
  const calculateTiers = (players, isPitching) => {
    if (!players || players.length === 0) return [];

    // Sort by primary metric only: wOBA for batters, SIERA for pitchers
    const sorted = [...players].sort((a, b) => {
      if (isPitching) {
        // Lower SIERA is better
        const aVal = parseFloat(a.siera) || parseFloat(a.era) || 99;
        const bVal = parseFloat(b.siera) || parseFloat(b.era) || 99;
        return aVal - bVal;
      } else {
        // Higher wOBA is better
        const aVal = parseFloat(a.woba) || 0;
        const bVal = parseFloat(b.woba) || 0;
        return bVal - aVal;
      }
    });

    // Find tier breaks (gaps > threshold)
    const tierThreshold = isPitching ? 0.25 : 0.015; // SIERA gap of 0.25, wOBA gap of .015
    let currentTier = 1;
    
    return sorted.map((player, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        let gap;
        if (isPitching) {
          const prevVal = parseFloat(prev.siera) || parseFloat(prev.era) || 0;
          const currVal = parseFloat(player.siera) || parseFloat(player.era) || 0;
          gap = currVal - prevVal; // Higher SIERA = worse
        } else {
          const prevVal = parseFloat(prev.woba) || 0;
          const currVal = parseFloat(player.woba) || 0;
          gap = prevVal - currVal; // Lower wOBA = worse
        }
        if (gap >= tierThreshold) {
          currentTier++;
        }
      }
      return { ...player, _tier: currentTier };
    });
  };

  // === Get primary ranking value (wOBA or SIERA) ===
  const getRankValue = (player, isPitching) => {
    if (isPitching) {
      // Lower SIERA is better, so invert for sorting (higher = better)
      const siera = parseFloat(player.siera) || parseFloat(player.era) || 5;
      return 10 - siera; // Invert so higher = better
    } else {
      return parseFloat(player.woba) || 0;
    }
  };

  const startDraft = async () => {
    if (!selectedTournamentId) {
      showNotif('Please select a tournament', 'error');
      return;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', selectedTournamentId)
      .single();

    if (error || !data) {
      showNotif('Failed to load tournament', 'error');
      return;
    }

    // Check if this is a low data tournament
    const battingCount = data.batting?.length || 0;
    const pitchingCount = data.pitching?.length || 0;
    const isLowData = battingCount < 50 || pitchingCount < 30;
    
    if (isLowData) {
      setLowDataMode(true);
      showNotif('⚠️ Low data detected - LDS mode enabled', 'warning');
    } else {
      setLowDataMode(false);
    }

    setTournamentData(data);
    setRoster({});
    setDraftStarted(true);
    setActivePositionTab('C');
    setShowQuickGuide(true); // Show guide on start
  };

  const resetDraft = () => {
    if (!confirm('Reset draft? This will clear your roster.')) return;
    setRoster({});
  };

  const exitDraft = () => {
    if (!confirm('Exit draft? Progress will be lost.')) return;
    setDraftStarted(false);
    setTournamentData(null);
    setRoster({});
    setLowDataMode(false);
  };

  // Check if player qualifies for elite defense shield (100+ DEF at key positions)
  const hasEliteDefenseShield = (player, isPitching) => {
    if (isPitching) return false;
    const keyDefPositions = ['C', '2B', 'SS', 'CF'];
    const hasEliteDef = player.def && parseInt(player.def) >= 100;
    const isKeyPosition = player.positions 
      ? player.positions.some(pos => keyDefPositions.includes(pos)) 
      : keyDefPositions.includes(player.pos);
    return hasEliteDef && isKeyPosition;
  };

  // Get available players for a position
  const getAvailablePlayers = (position, limit = 5) => {
    if (!tournamentData) return [];
    
    const isPitching = ['SP', 'SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'RP', 'RP1', 'RP2', 'RP3', 'RP4', 'CL'].some(p => position.startsWith(p) || position === p);
    const data = isPitching ? tournamentData.pitching : tournamentData.batting;
    if (!data) return [];

    // Normalize position for matching
    // In Perfect Draft, SP's are used for all pitching roles (RP/CL too)
    let posMatch = position;
    if (position.startsWith('SP') || position.startsWith('RP') || position === 'CL') posMatch = 'SP';
    else if (position === 'BENCH' || position.startsWith('BENCH')) posMatch = null; // All positions for bench

    // Check if this is a DH position (defense doesn't matter for DH)
    const isDHPosition = position === 'DH';

    // Get roster player keys
    const rosterPlayerKeys = new Set(Object.values(roster).map(p => `${p.name}|${p.ovr}|${p.vari || 'N'}`));

    const filtered = data.filter(p => {
      // Filter by card pool
      const tier = getCardTier(p.ovr);
      if (!cardPool[tier]) return false;
      
      // Filter by position (null = any for bench)
      // Check positions array if it exists, otherwise fall back to pos
      if (posMatch) {
        if (p.positions && p.positions.length > 0) {
          if (!p.positions.includes(posMatch)) return false;
        } else if ((p.pos || '').toUpperCase() !== posMatch) {
          return false;
        }
      }
      
      // Filter out already on roster
      const key = `${p.name}|${p.ovr}|${p.vari || 'N'}`;
      if (rosterPlayerKeys.has(key)) return false;

      // Filter out low confidence players (always hidden in Perfect Draft)
      const confidence = getSampleConfidence(p, isPitching);
      if (confidence.level === 'low') return false;

      // Filter out poor defense players (DEF < 50) for non-DH batting positions
      // Only apply if player has a DEF rating recorded
      if (!isPitching && !isDHPosition && p.def && parseInt(p.def) < 50) {
        return false;
      }
      
      return true;
    });

    // Calculate tiers on ALL eligible players first (before limiting)
    const tiered = calculateTiers(filtered, isPitching);
    
    // Add confidence, rank value, and T1+ status
    const withScores = tiered.map(p => {
      const hasShield = hasEliteDefenseShield(p, isPitching);
      // T1+ = (T1 or T2) with elite defense shield at key position
      const isT1Plus = (p._tier === 1 || p._tier === 2) && hasShield;
      return {
        ...p,
        _confidence: getSampleConfidence(p, isPitching),
        _rankValue: getRankValue(p, isPitching),
        _isPitching: isPitching,
        _hasShield: hasShield,
        _isT1Plus: isT1Plus
      };
    });

    // Sort by: T1+ first, then T1, then T2, then by rank value within each group
    return withScores
      .sort((a, b) => {
        // T1+ always first
        if (a._isT1Plus && !b._isT1Plus) return -1;
        if (!a._isT1Plus && b._isT1Plus) return 1;
        // Then by tier (T1 before T2 before T3+)
        if (a._tier !== b._tier) return a._tier - b._tier;
        // Within same tier, sort by rank value
        return b._rankValue - a._rankValue;
      })
      .slice(0, limit);
  };

  // Get all available for a position type (for scarcity calculation)
  const getAllAvailableForPosition = (position) => {
    return getAvailablePlayers(position, 999);
  };

  // Check position scarcity (SP covers all pitching roles in Perfect Draft)
  const getScarcityAlert = () => {
    const alerts = [];
    // Only check batting positions + SP (SP's are used for RP/CL in Perfect Draft)
    const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP'];
    
    for (const pos of positions) {
      // Skip if already filled
      if (pos === 'SP' && ['SP1','SP2','SP3','SP4','SP5'].every(s => roster[s])) continue;
      if (!pos.startsWith('SP') && roster[pos]) continue;

      const available = getAllAvailableForPosition(pos);
      
      // Count T1+ players (elite with shield)
      const t1PlusCount = available.filter(p => p._isT1Plus).length;
      
      // Count T2 or higher (T1+, T1, or T2)
      const t2OrHigherCount = available.filter(p => p._isT1Plus || p._tier <= 2).length;
      
      // Quality Shortage: Low on elite players with high defense (T1+)
      if (t1PlusCount <= 2 && t1PlusCount > 0) {
        alerts.push({ 
          pos, 
          count: t1PlusCount, 
          type: 'quality',
          message: `Quality Shortage: ${pos} - Low on elite players with high defense`
        });
      }
      
      // Few Good Picks Left: Running out of above-average players (T2 or higher)
      if (t2OrHigherCount <= 2 && t2OrHigherCount > 0) {
        alerts.push({ 
          pos, 
          count: t2OrHigherCount, 
          type: 'scarcity',
          message: `Few Good Picks Left: ${pos} - Running out of above-average players`
        });
      }
    }
    
    return alerts;
  };

  // Add player to roster
  const addToRoster = (slot, player) => {
    setRoster(prev => ({ ...prev, [slot]: player }));
    setShowPlayerModal(null);
    showNotif(`${player.name} added to ${slot}`);
  };

  // Add placeholder player to roster (for players not in database)
  const addPlaceholder = (slot, name) => {
    const placeholderPlayer = {
      name: name || 'Unknown Player',
      ovr: '?',
      pos: slot.replace(/[0-9]/g, ''), // Extract position from slot (SP1 -> SP)
      isPlaceholder: true
    };
    setRoster(prev => ({ ...prev, [slot]: placeholderPlayer }));
    setShowPlaceholderModal(null);
    setPlaceholderName('');
    showNotif(`${placeholderPlayer.name} added to ${slot}`);
  };

  // Remove player from roster (back to available)
  const removeFromRoster = (slot) => {
    setRoster(prev => {
      const newRoster = { ...prev };
      delete newRoster[slot];
      return newRoster;
    });
  };

  // Switch player position
  const switchPosition = (fromSlot, toSlot) => {
    const player = roster[fromSlot];
    if (!player) return;
    
    setRoster(prev => {
      const newRoster = { ...prev };
      delete newRoster[fromSlot];
      newRoster[toSlot] = player;
      return newRoster;
    });
    setEditingSlot(null);
    showNotif(`${player.name} moved to ${toSlot}`);
  };

  // Search players - includes ALL players (even low confidence)
  useEffect(() => {
    if (!searchQuery.trim() || !tournamentData) {
      setSearchResults([]);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const rosterPlayerKeys = new Set(Object.values(roster).map(p => `${p.name}|${p.ovr}|${p.vari || 'N'}`));
    
    const batting = (tournamentData.batting || []).filter(p => {
      if (!p.name.toLowerCase().includes(query)) return false;
      if (rosterPlayerKeys.has(`${p.name}|${p.ovr}|${p.vari || 'N'}`)) return false;
      if (!cardPool[getCardTier(p.ovr)]) return false;
      return true;
    });
    const pitching = (tournamentData.pitching || []).filter(p => {
      if (!p.name.toLowerCase().includes(query)) return false;
      if (rosterPlayerKeys.has(`${p.name}|${p.ovr}|${p.vari || 'N'}`)) return false;
      if (!cardPool[getCardTier(p.ovr)]) return false;
      return true;
    });
    
    setSearchResults([
      ...batting.map(p => ({ ...p, type: 'batting', _confidence: getSampleConfidence(p, false) })),
      ...pitching.map(p => ({ ...p, type: 'pitching', _confidence: getSampleConfidence(p, true) }))
    ].slice(0, 15));
  }, [searchQuery, tournamentData, roster, cardPool]);

  // Get empty slots for a player type
  const getEmptySlots = (playerType) => {
    if (playerType === 'batting') {
      return [...battingPositions, ...benchSlots].filter(s => !roster[s]);
    } else {
      return [...pitchingPositions, ...benchSlots].filter(s => !roster[s]);
    }
  };

  // === VALUE PICKS CALCULATION ===
  // Find players who perform close to top-tier players but are in lower card tiers
  const getValuePicks = () => {
    if (!tournamentData) return { picks: [], isMultiTier: false, message: '' };
    
    // Determine which card tiers are enabled
    const tierOrder = ['perfect', 'diamond', 'gold', 'silver', 'bronze', 'iron'];
    const enabledTiers = tierOrder.filter(t => cardPool[t]);
    
    if (enabledTiers.length <= 1) {
      return { 
        picks: [], 
        isMultiTier: false, 
        message: 'Value Picks requires multiple card tiers. Enable more tiers in the Pool filter above.'
      };
    }
    
    // Get the highest enabled tier as the "reference" tier
    const highestTier = enabledTiers[0];
    const highestTierIndex = tierOrder.indexOf(highestTier);
    
    // Value tiers are 2+ tiers below the highest
    const valueTiers = enabledTiers.filter(t => tierOrder.indexOf(t) >= highestTierIndex + 2);
    
    if (valueTiers.length === 0) {
      // If only 2 tiers apart, use the lowest as value tier
      const lowestTier = enabledTiers[enabledTiers.length - 1];
      if (lowestTier !== highestTier) {
        valueTiers.push(lowestTier);
      } else {
        return { 
          picks: [], 
          isMultiTier: false, 
          message: 'Need at least 2 different card tiers for Value Picks.'
        };
      }
    }
    
    // Get all available players (not in roster, passing card pool filter, with good confidence)
    const rosterPlayerKeys = new Set(Object.values(roster).map(p => `${p.name}|${p.ovr}|${p.vari || 'N'}`));
    
    const allBatters = (tournamentData.batting || []).filter(p => {
      if (rosterPlayerKeys.has(`${p.name}|${p.ovr}|${p.vari || 'N'}`)) return false;
      if (!cardPool[getCardTier(p.ovr)]) return false;
      if (getSampleConfidence(p, false).level === 'low') return false;
      return true;
    });
    
    const allPitchers = (tournamentData.pitching || []).filter(p => {
      if (rosterPlayerKeys.has(`${p.name}|${p.ovr}|${p.vari || 'N'}`)) return false;
      if (!cardPool[getCardTier(p.ovr)]) return false;
      if (getSampleConfidence(p, true).level === 'low') return false;
      return true;
    });
    
    // For each position, find the best player (from highest tier) and compare value tier players
    const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP'];
    const valuePicks = [];
    
    for (const pos of positions) {
      const isPitching = pos === 'SP';
      const players = isPitching ? allPitchers : allBatters;
      
      // Get players at this position
      const positionPlayers = players.filter(p => {
        if (isPitching) return true; // All pitchers for SP
        const positions = p.positions || [p.pos];
        return positions.some(pp => pp === pos || pp === pos);
      });
      
      if (positionPlayers.length === 0) continue;
      
      // Find the best metric at this position (from any tier in pool)
      let bestMetric;
      if (isPitching) {
        bestMetric = Math.min(...positionPlayers.map(p => parseFloat(p.siera) || parseFloat(p.era) || 10));
      } else {
        bestMetric = Math.max(...positionPlayers.map(p => parseFloat(p.woba) || 0));
      }
      
      // Find value picks from lower tiers
      for (const p of positionPlayers) {
        const playerTier = getCardTier(p.ovr);
        if (!valueTiers.includes(playerTier)) continue;
        
        const metric = isPitching 
          ? (parseFloat(p.siera) || parseFloat(p.era) || 10)
          : (parseFloat(p.woba) || 0);
        
        // Calculate gap from best
        const gap = isPitching ? (metric - bestMetric) : (bestMetric - metric);
        
        // Determine value level
        let valueLevel = null;
        if (isPitching) {
          if (gap <= 0.3) valueLevel = 'insane';
          else if (gap <= 0.4) valueLevel = 'great';
          else if (gap <= 0.5) valueLevel = 'good';
        } else {
          if (gap <= 0.015) valueLevel = 'insane';
          else if (gap <= 0.025) valueLevel = 'great';
          else if (gap <= 0.040) valueLevel = 'good';
        }
        
        if (valueLevel) {
          const tierLabel = getCardTierLabel(p.ovr);
          valuePicks.push({
            ...p,
            _position: pos,
            _isPitching: isPitching,
            _gap: gap,
            _bestMetric: bestMetric,
            _valueLevel: valueLevel,
            _tierLabel: tierLabel,
            _cardTier: playerTier,
            _metric: metric,
            _confidence: getSampleConfidence(p, isPitching)
          });
        }
      }
    }
    
    // Deduplicate players - combine positions for same player
    const playerMap = new Map();
    for (const p of valuePicks) {
      const key = `${p.name}|${p.ovr}|${p.vari || 'N'}`;
      if (playerMap.has(key)) {
        const existing = playerMap.get(key);
        // Add position if not already included
        if (!existing._positions.includes(p._position)) {
          existing._positions.push(p._position);
        }
        // Keep the better value level
        const levelOrder = { insane: 0, great: 1, good: 2 };
        if (levelOrder[p._valueLevel] < levelOrder[existing._valueLevel]) {
          existing._valueLevel = p._valueLevel;
          existing._gap = p._gap;
          existing._bestMetric = p._bestMetric;
        }
      } else {
        playerMap.set(key, { ...p, _positions: [p._position] });
      }
    }
    
    const deduplicatedPicks = Array.from(playerMap.values());
    
    // Sort by value level (insane > great > good), then by gap
    const levelOrder = { insane: 0, great: 1, good: 2 };
    deduplicatedPicks.sort((a, b) => {
      if (levelOrder[a._valueLevel] !== levelOrder[b._valueLevel]) {
        return levelOrder[a._valueLevel] - levelOrder[b._valueLevel];
      }
      return a._gap - b._gap;
    });
    
    return { picks: deduplicatedPicks.slice(0, 15), isMultiTier: true, message: '' };
  };

  // === TRUE SPLITS CALCULATION ===
  // Calculate IP-weighted pitching splits and AB-weighted batting splits
  const getTrueSplits = () => {
    if (!tournamentData) return null;
    
    // Pitching splits (IP-weighted)
    let leftIP = 0, rightIP = 0;
    (tournamentData.pitching || []).forEach(p => {
      const ip = parseFloat(p.ip) || 0;
      const throws = (p.throws || 'R').toUpperCase();
      if (throws === 'L') leftIP += ip;
      else rightIP += ip;
    });
    const totalIP = leftIP + rightIP;
    const pitchingLeft = totalIP > 0 ? Math.round((leftIP / totalIP) * 100) : 0;
    const pitchingRight = totalIP > 0 ? Math.round((rightIP / totalIP) * 100) : 0;
    
    // Batting splits (AB-weighted)
    let leftAB = 0, switchAB = 0, rightAB = 0;
    (tournamentData.batting || []).forEach(p => {
      const ab = parseFloat(p.ab) || 0;
      const bats = (p.bats || 'R').toUpperCase();
      if (bats === 'L') leftAB += ab;
      else if (bats === 'S') switchAB += ab;
      else rightAB += ab;
    });
    const totalAB = leftAB + switchAB + rightAB;
    const battingLeft = totalAB > 0 ? Math.round((leftAB / totalAB) * 100) : 0;
    const battingSwitch = totalAB > 0 ? Math.round((switchAB / totalAB) * 100) : 0;
    const battingRight = totalAB > 0 ? Math.round((rightAB / totalAB) * 100) : 0;
    
    return {
      pitching: { left: pitchingLeft, right: pitchingRight, totalIP },
      batting: { left: battingLeft, switch: battingSwitch, right: battingRight, totalAB }
    };
  };

  const filledCount = Object.keys(roster).length;
  const scarcityAlerts = draftStarted ? getScarcityAlert() : [];

  // Render Setup Screen
  if (!draftStarted) {
    const groupedTournaments = {
      tournaments: tournaments.filter(t => t.category === 'tournaments' || !t.category),
      drafts: tournaments.filter(t => t.category === 'drafts')
    };

    return (
      <Layout notification={notification}>
        <div style={{ maxWidth: 600, margin: '40px auto', padding: 20 }}>
          <h1 style={{ color: theme.textPrimary, marginBottom: 8 }}>🎯 Draft Assistant</h1>
          <p style={{ color: theme.textMuted, marginBottom: 32 }}>Set up your draft to get position recommendations and track picks.</p>

          <div style={{ background: theme.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${theme.border}` }}>
            {/* Tournament Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: theme.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                Select Tournament
              </label>
              <select 
                value={selectedTournamentId} 
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                style={{ 
                  width: '100%', padding: 12, borderRadius: 8, 
                  background: theme.inputBg, color: theme.textPrimary, 
                  border: `1px solid ${theme.border}`, fontSize: 14 
                }}
              >
                <option value="">Choose a tournament...</option>
                {groupedTournaments.tournaments.length > 0 && (
                  <optgroup label="Tournaments">
                    {groupedTournaments.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
                {groupedTournaments.drafts.length > 0 && (
                  <optgroup label="Drafts">
                    {groupedTournaments.drafts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Draft Size & DH */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', color: theme.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                  Draft Size
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => setDraftSize(26)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`,
                      background: draftSize === 26 ? theme.accent : theme.inputBg,
                      color: draftSize === 26 ? '#fff' : theme.textPrimary,
                      cursor: 'pointer', fontWeight: 600
                    }}
                  >26</button>
                  <button 
                    onClick={() => setDraftSize(32)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`,
                      background: draftSize === 32 ? theme.accent : theme.inputBg,
                      color: draftSize === 32 ? '#fff' : theme.textPrimary,
                      cursor: 'pointer', fontWeight: 600
                    }}
                  >32</button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: theme.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                  League Type
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => setHasDH(true)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`,
                      background: hasDH ? theme.accent : theme.inputBg,
                      color: hasDH ? '#fff' : theme.textPrimary,
                      cursor: 'pointer', fontWeight: 600
                    }}
                  >DH</button>
                  <button 
                    onClick={() => setHasDH(false)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`,
                      background: !hasDH ? theme.accent : theme.inputBg,
                      color: !hasDH ? '#fff' : theme.textPrimary,
                      cursor: 'pointer', fontWeight: 600
                    }}
                  >No DH</button>
                </div>
              </div>
            </div>

            {/* Card Pool */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: theme.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                Card Pool Available
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'perfect', label: 'Perfect (100+)', color: '#a855f7' },
                  { key: 'diamond', label: 'Diamond (90-99)', color: '#32EBFC' },
                  { key: 'gold', label: 'Gold (80-89)', color: '#FFE61F' },
                  { key: 'silver', label: 'Silver (70-79)', color: '#E0E0E0' },
                  { key: 'bronze', label: 'Bronze (60-69)', color: '#664300' },
                  { key: 'iron', label: 'Iron (<60)', color: '#4a4a4a' },
                ].map(tier => (
                  <label 
                    key={tier.key}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 6, 
                      padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                      background: cardPool[tier.key] ? tier.color + '22' : theme.inputBg,
                      border: `1px solid ${cardPool[tier.key] ? tier.color : theme.border}`,
                      color: cardPool[tier.key] ? tier.color : theme.textMuted
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={cardPool[tier.key]}
                      onChange={(e) => setCardPool(prev => ({ ...prev, [tier.key]: e.target.checked }))}
                    />
                    {tier.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button 
              onClick={startDraft}
              disabled={!selectedTournamentId}
              style={{
                width: '100%', padding: 16, borderRadius: 8, border: 'none',
                background: selectedTournamentId ? theme.accent : theme.inputBg,
                color: selectedTournamentId ? '#fff' : theme.textMuted,
                fontSize: 16, fontWeight: 600, cursor: selectedTournamentId ? 'pointer' : 'not-allowed'
              }}
            >
              Start Draft
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Render Main Draft View
  const positionTabs = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', ...(hasDH ? ['DH'] : []), 'SP'];
  const currentAvailable = getAvailablePlayers(activePositionTab, 10);

  // For compact mode, render without Layout wrapper
  if (isCompactMode) {
    return (
      <div style={{ background: theme.mainBg, minHeight: '100vh', color: theme.textPrimary }}>
        {notification && (
          <div style={{ position: 'fixed', top: 16, right: 16, padding: '12px 20px', borderRadius: 8, zIndex: 1001, background: notification.type === 'error' ? theme.error : theme.success, color: '#fff' }}>
            {notification.message}
          </div>
        )}
        <div style={{ padding: 14, maxWidth: '100%', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ color: theme.textPrimary, margin: 0, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🎯 {tournamentData?.name}
              </h1>
              <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: 13 }}>
                {draftSize} picks • {hasDH ? 'DH' : 'No DH'} • {filledCount}/{draftSize} filled
              </p>
              {/* True Splits - Compact */}
              {(() => {
                const splits = getTrueSplits();
                if (!splits) return null;
                const tooltipText = "True splits are calculated based on IP (pitching) and AB (batting) rather than raw player counts.";
                return (
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, flexWrap: 'wrap' }}>
                    <span style={{ color: theme.textSecondary, cursor: 'help' }} title={tooltipText}>
                      <span style={{ color: theme.textMuted }}>P ⓘ:</span>{' '}
                      <span style={{ color: '#f87171' }}>{splits.pitching.left}%L</span>
                      {'/'}
                      <span style={{ color: '#60a5fa' }}>{splits.pitching.right}%R</span>
                    </span>
                    <span style={{ color: theme.textSecondary, cursor: 'help' }} title={tooltipText}>
                      <span style={{ color: theme.textMuted }}>B ⓘ:</span>{' '}
                      <span style={{ color: '#f87171' }}>{splits.batting.left}%L</span>
                      {'/'}
                      <span style={{ color: '#a78bfa' }}>{splits.batting.switch}%S</span>
                      {'/'}
                      <span style={{ color: '#60a5fa' }}>{splits.batting.right}%R</span>
                    </span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setShowQuickGuide(true)} style={{ padding: '8px 12px', borderRadius: 6, background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>HELP</button>
              <button onClick={resetDraft} style={{ padding: '8px 12px', borderRadius: 6, background: theme.warning, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>↺</button>
              <button onClick={exitDraft} style={{ padding: '8px 12px', borderRadius: 6, background: theme.error, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          </div>

          {/* Scarcity Alerts */}
          {scarcityAlerts.length > 0 && (
            <div style={{ 
              background: theme.warning + '22', border: `1px solid ${theme.warning}`, 
              borderRadius: 8, padding: 10, marginBottom: 12 
            }}>
              {scarcityAlerts.map((alert, i) => (
                <div key={i} style={{ 
                  color: alert.type === 'quality' ? '#a855f7' : theme.warning, 
                  fontSize: 12,
                  marginBottom: i < scarcityAlerts.length - 1 ? 4 : 0
                }}>
                  {alert.type === 'quality' ? '🛡️' : '⚠️'} {alert.message}
                </div>
              ))}
            </div>
          )}

          {/* Card Pool Toggles */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: theme.textMuted, fontSize: 12, alignSelf: 'center' }}>Pool:</span>
            {[
              { key: 'perfect', label: 'Perf', color: '#a855f7' },
              { key: 'diamond', label: 'Dia', color: '#32EBFC' },
              { key: 'gold', label: 'Gold', color: '#FFE61F' },
              { key: 'silver', label: 'Silv', color: '#E0E0E0' },
              { key: 'bronze', label: 'Brnz', color: '#664300' },
              { key: 'iron', label: 'Iron', color: '#4a4a4a' },
            ].map(tier => (
              <button 
                key={tier.key}
                onClick={() => setCardPool(prev => ({ ...prev, [tier.key]: !prev[tier.key] }))}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                  background: cardPool[tier.key] ? tier.color : 'transparent',
                  color: cardPool[tier.key] ? (tier.key === 'gold' || tier.key === 'silver' ? '#000' : '#fff') : tier.color,
                  border: `1px solid ${tier.color}`,
                  cursor: 'pointer', opacity: cardPool[tier.key] ? 1 : 0.5
                }}
              >
                {tier.label}
              </button>
            ))}
            {/* LDS Toggle - Compact */}
            <button 
              onClick={() => setLowDataMode(!lowDataMode)}
              title="Low Data Support: Lowers thresholds to 99 AB / 20 IP"
              style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: lowDataMode ? '#f59e0b' : 'transparent',
                color: lowDataMode ? '#000' : '#f59e0b',
                border: `1px solid #f59e0b`,
                cursor: 'pointer', marginLeft: 'auto'
              }}
            >
              LDS
            </button>
          </div>

          {/* Available Players Panel */}
          <div style={{ background: theme.cardBg, borderRadius: 12, padding: 14, border: `1px solid ${theme.border}`, marginBottom: 12 }}>
            {/* Search */}
            <div style={{ marginBottom: 12 }}>
              <input 
                type="text"
                placeholder="🔍 Search player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{
                  width: '100%', padding: 10, borderRadius: 8,
                  background: theme.inputBg, color: theme.textPrimary,
                  border: `1px solid ${theme.border}`, fontSize: 14
                }}
              />
              {searchQuery.trim() && (
                <div 
                  style={{ 
                    marginTop: 6, background: theme.panelBg, borderRadius: 8, 
                    border: `1px solid ${theme.border}`, maxHeight: 220, overflowY: 'auto' 
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {searchResults.map((p, i) => {
                    const tier = getCardTierLabel(p.ovr);
                    const isPitch = p.type === 'pitching';
                    const hand = isPitch ? (p.throws || 'R') : (p.bats || 'R');
                    const handLabel = hand === 'S' ? 'S' : hand === 'L' ? 'L' : 'R';
                    return (
                      <div key={i} style={{ 
                        display: 'flex', alignItems: 'center', gap: 6, padding: 8,
                        borderBottom: `1px solid ${theme.border}`,
                        cursor: 'pointer', fontSize: 13,
                        background: tier.color + '15',
                        borderLeft: `3px solid ${tier.color}`
                      }}
                      onClick={() => setShowPlayerModal(p)}
                      >
                        <span style={{ color: tier.color, fontWeight: 600 }}>{p.ovr}</span>
                        <span style={{ color: theme.textMuted, fontSize: 11 }}>{handLabel}</span>
                        <span style={{ flex: 1, color: theme.textPrimary }}>{p.name}</span>
                        <span style={{ color: theme.textSecondary, fontSize: 11 }}>
                          {isPitch ? `${p.siera || p.era} · ${p.ip || '—'} IP` : `${p.woba} · ${p.ab || '—'} AB`}
                        </span>
                      </div>
                    );
                  })}
                  {/* Add placeholder option */}
                  <div 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 6, padding: 8,
                      cursor: 'pointer', background: theme.inputBg, fontSize: 13
                    }}
                    onClick={() => { setShowPlaceholderModal('search'); setPlaceholderName(searchQuery); }}
                  >
                    <span style={{ color: theme.warning, fontWeight: 600 }}>+</span>
                    <span style={{ color: theme.textSecondary }}>
                      {searchResults.length === 0 ? `Add "${searchQuery}" as custom...` : `Add custom player...`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Position Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {positionTabs.map(pos => {
                const isActive = activePositionTab === pos;
                return (
                  <button
                    key={pos}
                    onClick={() => { setActivePositionTab(pos); setSearchQuery(''); }}
                    style={{
                      padding: '6px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: isActive ? theme.accent : theme.inputBg,
                      color: isActive ? '#fff' : theme.textMuted,
                      border: `1px solid ${isActive ? theme.accent : theme.border}`,
                      cursor: 'pointer'
                    }}
                  >{pos}</button>
                );
              })}
            </div>

            {/* Best Available List - Compact */}
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 8 }}>
              Best {activePositionTab} ({currentAvailable.length})
            </div>
            <div>
              {currentAvailable.map((p, i) => {
                const tier = getCardTierLabel(p.ovr);
                const isPitching = p._isPitching;
                const hand = isPitching ? (p.throws || 'R') : (p.bats || 'R');
                const handLabel = hand === 'S' ? 'S' : hand === 'L' ? 'L' : 'R';
                // T1+ (purple) for elite defense + T1/T2, otherwise regular tier badges
                const tierBadge = p._isT1Plus 
                  ? { label: 'T1+', color: '#a855f7' }  // Purple for T1+
                  : p._tier <= 2 
                    ? { label: `T${p._tier}`, color: p._tier === 1 ? '#22c55e' : '#fbbf24' } 
                    : null;
                // Use pre-calculated shield status
                const showEliteDefShield = p._hasShield;
                return (
                  <div key={p.id || i} style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', 
                    background: tier.color + '12', borderRadius: 6, marginBottom: 5, cursor: 'pointer',
                    border: `1px solid ${theme.border}`,
                    borderLeft: p._isT1Plus 
                      ? `3px solid transparent` 
                      : `3px solid ${tier.color}`,
                    borderImage: p._isT1Plus 
                      ? `linear-gradient(to right, #a855f7, ${tier.color}) 1`
                      : 'none'
                  }}
                  onClick={() => setShowPlayerModal({ ...p, type: isPitching ? 'pitching' : 'batting' })}
                  >
                    <span style={{ color: tier.color, fontWeight: 700, fontSize: 14 }}>{p.ovr}</span>
                    <span style={{ color: theme.textMuted, fontSize: 11 }}>{handLabel}</span>
                    <span style={{ color: theme.textPrimary, flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {showEliteDefShield && <span style={{ color: '#3b82f6', fontSize: 11 }} title="Elite Defense (100+) at key position">🛡️</span>}
                    {tierBadge && <span style={{ color: tierBadge.color, fontSize: 11, fontWeight: 600 }}>{tierBadge.label}</span>}
                    <span style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {isPitching ? `${p.siera || p.era} · ${p.ip || '—'} IP` : `${p.woba} · ${p.ab || '—'} AB`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Roster Panel */}
          <div style={{ background: theme.cardBg, borderRadius: 12, padding: 12, border: `1px solid ${theme.border}` }}>
            <h3 style={{ color: theme.textPrimary, margin: '0 0 10px 0', fontSize: 14 }}>Roster ({filledCount}/{draftSize})</h3>
            
            {/* Compact roster - 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, fontSize: 11 }}>
              {[...battingPositions, ...pitchingPositions].map(pos => (
                <div key={pos} style={{ 
                  padding: 4, background: roster[pos] ? theme.success + '22' : theme.inputBg, 
                  borderRadius: 4, border: `1px solid ${roster[pos] ? theme.success : theme.border}`,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                }}>
                  <span style={{ color: theme.textMuted, fontWeight: 600 }}>{pos}: </span>
                  {roster[pos] ? (
                    <span style={{ color: theme.textPrimary }}>{roster[pos].name.split(' ').pop()}</span>
                  ) : (
                    <span style={{ color: theme.textMuted }}>—</span>
                  )}
                </div>
              ))}
            </div>
            
            {/* Bench count */}
            <div style={{ marginTop: 6, fontSize: 10, color: theme.textMuted }}>
              Bench: {Object.keys(roster).filter(k => k.startsWith('BENCH')).length}/{benchCount}
            </div>
          </div>
        </div>

        {/* Player Modal */}
        {showPlayerModal && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowPlayerModal(null)}
          >
            <div 
              style={{ background: theme.cardBg, borderRadius: 12, padding: 20, maxWidth: 350, width: '95%', border: `1px solid ${theme.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ color: theme.textPrimary, margin: 0, fontSize: 16 }}>{showPlayerModal.name}</h3>
                  <p style={{ color: theme.textMuted, margin: '4px 0 0 0', fontSize: 12 }}>
                    {showPlayerModal.pos} · <span style={{ color: getCardTierLabel(showPlayerModal.ovr).color }}>{showPlayerModal.ovr} OVR</span>
                    {showPlayerModal.type !== 'pitching' && showPlayerModal.def && <span> · <span style={{ color: getDefColor(showPlayerModal.def) }}>{showPlayerModal.def} DEF</span></span>}
                  </p>
                </div>
                <button onClick={() => setShowPlayerModal(null)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>

              {/* Stats */}
              <div style={{ background: theme.panelBg, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11 }}>
                {showPlayerModal.type === 'pitching' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: theme.textMuted }}>SIERA:</span> <span style={{ color: theme.accent }}>{showPlayerModal.siera || '—'}</span></div>
                    <div><span style={{ color: theme.textMuted }}>ERA:</span> {showPlayerModal.era || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>FIP-:</span> <span style={{ color: theme.accent }}>{showPlayerModal.fipMinus || '—'}</span></div>
                    <div><span style={{ color: theme.textMuted }}>WHIP:</span> {showPlayerModal.whip || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>IP:</span> {showPlayerModal.ip || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>K/9:</span> {showPlayerModal.k9 || '—'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: theme.textMuted }}>wOBA:</span> <span style={{ color: theme.accent }}>{showPlayerModal.woba || '—'}</span></div>
                    <div><span style={{ color: theme.textMuted }}>OPS+:</span> <span style={{ color: theme.accent }}>{showPlayerModal.opsPlus || '—'}</span></div>
                    <div><span style={{ color: theme.textMuted }}>AVG:</span> {showPlayerModal.avg || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>OBP:</span> {showPlayerModal.obp || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>SLG:</span> {showPlayerModal.slg || '—'}</div>
                    <div><span style={{ color: theme.textMuted }}>AB:</span> {showPlayerModal.ab || '—'}</div>
                  </div>
                )}
              </div>

              {/* Add to Roster */}
              <div style={{ marginBottom: 8, fontSize: 11, color: theme.textMuted }}>Add to roster:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {getEmptySlots(showPlayerModal.type === 'pitching' ? 'pitching' : 'batting').slice(0, 8).map(slot => (
                  <button
                    key={slot}
                    onClick={() => {
                      addToRoster(slot, showPlayerModal);
                      setShowPlayerModal(null);
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: 4, fontSize: 10,
                      background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer'
                    }}
                  >{slot}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Placeholder Player Modal */}
        {showPlaceholderModal && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowPlaceholderModal(null)}
          >
            <div 
              style={{ background: theme.cardBg, borderRadius: 12, padding: 20, maxWidth: 320, width: '95%', border: `1px solid ${theme.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ color: theme.textPrimary, margin: '0 0 12px 0', fontSize: 16 }}>Add Custom Player</h3>
              
              <div style={{ marginBottom: 12 }}>
                <input 
                  type="text"
                  placeholder="Player name..."
                  value={placeholderName}
                  onChange={(e) => setPlaceholderName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: 8, borderRadius: 6,
                    background: theme.inputBg, color: theme.textPrimary,
                    border: `1px solid ${theme.border}`, fontSize: 12
                  }}
                />
              </div>

              {showPlaceholderModal === 'search' ? (
                <>
                  <p style={{ color: theme.textMuted, fontSize: 11, marginBottom: 6 }}>Select position:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {allSlots.filter(s => !roster[s]).slice(0, 15).map(slot => (
                      <button 
                        key={slot}
                        onClick={() => addPlaceholder(slot, placeholderName)}
                        disabled={!placeholderName.trim()}
                        style={{
                          padding: '4px 8px', borderRadius: 4, fontSize: 10,
                          background: placeholderName.trim() ? theme.accent : theme.inputBg, 
                          color: placeholderName.trim() ? '#fff' : theme.textMuted,
                          border: `1px solid ${placeholderName.trim() ? theme.accent : theme.border}`, 
                          cursor: placeholderName.trim() ? 'pointer' : 'not-allowed'
                        }}
                      >{slot.replace('BENCH', 'B')}</button>
                    ))}
                  </div>
                </>
              ) : (
                <button 
                  onClick={() => addPlaceholder(showPlaceholderModal, placeholderName)}
                  disabled={!placeholderName.trim()}
                  style={{
                    width: '100%', padding: 10, borderRadius: 6,
                    background: placeholderName.trim() ? theme.accent : theme.inputBg,
                    color: placeholderName.trim() ? '#fff' : theme.textMuted,
                    border: 'none', cursor: placeholderName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 600, marginBottom: 8
                  }}
                >Add to {showPlaceholderModal}</button>
              )}
              
              <button 
                onClick={() => setShowPlaceholderModal(null)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: theme.inputBg, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 11 }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Quick Start Guide Modal */}
        {showQuickGuide && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowQuickGuide(false)}
          >
            <div 
              style={{ 
                background: theme.cardBg, borderRadius: 12, padding: 20, maxWidth: 400, width: '95%', 
                border: `1px solid ${theme.border}`, maxHeight: '90vh', overflowY: 'auto' 
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 18 }}>📋 Quick Guide</h2>
                <button onClick={() => setShowQuickGuide(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.6 }}>
                <p><strong style={{ color: theme.textPrimary }}>Search:</strong> Find any player by name</p>
                <p><strong style={{ color: theme.textPrimary }}>Position Tabs:</strong> Browse best available by position</p>
                <p><strong style={{ color: theme.textPrimary }}>Pool Toggles:</strong> Filter by card tier</p>
                <p><strong style={{ color: theme.textPrimary }}>Click Player:</strong> View stats and add to roster</p>
                <p><strong style={{ color: theme.textPrimary }}>+ Custom:</strong> Add placeholder for unlisted players</p>
                <p style={{ marginTop: 8 }}>
                  <strong style={{ color: theme.textPrimary }}>Tiers:</strong>{' '}
                  <span style={{ color: '#a855f7' }}>T1+</span> (elite + shield) →{' '}
                  <span style={{ color: '#22c55e' }}>T1</span> →{' '}
                  <span style={{ color: '#fbbf24' }}>T2</span>
                </p>
                <p>
                  <strong style={{ color: theme.textPrimary }}>🛡️ Shield:</strong> Elite defense (100+) at C, 2B, SS, CF
                </p>
                <p>
                  <strong style={{ color: '#f59e0b' }}>LDS:</strong> Low Data Support - lowers thresholds (99 AB / 20 IP)
                </p>
                <p style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
                  Batters ranked by wOBA · Pitchers ranked by SIERA (lower = better)
                </p>
              </div>
              <button 
                onClick={() => setShowQuickGuide(false)}
                style={{ width: '100%', marginTop: 16, padding: 10, borderRadius: 6, background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
              >Got it!</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal mode uses Layout wrapper

  return (
    <Layout notification={notification}>
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: theme.textPrimary, margin: 0, fontSize: 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🎯 Draft Assistant - {tournamentData?.name}
            </h1>
            <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: 13 }}>
              {draftSize} picks • {hasDH ? 'DH' : 'No DH'} • {filledCount}/{draftSize} filled
            </p>
            {/* True Splits */}
            {(() => {
              const splits = getTrueSplits();
              if (!splits) return null;
              const tooltipText = "True splits are calculated based on IP (pitching) and AB (batting) rather than raw player counts, giving a more accurate picture of the pool.";
              return (
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
                  <span 
                    style={{ color: theme.textSecondary, cursor: 'help', borderBottom: `1px dashed ${theme.textMuted}` }}
                    title={tooltipText}
                  >
                    <span style={{ color: theme.textMuted }}>True Pitching ⓘ:</span>{' '}
                    <span style={{ color: '#f87171' }}>{splits.pitching.left}% L</span>
                    {' / '}
                    <span style={{ color: '#60a5fa' }}>{splits.pitching.right}% R</span>
                  </span>
                  <span 
                    style={{ color: theme.textSecondary, cursor: 'help', borderBottom: `1px dashed ${theme.textMuted}` }}
                    title={tooltipText}
                  >
                    <span style={{ color: theme.textMuted }}>True Batting ⓘ:</span>{' '}
                    <span style={{ color: '#f87171' }}>{splits.batting.left}% L</span>
                    {' / '}
                    <span style={{ color: '#a78bfa' }}>{splits.batting.switch}% S</span>
                    {' / '}
                    <span style={{ color: '#60a5fa' }}>{splits.batting.right}% R</span>
                  </span>
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={popOutWindow} style={{ padding: '8px 16px', borderRadius: 6, background: theme.panelBg, color: theme.textPrimary, border: `1px solid ${theme.border}`, cursor: 'pointer' }} title="Open in smaller window for side-by-side use">↗️ Pop Out</button>
            <button onClick={() => setShowQuickGuide(true)} style={{ padding: '8px 16px', borderRadius: 6, background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>HELP</button>
            <button onClick={resetDraft} style={{ padding: '8px 16px', borderRadius: 6, background: theme.warning, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>Reset</button>
            <button onClick={exitDraft} style={{ padding: '8px 16px', borderRadius: 6, background: theme.error, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>Exit Draft</button>
          </div>
        </div>

        {/* Scarcity Alerts */}
        {scarcityAlerts.length > 0 && (
          <div style={{ 
            background: theme.warning + '22', border: `1px solid ${theme.warning}`, 
            borderRadius: 8, padding: 12, marginBottom: 16 
          }}>
            {scarcityAlerts.map((alert, i) => (
              <div key={i} style={{ 
                color: alert.type === 'quality' ? '#a855f7' : theme.warning, 
                fontSize: 13,
                marginBottom: i < scarcityAlerts.length - 1 ? 4 : 0
              }}>
                {alert.type === 'quality' ? '🛡️' : '⚠️'} {alert.message}
              </div>
            ))}
          </div>
        )}

        {/* Card Pool Toggles */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: theme.textMuted, fontSize: 12, alignSelf: 'center' }}>Pool:</span>
          {[
            { key: 'perfect', label: 'Perf', color: '#a855f7' },
            { key: 'diamond', label: 'Dia', color: '#32EBFC' },
            { key: 'gold', label: 'Gold', color: '#FFE61F' },
            { key: 'silver', label: 'Silv', color: '#E0E0E0' },
            { key: 'bronze', label: 'Brnz', color: '#664300' },
            { key: 'iron', label: 'Iron', color: '#4a4a4a' },
          ].map(tier => (
            <button 
              key={tier.key}
              onClick={() => setCardPool(prev => ({ ...prev, [tier.key]: !prev[tier.key] }))}
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: cardPool[tier.key] ? tier.color : 'transparent',
                color: cardPool[tier.key] ? (tier.key === 'gold' || tier.key === 'silver' ? '#000' : '#fff') : tier.color,
                border: `1px solid ${tier.color}`,
                cursor: 'pointer', opacity: cardPool[tier.key] ? 1 : 0.5
              }}
            >
              {tier.label}
            </button>
          ))}
          
          {/* LDS Toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button 
              onClick={() => setLowDataMode(!lowDataMode)}
              title="Low Data Support: Lowers confidence thresholds to 99 AB / 20 IP, allowing more players to appear in results. Recommended for tournaments with limited data."
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: lowDataMode ? '#f59e0b' : 'transparent',
                color: lowDataMode ? '#000' : '#f59e0b',
                border: `1px solid #f59e0b`,
                cursor: 'pointer'
              }}
            >
              LDS {lowDataMode ? 'ON' : 'OFF'}
            </button>
            <span style={{ color: theme.textMuted, fontSize: 10, cursor: 'help' }} title="Low Data Support: Lowers confidence thresholds to 99 AB / 20 IP">ⓘ</span>
          </div>
        </div>

        {/* Heuristics Legend */}
        <div style={{ 
          display: 'flex', gap: 16, marginBottom: 16, padding: '8px 12px', 
          background: theme.panelBg, borderRadius: 6, fontSize: 11, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <span style={{ color: theme.textMuted }}>Confidence:</span>
          <span><span style={{ color: '#22c55e' }}>◆</span> Trusted</span>
          <span><span style={{ color: '#86efac' }}>●</span> High</span>
          <span style={{ color: theme.textMuted }}>|</span>
          <span style={{ color: theme.textMuted }}>Tier:</span>
          <span><span style={{ color: '#22c55e' }}>T1</span> Elite</span>
          <span><span style={{ color: '#fbbf24' }}>T2</span> Good</span>
          <span><span style={{ color: theme.textMuted }}>T3+</span> Below gap</span>
          <span style={{ color: theme.textMuted, marginLeft: 'auto', fontSize: 10 }}>
            Low confidence hidden • SP's shown for all pitching slots
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 300px', gap: 20 }}>
          {/* Roster */}
          <div style={{ background: theme.cardBg, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}` }}>
            <h3 style={{ color: theme.textPrimary, margin: '0 0 12px 0', fontSize: 16 }}>Your Roster ({filledCount}/{draftSize})</h3>
            
            {/* Batting */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: theme.textMuted, fontSize: 10, fontWeight: 600, marginBottom: 6 }}>BATTING</div>
              {battingPositions.map(pos => (
                <div key={pos} style={{ 
                      display: 'flex', alignItems: 'center', gap: 6, padding: 8, 
                      background: roster[pos] ? theme.success + '22' : theme.inputBg, 
                      borderRadius: 6, marginBottom: 3, border: `1px solid ${roster[pos] ? theme.success : theme.border}`
                    }}>
                      <span style={{ width: 26, fontWeight: 600, color: theme.textMuted, fontSize: 11 }}>{pos}</span>
                      {roster[pos] ? (
                        <>
                          <span style={{ flex: 1, color: theme.textPrimary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {roster[pos].name} 
                            {roster[pos].isPlaceholder ? (
                              <span style={{ color: theme.warning, marginLeft: 4, fontSize: 10 }}>(custom)</span>
                            ) : (
                              <span style={{ color: getCardTierLabel(roster[pos].ovr).color, marginLeft: 4 }}>
                                {roster[pos].ovr}
                              </span>
                            )}
                          </span>
                          {!roster[pos].isPlaceholder && <button onClick={() => setEditingSlot(pos)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 11 }}>✎</button>}
                          <button onClick={() => removeFromRoster(pos)} style={{ background: 'transparent', border: 'none', color: theme.error, cursor: 'pointer', fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span 
                            onClick={() => setActivePositionTab(pos === 'DH' ? 'DH' : pos)}
                            style={{ color: theme.textMuted, fontSize: 12, cursor: 'pointer' }}
                          >Empty</span>
                          <button 
                            onClick={() => { setShowPlaceholderModal(pos); setPlaceholderName(''); }}
                            style={{ padding: '2px 6px', borderRadius: 4, background: theme.panelBg, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 10 }}
                          >+ Custom</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pitching */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>PITCHING</div>
                  {pitchingPositions.map(pos => (
                    <div key={pos} style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, padding: 8, 
                      background: roster[pos] ? theme.success + '22' : theme.inputBg, 
                      borderRadius: 6, marginBottom: 4, border: `1px solid ${roster[pos] ? theme.success : theme.border}`
                    }}>
                      <span style={{ width: 28, fontWeight: 600, color: theme.textMuted, fontSize: 12 }}>{pos}</span>
                      {roster[pos] ? (
                        <>
                          <span style={{ flex: 1, color: theme.textPrimary, fontSize: 13 }}>
                            {roster[pos].name}
                            {roster[pos].isPlaceholder ? (
                              <span style={{ color: theme.warning, marginLeft: 4, fontSize: 10 }}>(custom)</span>
                            ) : (
                              <span style={{ color: getCardTierLabel(roster[pos].ovr).color, marginLeft: 4 }}>
                                {roster[pos].ovr}
                              </span>
                            )}
                          </span>
                          {!roster[pos].isPlaceholder && <button onClick={() => setEditingSlot(pos)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 12 }}>✎</button>}
                          <button onClick={() => removeFromRoster(pos)} style={{ background: 'transparent', border: 'none', color: theme.error, cursor: 'pointer', fontSize: 12 }}>×</button>
                        </>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span 
                            onClick={() => setActivePositionTab('SP')}
                            style={{ color: theme.textMuted, fontSize: 12, cursor: 'pointer' }}
                          >Empty</span>
                          <button 
                            onClick={() => { setShowPlaceholderModal(pos); setPlaceholderName(''); }}
                            style={{ padding: '2px 6px', borderRadius: 4, background: theme.panelBg, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 10 }}
                          >+ Custom</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bench */}
                <div>
                  <div style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>BENCH ({Object.keys(roster).filter(k => k.startsWith('BENCH')).length}/{benchCount})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {benchSlots.map(slot => (
                      <div key={slot} style={{ 
                        width: 'calc(50% - 2px)', padding: 6, 
                        background: roster[slot] ? theme.success + '22' : theme.inputBg, 
                        borderRadius: 4, border: `1px solid ${roster[slot] ? theme.success : theme.border}`,
                        fontSize: 11
                      }}>
                        {roster[slot] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ flex: 1, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {roster[slot].name}
                            </span>
                            <button onClick={() => removeFromRoster(slot)} style={{ background: 'transparent', border: 'none', color: theme.error, cursor: 'pointer', fontSize: 10, padding: 0 }}>×</button>
                          </div>
                        ) : (
                          <span style={{ color: theme.textMuted }}>—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* NORMAL MODE - Available Players Second */}
              <div style={{ background: theme.cardBg, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}` }}>
                {/* Search */}
                <div style={{ marginBottom: 16 }}>
                  <input 
                    type="text"
                    placeholder="🔍 Quick search any player..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    style={{
                      width: '100%', padding: 12, borderRadius: 8,
                      background: theme.inputBg, color: theme.textPrimary,
                      border: `1px solid ${theme.border}`, fontSize: 14
                    }}
                  />
                  {searchQuery.trim() && (
                    <div 
                      style={{ 
                        marginTop: 8, background: theme.panelBg, borderRadius: 8, 
                        border: `1px solid ${theme.border}`, maxHeight: 300, overflowY: 'auto' 
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {searchResults.map((p, i) => {
                        const tier = getCardTierLabel(p.ovr);
                        const isPitch = p.type === 'pitching';
                        const hand = isPitch ? (p.throws || 'R') : (p.bats || 'R');
                        const handLabel = hand === 'S' ? 'S' : hand === 'L' ? 'L' : 'R';
                        return (
                          <div key={i} style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                            borderBottom: `1px solid ${theme.border}`,
                            cursor: 'pointer',
                            background: tier.color + '15',
                            borderLeft: `3px solid ${tier.color}`
                          }}
                          onClick={() => setShowPlayerModal(p)}
                          >
                            <span style={{ color: tier.color, fontWeight: 600, minWidth: 28 }}>{p.ovr}</span>
                            <span style={{ color: theme.textMuted, fontSize: 10, minWidth: 12 }}>{handLabel}</span>
                            <span style={{ flex: 1, color: theme.textPrimary }}>{p.name}</span>
                            <span style={{ color: theme.textMuted, fontSize: 12 }}>{p.pos}</span>
                            <span style={{ color: theme.textSecondary, fontSize: 11 }}>
                              {isPitch 
                                ? `${p.siera || p.era || '—'} ${p.siera ? 'SIERA' : 'ERA'} · ${p.ip || '—'} IP`
                                : `${p.woba || '—'} wOBA · ${p.ab || '—'} AB`
                              }
                            </span>
                          </div>
                        );
                      })}
                      {/* Add placeholder option */}
                      <div 
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                          cursor: 'pointer', background: theme.inputBg
                        }}
                        onClick={() => { setShowPlaceholderModal('search'); setPlaceholderName(searchQuery); }}
                      >
                        <span style={{ color: theme.warning, fontWeight: 600 }}>+</span>
                        <span style={{ flex: 1, color: theme.textSecondary }}>
                          {searchResults.length === 0 
                            ? `Add "${searchQuery}" as custom player...`
                            : `Can't find player? Add "${searchQuery}" as custom...`
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Position Tabs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {positionTabs.map(pos => {
                    const isActive = activePositionTab === pos;
                    return (
                      <button
                        key={pos}
                        onClick={() => { setActivePositionTab(pos); setSearchQuery(''); }}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: isActive ? theme.accent : theme.inputBg,
                          color: isActive ? '#fff' : theme.textMuted,
                          border: `1px solid ${isActive ? theme.accent : theme.border}`,
                          cursor: 'pointer'
                        }}
                      >{pos}</button>
                    );
                  })}
                </div>

                {/* Best Available List */}
                <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                  Best Available - {activePositionTab} (Top {currentAvailable.length})
                </div>
                <div>
                  {currentAvailable.map((p, i) => {
                    const tier = getCardTierLabel(p.ovr);
                    // T1+ (purple) for elite defense + T1/T2, otherwise regular tier badges
                    const tierBadge = p._isT1Plus 
                      ? { label: 'T1+', color: '#a855f7' }  // Purple for T1+
                      : p._tier <= 2 
                        ? { label: `T${p._tier}`, color: p._tier === 1 ? '#22c55e' : '#fbbf24' } 
                        : null;
                    const conf = p._confidence;
                    const isPitching = p._isPitching;
                    const hand = isPitching ? (p.throws || 'R') : (p.bats || 'R');
                    const handLabel = hand === 'S' ? 'S' : hand === 'L' ? 'L' : 'R';
                    // Use pre-calculated shield status
                    const showEliteDefShield = p._hasShield;
                    
                    return (
                      <div key={p.id || i} style={{ 
                        display: 'flex', alignItems: 'center', gap: 10, padding: 10, 
                        background: tier.color + '12', borderRadius: 8, marginBottom: 6,
                        border: `1px solid ${theme.border}`,
                        borderLeft: p._isT1Plus 
                          ? `3px solid transparent` 
                          : `3px solid ${tier.color}`,
                        borderImage: p._isT1Plus 
                          ? `linear-gradient(to right, #a855f7, ${tier.color}) 1`
                          : 'none'
                      }}>
                        {/* Rank + Tier */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30 }}>
                          <span style={{ color: theme.textMuted, fontSize: 11 }}>#{i + 1}</span>
                          {tierBadge && <span style={{ color: tierBadge.color, fontSize: 10, fontWeight: 600 }}>{tierBadge.label}</span>}
                        </div>
                        
                        {/* OVR Badge + Hand */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32 }}>
                          <span style={{ color: tier.color, fontWeight: 700, fontSize: 16 }}>{p.ovr}</span>
                          <span style={{ color: theme.textMuted, fontSize: 10 }}>{handLabel}</span>
                        </div>
                        
                        {/* Player Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: theme.textPrimary, fontWeight: 500 }}>{p.name}</span>
                            {showEliteDefShield && <span style={{ color: '#3b82f6', fontSize: 12 }} title="Elite Defense (100+) at key position">🛡️</span>}
                            <span style={{ color: conf.color, fontSize: 12 }} title={conf.desc}>{conf.label}</span>
                          </div>
                          <div style={{ color: theme.textMuted, fontSize: 11 }}>
                            {isPitching 
                              ? `${p.siera || p.era || '—'} ${p.siera ? 'SIERA' : 'ERA'} · ${p.ip || '—'} IP`
                              : `${p.woba || '—'} wOBA · ${p.opsPlus || '—'} OPS+ · ${p.ab || '—'} AB`
                            }
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <button 
                          onClick={() => setShowPlayerModal({ ...p, type: isPitching ? 'pitching' : 'batting' })}
                          style={{ padding: '6px 12px', borderRadius: 4, background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}
                        >View</button>
                      </div>
                    );
                  })}
                </div>
              </div>

          {/* Value Picks Panel */}
          {(() => {
            const { picks: valuePicks, isMultiTier, message } = getValuePicks();
            return (
              <div style={{ background: theme.cardBg, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}` }}>
                <h3 style={{ color: theme.textPrimary, margin: '0 0 4px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  💎 Value Picks
                </h3>
                <p style={{ color: theme.textMuted, fontSize: 11, margin: '0 0 12px 0' }}>
                  Lower tier cards with elite production
                </p>
                
                {!isMultiTier ? (
                  <div style={{ 
                    padding: 16, background: theme.inputBg, borderRadius: 8, 
                    color: theme.textMuted, fontSize: 12, textAlign: 'center' 
                  }}>
                    {message}
                  </div>
                ) : valuePicks.length === 0 ? (
                  <div style={{ 
                    padding: 16, background: theme.inputBg, borderRadius: 8, 
                    color: theme.textMuted, fontSize: 12, textAlign: 'center' 
                  }}>
                    No value picks found. Lower tier players aren't close enough to top performers.
                  </div>
                ) : (
                  <div>
                    {/* Group by value level */}
                    {['insane', 'great', 'good'].map(level => {
                      const levelPicks = valuePicks.filter(p => p._valueLevel === level);
                      if (levelPicks.length === 0) return null;
                      
                      const levelConfig = {
                        insane: { label: '🔥 Insane Value', color: '#f59e0b', desc: 'Within 0.015 wOBA / 0.3 SIERA' },
                        great: { label: '⭐ Great Value', color: '#22c55e', desc: 'Within 0.025 wOBA / 0.4 SIERA' },
                        good: { label: '👍 Good Value', color: '#3b82f6', desc: 'Within 0.040 wOBA / 0.5 SIERA' }
                      }[level];
                      
                      return (
                        <div key={level} style={{ marginBottom: 12 }}>
                          <div style={{ 
                            color: levelConfig.color, fontSize: 11, fontWeight: 600, 
                            marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 
                          }}>
                            {levelConfig.label}
                            <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: 10 }}>
                              ({levelConfig.desc})
                            </span>
                          </div>
                          {levelPicks.map((p, i) => {
                            const hand = p._isPitching ? (p.throws || 'R') : (p.bats || 'R');
                            const handLabel = hand === 'S' ? 'S' : hand === 'L' ? 'L' : 'R';
                            const gapDisplay = p._isPitching 
                              ? `+${p._gap.toFixed(2)} SIERA`
                              : `-${p._gap.toFixed(3)} wOBA`;
                            const pctOfBest = p._isPitching
                              ? Math.round((p._bestMetric / p._metric) * 100)
                              : Math.round((p._metric / p._bestMetric) * 100);
                            const positionsDisplay = p._positions ? p._positions.join('/') : p._position;
                            
                            return (
                              <div 
                                key={`${p.name}-${p.ovr}-${i}`}
                                onClick={() => setShowPlayerModal({ ...p, type: p._isPitching ? 'pitching' : 'batting' })}
                                style={{ 
                                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                  background: p._tierLabel.color + '15', borderRadius: 6, marginBottom: 4,
                                  border: `1px solid ${theme.border}`, borderLeft: `3px solid ${p._tierLabel.color}`,
                                  cursor: 'pointer', fontSize: 12
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28 }}>
                                  <span style={{ color: p._tierLabel.color, fontWeight: 700, fontSize: 13 }}>{p.ovr}</span>
                                  <span style={{ color: theme.textMuted, fontSize: 9 }}>{handLabel}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: theme.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.name}
                                  </div>
                                  <div style={{ color: theme.textMuted, fontSize: 10 }}>
                                    {positionsDisplay} · {p._tierLabel.label} · {pctOfBest}% of best
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 10 }}>
                                  <div style={{ color: theme.textSecondary }}>
                                    {p._isPitching ? p.siera || p.era : p.woba}
                                  </div>
                                  <div style={{ color: levelConfig.color }}>
                                    {gapDisplay}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Player Modal */}
        {showPlayerModal && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowPlayerModal(null)}
          >
            <div 
              style={{ background: theme.cardBg, borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', border: `1px solid ${theme.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ color: theme.textPrimary, margin: 0 }}>{showPlayerModal.name}</h3>
                  <p style={{ color: theme.textMuted, margin: '4px 0 0 0' }}>
                    {showPlayerModal.pos} · <span style={{ color: getCardTierLabel(showPlayerModal.ovr).color }}>{showPlayerModal.ovr} OVR</span>
                    {showPlayerModal.type !== 'pitching' && showPlayerModal.def && <span> · <span style={{ color: getDefColor(showPlayerModal.def) }}>{showPlayerModal.def} DEF</span></span>}
                  </p>
                </div>
                <button onClick={() => setShowPlayerModal(null)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>

              {/* Sample Size Confidence Banner */}
              {(() => {
                const isPitch = showPlayerModal.type === 'pitching';
                const conf = getSampleConfidence(showPlayerModal, isPitch);
                return (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', 
                    marginBottom: 12, borderRadius: 6,
                    background: conf.level === 'low' ? theme.warning + '22' : theme.success + '22',
                    border: `1px solid ${conf.color}`
                  }}>
                    <span style={{ color: conf.color, fontWeight: 700, fontSize: 14 }}>{conf.label}</span>
                    <span style={{ color: theme.textPrimary, fontSize: 12 }}>{conf.desc}</span>
                  </div>
                );
              })()}

              <div style={{ background: theme.panelBg, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {showPlayerModal.type === 'pitching' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>SIERA</div><div style={{ color: theme.accent, fontWeight: 600 }}>{showPlayerModal.siera || '—'}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>FIP-</div><div style={{ color: theme.accent, fontWeight: 600 }}>{showPlayerModal.fipMinus || '—'}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>ERA</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.era}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>K/9</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.kPer9}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>WHIP</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.whip}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>IP</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.ip}</div></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>wOBA</div><div style={{ color: theme.accent, fontWeight: 600 }}>{showPlayerModal.woba || '—'}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>OPS+</div><div style={{ color: theme.accent, fontWeight: 600 }}>{showPlayerModal.opsPlus || '—'}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>wRC+</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.wrcPlus}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>OPS</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.ops}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>AVG</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.avg}</div></div>
                    <div><div style={{ color: theme.textMuted, fontSize: 10 }}>PA</div><div style={{ color: theme.textPrimary, fontWeight: 600 }}>{showPlayerModal.pa}</div></div>
                  </div>
                )}
              </div>

              {/* Performance Tier */}
              {showPlayerModal._tier && (
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, 
                  padding: '6px 12px', background: theme.inputBg, borderRadius: 6
                }}>
                  <span style={{ color: theme.textMuted, fontSize: 11 }}>Performance Tier:</span>
                  <span style={{ 
                    fontWeight: 700, 
                    color: showPlayerModal._tier === 1 ? '#22c55e' : showPlayerModal._tier === 2 ? '#fbbf24' : theme.textMuted 
                  }}>
                    Tier {showPlayerModal._tier}
                    {showPlayerModal._tier === 1 && ' (Elite)'}
                    {showPlayerModal._tier === 2 && ' (Good)'}
                    {showPlayerModal._tier >= 3 && ' (Below gap)'}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Add to roster slot:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {getEmptySlots(showPlayerModal.type).map(slot => (
                    <button 
                      key={slot}
                      onClick={() => addToRoster(slot, showPlayerModal)}
                      style={{
                        padding: '6px 12px', borderRadius: 4, fontSize: 11,
                        background: theme.inputBg, color: theme.textPrimary,
                        border: `1px solid ${theme.border}`, cursor: 'pointer'
                      }}
                    >{slot.replace('BENCH', 'B')}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder Player Modal */}
        {showPlaceholderModal && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowPlaceholderModal(null)}
          >
            <div 
              style={{ background: theme.cardBg, borderRadius: 12, padding: 24, maxWidth: 350, width: '90%', border: `1px solid ${theme.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ color: theme.textPrimary, margin: '0 0 16px 0' }}>Add Custom Player</h3>
              <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
                Add a player that's not in the database (e.g., from a pack you just opened).
              </p>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: theme.textSecondary, marginBottom: 6, fontSize: 12 }}>Player Name</label>
                <input 
                  type="text"
                  placeholder="Enter player name..."
                  value={placeholderName}
                  onChange={(e) => setPlaceholderName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: 10, borderRadius: 6,
                    background: theme.inputBg, color: theme.textPrimary,
                    border: `1px solid ${theme.border}`, fontSize: 14
                  }}
                />
              </div>

              {showPlaceholderModal === 'search' ? (
                <>
                  <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>Select position:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                    {allSlots.filter(s => !roster[s]).map(slot => (
                      <button 
                        key={slot}
                        onClick={() => addPlaceholder(slot, placeholderName)}
                        disabled={!placeholderName.trim()}
                        style={{
                          padding: '6px 10px', borderRadius: 4, fontSize: 11,
                          background: placeholderName.trim() ? theme.accent : theme.inputBg, 
                          color: placeholderName.trim() ? '#fff' : theme.textMuted,
                          border: `1px solid ${placeholderName.trim() ? theme.accent : theme.border}`, 
                          cursor: placeholderName.trim() ? 'pointer' : 'not-allowed'
                        }}
                      >{slot.replace('BENCH', 'B')}</button>
                    ))}
                  </div>
                </>
              ) : (
                <button 
                  onClick={() => addPlaceholder(showPlaceholderModal, placeholderName)}
                  disabled={!placeholderName.trim()}
                  style={{
                    width: '100%', padding: 12, borderRadius: 6,
                    background: placeholderName.trim() ? theme.accent : theme.inputBg,
                    color: placeholderName.trim() ? '#fff' : theme.textMuted,
                    border: 'none', cursor: placeholderName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 14, fontWeight: 600, marginBottom: 8
                  }}
                >Add to {showPlaceholderModal}</button>
              )}
              
              <button 
                onClick={() => setShowPlaceholderModal(null)}
                style={{ width: '100%', padding: 10, borderRadius: 6, background: theme.inputBg, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Position Switch Modal */}
        {editingSlot && roster[editingSlot] && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setEditingSlot(null)}
          >
            <div 
              style={{ background: theme.cardBg, borderRadius: 12, padding: 24, maxWidth: 300, width: '90%', border: `1px solid ${theme.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ color: theme.textPrimary, margin: '0 0 16px 0' }}>Move {roster[editingSlot].name}</h3>
              <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>Select new position:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allSlots.filter(s => s !== editingSlot && !roster[s]).map(slot => (
                  <button 
                    key={slot}
                    onClick={() => switchPosition(editingSlot, slot)}
                    style={{
                      padding: '8px 12px', borderRadius: 4, fontSize: 12,
                      background: theme.inputBg, color: theme.textPrimary,
                      border: `1px solid ${theme.border}`, cursor: 'pointer'
                    }}
                  >{slot.replace('BENCH', 'B')}</button>
                ))}
              </div>
              <button 
                onClick={() => setEditingSlot(null)}
                style={{ width: '100%', marginTop: 16, padding: 10, borderRadius: 6, background: theme.inputBg, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Quick Start Guide Modal */}
        {showQuickGuide && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
          onClick={() => setShowQuickGuide(false)}
          >
            <div 
              style={{ 
                background: theme.cardBg, borderRadius: 16, padding: 28, maxWidth: 650, width: '95%', 
                border: `1px solid ${theme.border}`, maxHeight: '90vh', overflowY: 'auto' 
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 22 }}>📋 Draft Assistant Guide</h2>
                <button onClick={() => setShowQuickGuide(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Layout Overview */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>🖥️ Layout</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: theme.textPrimary }}>Left Panel:</strong> Your roster with all slots<br/>
                    <strong style={{ color: theme.textPrimary }}>Center Panel:</strong> Available players by position<br/>
                    <strong style={{ color: theme.textPrimary }}>Right Panel:</strong> Value Picks - lower tier cards with elite production
                  </p>
                </div>

                {/* Position Tabs */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>🏷️ Position Tabs</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Click position tabs (C, 1B, SS, SP, etc.) to see the best available players for that position. 
                    Players are ranked by <strong style={{ color: theme.textPrimary }}>wOBA</strong> for batters (higher is better) and <strong style={{ color: theme.textPrimary }}>SIERA</strong> for pitchers (lower is better).
                  </p>
                </div>

                {/* Card Pool Filters */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>🎴 Card Pool Toggles</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Toggle card tiers on/off to match your draft's available packs. Click <strong style={{ color: '#a855f7' }}>Perf</strong>, <strong style={{ color: '#32EBFC' }}>Dia</strong>, <strong style={{ color: '#FFE61F' }}>Gold</strong>, etc. to show/hide those tiers.
                  </p>
                </div>

                {/* Confidence & Tiers */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>📊 Confidence & Tiers</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: '#22c55e' }}>◆ Trusted</span> = Large sample size (801+ AB / 200+ IP)<br/>
                    <span style={{ color: '#86efac' }}>● High</span> = Good sample size (450-800 AB / 100-199 IP)<br/>
                    <span style={{ color: '#a855f7' }}>T1+</span> = Elite tier + elite defense at key position (sorted first!)<br/>
                    <span style={{ color: '#22c55e' }}>T1</span> = Elite tier, <span style={{ color: '#fbbf24' }}>T2</span> = Good tier, <span style={{ color: theme.textMuted }}>T3+</span> = Below performance gap<br/>
                    <em style={{ color: theme.textMuted, fontSize: 12 }}>Low confidence players are hidden by default. Sort order: T1+ → T1 → T2</em>
                  </p>
                </div>

                {/* Low Data Support */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>📉 Low Data Support (LDS)</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: '#f59e0b' }}>LDS Mode:</strong> Lowers confidence thresholds for tournaments with limited data.<br/>
                    Normal: 450+ AB / 100+ IP to show | LDS: 99+ AB / 20+ IP to show<br/>
                    <em style={{ color: theme.textMuted, fontSize: 12 }}>Auto-enabled for small tournaments. Toggle with the LDS button.</em>
                  </p>
                </div>

                {/* Defense Rating */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>🛡️ Defense Rating (DEF)</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: '#a855f7' }}>100+</span> = Elite (Purple) | <span style={{ color: '#3b82f6' }}>80-99</span> = Great (Blue) | <span style={{ color: '#22c55e' }}>50-79</span> = Good (Green) | <span style={{ color: '#fbbf24' }}>&lt;50</span> = Poor (Yellow)<br/>
                    <strong style={{ color: theme.textPrimary }}>🛡️ Shield icon:</strong> Shows on C, 2B, SS, CF with elite defense (100+)<br/>
                    <em style={{ color: theme.textMuted, fontSize: 12 }}>Poor defense players (&lt;50 DEF) hidden except for DH position.</em>
                  </p>
                </div>

                {/* True Splits */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>📈 True Splits</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Displayed in the header: <strong style={{ color: theme.textPrimary }}>True Pitching</strong> and <strong style={{ color: theme.textPrimary }}>True Batting</strong> splits.<br/>
                    These are weighted by IP (pitchers) and AB (batters) rather than raw player counts, giving a more accurate picture of the pool's handedness distribution.
                  </p>
                </div>

                {/* Value Picks */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>💎 Value Picks</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Shows players from lower card tiers performing close to top-tier players:<br/>
                    <span style={{ color: '#ef4444' }}>🔥 Insane:</span> Within 0.015 wOBA / 0.3 SIERA of best<br/>
                    <span style={{ color: '#f97316' }}>⭐ Great:</span> Within 0.025 wOBA / 0.4 SIERA of best<br/>
                    <span style={{ color: '#eab308' }}>👍 Good:</span> Within 0.040 wOBA / 0.5 SIERA of best<br/>
                    <em style={{ color: theme.textMuted, fontSize: 12 }}>Requires multiple card tiers enabled to compare.</em>
                  </p>
                </div>

                {/* Player Actions */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>👆 Player Actions</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: theme.textPrimary }}>View:</strong> Click to see full stats and add to a roster slot<br/>
                    <strong style={{ color: theme.textPrimary }}>Search:</strong> Use the search bar to find any player by name<br/>
                    <strong style={{ color: theme.textPrimary }}>+ Custom:</strong> Add placeholder for players not in database<br/>
                    <strong style={{ color: theme.textPrimary }}>Click empty slot:</strong> Jumps to that position's available players
                  </p>
                </div>

                {/* Roster Management */}
                <div style={{ background: theme.panelBg, borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>📝 Roster Management</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: theme.textPrimary }}>✎</strong> = Move player to different slot<br/>
                    <strong style={{ color: theme.error }}>×</strong> = Remove player from roster<br/>
                    Players you draft are removed from the available pool.
                  </p>
                </div>

                {/* Tips */}
                <div style={{ background: theme.accent + '15', borderRadius: 10, padding: 14, border: `1px solid ${theme.accent}33` }}>
                  <h3 style={{ color: theme.accent, margin: '0 0 8px 0', fontSize: 14 }}>💡 Pro Tips</h3>
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    • SP's are shown for RP/CL slots since starters are typically best for all roles<br/>
                    • Watch for scarcity alerts when elite players at a position are running low<br/>
                    • Use BENCH slots for versatile players who can fill multiple positions<br/>
                    • Pop Out button opens a compact window for side-by-side use with the game<br/>
                    • Prioritize 🛡️ elite defense at key positions (C, 2B, SS, CF)
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowQuickGuide(false)}
                style={{ 
                  width: '100%', marginTop: 20, padding: 14, borderRadius: 8, 
                  background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600
                }}
              >Got it, let's draft!</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function App() {
  return (<BrowserRouter><ThemeProvider><AuthProvider><Routes>
    <Route path="/" element={<StatsPage />} />
    <Route path="/info" element={<InfoPage />} />
    <Route path="/videos" element={<VideosPage />} />
    <Route path="/articles" element={<ArticlesPage />} />
    <Route path="/submit" element={<SubmitDataPage />} />
    <Route path="/review" element={<ReviewQueuePage />} />
    <Route path="/leaderboards" element={<LeaderboardsPage />} />
    <Route path="/draft-assistant" element={<DraftAssistantPage />} />
  </Routes></AuthProvider></ThemeProvider></BrowserRouter>);
}

const darkTheme = {
  mainBg: '#0a0e17', cardBg: '#0f1419', panelBg: '#141a23', tableBg: '#111827', sidebarBg: '#070b11',
  textPrimary: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b', textDim: '#475569',
  accent: '#3b82f6', accentHover: '#2563eb', success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
  gold: '#fbbf24',
  tableHeaderBg: '#1e293b', tableRowBg: '#111827', tableRowHover: '#1a2332', tableBorder: '#1e293b',
  border: '#1e293b', borderLight: '#334155', inputBg: '#0f1419', inputBorder: '#334155',
};

const lightTheme = {
  mainBg: '#f8fafc', cardBg: '#ffffff', panelBg: '#f1f5f9', tableBg: '#ffffff', sidebarBg: '#f1f5f9',
  textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#64748b', textDim: '#94a3b8',
  accent: '#2563eb', accentHover: '#1d4ed8', success: '#16a34a', warning: '#d97706', error: '#dc2626',
  gold: '#d97706',
  tableHeaderBg: '#f1f5f9', tableRowBg: '#ffffff', tableRowHover: '#f8fafc', tableBorder: '#e2e8f0',
  border: '#e2e8f0', borderLight: '#cbd5e1', inputBg: '#ffffff', inputBorder: '#cbd5e1',
};

function getStyles(t) {
  return {
    container: { minHeight: '100vh', background: t.mainBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: t.textPrimary, fontSize: 14 },
    loading: { minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted },
    notification: { position: 'fixed', top: 16, right: 16, padding: '12px 24px', borderRadius: 6, color: '#fff', fontWeight: 500, zIndex: 1000, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
    header: { background: t.sidebarBg, borderBottom: `1px solid ${t.border}`, padding: '12px 24px' },
    headerContent: { maxWidth: 1800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
    title: { margin: 0, fontSize: 22, color: t.teamPrimary ? '#ffffff' : t.textPrimary, fontWeight: 700 },
    subtitle: { margin: '2px 0 0', fontSize: 12, color: t.teamPrimary ? 'rgba(255,255,255,0.7)' : t.textDim, fontWeight: 500 },
    
    // News Banner
    newsBannerContainer: { background: t.teamSecondary || t.sidebarBg, borderBottom: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative' },
    newsBannerScroll: { display: 'flex', alignItems: 'center', position: 'relative' },
    newsBannerText: { display: 'inline-block', whiteSpace: 'nowrap', animation: 'scrollBanner 40s linear infinite', color: t.teamPrimary ? '#ffffff' : t.gold, fontWeight: 600, fontSize: 14, padding: '10px 0' },
    newsBannerSpacer: { margin: '0 50px', color: t.textDim },
    newsBannerEditBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: t.textMuted, fontSize: 12, zIndex: 10 },
    newsBannerEdit: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' },
    newsBannerInput: { flex: 1, padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    newsBannerSaveBtn: { padding: '8px 14px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    newsBannerCancelBtn: { padding: '8px 14px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    
    nav: { display: 'flex', gap: 4 },
    navLink: { padding: '8px 16px', color: t.teamPrimary ? 'rgba(255,255,255,0.8)' : t.textMuted, textDecoration: 'none', borderRadius: 4, fontWeight: 500, fontSize: 13 },
    navLinkActive: { background: t.teamSecondary || t.accent, color: '#fff' },
    themeControls: { display: 'flex', alignItems: 'center', gap: 8 },
    teamSelect: { padding: '6px 10px', background: t.teamPrimary ? 'rgba(255,255,255,0.15)' : t.inputBg, border: `1px solid ${t.teamPrimary ? 'rgba(255,255,255,0.3)' : t.border}`, borderRadius: 6, color: t.teamPrimary ? '#ffffff' : t.textPrimary, fontSize: 12, cursor: 'pointer', outline: 'none', colorScheme: 'dark' },
    themeToggle: { width: 36, height: 36, borderRadius: 6, border: `1px solid ${t.teamPrimary ? 'rgba(255,255,255,0.3)' : t.border}`, background: t.teamPrimary ? 'rgba(255,255,255,0.1)' : 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.teamPrimary ? '#ffffff' : t.textMuted },
    main: { display: 'flex', maxWidth: 1800, margin: '0 auto', minHeight: 'calc(100vh - 58px)' },
    sidebar: { width: 240, background: t.teamPrimary || t.sidebarBg, borderRight: `1px solid ${t.border}`, padding: 14, flexShrink: 0, display: 'flex', flexDirection: 'column' },
    sidebarTabs: { display: 'flex', gap: 2, marginBottom: 12 },
    sidebarTabBtn: { flex: 1, padding: '8px 6px', background: 'transparent', color: t.teamPrimary ? 'rgba(255,255,255,0.7)' : t.textMuted, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 11 },
    sidebarTabActive: { background: t.teamPrimary ? 'rgba(255,255,255,0.2)' : t.panelBg, color: t.teamPrimary ? '#ffffff' : t.textPrimary },
    sidebarSearch: { width: '100%', padding: '9px 12px', background: t.teamPrimary ? 'rgba(255,255,255,0.15)' : t.inputBg, border: `1px solid ${t.teamPrimary ? 'rgba(255,255,255,0.2)' : t.border}`, borderRadius: 4, color: t.teamPrimary ? '#ffffff' : t.textPrimary, fontSize: 13, boxSizing: 'border-box', marginBottom: 10, outline: 'none' },
    tournamentList: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'auto' },
    emptyMsg: { color: t.teamPrimary ? 'rgba(255,255,255,0.6)' : t.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' },
    tournamentItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'transparent', borderRadius: 4, cursor: 'pointer', borderLeft: `3px solid transparent` },
    tournamentActive: { background: t.teamPrimary ? 'rgba(255,255,255,0.15)' : t.panelBg, borderLeftColor: t.teamSecondary || t.accent },
    tournamentInfo: { display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', flex: 1 },
    tournamentName: { fontWeight: 500, color: t.teamPrimary ? 'rgba(255,255,255,0.9)' : t.textSecondary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    tournamentNameActive: { color: t.textPrimary, fontWeight: 600 },
    tournamentStats: { fontSize: 11, color: t.textDim },
    tournamentActions: { display: 'flex', gap: 4, alignItems: 'center' },
    legacyBtn: { width: 24, height: 24, background: 'transparent', color: t.textDim, border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 14, opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    delBtn: { width: 24, height: 24, background: 'transparent', color: t.textDim, border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 16, opacity: 0.5 },
    newTournamentBtn: { marginTop: 10, padding: 10, background: t.panelBg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    content: { flex: 1, padding: '20px 24px', overflow: 'auto', background: t.mainBg },
    welcome: { textAlign: 'center', padding: '80px 40px' },
    welcomeTitle: { fontSize: 24, color: t.textSecondary, marginBottom: 10, fontWeight: 600 },
    welcomeText: { color: t.textDim, fontSize: 14 },
    tournamentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    tournamentMeta: { display: 'flex', alignItems: 'baseline', gap: 20 },
    tournamentTitleMain: { fontSize: 20, color: t.textSecondary, margin: 0, fontWeight: 600 },
    handednessContainer: { display: 'flex', gap: 16 },
    handednessGroup: { color: t.textDim, fontSize: 12, fontFamily: 'ui-monospace, monospace' },
    uploadBtn: { padding: '8px 14px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 12 },
    tabRow: { marginBottom: 12 },
    tabs: { display: 'flex', gap: 4 },
    tab: { padding: '8px 18px', background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
    tabActive: { background: t.teamPrimary || t.panelBg, color: t.teamPrimary ? '#ffffff' : t.textPrimary },
    tabCount: { marginLeft: 6, color: t.teamPrimary ? 'rgba(255,255,255,0.7)' : t.textDim, fontWeight: 400 },
    controlBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: t.panelBg, borderRadius: 6, borderLeft: `3px solid ${t.teamPrimary || t.accent}` },
    controlGroup: { display: 'flex', alignItems: 'center', gap: 6 },
    controlDivider: { width: 1, height: 24, background: t.border, margin: '0 6px' },
    searchInput: { padding: '7px 12px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: '4px 0 0 4px', fontSize: 13, width: 160, outline: 'none' },
    filterSelect: { padding: '7px 12px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderLeft: 'none', borderRadius: '0 4px 4px 0', fontSize: 13, cursor: 'pointer', outline: 'none' },
    controlBtn: { padding: '7px 12px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    controlBtnActive: { background: t.teamSecondary || t.accent, color: '#fff', borderColor: t.teamSecondary || t.accent },
    controlBtnHighlight: { borderColor: t.teamPrimary || t.accent, color: t.teamPrimary || t.accent },
    filterBadge: { background: t.teamSecondary || t.accent, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
    resetBtn: { padding: '7px 12px', background: 'transparent', color: t.warning, border: `1px solid ${t.warning}40`, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
    resultsCount: { marginLeft: 'auto', color: t.textDim, fontSize: 12, fontFamily: 'ui-monospace, monospace' },
    advancedFilters: { background: t.panelBg, borderRadius: 6, padding: '12px 14px', marginBottom: 12 },
    filterGroup: { display: 'flex', gap: 20 },
    statFilter: { display: 'flex', alignItems: 'center', gap: 10 },
    statFilterLabel: { display: 'flex', alignItems: 'center', gap: 8, color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
    checkbox: { width: 16, height: 16, cursor: 'pointer' },
    statFilterControls: { display: 'flex', gap: 6 },
    operatorSelect: { padding: '5px 8px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 12, cursor: 'pointer' },
    valueInput: { padding: '5px 8px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 12, width: 60 },
    tableContainer: { background: t.tableBg, borderRadius: 6, border: `1px solid ${t.teamPrimary ? t.teamPrimary : t.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    tableWrapper: { overflow: 'auto', maxHeight: 'calc(100vh - 280px)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
    th: { padding: '8px 6px', background: t.teamPrimary || t.tableHeaderBg, color: t.teamPrimary ? '#ffffff' : t.textMuted, fontWeight: 600, textAlign: 'center', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.teamPrimary ? 'rgba(255,255,255,0.2)' : t.border}`, userSelect: 'none', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.02em', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
    thRate: { background: t.teamSecondary || t.tableHeaderBg, color: t.teamSecondary ? '#ffffff' : t.gold, fontSize: 10, fontWeight: 700 },
    thSorted: { color: t.teamPrimary ? t.teamSecondary || '#ffffff' : t.textPrimary },
    sortIndicator: { marginLeft: 3, fontSize: 10 },
    tr: { borderBottom: `1px solid ${t.tableBorder}`, background: t.tableRowBg },
    td: { padding: '6px 6px', color: t.textPrimary, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 12 },
    tdName: { padding: '6px 6px', color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12 },
    tdOvr: { padding: '6px 6px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12 },
    tdRate: { padding: '6px 6px', color: t.teamSecondary || t.gold, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600 },
    emptyTable: { padding: 48, textAlign: 'center', color: t.textMuted, fontSize: 14 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: t.cardBg, padding: 28, borderRadius: 8, border: `1px solid ${t.teamPrimary || t.border}`, maxWidth: 400, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    modalTitle: { margin: '0 0 10px', color: t.teamPrimary || t.textPrimary, fontSize: 20, fontWeight: 600 },
    modalText: { margin: '0 0 20px', color: t.textSecondary, fontSize: 14 },
    modalBtns: { display: 'flex', gap: 10, marginTop: 20 },
    authError: { color: t.error, fontSize: 13, margin: '0 0 14px', padding: '10px 14px', background: `${t.error}15`, borderRadius: 4 },
    input: { width: '100%', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', marginBottom: 10, outline: 'none' },
    textareaLarge: { width: '100%', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', minHeight: 140, outline: 'none' },
    formBtns: { display: 'flex', gap: 10 },
    newForm: { marginBottom: 12, padding: 12, background: t.panelBg, borderRadius: 6 },
    saveBtn: { flex: 1, padding: '10px 14px', background: t.teamPrimary || t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    cancelBtn: { flex: 1, padding: '10px 14px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    addBtn: { padding: '8px 14px', background: t.teamSecondary || t.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    editBtn: { padding: '8px 14px', background: 'transparent', color: t.teamPrimary || t.textMuted, border: `1px solid ${t.teamPrimary || t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
    pageContent: { flex: 1, padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${t.teamPrimary || t.border}` },
    pageTitle: { margin: 0, fontSize: 24, color: t.teamPrimary || t.textPrimary, fontWeight: 600 },
    infoContent: { display: 'flex', flexDirection: 'column', gap: 20 },
    infoSection: { background: t.panelBg, padding: 24, borderRadius: 6, borderLeft: `4px solid ${t.teamPrimary || t.accent}` },
    infoHeading: { margin: '0 0 12px', color: t.teamPrimary || t.textPrimary, fontSize: 18, fontWeight: 600 },
    infoBody: { margin: 0, color: t.textSecondary, fontSize: 14, lineHeight: 1.7 },
    
    // Admin Login Section
    adminLoginSection: { marginTop: 40, padding: 24, background: t.panelBg, borderRadius: 8, border: `1px solid ${t.border}` },
    adminLoginTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: t.textPrimary },
    adminLoginStatus: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    adminLoginBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.success, color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600 },
    adminLogoutBtn: { padding: '6px 14px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 13 },
    adminUpgradeBtn: { padding: '6px 14px', background: t.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
    adminLoginPrompt: { display: 'flex', flexDirection: 'column', gap: 12 },
    adminLoginText: { margin: 0, color: t.textMuted, fontSize: 14 },
    adminLoginBtn: { padding: '10px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14, width: 'fit-content' },
    
    editContainer: { display: 'flex', flexDirection: 'column', gap: 14 },
    editField: { display: 'flex', flexDirection: 'column', gap: 8 },
    editLabel: { color: t.textSecondary, fontWeight: 500, fontSize: 13 },
    editSection: { background: t.panelBg, padding: 14, borderRadius: 6 },
    editSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    editSectionNum: { color: t.textDim, fontSize: 12, fontWeight: 600 },
    editSectionBtns: { display: 'flex', gap: 6 },
    moveBtn: { width: 28, height: 28, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, cursor: 'pointer', fontSize: 14 },
    removeBtn: { width: 28, height: 28, background: t.error, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 14 },
    addSectionBtn: { padding: 12, background: 'transparent', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
    editActions: { display: 'flex', gap: 10, marginTop: 14 },
    addVideoForm: { background: t.panelBg, padding: 20, borderRadius: 6, marginBottom: 20 },
    videoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
    videoCard: { background: t.panelBg, borderRadius: 6, overflow: 'hidden', position: 'relative' },
    thumbnailContainer: { position: 'relative', paddingTop: '56.25%', background: t.inputBg, cursor: 'pointer' },
    thumbnail: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
    thumbnailPlaceholder: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 40, color: t.textDim },
    videoInfo: { padding: 14 },
    videoTitle: { display: 'block', color: t.textPrimary, fontWeight: 500, fontSize: 14, marginBottom: 4 },
    videoPlatform: { color: t.textDim, fontSize: 12 },
    removeVideoBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: `${t.error}dd`, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
    videoPlayerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    videoPlayerContainer: { position: 'relative', width: '90%', maxWidth: 1000, aspectRatio: '16/9' },
    videoPlayer: { width: '100%', height: '100%', borderRadius: 6 },
    closePlayerBtn: { position: 'absolute', top: -40, right: 0, background: 'transparent', color: '#fff', border: 'none', fontSize: 32, cursor: 'pointer' },
    
    // Event type selector
    eventTypeSelector: { display: 'flex', gap: 8, marginBottom: 10 },
    eventTypeBtn: { flex: 1, padding: '8px 12px', background: t.inputBg, color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 12, transition: 'all 0.15s' },
    eventTypeBtnActive: { background: t.accent, color: '#fff', borderColor: t.accent },
    
    // Header actions
    headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
    missingDataBtn: { padding: '8px 14px', background: t.panelBg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 },
    
    // Date picker modal
    datePickerModal: { background: t.cardBg, padding: 28, borderRadius: 8, border: `1px solid ${t.border}`, maxWidth: 500, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    datePickerGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 20 },
    datePickerDay: { padding: '12px 8px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
    datePickerDayUploaded: { background: `${t.success}20`, borderColor: t.success },
    datePickerSunday: { borderLeft: `3px solid ${t.accent}` },
    datePickerDayNum: { display: 'block', fontSize: 16, fontWeight: 600, color: t.textPrimary },
    datePickerDayLabel: { display: 'block', fontSize: 10, color: t.textDim, marginTop: 2 },
    
    // Missing data modal
    missingDataModal: { background: t.cardBg, padding: 28, borderRadius: 8, border: `1px solid ${t.border}`, maxWidth: 500, width: '95%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    calendarContainer: { marginBottom: 20 },
    calendarHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center', fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: 'uppercase' },
    calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 },
    weekLabel: { fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
    calendarDay: { aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'all 0.15s' },
    calendarDayEmpty: { aspectRatio: '1' },
    calendarDayComplete: { background: `${t.success}20`, border: `2px solid ${t.success}` },
    calendarDayMissing: { background: `${t.warning}15`, border: `2px solid ${t.warning}` },
    calendarDayToday: { boxShadow: `0 0 0 2px ${t.accent}, 0 0 8px ${t.accent}50` },
    calendarDayClickable: { cursor: 'pointer' },
    calendarWeekStart: { borderLeft: `3px solid ${t.accent}` },
    calendarDayNum: { fontSize: 15, fontWeight: 700, color: t.textPrimary },
    calendarDayStatus: { fontSize: 13, marginTop: 2, fontWeight: 600 },
    calendarLegend: { display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary },
    legendDot: { width: 12, height: 12, borderRadius: '50%' },
    adminHint: { color: t.accent, fontStyle: 'italic', fontSize: 12 },
    
    // Nav badge for review queue
    navLinkReview: { display: 'flex', alignItems: 'center', gap: 6 },
    navBadge: { background: t.error, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
    
    // Submit Data Page
    submitPageLayout: { minHeight: 'calc(100vh - 60px)', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, padding: '24px', maxWidth: 1200, margin: '0 auto' },
    submitFormPanel: { background: t.cardBg, borderRadius: 8, padding: 24, border: `1px solid ${t.border}` },
    submitInfoPanel: { background: t.panelBg, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden', height: 'fit-content', position: 'sticky', top: 24 },
    submitTitle: { fontSize: 22, fontWeight: 700, color: t.textPrimary, marginBottom: 8 },
    submitSubtitle: { fontSize: 14, color: t.textMuted, marginBottom: 24 },
    submitForm: { display: 'flex', flexDirection: 'column', gap: 20 },
    formSection: { display: 'flex', flexDirection: 'column', gap: 8 },
    formLabel: { fontSize: 14, fontWeight: 600, color: t.textPrimary },
    formHint: { fontSize: 12, color: t.textMuted, marginTop: -4 },
    formInput: { padding: '12px 14px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, outline: 'none' },
    formSelect: { padding: '12px 14px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' },
    formTextarea: { padding: '12px 14px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' },
    fileDropzone: { padding: '24px 20px', background: t.inputBg, border: `2px dashed ${t.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' },
    filePrompt: { color: t.textMuted, fontSize: 14 },
    fileIcon: { display: 'block', fontSize: 28, marginBottom: 6 },
    fileSelected: { color: t.textPrimary, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
    fileSize: { color: t.textMuted, fontWeight: 400 },
    fileTypeTag: { background: t.accent, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 },
    fileClearBtn: { background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4 },
    tournamentOptions: { display: 'flex', gap: 16, marginBottom: 8 },
    radioOption: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: t.textSecondary },
    dateGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
    dateBtn: { padding: '10px 4px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
    dateBtnSelected: { background: t.accent, borderColor: t.accent, color: '#fff' },
    dateBtnToday: { boxShadow: `0 0 0 2px ${t.accent}` },
    dateBtnUploaded: { background: `${t.success}22`, borderColor: t.success },
    dateBtnDay: { display: 'block', fontSize: 14, fontWeight: 600, color: t.textPrimary },
    dateBtnLabel: { display: 'block', fontSize: 10, color: t.textMuted, marginTop: 2 },
    submitBtn: { padding: '14px 24px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'all 0.2s' },
    submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    submitResult: { textAlign: 'center', padding: '32px 24px', background: t.panelBg, borderRadius: 12, border: `2px solid ${t.success}` },
    submitResultIcon: { fontSize: 48, marginBottom: 12 },
    submitResultTitle: { fontSize: 20, fontWeight: 700, color: t.textPrimary, marginBottom: 8 },
    submitResultDetails: { fontSize: 14, color: t.textSecondary, marginBottom: 16 },
    submitResultNote: { fontSize: 13, color: t.textMuted, marginBottom: 20 },
    submitAnotherBtn: { padding: '10px 20px', background: 'transparent', color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
    
    // Info Panel (right side)
    infoPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${t.border}`, background: t.cardBg },
    infoPanelTitle: { fontSize: 15, fontWeight: 600, color: t.textPrimary, margin: 0 },
    infoPanelEditBtn: { background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 13, padding: '4px 8px' },
    infoPanelContent: { padding: 20, maxHeight: 'calc(100vh - 200px)', overflow: 'auto' },
    infoPanelSection: { marginBottom: 20 },
    infoPanelHeading: { fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 8 },
    infoPanelBody: { fontSize: 13, color: t.textSecondary, lineHeight: 1.6 },
    infoPanelEmpty: { color: t.textMuted, fontSize: 13, fontStyle: 'italic' },
    infoPanelEdit: { padding: 16 },
    infoPanelEditSection: { marginBottom: 16, padding: 12, background: t.inputBg, borderRadius: 6 },
    infoPanelEditHeader: { display: 'flex', gap: 8, marginBottom: 8 },
    infoPanelEditInput: { flex: 1, padding: '8px 10px', background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    infoPanelRemoveBtn: { background: t.error, color: '#fff', border: 'none', borderRadius: 4, width: 28, cursor: 'pointer', fontSize: 12 },
    infoPanelEditTextarea: { width: '100%', padding: '8px 10px', background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
    infoPanelAddBtn: { width: '100%', padding: '10px', background: 'transparent', color: t.accent, border: `1px dashed ${t.accent}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 16 },
    infoPanelEditActions: { display: 'flex', gap: 8 },
    
    // Review Queue Page
    reviewPage: { minHeight: 'calc(100vh - 60px)', padding: '24px' },
    reviewContainer: { maxWidth: 1000, margin: '0 auto' },
    reviewTitle: { fontSize: 24, fontWeight: 700, color: t.textPrimary, marginBottom: 20 },
    reviewTabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 },
    reviewTab: { padding: '10px 16px', background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 },
    reviewTabActive: { background: t.panelBg, color: t.textPrimary },
    reviewTabBadge: { background: t.accent, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
    reviewList: { display: 'flex', flexDirection: 'column', gap: 16 },
    emptyState: { textAlign: 'center', padding: '48px 24px', color: t.textMuted, fontSize: 16 },
    reviewCard: { background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' },
    reviewCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: t.panelBg, borderBottom: `1px solid ${t.border}` },
    reviewCardFile: { fontWeight: 600, color: t.textPrimary },
    reviewCardTime: { fontSize: 12, color: t.textMuted },
    reviewCardBody: { padding: 16 },
    reviewCardRow: { display: 'flex', gap: 12, marginBottom: 8, fontSize: 14 },
    reviewCardLabel: { color: t.textMuted, minWidth: 100 },
    reviewCardValue: { color: t.textPrimary },
    reviewCardMatch: { fontWeight: 600 },
    reviewCardWarnings: { marginTop: 12, padding: 12, background: `${t.warning}10`, borderRadius: 6, border: `1px solid ${t.warning}30` },
    warningItem: { color: t.warning, fontSize: 13, marginBottom: 4, cursor: 'pointer' },
    removedRowsList: { marginTop: 8, padding: 8, background: t.inputBg, borderRadius: 4, maxHeight: 150, overflow: 'auto' },
    removedRow: { fontSize: 12, color: t.textSecondary, padding: '4px 0', borderBottom: `1px solid ${t.border}` },
    reviewCardActions: { display: 'flex', gap: 8, padding: 16, borderTop: `1px solid ${t.border}`, flexWrap: 'wrap', alignItems: 'center' },
    reviewSelect: { flex: 1, minWidth: 150, padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    approveBtn: { padding: '8px 16px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    rejectBtn: { padding: '8px 12px', background: t.error, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    previewBtn: { padding: '8px 12px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 13 },
    newEventBtn: { padding: '8px 12px', background: 'transparent', color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 4, cursor: 'pointer', fontSize: 13 },
    newEventForm: { display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', alignItems: 'center' },
    newEventInput: { flex: 1, minWidth: 150, padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    newEventSelect: { padding: '8px 10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    cancelSmallBtn: { padding: '8px 12px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 13 },
    previewTable: { padding: 16, background: t.inputBg, borderTop: `1px solid ${t.border}`, overflow: 'auto' },
    criticalIssues: { padding: 16, background: `${t.error}15`, borderBottom: `1px solid ${t.error}30` },
    criticalTitle: { fontWeight: 600, color: t.error, marginBottom: 8 },
    criticalItem: { color: t.textSecondary, fontSize: 13, marginBottom: 4 },
    historyTable: { width: '100%', borderCollapse: 'collapse', background: t.cardBg, borderRadius: 8, overflow: 'hidden' },
    historyTh: { padding: '12px 16px', background: t.panelBg, textAlign: 'left', fontWeight: 600, fontSize: 13, color: t.textMuted, borderBottom: `1px solid ${t.border}` },
    historyTd: { padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontSize: 14, color: t.textPrimary },
    undoBtn: { padding: '6px 12px', background: 'transparent', color: t.warning, border: `1px solid ${t.warning}`, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
    
    // Leaderboards Page
    leaderboardPage: { minHeight: 'calc(100vh - 60px)', padding: '24px' },
    leaderboardContainer: { maxWidth: 800, margin: '0 auto' },
    leaderboardContainerWide: { maxWidth: 1400, margin: '0 auto' },
    leaderboardTitle: { fontSize: 28, fontWeight: 700, color: t.textPrimary, marginBottom: 8 },
    leaderboardSubtitle: { fontSize: 14, color: t.textMuted, marginBottom: 24 },
    leaderboardTabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 },
    leaderboardTab: { padding: '10px 20px', background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all 0.15s' },
    leaderboardTabActive: { background: t.accent, color: '#fff' },
    leaderboardSection: { background: t.cardBg, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' },
    leaderboardSideBySide: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 },
    leaderboardCard: { background: t.cardBg, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' },
    leaderboardCardTitle: { margin: 0, padding: '16px 20px', background: t.panelBg, borderBottom: `1px solid ${t.border}`, fontSize: 16, fontWeight: 600, color: t.textPrimary },
    weekSelector: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${t.border}`, background: t.panelBg },
    weekSelectorCentered: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 },
    leaderboardWeekLabel: { fontSize: 14, fontWeight: 600, color: t.textSecondary },
    weekSelect: { padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, cursor: 'pointer' },
    leaderboardTableWrapper: { overflowX: 'auto', maxHeight: 600, overflowY: 'auto' },
    leaderboardTable: { width: '100%', borderCollapse: 'collapse' },
    leaderboardTh: { padding: '12px 14px', background: t.panelBg, textAlign: 'center', fontWeight: 600, fontSize: 12, color: t.textMuted, borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0 },
    leaderboardTd: { padding: '10px 14px', textAlign: 'center', borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.textPrimary },
    allTimeExplainer: { padding: '16px 20px', background: t.panelBg, borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.textMuted, fontStyle: 'italic' },
    allTimeExplainerSmall: { margin: 0, padding: '12px 20px', fontSize: 12, color: t.textDim, fontStyle: 'italic', borderBottom: `1px solid ${t.border}` },
    
    // Articles Page
    addArticleForm: { background: t.cardBg, padding: 20, borderRadius: 12, marginBottom: 24, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 12 },
    articleGrid: { display: 'flex', flexDirection: 'column', gap: 12 },
    articleCard: { background: t.cardBg, borderRadius: 12, border: `1px solid ${t.border}`, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' },
    articleCardContent: { display: 'flex', alignItems: 'center', gap: 16, flex: 1, cursor: 'pointer' },
    articleIcon: { fontSize: 32, width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.panelBg, borderRadius: 8 },
    articleInfo: { flex: 1 },
    articleTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: t.textPrimary },
    articleDescription: { margin: '6px 0 0', fontSize: 13, color: t.textMuted, lineHeight: 1.4 },
    articleDate: { fontSize: 12, color: t.textDim },
    articleActions: { display: 'flex', alignItems: 'center', gap: 8 },
    articleDownloadBtn: { padding: '6px 12px', background: t.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' },
    articleRemoveBtn: { padding: '6px 10px', background: 'transparent', color: t.error, border: `1px solid ${t.error}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' },
    articleViewerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    articleViewerContainer: { width: '90%', height: '90%', maxWidth: 1200, background: t.cardBg, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    articleViewerHeader: { padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    articleViewerTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: t.textPrimary },
    articleViewer: { flex: 1, width: '100%', border: 'none' },
    lockedContent: { textAlign: 'center', padding: '60px 20px', background: t.cardBg, borderRadius: 12, border: `1px solid ${t.border}` },
    lockIcon: { fontSize: 48, marginBottom: 16 },
    lockedTitle: { fontSize: 20, fontWeight: 600, color: t.textPrimary, margin: '0 0 8px' },
    lockedText: { fontSize: 14, color: t.textMuted, margin: '0 0 20px' },
    unlockBtn: { padding: '10px 24px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  };
}
