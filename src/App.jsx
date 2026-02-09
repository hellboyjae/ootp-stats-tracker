import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from './supabase.js';

const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  
  // Inject keyframes for news banner animation
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
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  useEffect(() => { localStorage.setItem('theme', isDark ? 'dark' : 'light'); }, [isDark]);
  const toggle = () => setIsDark(!isDark);
  const theme = isDark ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={{ isDark, toggle, theme }}>{children}</ThemeContext.Provider>;
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

function getOvrColor(ovr) {
  const val = parseInt(ovr) || 0;
  if (val >= 100) return '#E82D07';
  if (val >= 90) return '#32EBFC';
  if (val >= 80) return '#FFE61F';
  if (val >= 70) return '#E0E0E0';
  if (val >= 60) return '#664300';
  return '#FFFFFF';
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
  const { isDark, toggle, theme } = useTheme();
  const { hasAccess } = useAuth();
  const styles = getStyles(theme);
  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? theme.error : theme.success}}>{notification.message}</div>}
      <header style={styles.header}><div style={styles.headerContent}>
        <div><h1 style={styles.title}>BeaneCounter</h1><p style={styles.subtitle}>OOTP Baseball Statistics by ItsHellboy</p></div>
        <div style={styles.headerRight}>
          <nav style={styles.nav}>
            <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})} end>Stats</NavLink>
            <NavLink to="/leaderboards" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Leaderboards</NavLink>
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
          <button onClick={toggle} style={styles.themeToggle} title={isDark ? 'Light' : 'Dark'}>{isDark ? '☀' : '☾'}</button>
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
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('pitching');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentType, setNewTournamentType] = useState('daily');
  const [filters, setFilters] = useState({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
  const [showPer9, setShowPer9] = useState(false);
  const [showTraditional, setShowTraditional] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tournaments');
  const [tournamentSearch, setTournamentSearch] = useState('');
  const [showMissingData, setShowMissingData] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState(null);

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
        uploadedDates: t.uploaded_dates || []
      }));
      setTournaments(parsed);
      const lastSelectedId = localStorage.getItem('selectedTournamentId');
      if (lastSelectedId) { const found = parsed.find(t => t.id === lastSelectedId); if (found) { setSelectedTournament(found); setSidebarTab(found.category || 'tournaments'); } }
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

  const selectTournament = (t) => { setSelectedTournament(t); localStorage.setItem('selectedTournamentId', t.id); };
  const parseIP = (ip) => { if (!ip) return 0; const str = String(ip); if (str.includes('.')) { const [w, f] = str.split('.'); return parseFloat(w) + (parseFloat(f) / 3); } return parseFloat(ip) || 0; };
  const formatIP = (d) => { const w = Math.floor(d), f = Math.round((d - w) * 3); return f === 0 ? w.toString() : f === 3 ? (w + 1).toString() : `${w}.${f}`; };
  const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };

  const combinePlayerStats = (existing, newP, type) => {
    const getPlayerKey = (p) => `${p.name}|${p.ovr}`;
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
        ovr: parseNum(row.OVR), vari: parseNum(row.VAR), g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
        era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000', babip: row.BABIP || '.000',
        whip: row.WHIP || '0.00', braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00', hPer9: row['H/9'] || '0.00',
        bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00', lobPct: parsePct(row['LOB%']),
        eraPlus: parseNum(row['ERA+']), fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
        war: row.WAR || '0.0', siera: row.SIERA || '0.00'
      };
    } else {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', bats: row.B || '',
        ovr: parseNum(row.OVR), vari: parseNum(row.VAR), g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
        h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR), bbPct: parsePct(row['BB%']),
        so: parseNum(row.SO), gidp: parseNum(row.GIDP), avg: row.AVG || '.000', obp: row.OBP || '.000', slg: row.SLG || '.000',
        woba: row.wOBA || '.000', ops: row.OPS || '.000', opsPlus: parseNum(row['OPS+']), babip: row.BABIP || '.000',
        wrcPlus: parseNum(row['wRC+']), wraa: row.wRAA || '0.0', war: row.WAR || '0.0', sbPct: parsePct(row['SB%']), bsr: row.BsR || '0.0'
      };
    }
  };

  const PITCHING_HEADERS = ['POS', 'Name', 'T', 'OVR', 'VAR', 'G', 'GS', 'IP', 'BF', 'ERA', 'AVG', 'OBP', 'BABIP', 'WHIP', 'BRA/9', 'HR/9', 'H/9', 'BB/9', 'K/9', 'LOB%', 'ERA+', 'FIP', 'FIP-', 'WAR', 'SIERA'];
  const BATTING_HEADERS = ['POS', 'Name', 'B', 'OVR', 'VAR', 'G', 'GS', 'PA', 'AB', 'H', '2B', '3B', 'HR', 'BB%', 'SO', 'GIDP', 'AVG', 'OBP', 'SLG', 'wOBA', 'OPS', 'OPS+', 'BABIP', 'wRC+', 'wRAA', 'WAR', 'SB%', 'BsR'];
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
    const files = Array.from(event.target.files); 
    if (!files.length || !selectedTournament) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) { showNotif('File too large', 'error'); event.target.value = ''; return; }
      if (!file.name.toLowerCase().endsWith('.csv')) { showNotif('Not a CSV', 'error'); event.target.value = ''; return; }
    }
    // Store files and show date picker
    setPendingUploadFiles(files);
    setShowDatePicker(true);
    event.target.value = '';
  };

  const processUploadWithDate = async (selectedDate) => {
    if (!pendingUploadFiles || !selectedTournament) return;
    
    requestAuth(async () => {
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
      } catch (e) { showNotif('Upload error', 'error'); }
      setPendingUploadFiles(null);
      setShowDatePicker(false);
    });
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
    if (filters.search) f = f.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.position !== 'all') f = f.filter(p => p.pos.toUpperCase() === filters.position.toUpperCase());
    f = f.filter(p => passesFilter(p.g, filters.gFilter));
    if (type === 'batting') f = f.filter(p => passesFilter(p.pa, filters.paFilter) && passesFilter(p.ab, filters.abFilter));
    else f = f.filter(p => passesFilter(parseIP(p.ip), filters.ipFilter));
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
  const resetFilters = () => setFilters({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
  const getActiveFilterCount = () => { let c = 0; if (filters.position !== 'all') c++; ['gFilter', 'paFilter', 'abFilter', 'ipFilter'].forEach(f => { if (filters[f].enabled) c++; }); return c; };

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
  const filteredData = selectedTournament ? getFilteredData(selectedTournament[activeTab], activeTab) : [];
  const totalData = selectedTournament ? selectedTournament[activeTab].length : 0;

  return (
    <Layout notification={notification}>
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
                    <span style={styles.tournamentStats}><span style={{color: quality.color, fontWeight: 600}}>{quality.label}</span> · {t.batting.length}B / {t.pitching.length}P</span>
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
                {(selectedTournament.pitching.length > 0 || selectedTournament.batting.length > 0) && (
                  <div style={styles.handednessContainer}>
                    {selectedTournament.pitching.length > 0 && (() => { const s = getHandednessStats(selectedTournament.pitching, 'throws'); return <span style={styles.handednessGroup}>T: L{s.L}% S{s.S}% R{s.R}%</span>; })()}
                    {selectedTournament.batting.length > 0 && (() => { const s = getHandednessStats(selectedTournament.batting, 'bats'); return <span style={styles.handednessGroup}>B: L{s.L}% S{s.S}% R{s.R}%</span>; })()}
                  </div>
                )}
              </div>
              <div style={styles.headerActions}>
                <button style={styles.missingDataBtn} onClick={() => setShowMissingData(true)} title="View missing data calendar">📅 Missing Data</button>
                {hasAccess('upload') && (
                <label style={styles.uploadBtn}><span>↑ Upload CSV</span><input type="file" accept=".csv" multiple onChange={handleFileUpload} style={{display:'none'}} /></label>
                )}
              </div>
            </div>
            
            {/* Date Picker Modal */}
            {showDatePicker && (
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
                          onClick={() => processUploadWithDate(day.dateStr)}
                        >
                          <span style={styles.datePickerDayNum}>{day.dayOfMonth}</span>
                          <span style={styles.datePickerDayLabel}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.dayOfWeek]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={styles.modalBtns}>
                    <button onClick={() => { setShowDatePicker(false); setPendingUploadFiles(null); }} style={styles.cancelBtn}>Cancel</button>
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
                <button style={{...styles.tab, ...(activeTab === 'pitching' ? styles.tabActive : {})}} onClick={() => { setActiveTab('pitching'); setFilters(f => ({...f, position: 'all'})); }}>Pitching <span style={styles.tabCount}>{selectedTournament.pitching.length}</span></button>
                <button style={{...styles.tab, ...(activeTab === 'batting' ? styles.tabActive : {})}} onClick={() => { setActiveTab('batting'); setFilters(f => ({...f, position: 'all'})); }}>Batting <span style={styles.tabCount}>{selectedTournament.batting.length}</span></button>
              </div>
            </div>
            <div style={styles.controlBar}>
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
            {showAdvancedFilters && (<div style={styles.advancedFilters}><div style={styles.filterGroup}>
              <StatFilter label="G" filter={filters.gFilter} onChange={(u) => updateStatFilter('gFilter', u)} theme={theme} />
              {activeTab === 'batting' ? (<><StatFilter label="PA" filter={filters.paFilter} onChange={(u) => updateStatFilter('paFilter', u)} theme={theme} /><StatFilter label="AB" filter={filters.abFilter} onChange={(u) => updateStatFilter('abFilter', u)} theme={theme} /></>) : (<StatFilter label="IP" filter={filters.ipFilter} onChange={(u) => updateStatFilter('ipFilter', u)} theme={theme} />)}
            </div></div>)}
            <div style={styles.tableContainer}>
              {activeTab === 'pitching' ? <PitchingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} showTraditional={showTraditional} /> : <BattingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} showTraditional={showTraditional} />}
            </div>
          </>)}
        </div>
      </main>
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

  useEffect(() => { loadContent(); }, []);
  const loadContent = async () => { setIsLoading(true); try { const { data } = await supabase.from('site_content').select('*').eq('id', 'info').single(); if (data?.content) setContent(data.content); } catch (e) {} setIsLoading(false); };
  const saveContent = async () => { try { await supabase.from('site_content').upsert({ id: 'info', content: editContent, updated_at: new Date().toISOString() }); setContent(editContent); setIsEditing(false); showNotif('Saved!'); } catch (e) { showNotif('Failed', 'error'); } };
  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };
  const startEditing = () => { requestAuth(() => { setEditContent(JSON.parse(JSON.stringify(content))); setIsEditing(true); }, 'master'); };
  const addSection = () => { setEditContent(c => ({ ...c, sections: [...c.sections, { heading: 'New Section', body: 'Content...' }] })); };
  const updateSection = (i, field, value) => { setEditContent(c => { const s = [...c.sections]; s[i] = { ...s[i], [field]: value }; return { ...c, sections: s }; }); };
  const removeSection = (i) => { setEditContent(c => ({ ...c, sections: c.sections.filter((_, idx) => idx !== i) })); };
  const moveSection = (i, dir) => { const ni = i + dir; if (ni < 0 || ni >= editContent.sections.length) return; setEditContent(c => { const s = [...c.sections]; [s[i], s[ni]] = [s[ni], s[i]]; return { ...c, sections: s }; }); };

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

function PitchingTable({ data, sortBy, sortDir, onSort, theme, showPer9, showTraditional }) {
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
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.throws}</td>
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

function BattingTable({ data, sortBy, sortDir, onSort, theme, showPer9, showTraditional }) {
  const styles = getStyles(theme);
  const SortHeader = ({ field, children, isRate }) => (
    <th style={{...styles.th, ...(isRate ? styles.thRate : {}), ...(sortBy === field ? styles.thSorted : {})}} onClick={() => onSort(field)}>
      {children}{sortBy === field && <span style={styles.sortIndicator}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
  const calcPer600PA = (val, pa) => { const paNum = parseFloat(pa) || 0; return paNum === 0 ? '0.00' : (parseFloat(val || 0) / paNum * 600).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No batting data</div>;
  return (<div style={styles.tableWrapper}><table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="bats">B</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader>
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
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.bats}</td>
      <td style={{...styles.tdOvr, color: getOvrColor(p.ovr)}}>{p.ovr}</td><td style={styles.td}>{p.vari}</td>
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

  const handleSubmit = async () => {
    if (!pitchingFile && !battingFile) { showNotif('Please select at least one CSV file', 'error'); return; }
    if (!selectedDate) { showNotif('Please select a date', 'error'); return; }
    if (!selectedTournamentId && !suggestNewEvent) { showNotif('Please select a tournament or suggest a new event', 'error'); return; }
    if (suggestNewEvent && !newEventName.trim()) { showNotif('Please enter a name for the new event', 'error'); return; }

    setIsSubmitting(true);
    const results = { pitching: null, batting: null };
    
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

      // Process pitching file
      if (pitchingFile) {
        const content = await pitchingFile.text();
        const validation = validateCSV(content, pitchingFile.name);
        
        let matchPercent = 0;
        if (selectedTournament) {
          matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.pitching, 'pitching');
        }

        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId || null,
          suggested_tournament_name: suggestNewEvent ? newEventName.trim() : (selectedTournament?.name || ''),
          suggested_date: selectedDate,
          user_notes: userNotes.trim() || null,
          file_type: 'pitching',
          file_name: pitchingFile.name,
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

      // Process batting file
      if (battingFile) {
        const content = await battingFile.text();
        const validation = validateCSV(content, battingFile.name);
        
        let matchPercent = 0;
        if (selectedTournament) {
          matchPercent = calculatePlayerMatch(validation.rawRows, selectedTournament.batting, 'batting');
        }

        const { error } = await supabase.from('pending_uploads').insert({
          suggested_tournament_id: selectedTournamentId || null,
          suggested_tournament_name: suggestNewEvent ? newEventName.trim() : (selectedTournament?.name || ''),
          suggested_date: selectedDate,
          user_notes: userNotes.trim() || null,
          file_type: 'batting',
          file_name: battingFile.name,
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

  const groupedTournaments = {
    tournaments: tournaments.filter(t => t.category === 'tournaments' || !t.category),
    drafts: tournaments.filter(t => t.category === 'drafts')
  };

  return (
    <Layout notification={notification}>
      <div style={styles.submitPageLayout}>
        {/* Left: Upload Form */}
        <div style={styles.submitFormPanel}>
          <h2 style={styles.submitTitle}>📤 Submit CSV Data</h2>
          <p style={styles.submitSubtitle}>Submit <strong>one event at a time</strong> — include both Pitching and Batting CSVs for that event.</p>

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
  
  // New event creation state
  const [creatingNewFor, setCreatingNewFor] = useState(null);
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState('daily');
  const [newEventCategory, setNewEventCategory] = useState('tournaments');

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
      
      // Combine data (merge players by name+ovr)
      const playerMap = new Map();
      existingData.forEach(p => playerMap.set(`${p.name}|${p.ovr}`, p));
      
      newData.forEach(row => {
        const name = (row.Name || '').trim();
        const ovr = parseNum(row.OVR);
        const key = `${name}|${ovr}`;
        
        // Normalize the row data - MUST match normalizePlayerData exactly
        const normalized = upload.file_type === 'batting' ? {
          id: crypto.randomUUID(),
          name: row.Name?.trim() || 'Unknown',
          pos: row.POS?.trim() || '',
          bats: row.B || '',
          ovr: parseNum(row.OVR),
          vari: parseNum(row.VAR),
          g: parseNum(row.G),
          gs: parseNum(row.GS),
          pa: parseNum(row.PA),
          ab: parseNum(row.AB),
          h: parseNum(row.H),
          doubles: parseNum(row['2B']),
          triples: parseNum(row['3B']),
          hr: parseNum(row.HR),
          bbPct: parsePct(row['BB%']),
          so: parseNum(row.SO),
          gidp: parseNum(row.GIDP),
          avg: row.AVG || '.000',
          obp: row.OBP || '.000',
          slg: row.SLG || '.000',
          woba: row.wOBA || '.000',
          ops: row.OPS || '.000',
          opsPlus: parseNum(row['OPS+']),
          babip: row.BABIP || '.000',
          wrcPlus: parseNum(row['wRC+']),
          wraa: row.wRAA || '0.0',
          war: row.WAR || '0.0',
          sbPct: parsePct(row['SB%']),
          bsr: row.BsR || '0.0',
          // Store raw counting stats for compounding
          bb: parseNum(row.BB) || Math.round(parseNum(row.PA) * parseFloat(parsePct(row['BB%'])) / 100),
          sb: parseNum(row.SB) || 0,
          cs: parseNum(row.CS) || 0
        } : {
          id: crypto.randomUUID(),
          name: row.Name?.trim() || 'Unknown',
          pos: row.POS?.trim() || '',
          throws: row.T || '',
          ovr: parseNum(row.OVR),
          vari: parseNum(row.VAR),
          g: parseNum(row.G),
          gs: parseNum(row.GS),
          ip: row.IP || '0',
          bf: parseNum(row.BF),
          era: row.ERA || '0.00',
          avg: row.AVG || '.000',
          obp: row.OBP || '.000',
          babip: row.BABIP || '.000',
          whip: row.WHIP || '0.00',
          braPer9: row['BRA/9'] || '0.00',
          hrPer9: row['HR/9'] || '0.00',
          hPer9: row['H/9'] || '0.00',
          bbPer9: row['BB/9'] || '0.00',
          kPer9: row['K/9'] || '0.00',
          lobPct: parsePct(row['LOB%']),
          eraPlus: parseNum(row['ERA+']),
          fip: row.FIP || '0.00',
          fipMinus: parseNum(row['FIP-']),
          war: row.WAR || '0.0',
          siera: row.SIERA || '0.00',
          // Store raw counting stats for compounding
          er: parseNum(row.ER) || 0,
          h_allowed: parseNum(row.H) || 0,
          bb_allowed: parseNum(row.BB) || 0,
          k: parseNum(row.K) || parseNum(row.SO) || 0,
          hr_allowed: parseNum(row.HR) || 0
        };
        
        if (playerMap.has(key)) {
          // COMPOUND stats - add counting stats together, recalculate rate stats
          const existing = playerMap.get(key);
          
          if (upload.file_type === 'batting') {
            // Add counting stats
            const compounded = {
              ...existing,
              g: existing.g + normalized.g,
              gs: existing.gs + normalized.gs,
              pa: existing.pa + normalized.pa,
              ab: existing.ab + normalized.ab,
              h: existing.h + normalized.h,
              doubles: existing.doubles + normalized.doubles,
              triples: existing.triples + normalized.triples,
              hr: existing.hr + normalized.hr,
              so: existing.so + normalized.so,
              gidp: existing.gidp + normalized.gidp,
              bb: (existing.bb || 0) + (normalized.bb || 0),
              sb: (existing.sb || 0) + (normalized.sb || 0),
              cs: (existing.cs || 0) + (normalized.cs || 0),
              // Keep latest OVR, VAR, POS
              ovr: normalized.ovr,
              vari: normalized.vari,
              pos: normalized.pos || existing.pos,
              bats: normalized.bats || existing.bats
            };
            
            // Recalculate rate stats
            const ab = compounded.ab || 1;
            const pa = compounded.pa || 1;
            const h = compounded.h;
            const bb = compounded.bb || 0;
            const doubles = compounded.doubles;
            const triples = compounded.triples;
            const hr = compounded.hr;
            const singles = h - doubles - triples - hr;
            const tb = singles + (doubles * 2) + (triples * 3) + (hr * 4);
            const hbp = Math.round(pa - ab - bb); // Estimate HBP
            
            compounded.avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
            compounded.obp = pa > 0 ? ((h + bb + Math.max(0, hbp)) / pa).toFixed(3) : '.000';
            compounded.slg = ab > 0 ? (tb / ab).toFixed(3) : '.000';
            compounded.ops = (parseFloat(compounded.obp) + parseFloat(compounded.slg)).toFixed(3);
            compounded.bbPct = pa > 0 ? (bb / pa * 100).toFixed(1) : '0.0';
            compounded.sbPct = (compounded.sb + compounded.cs) > 0 ? (compounded.sb / (compounded.sb + compounded.cs) * 100).toFixed(1) : '0.0';
            
            // These advanced stats are harder to recalculate - use weighted average based on PA
            const oldPa = existing.pa || 1;
            const newPa = normalized.pa || 1;
            const totalPa = compounded.pa || 1;
            compounded.woba = ((parseFloat(existing.woba || 0) * oldPa + parseFloat(normalized.woba || 0) * newPa) / totalPa).toFixed(3);
            compounded.babip = ((parseFloat(existing.babip || 0) * oldPa + parseFloat(normalized.babip || 0) * newPa) / totalPa).toFixed(3);
            compounded.opsPlus = Math.round((parseFloat(existing.opsPlus || 0) * oldPa + parseFloat(normalized.opsPlus || 0) * newPa) / totalPa);
            compounded.wrcPlus = Math.round((parseFloat(existing.wrcPlus || 0) * oldPa + parseFloat(normalized.wrcPlus || 0) * newPa) / totalPa);
            compounded.wraa = ((parseFloat(existing.wraa || 0) + parseFloat(normalized.wraa || 0))).toFixed(1);
            compounded.war = ((parseFloat(existing.war || 0) + parseFloat(normalized.war || 0))).toFixed(1);
            compounded.bsr = ((parseFloat(existing.bsr || 0) + parseFloat(normalized.bsr || 0))).toFixed(1);
            
            playerMap.set(key, compounded);
          } else {
            // Pitching - add counting stats
            const parseIP = (ip) => {
              const str = String(ip);
              if (str.includes('.')) {
                const [whole, frac] = str.split('.');
                return parseFloat(whole) + (parseFloat(frac) / 3);
              }
              return parseFloat(ip) || 0;
            };
            const formatIP = (ipDecimal) => {
              const whole = Math.floor(ipDecimal);
              const frac = Math.round((ipDecimal - whole) * 3);
              return frac === 0 ? String(whole) : `${whole}.${frac}`;
            };
            
            const oldIP = parseIP(existing.ip);
            const newIP = parseIP(normalized.ip);
            const totalIP = oldIP + newIP;
            
            const compounded = {
              ...existing,
              g: existing.g + normalized.g,
              gs: existing.gs + normalized.gs,
              ip: formatIP(totalIP),
              bf: existing.bf + normalized.bf,
              er: (existing.er || 0) + (normalized.er || 0),
              h_allowed: (existing.h_allowed || 0) + (normalized.h_allowed || 0),
              bb_allowed: (existing.bb_allowed || 0) + (normalized.bb_allowed || 0),
              k: (existing.k || 0) + (normalized.k || 0),
              hr_allowed: (existing.hr_allowed || 0) + (normalized.hr_allowed || 0),
              // Keep latest OVR, VAR, POS
              ovr: normalized.ovr,
              vari: normalized.vari,
              pos: normalized.pos || existing.pos,
              throws: normalized.throws || existing.throws
            };
            
            // Recalculate rate stats
            const ip = totalIP || 1;
            const er = compounded.er || 0;
            const h_allowed = compounded.h_allowed || 0;
            const bb_allowed = compounded.bb_allowed || 0;
            const k = compounded.k || 0;
            const hr_allowed = compounded.hr_allowed || 0;
            const bf = compounded.bf || 1;
            
            compounded.era = ip > 0 ? (er * 9 / ip).toFixed(2) : '0.00';
            compounded.whip = ip > 0 ? ((h_allowed + bb_allowed) / ip).toFixed(2) : '0.00';
            compounded.hPer9 = ip > 0 ? (h_allowed * 9 / ip).toFixed(2) : '0.00';
            compounded.bbPer9 = ip > 0 ? (bb_allowed * 9 / ip).toFixed(2) : '0.00';
            compounded.kPer9 = ip > 0 ? (k * 9 / ip).toFixed(2) : '0.00';
            compounded.hrPer9 = ip > 0 ? (hr_allowed * 9 / ip).toFixed(2) : '0.00';
            compounded.avg = bf > 0 ? (h_allowed / (bf - bb_allowed)).toFixed(3) : '.000';
            
            // These advanced stats use weighted average based on IP
            const oldIpWeight = oldIP || 1;
            const newIpWeight = newIP || 1;
            compounded.babip = ((parseFloat(existing.babip || 0) * oldIpWeight + parseFloat(normalized.babip || 0) * newIpWeight) / ip).toFixed(3);
            compounded.lobPct = ((parseFloat(existing.lobPct || 0) * oldIpWeight + parseFloat(normalized.lobPct || 0) * newIpWeight) / ip).toFixed(1);
            compounded.fip = ((parseFloat(existing.fip || 0) * oldIpWeight + parseFloat(normalized.fip || 0) * newIpWeight) / ip).toFixed(2);
            compounded.siera = ((parseFloat(existing.siera || 0) * oldIpWeight + parseFloat(normalized.siera || 0) * newIpWeight) / ip).toFixed(2);
            compounded.braPer9 = ((parseFloat(existing.braPer9 || 0) * oldIpWeight + parseFloat(normalized.braPer9 || 0) * newIpWeight) / ip).toFixed(2);
            compounded.eraPlus = Math.round((parseFloat(existing.eraPlus || 0) * oldIpWeight + parseFloat(normalized.eraPlus || 0) * newIpWeight) / ip);
            compounded.fipMinus = Math.round((parseFloat(existing.fipMinus || 0) * oldIpWeight + parseFloat(normalized.fipMinus || 0) * newIpWeight) / ip);
            compounded.war = ((parseFloat(existing.war || 0) + parseFloat(normalized.war || 0))).toFixed(1);
            
            playerMap.set(key, compounded);
          }
        } else {
          playerMap.set(key, normalized);
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
        player_data: newData
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
      const existingData = historyItem.file_type === 'batting' ? (tournament.batting || []) : (tournament.pitching || []);
      const addedPlayerKeys = new Set((historyItem.player_data || []).map(p => `${p.Name}|${p.OVR}`));
      const filteredData = existingData.filter(p => !addedPlayerKeys.has(`${p.name}|${p.ovr}`));

      // Remove date from uploaded_dates
      const uploadedDates = (tournament.uploaded_dates || []).filter(d => d !== historyItem.upload_date);

      // Update tournament
      const updatePayload = historyItem.file_type === 'batting'
        ? { batting: filteredData, uploaded_dates: uploadedDates }
        : { pitching: filteredData, uploaded_dates: uploadedDates };
      
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
        uploaded_dates: []
      };

      const { error: createError } = await supabase.from('tournaments').insert(newTournament);
      if (createError) throw createError;

      // Now approve with the new tournament
      await handleApprove(upload, newTournament.id, upload.suggested_date);
      
      setCreatingNewFor(null);
      setNewEventName('');
      setNewEventType('daily');
      setNewEventCategory('tournaments');
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
                  ) : pendingUploads.map(upload => (
                    <div key={upload.id} style={styles.reviewCard}>
                      <div style={styles.reviewCardHeader}>
                        <span style={styles.reviewCardFile}>📄 {upload.file_name}</span>
                        <span style={styles.reviewCardTime}>{timeAgo(upload.created_at)}</span>
                      </div>
                      
                      <div style={styles.reviewCardBody}>
                        <div style={styles.reviewCardRow}>
                          <span style={styles.reviewCardLabel}>Type:</span>
                          <span style={styles.reviewCardValue}>{upload.file_type?.toUpperCase()} ({(upload.clean_data || []).length} players)</span>
                        </div>
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
                    </div>
                  ))}
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

export default function App() {
  return (<BrowserRouter><ThemeProvider><AuthProvider><Routes>
    <Route path="/" element={<StatsPage />} />
    <Route path="/info" element={<InfoPage />} />
    <Route path="/videos" element={<VideosPage />} />
    <Route path="/articles" element={<ArticlesPage />} />
    <Route path="/submit" element={<SubmitDataPage />} />
    <Route path="/review" element={<ReviewQueuePage />} />
    <Route path="/leaderboards" element={<LeaderboardsPage />} />
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
    title: { margin: 0, fontSize: 22, color: t.textPrimary, fontWeight: 700 },
    subtitle: { margin: '2px 0 0', fontSize: 12, color: t.textDim, fontWeight: 500 },
    
    // News Banner
    newsBannerContainer: { background: t.sidebarBg, borderBottom: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative' },
    newsBannerScroll: { display: 'flex', alignItems: 'center', position: 'relative' },
    newsBannerText: { display: 'inline-block', whiteSpace: 'nowrap', animation: 'scrollBanner 20s linear infinite', color: t.gold, fontWeight: 600, fontSize: 14, padding: '10px 0' },
    newsBannerSpacer: { margin: '0 50px', color: t.textDim },
    newsBannerEditBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: t.textMuted, fontSize: 12, zIndex: 10 },
    newsBannerEdit: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' },
    newsBannerInput: { flex: 1, padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13 },
    newsBannerSaveBtn: { padding: '8px 14px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    newsBannerCancelBtn: { padding: '8px 14px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    
    nav: { display: 'flex', gap: 4 },
    navLink: { padding: '8px 16px', color: t.textMuted, textDecoration: 'none', borderRadius: 4, fontWeight: 500, fontSize: 13 },
    navLinkActive: { background: t.accent, color: '#fff' },
    themeToggle: { width: 36, height: 36, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted },
    main: { display: 'flex', maxWidth: 1800, margin: '0 auto', minHeight: 'calc(100vh - 58px)' },
    sidebar: { width: 240, background: t.sidebarBg, borderRight: `1px solid ${t.border}`, padding: 14, flexShrink: 0, display: 'flex', flexDirection: 'column' },
    sidebarTabs: { display: 'flex', gap: 2, marginBottom: 12 },
    sidebarTabBtn: { flex: 1, padding: '8px 6px', background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 11 },
    sidebarTabActive: { background: t.panelBg, color: t.textPrimary },
    sidebarSearch: { width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, color: t.textPrimary, fontSize: 13, boxSizing: 'border-box', marginBottom: 10, outline: 'none' },
    tournamentList: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'auto' },
    emptyMsg: { color: t.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' },
    tournamentItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'transparent', borderRadius: 4, cursor: 'pointer', borderLeft: '3px solid transparent' },
    tournamentActive: { background: t.panelBg, borderLeftColor: t.accent },
    tournamentInfo: { display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', flex: 1 },
    tournamentName: { fontWeight: 500, color: t.textSecondary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
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
    tabActive: { background: t.panelBg, color: t.textPrimary },
    tabCount: { marginLeft: 6, color: t.textDim, fontWeight: 400 },
    controlBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: t.panelBg, borderRadius: 6 },
    controlGroup: { display: 'flex', alignItems: 'center', gap: 6 },
    controlDivider: { width: 1, height: 24, background: t.border, margin: '0 6px' },
    searchInput: { padding: '7px 12px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: '4px 0 0 4px', fontSize: 13, width: 160, outline: 'none' },
    filterSelect: { padding: '7px 12px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderLeft: 'none', borderRadius: '0 4px 4px 0', fontSize: 13, cursor: 'pointer', outline: 'none' },
    controlBtn: { padding: '7px 12px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    controlBtnActive: { background: t.accent, color: '#fff', borderColor: t.accent },
    controlBtnHighlight: { borderColor: t.accent, color: t.accent },
    filterBadge: { background: t.accent, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
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
    tableContainer: { background: t.tableBg, borderRadius: 6, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    tableWrapper: { overflow: 'auto', maxHeight: 'calc(100vh - 280px)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
    th: { padding: '8px 6px', background: t.tableHeaderBg, color: t.textMuted, fontWeight: 600, textAlign: 'center', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.border}`, userSelect: 'none', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.02em', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
    thRate: { background: t.tableHeaderBg, color: t.gold, fontSize: 10, fontWeight: 700 },
    thSorted: { color: t.textPrimary },
    sortIndicator: { marginLeft: 3, fontSize: 10 },
    tr: { borderBottom: `1px solid ${t.tableBorder}`, background: t.tableRowBg },
    td: { padding: '6px 6px', color: t.textPrimary, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 12 },
    tdName: { padding: '6px 6px', color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12 },
    tdOvr: { padding: '6px 6px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12 },
    tdRate: { padding: '6px 6px', color: t.gold, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600 },
    emptyTable: { padding: 48, textAlign: 'center', color: t.textMuted, fontSize: 14 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: t.cardBg, padding: 28, borderRadius: 8, border: `1px solid ${t.border}`, maxWidth: 400, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    modalTitle: { margin: '0 0 10px', color: t.textPrimary, fontSize: 20, fontWeight: 600 },
    modalText: { margin: '0 0 20px', color: t.textSecondary, fontSize: 14 },
    modalBtns: { display: 'flex', gap: 10, marginTop: 20 },
    authError: { color: t.error, fontSize: 13, margin: '0 0 14px', padding: '10px 14px', background: `${t.error}15`, borderRadius: 4 },
    input: { width: '100%', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', marginBottom: 10, outline: 'none' },
    textareaLarge: { width: '100%', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', minHeight: 140, outline: 'none' },
    formBtns: { display: 'flex', gap: 10 },
    newForm: { marginBottom: 12, padding: 12, background: t.panelBg, borderRadius: 6 },
    saveBtn: { flex: 1, padding: '10px 14px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    cancelBtn: { flex: 1, padding: '10px 14px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    addBtn: { padding: '8px 14px', background: t.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    editBtn: { padding: '8px 14px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
    pageContent: { flex: 1, padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${t.border}` },
    pageTitle: { margin: 0, fontSize: 24, color: t.textPrimary, fontWeight: 600 },
    infoContent: { display: 'flex', flexDirection: 'column', gap: 20 },
    infoSection: { background: t.panelBg, padding: 24, borderRadius: 6 },
    infoHeading: { margin: '0 0 12px', color: t.textPrimary, fontSize: 18, fontWeight: 600 },
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
