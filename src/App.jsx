import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from './supabase.js';

// Theme Context
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark
  });

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark(!isDark);
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, toggle, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() { return useContext(ThemeContext); }

// Auth Context
const AuthContext = createContext();

// Auth levels: 'none' | 'upload' | 'master'
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function AuthProvider({ children }) {
  const { theme } = useTheme();
  const [authLevel, setAuthLevel] = useState('none'); // 'none' | 'upload' | 'master'
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [requiredLevel, setRequiredLevel] = useState('upload');
  const [authError, setAuthError] = useState('');

  useEffect(() => { 
    const saved = sessionStorage.getItem('authLevel');
    if (saved === 'master' || saved === 'upload') setAuthLevel(saved);
  }, []);

  // Check if current auth level meets required level
  const hasAccess = (required) => {
    if (authLevel === 'master') return true;
    if (authLevel === 'upload' && required === 'upload') return true;
    return false;
  };

  // Request auth for a specific level
  const requestAuth = (onSuccess, level = 'upload') => {
    if (hasAccess(level)) { 
      onSuccess(); 
    } else { 
      setPendingAction(() => onSuccess); 
      setRequiredLevel(level);
      setShowPasswordModal(true); 
      setAuthError(''); 
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const hashedInput = await hashPassword(passwordInput);
      const { data, error } = await supabase.from('site_content').select('content').eq('id', 'auth').single();
      if (error || !data?.content) { setAuthError('Auth not configured'); setPasswordInput(''); return; }
      
      const { passwordHash, uploadPasswordHash } = data.content;
      
      // Check master password first
      if (passwordHash && hashedInput === passwordHash) {
        setAuthLevel('master'); 
        sessionStorage.setItem('authLevel', 'master');
        setShowPasswordModal(false); 
        setPasswordInput(''); 
        setAuthError('');
        if (pendingAction) { pendingAction(); setPendingAction(null); }
        return;
      }
      
      // Check upload-only password
      if (uploadPasswordHash && hashedInput === uploadPasswordHash) {
        // Upload password only works if upload-level access is sufficient
        if (requiredLevel === 'upload') {
          setAuthLevel('upload'); 
          sessionStorage.setItem('authLevel', 'upload');
          setShowPasswordModal(false); 
          setPasswordInput(''); 
          setAuthError('');
          if (pendingAction) { pendingAction(); setPendingAction(null); }
        } else {
          setAuthError('This action requires master password');
          setPasswordInput('');
        }
        return;
      }
      
      setAuthError('Incorrect password'); 
      setPasswordInput('');
    } catch (e) { 
      setAuthError('Authentication failed'); 
      setPasswordInput(''); 
    }
  };

  const styles = getStyles(theme);

  return (
    <AuthContext.Provider value={{ authLevel, hasAccess, requestAuth }}>
      {children}
      {showPasswordModal && (
        <div style={styles.modalOverlay}><div style={styles.modal}>
          <h3 style={styles.modalTitle}>🔐 Enter Password</h3>
          <p style={styles.modalText}>
            {requiredLevel === 'master' 
              ? 'This action requires master password.' 
              : 'Enter your password to continue.'}
          </p>
          {authError && <p style={styles.authError}>{authError}</p>}
          <input type="password" placeholder="Enter password..." value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} style={styles.input} autoFocus />
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

// OVR color helper
function getOvrColor(ovr) {
  const val = parseInt(ovr) || 0;
  if (val >= 100) return '#E82D07';
  if (val >= 90) return '#32EBFC';
  if (val >= 80) return '#FFE61F';
  if (val >= 70) return '#E0E0E0';
  if (val >= 60) return '#664300';
  return '#FFFFFF';
}

function Layout({ children, notification }) {
  const { isDark, toggle, theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? theme.error : theme.success}}>{notification.message}</div>}
      <header style={styles.header}><div style={styles.headerContent}>
        <div><h1 style={styles.title}>⚾ BeaneCounter</h1><p style={styles.subtitle}>Out of the Park Baseball Statistics Tool by ItsHellboy</p></div>
        <div style={styles.headerRight}>
          <nav style={styles.nav}>
            <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})} end>Stats</NavLink>
            <NavLink to="/videos" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Videos</NavLink>
            <NavLink to="/info" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Info & FAQ</NavLink>
          </nav>
          <button onClick={toggle} style={styles.themeToggle} title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div></header>
      {children}
    </div>
  );
}

function StatsPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { authLevel, hasAccess, requestAuth } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('pitching');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [filters, setFilters] = useState({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
  const [showPer9, setShowPer9] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tournaments');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const parsed = (data || []).map(t => ({ id: t.id, name: t.name, createdAt: t.created_at, category: t.category || 'tournaments', batting: t.batting || [], pitching: t.pitching || [], uploadedHashes: t.uploaded_hashes || [] }));
      setTournaments(parsed);
      const lastSelectedId = localStorage.getItem('selectedTournamentId');
      if (lastSelectedId) { const found = parsed.find(t => t.id === lastSelectedId); if (found) { setSelectedTournament(found); setSidebarTab(found.category || 'tournaments'); } }
    } catch (e) { console.error('Load error:', e); showNotif('Failed to load', 'error'); }
    setIsLoading(false);
  };

  const saveTournament = async (tournament) => {
    try { 
      const payload = { id: tournament.id, name: tournament.name, created_at: tournament.createdAt, category: tournament.category, batting: tournament.batting, pitching: tournament.pitching };
      if (tournament.uploadedHashes !== undefined) payload.uploaded_hashes = tournament.uploadedHashes;
      const { error } = await supabase.from('tournaments').upsert(payload);
      if (error) {
        console.error('Supabase save error:', error);
        if (error.message?.includes('uploaded_hashes')) {
          const { error: retryError } = await supabase.from('tournaments').upsert({ id: tournament.id, name: tournament.name, created_at: tournament.createdAt, category: tournament.category, batting: tournament.batting, pitching: tournament.pitching });
          if (retryError) showNotif(`Failed to save: ${retryError.message}`, 'error');
        } else { showNotif(`Failed to save: ${error.message}`, 'error'); }
      }
    } catch (e) { console.error('Save error:', e); showNotif('Failed to save', 'error'); }
  };

  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };

  const createTournament = () => {
    if (!newTournamentName.trim()) return;
    requestAuth(async () => {
      const newT = { id: crypto.randomUUID(), name: newTournamentName.trim(), createdAt: new Date().toISOString(), category: sidebarTab, batting: [], pitching: [], uploadedHashes: [] };
      await saveTournament(newT); setTournaments([newT, ...tournaments]); setSelectedTournament(newT);
      localStorage.setItem('selectedTournamentId', newT.id); setNewTournamentName(''); setShowNewTournament(false);
      showNotif(`Created "${newT.name}"!`);
    }, 'upload');
  };

  const deleteTournament = (id) => {
    requestAuth(async () => {
      if (!confirm('Delete this and all its data?')) return;
      try { await supabase.from('tournaments').delete().eq('id', id);
        const updated = tournaments.filter(t => t.id !== id); setTournaments(updated);
        if (selectedTournament?.id === id) { setSelectedTournament(null); localStorage.removeItem('selectedTournamentId'); }
        showNotif('Deleted');
      } catch (e) { showNotif('Failed to delete', 'error'); }
    }, 'master');
  };

  const selectTournament = (t) => { setSelectedTournament(t); localStorage.setItem('selectedTournamentId', t.id); };
  const parseIP = (ip) => { if (!ip) return 0; const str = String(ip); if (str.includes('.')) { const [w, f] = str.split('.'); return parseFloat(w) + (parseFloat(f) / 3); } return parseFloat(ip) || 0; };
  const formatIP = (d) => { const w = Math.floor(d), f = Math.round((d - w) * 3); return f === 0 ? w.toString() : f === 3 ? (w + 1).toString() : `${w}.${f}`; };
  const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const parsePct = (v) => { if (!v) return '0.0'; return String(v).replace('%', ''); };

  const combinePlayerStats = (existing, newP, type) => {
    const map = new Map(); existing.forEach(p => map.set(p.name, { ...p }));
    newP.forEach(p => {
      if (map.has(p.name)) {
        const e = map.get(p.name);
        if (type === 'pitching') {
          const cIP = parseIP(e.ip) + parseIP(p.ip), eIP = parseIP(e.ip), nIP = parseIP(p.ip);
          const wAvg = (s1, i1, s2, i2) => (i1 + i2 === 0) ? 0 : ((parseFloat(s1) * i1) + (parseFloat(s2) * i2)) / (i1 + i2);
          map.set(p.name, { ...e, g: e.g + p.g, gs: e.gs + p.gs, ip: formatIP(cIP), bf: e.bf + p.bf,
            era: wAvg(e.era, eIP, p.era, nIP).toFixed(2), avg: wAvg(e.avg, eIP, p.avg, nIP).toFixed(3),
            obp: wAvg(e.obp, eIP, p.obp, nIP).toFixed(3), babip: wAvg(e.babip, eIP, p.babip, nIP).toFixed(3),
            whip: wAvg(e.whip, eIP, p.whip, nIP).toFixed(2), braPer9: wAvg(e.braPer9, eIP, p.braPer9, nIP).toFixed(2),
            hrPer9: wAvg(e.hrPer9, eIP, p.hrPer9, nIP).toFixed(2), hPer9: wAvg(e.hPer9, eIP, p.hPer9, nIP).toFixed(2),
            bbPer9: wAvg(e.bbPer9, eIP, p.bbPer9, nIP).toFixed(2), kPer9: wAvg(e.kPer9, eIP, p.kPer9, nIP).toFixed(2),
            lobPct: wAvg(e.lobPct, eIP, p.lobPct, nIP).toFixed(1), eraPlus: Math.round(wAvg(e.eraPlus, eIP, p.eraPlus, nIP)),
            fip: wAvg(e.fip, eIP, p.fip, nIP).toFixed(2), fipMinus: Math.round(wAvg(e.fipMinus, eIP, p.fipMinus, nIP)),
            war: (parseFloat(e.war||0) + parseFloat(p.war||0)).toFixed(1), siera: wAvg(e.siera, eIP, p.siera, nIP).toFixed(2)
          });
        } else {
          const cG = e.g + p.g, cGS = e.gs + p.gs, cPA = e.pa + p.pa, cAB = e.ab + p.ab;
          const cH = e.h + p.h, c2B = e.doubles + p.doubles, c3B = e.triples + p.triples, cHR = e.hr + p.hr;
          const cSO = e.so + p.so, cGIDP = e.gidp + p.gidp;
          const wAvg = (s1, w1, s2, w2) => (w1 + w2 === 0) ? 0 : ((parseFloat(s1) * w1) + (parseFloat(s2) * w2)) / (w1 + w2);
          const avg = cAB > 0 ? (cH / cAB).toFixed(3) : '.000';
          const tb = cH + c2B + (2 * c3B) + (3 * cHR);
          const slg = cAB > 0 ? (tb / cAB).toFixed(3) : '.000';
          const babip = (cAB - cSO - cHR) > 0 ? ((cH - cHR) / (cAB - cSO - cHR)).toFixed(3) : '.000';
          map.set(p.name, { ...e, g: cG, gs: cGS, pa: cPA, ab: cAB, h: cH, doubles: c2B, triples: c3B, hr: cHR,
            bbPct: wAvg(e.bbPct, e.pa, p.bbPct, p.pa).toFixed(1), so: cSO, gidp: cGIDP, avg,
            obp: wAvg(e.obp, e.pa, p.obp, p.pa).toFixed(3), slg,
            woba: wAvg(e.woba, e.pa, p.woba, p.pa).toFixed(3), ops: wAvg(e.ops, e.pa, p.ops, p.pa).toFixed(3),
            opsPlus: Math.round(wAvg(e.opsPlus, e.pa, p.opsPlus, p.pa)), babip,
            wrcPlus: Math.round(wAvg(e.wrcPlus, e.pa, p.wrcPlus, p.pa)),
            wraa: (parseFloat(e.wraa||0) + parseFloat(p.wraa||0)).toFixed(1),
            war: (parseFloat(e.war||0) + parseFloat(p.war||0)).toFixed(1),
            sbPct: wAvg(e.sbPct, e.pa, p.sbPct, p.pa).toFixed(1),
            bsr: (parseFloat(e.bsr||0) + parseFloat(p.bsr||0)).toFixed(1)
          });
        }
      } else { map.set(p.name, { ...p, id: crypto.randomUUID() }); }
    });
    return Array.from(map.values());
  };

  const normalizePlayerData = (row, type) => {
    if (type === 'pitching') {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', throws: row.T || '',
        ovr: parseNum(row.OVR), vari: parseNum(row.VAR), g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
        era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000', babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
        braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00', hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
        lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']), fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']), war: row.WAR || '0.0', siera: row.SIERA || '0.00'
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
    if (isPitch) {
      const missing = PITCHING_HEADERS.filter(x => !h.includes(x));
      const extra = h.filter(x => !PITCHING_HEADERS.includes(x));
      return { valid: false, error: `Pitching header mismatch. ${missing.length ? `Missing: ${missing.join(', ')}. ` : ''}${extra.length ? `Extra: ${extra.join(', ')}. ` : ''}Expected ${PITCHING_HEADERS.length} cols, got ${h.length}.` };
    }
    if (isBat) {
      const missing = BATTING_HEADERS.filter(x => !h.includes(x));
      const extra = h.filter(x => !BATTING_HEADERS.includes(x));
      return { valid: false, error: `Batting header mismatch. ${missing.length ? `Missing: ${missing.join(', ')}. ` : ''}${extra.length ? `Extra: ${extra.join(', ')}. ` : ''}Expected ${BATTING_HEADERS.length} cols, got ${h.length}.` };
    }
    return { valid: false, error: 'Unrecognized CSV format.' };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0]; if (!file || !selectedTournament) return;
    if (file.size > MAX_FILE_SIZE) { showNotif(`File too large. Max 1MB.`, 'error'); event.target.value = ''; return; }
    if (!file.name.toLowerCase().endsWith('.csv')) { showNotif('Invalid file type. Upload .csv', 'error'); event.target.value = ''; return; }
    requestAuth(async () => {
      try {
        const fileContent = await file.text();
        const fileHash = await hashContent(fileContent);
        const uploadedHashes = selectedTournament.uploadedHashes || [];
        if (uploadedHashes.includes(fileHash)) { showNotif('Duplicate file already uploaded.', 'error'); event.target.value = ''; return; }
        Papa.parse(fileContent, { header: true, skipEmptyLines: true,
          complete: async (results) => {
            if (!results.meta.fields?.length) { showNotif('CSV has no headers.', 'error'); event.target.value = ''; return; }
            if (!results.data.length) { showNotif('CSV has no data rows.', 'error'); event.target.value = ''; return; }
            const validation = validateHeaders(results.meta.fields);
            if (!validation.valid) { showNotif(validation.error, 'error'); event.target.value = ''; return; }
            const validRows = results.data.filter(r => r.Name?.trim());
            if (!validRows.length) { showNotif('No valid player data found.', 'error'); event.target.value = ''; return; }
            const processed = validRows.map(r => normalizePlayerData(r, validation.type));
            const combined = combinePlayerStats(selectedTournament[validation.type], processed, validation.type);
            const updated = { ...selectedTournament, [validation.type]: combined, uploadedHashes: [...uploadedHashes, fileHash] };
            await saveTournament(updated);
            setTournaments(tournaments.map(t => t.id === selectedTournament.id ? updated : t));
            setSelectedTournament(updated);
            showNotif(`✓ ${validation.type === 'pitching' ? 'Pitching' : 'Batting'}: ${processed.length} → ${combined.length} players`);
            event.target.value = '';
          },
          error: (e) => { showNotif(`CSV error: ${e.message}`, 'error'); event.target.value = ''; }
        });
      } catch (e) { showNotif(`File error: ${e.message}`, 'error'); event.target.value = ''; }
    });
    event.target.value = '';
  };

  const passesFilter = (v, f) => { if (!f.enabled) return true; const nv = parseFloat(v) || 0, fv = parseFloat(f.value) || 0; return f.operator === '>' ? nv > fv : f.operator === '>=' ? nv >= fv : f.operator === '=' ? nv === fv : f.operator === '<=' ? nv <= fv : nv < fv; };

  const getFilteredData = (data, type) => {
    if (!data) return [];
    let f = [...data];
    if (filters.search) f = f.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.position !== 'all') f = f.filter(p => p.pos.toUpperCase() === filters.position.toUpperCase());
    f = f.filter(p => passesFilter(p.g, filters.gFilter));
    if (type === 'batting') { f = f.filter(p => passesFilter(p.pa, filters.paFilter) && passesFilter(p.ab, filters.abFilter)); }
    else { f = f.filter(p => passesFilter(parseIP(p.ip), filters.ipFilter)); }
    f.sort((a, b) => { let av = a[filters.sortBy], bv = b[filters.sortBy]; if (!isNaN(parseFloat(av)) && !isNaN(parseFloat(bv))) { av = parseFloat(av); bv = parseFloat(bv); return filters.sortDir === 'asc' ? av - bv : bv - av; } return filters.sortDir === 'asc' ? String(av||'').localeCompare(String(bv||'')) : String(bv||'').localeCompare(String(av||'')); });
    return f;
  };

  const toggleSort = (field) => { if (filters.sortBy === field) setFilters(f => ({ ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' })); else setFilters(f => ({ ...f, sortBy: field, sortDir: 'desc' })); };
  const updateStatFilter = (name, updates) => setFilters(f => ({ ...f, [name]: { ...f[name], ...updates } }));
  const resetFilters = () => setFilters({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
  const getActiveFilterCount = () => { let c = 0; if (filters.position !== 'all') c++; ['gFilter', 'paFilter', 'abFilter', 'ipFilter'].forEach(f => { if (filters[f].enabled) c++; }); return c; };

  const pitchingPositions = ['all', 'SP', 'RP', 'CL'];
  const battingPositions = ['all', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const getHandednessStats = (players, field) => {
    if (!players || players.length === 0) return { L: 0, S: 0, R: 0 };
    const total = players.length, counts = { L: 0, S: 0, R: 0 };
    players.forEach(p => { const v = (p[field] || '').toUpperCase(); if (counts[v] !== undefined) counts[v]++; });
    return { L: ((counts.L / total) * 100).toFixed(0), S: ((counts.S / total) * 100).toFixed(0), R: ((counts.R / total) * 100).toFixed(0) };
  };

  const filteredTournaments = tournaments.filter(t => (t.category || 'tournaments') === sidebarTab);
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
          </div>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>{sidebarTab === 'drafts' ? 'Drafts' : 'Tournaments'}</h2>
            <button style={hasAccess('upload') ? styles.addBtn : styles.addBtnLocked} onClick={() => hasAccess('upload') ? setShowNewTournament(true) : requestAuth(() => setShowNewTournament(true), 'upload')}>{hasAccess('upload') ? '+ New' : '🔒 New'}</button>
          </div>
          {showNewTournament && (<div style={styles.newForm}>
            <input type="text" placeholder="Name..." value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTournament()} style={styles.input} autoFocus />
            <div style={styles.formBtns}><button onClick={createTournament} style={styles.saveBtn}>Create</button><button onClick={() => setShowNewTournament(false)} style={styles.cancelBtn}>Cancel</button></div>
          </div>)}
          <div style={styles.tournamentList}>
            {filteredTournaments.length === 0 ? <p style={styles.emptyMsg}>No {sidebarTab} yet</p> :
              filteredTournaments.map(t => (<div key={t.id} style={{...styles.tournamentItem, ...(selectedTournament?.id === t.id ? styles.tournamentActive : {})}} onClick={() => selectTournament(t)}>
                <div style={styles.tournamentInfo}><span style={styles.tournamentName}>{t.name}</span><span style={styles.tournamentStats}>{t.batting.length} bat · {t.pitching.length} pitch</span></div>
                <button style={hasAccess('master') ? styles.delBtn : styles.delBtnLocked} onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }} title={hasAccess('master') ? 'Delete' : 'Master password required'}>{hasAccess('master') ? '×' : '🔒'}</button>
              </div>))}
          </div>
        </aside>
        <div style={styles.content}>
          {!selectedTournament ? (<div style={styles.welcome}><h2 style={styles.welcomeTitle}>🏆 Welcome!</h2><p style={styles.welcomeText}>Create or select a tournament to start tracking stats.</p></div>) : (<>
            <div style={styles.tournamentHeader}>
              <h2 style={styles.tournamentTitle}>{selectedTournament.name}</h2>
              {(selectedTournament.pitching.length > 0 || selectedTournament.batting.length > 0) && (<div style={styles.handednessContainer}>
                {selectedTournament.pitching.length > 0 && (() => { const s = getHandednessStats(selectedTournament.pitching, 'throws'); return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Pitchers (T):</span><span style={styles.handednessValue}>L {s.L}%</span><span style={styles.handednessValue}>S {s.S}%</span><span style={styles.handednessValue}>R {s.R}%</span></div>); })()}
                {selectedTournament.batting.length > 0 && (() => { const s = getHandednessStats(selectedTournament.batting, 'bats'); return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Batters (B):</span><span style={styles.handednessValue}>L {s.L}%</span><span style={styles.handednessValue}>S {s.S}%</span><span style={styles.handednessValue}>R {s.R}%</span></div>); })()}
              </div>)}
            </div>
            <div style={styles.uploadSection}>
              <label style={hasAccess('upload') ? styles.uploadBtn : styles.uploadBtnLocked}>{hasAccess('upload') ? '📁 Upload CSV' : '🔒 Upload CSV'}<input type="file" accept=".csv" onChange={handleFileUpload} style={{display:'none'}} /></label>
              <span style={styles.uploadHint}>{hasAccess('upload') ? 'Auto-detects type • Same-name players combined' : 'Password required'}</span>
            </div>
            <div style={styles.tabs}>
              <button style={{...styles.tab, ...(activeTab === 'pitching' ? styles.tabActive : {})}} onClick={() => { setActiveTab('pitching'); setFilters(f => ({...f, position: 'all'})); }}>⚾ Pitching ({selectedTournament.pitching.length})</button>
              <button style={{...styles.tab, ...(activeTab === 'batting' ? styles.tabActive : {})}} onClick={() => { setActiveTab('batting'); setFilters(f => ({...f, position: 'all'})); }}>🏏 Batting ({selectedTournament.batting.length})</button>
            </div>
            <div style={styles.filterBar}>
              <input type="text" placeholder="Search..." value={filters.search} onChange={(e) => setFilters(f => ({...f, search: e.target.value}))} style={styles.searchInput} />
              <select value={filters.position} onChange={(e) => setFilters(f => ({...f, position: e.target.value}))} style={styles.filterSelect}>
                {(activeTab === 'pitching' ? pitchingPositions : battingPositions).map(pos => (<option key={pos} value={pos}>{pos === 'all' ? 'All Positions' : pos}</option>))}
              </select>
              <button style={{...styles.advancedFilterBtn, ...(showAdvancedFilters ? styles.advancedFilterBtnActive : {}), ...(getActiveFilterCount() > 0 ? styles.advancedFilterBtnHasFilters : {})}} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>🎚️ Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}</button>
              <button style={{...styles.per9Toggle, ...(showPer9 ? styles.per9ToggleActive : {})}} onClick={() => setShowPer9(!showPer9)} title="Show per-9 innings calculations (recommended)">📊 Per-9 {showPer9 ? 'ON' : 'OFF'}</button>
              {getActiveFilterCount() > 0 && <button style={styles.resetBtn} onClick={resetFilters}>Reset All</button>}
            </div>
            {showAdvancedFilters && (<div style={styles.advancedFilters}><div style={styles.filterGroup}>
              <StatFilter label="Games (G)" filter={filters.gFilter} onChange={(u) => updateStatFilter('gFilter', u)} theme={theme} />
              {activeTab === 'batting' ? (<><StatFilter label="PA" filter={filters.paFilter} onChange={(u) => updateStatFilter('paFilter', u)} theme={theme} /><StatFilter label="AB" filter={filters.abFilter} onChange={(u) => updateStatFilter('abFilter', u)} theme={theme} /></>) : (<StatFilter label="IP" filter={filters.ipFilter} onChange={(u) => updateStatFilter('ipFilter', u)} theme={theme} />)}
            </div></div>)}
            <div style={styles.resultsCount}>Showing {filteredData.length} of {totalData} players {showPer9 && <span style={styles.per9Hint}>• Per-9 stats enabled (recommended)</span>}</div>
            <div style={styles.tableContainer}>
              {activeTab === 'pitching' ? <PitchingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} /> : <BattingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} theme={theme} showPer9={showPer9} />}
            </div>
          </>)}
        </div>
      </main>
    </Layout>
  );
}

// Markdown parser
function parseMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:16px;font-weight:bold;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 10px;font-size:20px;font-weight:bold;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 12px;font-size:24px;font-weight:bold;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="padding:2px 6px;border-radius:3px;font-family:monospace;">$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0;" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;">$1</li>')
    .replace(/\n/g, '<br />');
}

function InfoPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { authLevel, hasAccess, requestAuth } = useAuth();
  const [content, setContent] = useState({ title: 'Info & FAQ', sections: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState({ title: '', sections: [] });
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { loadContent(); }, []);

  const loadContent = async () => {
    setIsLoading(true);
    try { const { data } = await supabase.from('site_content').select('*').eq('id', 'info').single(); if (data?.content) setContent(data.content); }
    catch (e) { console.log('No content yet'); }
    setIsLoading(false);
  };

  const saveContent = async () => {
    try { await supabase.from('site_content').upsert({ id: 'info', content: editContent, updated_at: new Date().toISOString() }); setContent(editContent); setIsEditing(false); showNotif('Saved!'); }
    catch (e) { showNotif('Failed to save', 'error'); }
  };

  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };
  const startEditing = () => { requestAuth(() => { setEditContent(JSON.parse(JSON.stringify(content))); setIsEditing(true); }, 'master'); };
  const addSection = () => { setEditContent(c => ({ ...c, sections: [...c.sections, { heading: 'New Section', body: 'Content here...' }] })); };
  const updateSection = (i, field, value) => { setEditContent(c => { const s = [...c.sections]; s[i] = { ...s[i], [field]: value }; return { ...c, sections: s }; }); };
  const removeSection = (i) => { setEditContent(c => ({ ...c, sections: c.sections.filter((_, idx) => idx !== i) })); };
  const moveSection = (i, dir) => { const ni = i + dir; if (ni < 0 || ni >= editContent.sections.length) return; setEditContent(c => { const s = [...c.sections]; [s[i], s[ni]] = [s[ni], s[i]]; return { ...c, sections: s }; }); };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>{isEditing ? 'Edit Info & FAQ' : content.title}</h2>
          {!isEditing && <button onClick={startEditing} style={styles.editBtn}>{hasAccess('master') ? '✏️ Edit' : '🔒 Edit'}</button>}
        </div>
        {isEditing ? (<div style={styles.editContainer}>
          <div style={styles.editField}><label style={styles.editLabel}>Page Title</label><input type="text" value={editContent.title} onChange={(e) => setEditContent(c => ({ ...c, title: e.target.value }))} style={styles.input} /></div>
          <button onClick={() => setShowHelp(!showHelp)} style={styles.helpToggle}>{showHelp ? '▼ Hide' : '▶ Show'} Formatting Help</button>
          {showHelp && (<div style={styles.helpBox}>
            <p style={styles.helpTitle}>Markdown Formatting:</p>
            <code style={styles.helpCode}># Heading 1</code><code style={styles.helpCode}>## Heading 2</code><code style={styles.helpCode}>### Heading 3</code>
            <code style={styles.helpCode}>**bold text**</code><code style={styles.helpCode}>*italic text*</code><code style={styles.helpCode}>`inline code`</code>
            <code style={styles.helpCode}>[Link Text](https://url.com)</code><code style={styles.helpCode}>![Alt Text](https://image-url.com/image.jpg)</code><code style={styles.helpCode}>- List item</code>
          </div>)}
          {editContent.sections.map((section, i) => (<div key={i} style={styles.editSection}>
            <div style={styles.editSectionHeader}><span style={styles.editSectionNum}>Section {i + 1}</span>
              <div style={styles.editSectionBtns}><button onClick={() => moveSection(i, -1)} style={styles.moveBtn} disabled={i === 0}>↑</button><button onClick={() => moveSection(i, 1)} style={styles.moveBtn} disabled={i === editContent.sections.length - 1}>↓</button><button onClick={() => removeSection(i)} style={styles.removeBtn}>✕</button></div>
            </div>
            <input type="text" value={section.heading} onChange={(e) => updateSection(i, 'heading', e.target.value)} style={styles.input} placeholder="Heading" />
            <textarea value={section.body} onChange={(e) => updateSection(i, 'body', e.target.value)} style={styles.textareaLarge} rows={8} placeholder="Use Markdown for formatting..." />
            <div style={styles.previewLabel}>Preview:</div>
            <div style={styles.previewBox} dangerouslySetInnerHTML={{ __html: parseMarkdown(section.body) }} />
          </div>))}
          <button onClick={addSection} style={styles.addSectionBtn}>+ Add Section</button>
          <div style={styles.editActions}><button onClick={saveContent} style={styles.saveBtn}>Save Changes</button><button onClick={() => setIsEditing(false)} style={styles.cancelBtn}>Cancel</button></div>
        </div>) : (<div style={styles.infoContent}>
          {content.sections.length === 0 ? <p style={styles.emptyMsg}>No content yet. Click Edit to add some!</p> :
            content.sections.map((s, i) => (<div key={i} style={styles.infoSection}><h3 style={styles.infoHeading}>{s.heading}</h3><div style={styles.infoBody} dangerouslySetInnerHTML={{ __html: parseMarkdown(s.body) }} /></div>))}
        </div>)}
      </div>
    </Layout>
  );
}

function VideosPage() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { authLevel, hasAccess, requestAuth } = useAuth();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [notification, setNotification] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => { loadVideos(); }, []);

  const loadVideos = async () => {
    setIsLoading(true);
    try { const { data } = await supabase.from('site_content').select('*').eq('id', 'videos').single(); if (data?.content?.videos) setVideos(data.content.videos); }
    catch (e) { console.log('No videos yet'); }
    setIsLoading(false);
  };

  const saveVideos = async (newVideos) => {
    try { await supabase.from('site_content').upsert({ id: 'videos', content: { videos: newVideos }, updated_at: new Date().toISOString() }); setVideos(newVideos); }
    catch (e) { showNotif('Failed to save', 'error'); }
  };

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

  const addVideo = () => {
    requestAuth(() => {
      const info = extractVideoId(newVideoUrl);
      if (!info) { showNotif('Invalid URL. Use YouTube or Twitch.', 'error'); return; }
      const newVideo = { ...info, title: newVideoTitle || 'Untitled', addedAt: new Date().toISOString() };
      saveVideos([newVideo, ...videos]); setNewVideoUrl(''); setNewVideoTitle(''); setShowAddForm(false); showNotif('Video added!');
    }, 'master');
  };

  const removeVideo = (i) => { requestAuth(() => { if (!confirm('Remove this video?')) return; saveVideos(videos.filter((_, idx) => idx !== i)); showNotif('Removed'); }, 'master'); };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>📺 Videos</h2>
          <button onClick={() => requestAuth(() => setShowAddForm(true), 'master')} style={hasAccess('master') ? styles.addBtn : styles.uploadBtnLocked}>{hasAccess('master') ? '+ Add Video' : '🔒 Add Video'}</button>
        </div>
        {showAddForm && (<div style={styles.addVideoForm}>
          <h3 style={styles.formTitle}>Add New Video</h3>
          <input type="text" placeholder="Video title (optional)" value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} style={styles.input} />
          <input type="text" placeholder="YouTube or Twitch URL..." value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} style={styles.input} />
          <div style={styles.formBtns}><button onClick={addVideo} style={styles.saveBtn}>Add Video</button><button onClick={() => { setShowAddForm(false); setNewVideoUrl(''); setNewVideoTitle(''); }} style={styles.cancelBtn}>Cancel</button></div>
        </div>)}
        {playingVideo !== null && (<div style={styles.videoPlayerOverlay} onClick={() => setPlayingVideo(null)}>
          <div style={styles.videoPlayerContainer} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPlayingVideo(null)} style={styles.closePlayerBtn}>✕</button>
            <iframe src={getEmbedUrl(videos[playingVideo])} style={styles.videoPlayer} frameBorder="0" allowFullScreen allow="autoplay; encrypted-media" />
          </div>
        </div>)}
        {videos.length === 0 ? <p style={styles.emptyMsg}>No videos yet. Add some!</p> : (
          <div style={styles.videoGrid}>
            {videos.map((v, i) => (<div key={i} style={styles.videoCard}>
              <div style={styles.thumbnailContainer} onClick={() => setPlayingVideo(i)}>
                {getThumbnail(v) ? <img src={getThumbnail(v)} alt={v.title} style={styles.thumbnail} /> : <div style={styles.thumbnailPlaceholder}>▶</div>}
                <div style={styles.playOverlay}>▶</div>
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

function StatFilter({ label, filter, onChange, theme }) {
  const styles = getStyles(theme);
  return (<div style={styles.statFilter}><label style={styles.statFilterLabel}><input type="checkbox" checked={filter.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} style={styles.checkbox} />{label}</label>
    <div style={styles.statFilterControls}><select value={filter.operator} onChange={(e) => onChange({ operator: e.target.value })} style={styles.operatorSelect} disabled={!filter.enabled}>
      <option value=">">{'>'}</option><option value=">=">{'>='}</option><option value="=">=</option><option value="<=">{'<='}</option><option value="<">{'<'}</option>
    </select><input type="number" value={filter.value} onChange={(e) => onChange({ value: e.target.value })} style={styles.valueInput} disabled={!filter.enabled} min="0" /></div></div>);
}

function PitchingTable({ data, sortBy, sortDir, onSort, theme, showPer9 }) {
  const styles = getStyles(theme);
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  const calcIPperG = (ip, g) => { if (!g) return '0.00'; const str = String(ip); let n = str.includes('.') ? parseFloat(str.split('.')[0]) + (parseFloat(str.split('.')[1]) / 3) : parseFloat(ip) || 0; return (n / g).toFixed(2); };
  const calcPer9 = (val, g) => { if (!g || g === 0) return '0.00'; return (parseFloat(val || 0) / g * 9).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No pitching data</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="throws">T</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader><SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="ip">IP</SortHeader><SortHeader field="ipPerG">IP/G</SortHeader><SortHeader field="bf">BF</SortHeader><SortHeader field="era">ERA</SortHeader><SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="whip">WHIP</SortHeader><SortHeader field="braPer9">BRA/9</SortHeader><SortHeader field="hrPer9">HR/9</SortHeader><SortHeader field="hPer9">H/9</SortHeader><SortHeader field="bbPer9">BB/9</SortHeader><SortHeader field="kPer9">K/9</SortHeader><SortHeader field="lobPct">LOB%</SortHeader><SortHeader field="eraPlus">ERA+</SortHeader><SortHeader field="fip">FIP</SortHeader><SortHeader field="fipMinus">FIP-</SortHeader><SortHeader field="war">WAR</SortHeader>{showPer9 && <th style={styles.thPer9}>WAR/9</th>}<SortHeader field="siera">SIERA</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.throws}</td>
      <td style={{...styles.tdOvr, color: getOvrColor(p.ovr)}}>{p.ovr}</td>
      <td style={styles.td}>{p.vari}</td><td style={styles.td}>{p.g}</td><td style={styles.td}>{p.gs}</td><td style={styles.td}>{p.ip}</td><td style={styles.tdStat}>{calcIPperG(p.ip, p.g)}</td><td style={styles.td}>{p.bf}</td><td style={styles.tdStat}>{p.era}</td><td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.babip}</td><td style={styles.tdStat}>{p.whip}</td><td style={styles.tdStat}>{p.braPer9}</td><td style={styles.tdStat}>{p.hrPer9}</td><td style={styles.tdStat}>{p.hPer9}</td><td style={styles.tdStat}>{p.bbPer9}</td><td style={styles.tdStat}>{p.kPer9}</td><td style={styles.td}>{p.lobPct}</td><td style={styles.tdStat}>{p.eraPlus}</td><td style={styles.tdStat}>{p.fip}</td><td style={styles.tdStat}>{p.fipMinus}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#22C55E' : '#EF4444'}}>{p.war}</td>
      {showPer9 && <td style={styles.tdPer9}>{calcPer9(p.war, p.g)}</td>}
      <td style={{...styles.tdStat, color: parseFloat(p.siera) < 3.90 ? '#22C55E' : parseFloat(p.siera) > 3.90 ? '#EF4444' : styles.tdStat.color}}>{p.siera}</td>
    </tr>))}
  </tbody></table>);
}

function BattingTable({ data, sortBy, sortDir, onSort, theme, showPer9 }) {
  const styles = getStyles(theme);
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  const calcPer9 = (val, g) => { if (!g || g === 0) return '0.00'; return (parseFloat(val || 0) / g * 9).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No batting data</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="bats">B</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader><SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="pa">PA</SortHeader><SortHeader field="ab">AB</SortHeader><SortHeader field="h">H</SortHeader><SortHeader field="doubles">2B</SortHeader><SortHeader field="triples">3B</SortHeader><SortHeader field="hr">HR</SortHeader>{showPer9 && <th style={styles.thPer9}>HR/9</th>}<SortHeader field="bbPct">BB%</SortHeader><SortHeader field="so">SO</SortHeader>{showPer9 && <th style={styles.thPer9}>SO/9</th>}<SortHeader field="gidp">GIDP</SortHeader>{showPer9 && <th style={styles.thPer9}>GIDP/9</th>}<SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="slg">SLG</SortHeader><SortHeader field="woba">wOBA</SortHeader><SortHeader field="ops">OPS</SortHeader><SortHeader field="opsPlus">OPS+</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="wrcPlus">wRC+</SortHeader><SortHeader field="wraa">wRAA</SortHeader>{showPer9 && <th style={styles.thPer9}>wRAA/9</th>}<SortHeader field="war">WAR</SortHeader>{showPer9 && <th style={styles.thPer9}>WAR/9</th>}<SortHeader field="sbPct">SB%</SortHeader><SortHeader field="bsr">BsR</SortHeader>{showPer9 && <th style={styles.thPer9}>BsR/9</th>}
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.bats}</td>
      <td style={{...styles.tdOvr, color: getOvrColor(p.ovr)}}>{p.ovr}</td>
      <td style={styles.td}>{p.vari}</td><td style={styles.td}>{p.g}</td><td style={styles.td}>{p.gs}</td><td style={styles.td}>{p.pa}</td><td style={styles.td}>{p.ab}</td><td style={styles.td}>{p.h}</td><td style={styles.td}>{p.doubles}</td><td style={styles.td}>{p.triples}</td><td style={styles.td}>{p.hr}</td>{showPer9 && <td style={styles.tdPer9}>{calcPer9(p.hr, p.g)}</td>}<td style={styles.td}>{p.bbPct}</td><td style={styles.td}>{p.so}</td>{showPer9 && <td style={styles.tdPer9}>{calcPer9(p.so, p.g)}</td>}<td style={styles.td}>{p.gidp}</td>{showPer9 && <td style={styles.tdPer9}>{calcPer9(p.gidp, p.g)}</td>}<td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.slg}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.woba) > 0.320 ? '#22C55E' : parseFloat(p.woba) < 0.320 ? '#EF4444' : styles.tdStat.color}}>{p.woba}</td>
      <td style={styles.tdStat}>{p.ops}</td><td style={styles.tdStat}>{p.opsPlus}</td><td style={styles.tdStat}>{p.babip}</td><td style={styles.tdStat}>{p.wrcPlus}</td><td style={styles.tdStat}>{p.wraa}</td>{showPer9 && <td style={styles.tdPer9}>{calcPer9(p.wraa, p.g)}</td>}
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#22C55E' : '#EF4444'}}>{p.war}</td>
      {showPer9 && <td style={styles.tdPer9}>{calcPer9(p.war, p.g)}</td>}
      <td style={styles.td}>{p.sbPct}</td><td style={styles.tdStat}>{p.bsr}</td>{showPer9 && <td style={styles.tdPer9}>{calcPer9(p.bsr, p.g)}</td>}
    </tr>))}
  </tbody></table>);
}

export default function App() {
  return (<BrowserRouter><ThemeProvider><AuthProvider><Routes>
    <Route path="/" element={<StatsPage />} />
    <Route path="/info" element={<InfoPage />} />
    <Route path="/videos" element={<VideosPage />} />
  </Routes></AuthProvider></ThemeProvider></BrowserRouter>);
}

// Theme definitions
const darkTheme = {
  // Backgrounds
  mainBg: '#0F172A',
  cardBg: '#111827',
  deepBg: '#020617',
  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  // Accent
  accent: '#38BDF8',
  accentHover: '#0EA5E9',
  focus: '#FACC15',
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
  // Table
  tableHeaderBg: '#1E293B',
  tableRowBg: '#0F172A',
  tableRowHover: '#1E293B',
  tableBorder: '#334155',
  // Borders/Inputs
  border: '#334155',
  borderMuted: '#1E293B',
  inputBg: '#020617',
  inputBorder: '#475569',
};

const lightTheme = {
  // Backgrounds
  mainBg: '#FFFFFF',
  cardBg: '#F9FAFB',
  deepBg: '#F3F4F6',
  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  // Accent
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  focus: '#F59E0B',
  // Status
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  // Table
  tableHeaderBg: '#E5E7EB',
  tableRowBg: '#FFFFFF',
  tableRowHover: '#F3F4F6',
  tableBorder: '#D1D5DB',
  // Borders/Inputs
  border: '#D1D5DB',
  borderMuted: '#E5E7EB',
  inputBg: '#FFFFFF',
  inputBorder: '#9CA3AF',
};

// Dynamic styles generator
function getStyles(t) {
  return {
    container: { minHeight: '100vh', background: t.mainBg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: t.textPrimary },
    loading: { minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textPrimary },
    notification: { position: 'fixed', top: 20, right: 20, padding: '12px 24px', borderRadius: 8, color: '#fff', fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
    
    // Header
    header: { background: t.deepBg, borderBottom: `2px solid ${t.border}`, padding: '16px 32px' },
    headerContent: { maxWidth: 1800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
    title: { margin: 0, fontSize: 24, color: t.accent, fontWeight: 700, letterSpacing: 1 },
    subtitle: { margin: '4px 0 0', fontSize: 13, color: t.textSecondary },
    
    // Navigation
    nav: { display: 'flex', gap: 8 },
    navLink: { padding: '8px 16px', background: t.cardBg, color: t.textSecondary, textDecoration: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, border: `1px solid ${t.border}`, transition: 'all 0.2s' },
    navLinkActive: { background: t.accent, color: '#fff', borderColor: t.accent },
    themeToggle: { width: 40, height: 40, borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardBg, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    
    // Main layout
    main: { display: 'flex', maxWidth: 1800, margin: '0 auto', minHeight: 'calc(100vh - 100px)' },
    
    // Sidebar
    sidebar: { width: 260, background: t.cardBg, borderRight: `1px solid ${t.border}`, padding: 16, flexShrink: 0 },
    sidebarTabs: { display: 'flex', gap: 4, marginBottom: 16 },
    sidebarTabBtn: { flex: 1, padding: '8px', background: t.mainBg, color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    sidebarTabActive: { background: t.accent, color: '#fff', borderColor: t.accent },
    sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.border}` },
    sidebarTitle: { margin: 0, fontSize: 13, color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 },
    
    // Buttons
    addBtn: { padding: '6px 12px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    saveBtn: { flex: 1, padding: 10, background: t.success, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    cancelBtn: { flex: 1, padding: 10, background: t.textMuted, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    uploadBtn: { padding: '10px 20px', background: t.success, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    uploadBtnLocked: { padding: '10px 20px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    resetBtn: { padding: '8px 16px', background: t.warning, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    editBtn: { padding: '10px 20px', background: t.cardBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    
    // Forms
    newForm: { marginBottom: 12, padding: 12, background: t.mainBg, borderRadius: 8, border: `1px solid ${t.border}` },
    input: { width: '100%', padding: 10, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', marginBottom: 8 },
    textarea: { width: '100%', padding: 10, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' },
    textareaLarge: { width: '100%', padding: 10, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 6, color: t.textPrimary, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', minHeight: 150 },
    formBtns: { display: 'flex', gap: 8, marginTop: 8 },
    
    // Tournament list
    tournamentList: { display: 'flex', flexDirection: 'column', gap: 8 },
    emptyMsg: { color: t.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' },
    tournamentItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: t.mainBg, borderRadius: 6, cursor: 'pointer', border: `1px solid ${t.border}`, transition: 'all 0.2s' },
    tournamentActive: { borderColor: t.accent, background: t.tableRowHover },
    tournamentInfo: { display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' },
    tournamentName: { fontWeight: 600, color: t.textPrimary, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    tournamentStats: { fontSize: 11, color: t.textMuted },
    delBtn: { width: 24, height: 24, background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 18 },
    delBtnLocked: { width: 24, height: 24, background: 'transparent', color: t.textMuted, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, opacity: 0.6 },
    addBtnLocked: { padding: '6px 12px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 11 },
    
    // Content area
    content: { flex: 1, padding: '24px 32px', overflow: 'auto' },
    welcome: { textAlign: 'center', padding: '60px 40px' },
    welcomeTitle: { fontSize: 32, color: t.accent, marginBottom: 12, fontWeight: 700 },
    welcomeText: { color: t.textSecondary, fontSize: 16 },
    
    // Tournament header
    tournamentHeader: { marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${t.border}` },
    tournamentTitle: { fontSize: 24, color: t.textPrimary, margin: 0, fontWeight: 700 },
    handednessContainer: { display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' },
    handednessGroup: { display: 'flex', alignItems: 'center', gap: 12, background: t.cardBg, padding: '8px 16px', borderRadius: 6, border: `1px solid ${t.border}` },
    handednessLabel: { color: t.textSecondary, fontWeight: 600, fontSize: 12 },
    handednessValue: { color: t.textPrimary, fontSize: 13, fontFamily: 'monospace' },
    
    // Upload section
    uploadSection: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: 16, background: t.cardBg, borderRadius: 8, border: `2px dashed ${t.border}`, flexWrap: 'wrap' },
    uploadHint: { color: t.textMuted, fontSize: 12 },
    
    // Tabs
    tabs: { display: 'flex', gap: 8, marginBottom: 16 },
    tab: { padding: '10px 20px', background: t.cardBg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
    tabActive: { background: t.accent, borderColor: t.accent, color: '#fff' },
    
    // Filters
    filterBar: { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
    searchInput: { padding: '8px 14px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 14, width: 200 },
    filterSelect: { padding: '8px 14px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' },
    advancedFilterBtn: { padding: '8px 14px', background: t.cardBg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    advancedFilterBtnActive: { borderColor: t.accent, color: t.accent },
    advancedFilterBtnHasFilters: { background: t.accent, color: '#fff', borderColor: t.accent },
    per9Toggle: { padding: '8px 14px', background: t.cardBg, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    per9ToggleActive: { background: t.success, color: '#fff', borderColor: t.success },
    per9Hint: { color: t.success, fontWeight: 600 },
    advancedFilters: { background: t.cardBg, borderRadius: 8, border: `1px solid ${t.border}`, padding: 16, marginBottom: 16 },
    filterGroup: { display: 'flex', gap: 24, flexWrap: 'wrap' },
    statFilter: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 },
    statFilterLabel: { display: 'flex', alignItems: 'center', gap: 8, color: t.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    checkbox: { width: 16, height: 16, cursor: 'pointer' },
    statFilterControls: { display: 'flex', gap: 8 },
    operatorSelect: { padding: '6px 10px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}`, borderRadius: 4, fontSize: 13, cursor: 'pointer' },
    valueInput: { padding: '6px 10px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}`, borderRadius: 4, fontSize: 13, width: 80 },
    resultsCount: { color: t.textMuted, fontSize: 12, marginBottom: 8 },
    
    // Table
    tableContainer: { background: t.cardBg, borderRadius: 8, border: `1px solid ${t.tableBorder}`, overflow: 'auto', maxHeight: 500 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
    th: { padding: '10px 6px', background: t.tableHeaderBg, color: t.accent, fontWeight: 700, textAlign: 'center', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${t.tableBorder}`, userSelect: 'none' },
    thPer9: { padding: '10px 6px', background: t.tableHeaderBg, color: t.warning, fontWeight: 700, textAlign: 'center', position: 'sticky', top: 0, whiteSpace: 'nowrap', borderBottom: `2px solid ${t.tableBorder}`, userSelect: 'none', fontSize: 10 },
    tr: { borderBottom: `1px solid ${t.tableBorder}`, background: t.tableRowBg },
    td: { padding: '6px 6px', color: t.textPrimary, textAlign: 'center', fontFamily: 'monospace' },
    tdName: { padding: '6px 6px', color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' },
    tdOvr: { padding: '6px 6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 },
    tdStat: { padding: '6px 6px', color: t.accent, textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 },
    tdPer9: { padding: '6px 6px', color: t.warning, textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, fontSize: 10 },
    emptyTable: { padding: 40, textAlign: 'center', color: t.textMuted },
    
    // Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: t.cardBg, padding: 32, borderRadius: 12, border: `1px solid ${t.border}`, maxWidth: 400, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' },
    modalTitle: { margin: '0 0 12px', color: t.textPrimary, fontSize: 20, fontWeight: 700 },
    modalText: { margin: '0 0 20px', color: t.textSecondary, fontSize: 14 },
    modalBtns: { display: 'flex', gap: 12, marginTop: 16 },
    authError: { color: t.error, fontSize: 13, margin: '0 0 12px', padding: '8px 12px', background: `${t.error}15`, borderRadius: 6 },
    
    // Page content
    pageContent: { flex: 1, padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${t.border}` },
    pageTitle: { margin: 0, fontSize: 28, color: t.textPrimary, fontWeight: 700 },
    
    // Info page
    infoContent: { display: 'flex', flexDirection: 'column', gap: 24 },
    infoSection: { background: t.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${t.border}` },
    infoHeading: { margin: '0 0 12px', color: t.accent, fontSize: 20, fontWeight: 700 },
    infoBody: { margin: 0, color: t.textPrimary, fontSize: 14, lineHeight: 1.7 },
    
    // Edit mode
    editContainer: { display: 'flex', flexDirection: 'column', gap: 16 },
    editField: { display: 'flex', flexDirection: 'column', gap: 8 },
    editLabel: { color: t.textSecondary, fontWeight: 600, fontSize: 13 },
    editSection: { background: t.cardBg, padding: 16, borderRadius: 8, border: `1px solid ${t.border}` },
    editSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    editSectionNum: { color: t.textMuted, fontSize: 12, fontWeight: 600 },
    editSectionBtns: { display: 'flex', gap: 8 },
    moveBtn: { width: 28, height: 28, background: t.mainBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 14 },
    removeBtn: { width: 28, height: 28, background: t.error, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
    addSectionBtn: { padding: '12px 24px', background: t.mainBg, color: t.accent, border: `2px dashed ${t.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
    editActions: { display: 'flex', gap: 12, marginTop: 16 },
    
    // Markdown help
    helpToggle: { background: t.mainBg, color: t.accent, border: `1px solid ${t.border}`, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 8 },
    helpBox: { background: t.mainBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: 16, marginBottom: 16 },
    helpTitle: { color: t.textSecondary, margin: '0 0 12px', fontWeight: 700 },
    helpCode: { display: 'block', background: t.cardBg, padding: '4px 8px', borderRadius: 4, marginBottom: 6, color: t.textPrimary, fontSize: 12, fontFamily: 'monospace' },
    previewLabel: { color: t.textSecondary, fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 4 },
    previewBox: { background: t.mainBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: 16, minHeight: 60, color: t.textPrimary, fontSize: 14, lineHeight: 1.6 },
    
    // Videos page
    addVideoForm: { background: t.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${t.border}`, marginBottom: 24 },
    formTitle: { margin: '0 0 16px', color: t.textPrimary, fontSize: 18, fontWeight: 700 },
    videoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
    videoCard: { background: t.cardBg, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative' },
    thumbnailContainer: { position: 'relative', paddingTop: '56.25%', background: t.mainBg, cursor: 'pointer' },
    thumbnail: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
    thumbnailPlaceholder: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 48, color: t.textMuted },
    playOverlay: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 60, height: 60, background: `${t.accent}dd`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', opacity: 0, transition: 'opacity 0.2s' },
    videoInfo: { padding: 16 },
    videoTitle: { display: 'block', color: t.textPrimary, fontWeight: 600, fontSize: 14, marginBottom: 4 },
    videoPlatform: { color: t.textMuted, fontSize: 12 },
    removeVideoBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: `${t.error}dd`, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
    videoPlayerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    videoPlayerContainer: { position: 'relative', width: '90%', maxWidth: 1000, aspectRatio: '16/9' },
    videoPlayer: { width: '100%', height: '100%', borderRadius: 8 },
    closePlayerBtn: { position: 'absolute', top: -40, right: 0, background: 'transparent', color: '#fff', border: 'none', fontSize: 32, cursor: 'pointer' }
  };
}
