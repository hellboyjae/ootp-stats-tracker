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

  const styles = getStyles(theme);
  return (
    <AuthContext.Provider value={{ authLevel, hasAccess, requestAuth }}>
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

function Layout({ children, notification }) {
  const { isDark, toggle, theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? theme.error : theme.success}}>{notification.message}</div>}
      <header style={styles.header}><div style={styles.headerContent}>
        <div><h1 style={styles.title}>BeaneCounter</h1><p style={styles.subtitle}>OOTP Baseball Statistics</p></div>
        <div style={styles.headerRight}>
          <nav style={styles.nav}>
            <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})} end>Stats</NavLink>
            <NavLink to="/videos" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Videos</NavLink>
            <NavLink to="/info" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Info</NavLink>
          </nav>
          <button onClick={toggle} style={styles.themeToggle} title={isDark ? 'Light' : 'Dark'}>{isDark ? '☀' : '☾'}</button>
        </div>
      </div></header>
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
  const [filters, setFilters] = useState({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
  const [showPer9, setShowPer9] = useState(false);
  const [showTraditional, setShowTraditional] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tournaments');
  const [tournamentSearch, setTournamentSearch] = useState('');

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
        if (error.message?.includes('uploaded_hashes')) {
          const { error: retryError } = await supabase.from('tournaments').upsert({ id: tournament.id, name: tournament.name, created_at: tournament.createdAt, category: tournament.category, batting: tournament.batting, pitching: tournament.pitching });
          if (retryError) showNotif('Save failed', 'error');
        } else showNotif('Save failed', 'error');
      }
    } catch (e) { showNotif('Save failed', 'error'); }
  };

  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };

  const createTournament = () => {
    if (!newTournamentName.trim()) return;
    requestAuth(async () => {
      const newT = { id: crypto.randomUUID(), name: newTournamentName.trim(), createdAt: new Date().toISOString(), category: sidebarTab, batting: [], pitching: [], uploadedHashes: [] };
      await saveTournament(newT); setTournaments([newT, ...tournaments]); setSelectedTournament(newT);
      localStorage.setItem('selectedTournamentId', newT.id); setNewTournamentName(''); setShowNewTournament(false);
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
    requestAuth(async () => {
      try {
        let currentTournament = { ...selectedTournament };
        let uploadedHashes = [...(currentTournament.uploadedHashes || [])];
        let totalBatting = 0, totalPitching = 0, skippedDupes = 0;
        for (const file of files) {
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
        currentTournament.uploadedHashes = uploadedHashes;
        await saveTournament(currentTournament);
        setTournaments(tournaments.map(t => t.id === selectedTournament.id ? currentTournament : t));
        setSelectedTournament(currentTournament);
        let msg = totalBatting || totalPitching ? `✓ ${totalBatting ? totalBatting + ' batters' : ''}${totalPitching ? (totalBatting ? ', ' : '') + totalPitching + ' pitchers' : ''}` : 'No new data';
        if (skippedDupes) msg += ` (${skippedDupes} dupes skipped)`;
        showNotif(msg, (!totalBatting && !totalPitching) ? 'error' : undefined);
      } catch (e) { showNotif('Upload error', 'error'); }
      event.target.value = '';
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
          </div>
          <input type="text" placeholder="Search..." value={tournamentSearch} onChange={(e) => setTournamentSearch(e.target.value)} style={styles.sidebarSearch} />
          {showNewTournament && (<div style={styles.newForm}>
            <input type="text" placeholder="Name..." value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTournament()} style={styles.input} autoFocus />
            <div style={styles.formBtns}><button onClick={createTournament} style={styles.saveBtn}>Create</button><button onClick={() => setShowNewTournament(false)} style={styles.cancelBtn}>Cancel</button></div>
          </div>)}
          <div style={styles.tournamentList}>
            {filteredTournaments.length === 0 ? <p style={styles.emptyMsg}>No {sidebarTab} yet</p> :
              filteredTournaments.map(t => {
                const quality = getDataQuality(getCsvCount(t));
                const isSelected = selectedTournament?.id === t.id;
                return (<div key={t.id} style={{...styles.tournamentItem, ...(isSelected ? styles.tournamentActive : {})}} onClick={() => selectTournament(t)}>
                  <div style={styles.tournamentInfo}>
                    <span style={{...styles.tournamentName, ...(isSelected ? styles.tournamentNameActive : {})}}>{t.name}</span>
                    <span style={styles.tournamentStats}><span style={{color: quality.color, fontWeight: 600}}>{quality.label}</span> · {t.batting.length}B / {t.pitching.length}P</span>
                  </div>
                  <button style={styles.delBtn} onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}>{hasAccess('master') ? '×' : '🔒'}</button>
                </div>);
              })}
          </div>
          <button style={styles.newTournamentBtn} onClick={() => hasAccess('upload') ? setShowNewTournament(true) : requestAuth(() => setShowNewTournament(true), 'upload')}>{hasAccess('upload') ? '+ New' : '🔒 New'}</button>
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
              <label style={styles.uploadBtn}><span>{hasAccess('upload') ? '↑ Upload CSV' : '🔒 Upload'}</span><input type="file" accept=".csv" multiple onChange={handleFileUpload} style={{display:'none'}} /></label>
            </div>
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
                <button style={{...styles.controlBtn, ...(showPer9 ? styles.controlBtnActive : {})}} onClick={() => setShowPer9(!showPer9)}>Rate Stats</button>
                <button style={{...styles.controlBtn, ...(!showTraditional ? styles.controlBtnActive : {})}} onClick={() => setShowTraditional(!showTraditional)}>Compact</button>
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
  const { hasAccess, requestAuth } = useAuth();
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
          {!isEditing && <button onClick={startEditing} style={styles.editBtn}>{hasAccess('master') ? 'Edit' : '🔒 Edit'}</button>}
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
          <button onClick={() => requestAuth(() => setShowAddForm(true), 'master')} style={styles.addBtn}>{hasAccess('master') ? '+ Add' : '🔒 Add'}</button>
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

export default function App() {
  return (<BrowserRouter><ThemeProvider><AuthProvider><Routes>
    <Route path="/" element={<StatsPage />} />
    <Route path="/info" element={<InfoPage />} />
    <Route path="/videos" element={<VideosPage />} />
  </Routes></AuthProvider></ThemeProvider></BrowserRouter>);
}
: { borderColor: t.accent, color: t.accent },
    filterBadge: { background: t.accent, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 600 },
    resetBtn: { padding: '5px 10px', background: 'transparent', color: t.warning, border: `1px solid ${t.warning}40`, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500 },
    resultsCount: { marginLeft: 'auto', color: t.textDim, fontSize: 11, fontFamily: 'ui-monospace, monospace' },
    advancedFilters: { background: t.panelBg, borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
    filterGroup: { display: 'flex', gap: 16 },
    statFilter: { display: 'flex', alignItems: 'center', gap: 8 },
    statFilterLabel: { display: 'flex', alignItems: 'center', gap: 6, color: t.textSecondary, fontSize: 11, fontWeight: 500, cursor: 'pointer' },
    checkbox: { width: 14, height: 14, cursor: 'pointer' },
    statFilterControls: { display: 'flex', gap: 4 },
    operatorSelect: { padding: '4px 6px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' },
    valueInput: { padding: '4px 6px', background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 11, width: 50 },
    tableContainer: { background: t.tableBg, borderRadius: 6, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    tableWrapper: { overflow: 'auto', maxHeight: 'calc(100vh - 260px)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
    th: { padding: '6px 5px', background: t.tableHeaderBg, color: t.textMuted, fontWeight: 600, textAlign: 'center', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.border}`, userSelect: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
    thRate: { background: t.tableHeaderBg, color: t.textDim, fontSize: 9 },
    thSorted: { color: t.textPrimary },
    sortIndicator: { marginLeft: 2, fontSize: 9 },
    tr: { borderBottom: `1px solid ${t.tableBorder}`, background: t.tableRowBg },
    td: { padding: '4px 5px', color: t.textPrimary, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 11 },
    tdName: { padding: '4px 5px', color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left', fontSize: 11 },
    tdOvr: { padding: '4px 5px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 11 },
    tdRate: { padding: '4px 5px', color: t.textDim, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10 },
    emptyTable: { padding: 40, textAlign: 'center', color: t.textMuted },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: t.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${t.border}`, maxWidth: 360, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    modalTitle: { margin: '0 0 8px', color: t.textPrimary, fontSize: 18, fontWeight: 600 },
    modalText: { margin: '0 0 16px', color: t.textSecondary, fontSize: 13 },
    modalBtns: { display: 'flex', gap: 8, marginTop: 16 },
    authError: { color: t.error, fontSize: 12, margin: '0 0 12px', padding: '8px 12px', background: `${t.error}15`, borderRadius: 4 },
    input: { width: '100%', padding: '8px 10px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 13, boxSizing: 'border-box', marginBottom: 8, outline: 'none' },
    textareaLarge: { width: '100%', padding: '8px 10px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.textPrimary, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', minHeight: 120, outline: 'none' },
    formBtns: { display: 'flex', gap: 8 },
    newForm: { marginBottom: 10, padding: 10, background: t.panelBg, borderRadius: 6 },
    saveBtn: { flex: 1, padding: '8px 12px', background: t.success, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    cancelBtn: { flex: 1, padding: '8px 12px', background: t.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    addBtn: { padding: '6px 12px', background: t.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    editBtn: { padding: '6px 12px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 12 },
    pageContent: { flex: 1, padding: '20px 24px', maxWidth: 900, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${t.border}` },
    pageTitle: { margin: 0, fontSize: 20, color: t.textPrimary, fontWeight: 600 },
    infoContent: { display: 'flex', flexDirection: 'column', gap: 16 },
    infoSection: { background: t.panelBg, padding: 20, borderRadius: 6 },
    infoHeading: { margin: '0 0 10px', color: t.textPrimary, fontSize: 16, fontWeight: 600 },
    infoBody: { margin: 0, color: t.textSecondary, fontSize: 13, lineHeight: 1.6 },
    editContainer: { display: 'flex', flexDirection: 'column', gap: 12 },
    editField: { display: 'flex', flexDirection: 'column', gap: 6 },
    editLabel: { color: t.textSecondary, fontWeight: 500, fontSize: 12 },
    editSection: { background: t.panelBg, padding: 12, borderRadius: 6 },
    editSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    editSectionNum: { color: t.textDim, fontSize: 11, fontWeight: 600 },
    editSectionBtns: { display: 'flex', gap: 4 },
    moveBtn: { width: 24, height: 24, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 3, cursor: 'pointer', fontSize: 12 },
    removeBtn: { width: 24, height: 24, background: t.error, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
    addSectionBtn: { padding: 10, background: 'transparent', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 12 },
    editActions: { display: 'flex', gap: 8, marginTop: 12 },
    addVideoForm: { background: t.panelBg, padding: 16, borderRadius: 6, marginBottom: 16 },
    videoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
    videoCard: { background: t.panelBg, borderRadius: 6, overflow: 'hidden', position: 'relative' },
    thumbnailContainer: { position: 'relative', paddingTop: '56.25%', background: t.inputBg, cursor: 'pointer' },
    thumbnail: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
    thumbnailPlaceholder: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 36, color: t.textDim },
    videoInfo: { padding: 12 },
    videoTitle: { display: 'block', color: t.textPrimary, fontWeight: 500, fontSize: 13, marginBottom: 2 },
    videoPlatform: { color: t.textDim, fontSize: 11 },
    removeVideoBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, background: `${t.error}dd`, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
    videoPlayerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    videoPlayerContainer: { position: 'relative', width: '90%', maxWidth: 900, aspectRatio: '16/9' },
    videoPlayer: { width: '100%', height: '100%', borderRadius: 6 },
    closePlayerBtn: { position: 'absolute', top: -36, right: 0, background: 'transparent', color: '#fff', border: 'none', fontSize: 28, cursor: 'pointer' },
  };
}
