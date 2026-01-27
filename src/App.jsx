import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from './supabase.js';

const AuthContext = React.createContext();

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => { if (sessionStorage.getItem('uploadAuthenticated') === 'true') setIsAuthenticated(true); }, []);

  const requestAuth = (onSuccess) => {
    if (isAuthenticated) { onSuccess(); } else { setPendingAction(() => onSuccess); setShowPasswordModal(true); setAuthError(''); }
  };

  const handlePasswordSubmit = async () => {
    try {
      const hashedInput = await hashPassword(passwordInput);
      const { data, error } = await supabase.from('site_content').select('content').eq('id', 'auth').single();
      if (error || !data?.content?.passwordHash) { setAuthError('Auth not configured'); setPasswordInput(''); return; }
      if (hashedInput === data.content.passwordHash) {
        setIsAuthenticated(true); sessionStorage.setItem('uploadAuthenticated', 'true');
        setShowPasswordModal(false); setPasswordInput(''); setAuthError('');
        if (pendingAction) { pendingAction(); setPendingAction(null); }
      } else { setAuthError('Incorrect password'); setPasswordInput(''); }
    } catch (e) { setAuthError('Authentication failed'); setPasswordInput(''); }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, requestAuth }}>
      {children}
      {showPasswordModal && (
        <div style={styles.modalOverlay}><div style={styles.modal}>
          <h3 style={styles.modalTitle}>🔐 Enter Password</h3>
          <p style={styles.modalText}>This action requires authentication.</p>
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

function useAuth() { return React.useContext(AuthContext); }

function Layout({ children, notification }) {
  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? '#9e4600' : '#00683f'}}>{notification.message}</div>}
      <header style={styles.header}><div style={styles.headerContent}>
        <div><h1 style={styles.title}>⚾ BeaneCounter</h1><p style={styles.subtitle}>Out of the Park Baseball Statistics Tool by ItsHellboy</p></div>
        <nav style={styles.nav}>
          <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})} end>Stats</NavLink>
          <NavLink to="/videos" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Videos</NavLink>
          <NavLink to="/info" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>Info & FAQ</NavLink>
        </nav>
      </div></header>
      {children}
    </div>
  );
}

function StatsPage() {
  const { isAuthenticated, requestAuth } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('pitching');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [filters, setFilters] = useState({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc', gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 }, abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 } });
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
    try { await supabase.from('tournaments').upsert({ id: tournament.id, name: tournament.name, created_at: tournament.createdAt, category: tournament.category, batting: tournament.batting, pitching: tournament.pitching, uploaded_hashes: tournament.uploadedHashes || [] }); }
    catch (e) { showNotif('Failed to save', 'error'); }
  };

  const showNotif = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };

  const createTournament = async () => {
    if (!newTournamentName.trim()) return;
    const newT = { id: crypto.randomUUID(), name: newTournamentName.trim(), createdAt: new Date().toISOString(), category: sidebarTab, batting: [], pitching: [], uploadedHashes: [] };
    await saveTournament(newT); setTournaments([newT, ...tournaments]); setSelectedTournament(newT);
    localStorage.setItem('selectedTournamentId', newT.id); setNewTournamentName(''); setShowNewTournament(false);
    showNotif(`Created "${newT.name}"!`);
  };

  const deleteTournament = async (id) => {
    if (!confirm('Delete this and all its data?')) return;
    try { await supabase.from('tournaments').delete().eq('id', id);
      const updated = tournaments.filter(t => t.id !== id); setTournaments(updated);
      if (selectedTournament?.id === id) { setSelectedTournament(null); localStorage.removeItem('selectedTournamentId'); }
      showNotif('Deleted');
    } catch (e) { showNotif('Failed to delete', 'error'); }
  };

  const selectTournament = (t) => { setSelectedTournament(t); localStorage.setItem('selectedTournamentId', t.id); };
  const parseIP = (ip) => { if (!ip) return 0; const str = String(ip); if (str.includes('.')) { const [w, f] = str.split('.'); return parseFloat(w) + (parseFloat(f) / 3); } return parseFloat(ip) || 0; };
  const formatIP = (d) => { const w = Math.floor(d), f = Math.round((d - w) * 3); return f === 0 ? w.toString() : f === 3 ? (w + 1).toString() : `${w}.${f}`; };
  const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const parsePct = (v) => { if (!v) return '0.0'; const s = String(v).replace('%', ''); return s; };

  const combinePlayerStats = (existing, newP, type) => {
    const map = new Map(); existing.forEach(p => map.set(p.name, { ...p }));
    newP.forEach(p => {
      if (map.has(p.name)) {
        const e = map.get(p.name);
        if (type === 'pitching') {
          const cIP = parseIP(e.ip) + parseIP(p.ip), eIP = parseIP(e.ip), nIP = parseIP(p.ip);
          const wAvg = (s1, i1, s2, i2) => (i1 + i2 === 0) ? 0 : ((parseFloat(s1) * i1) + (parseFloat(s2) * i2)) / (i1 + i2);
          map.set(p.name, { ...e, 
            g: e.g + p.g, gs: e.gs + p.gs, ip: formatIP(cIP), bf: e.bf + p.bf,
            era: wAvg(e.era, eIP, p.era, nIP).toFixed(2),
            avg: wAvg(e.avg, eIP, p.avg, nIP).toFixed(3),
            obp: wAvg(e.obp, eIP, p.obp, nIP).toFixed(3),
            babip: wAvg(e.babip, eIP, p.babip, nIP).toFixed(3),
            whip: wAvg(e.whip, eIP, p.whip, nIP).toFixed(2),
            braPer9: wAvg(e.braPer9, eIP, p.braPer9, nIP).toFixed(2),
            hrPer9: wAvg(e.hrPer9, eIP, p.hrPer9, nIP).toFixed(2),
            hPer9: wAvg(e.hPer9, eIP, p.hPer9, nIP).toFixed(2),
            bbPer9: wAvg(e.bbPer9, eIP, p.bbPer9, nIP).toFixed(2),
            kPer9: wAvg(e.kPer9, eIP, p.kPer9, nIP).toFixed(2),
            lobPct: wAvg(e.lobPct, eIP, p.lobPct, nIP).toFixed(1),
            eraPlus: Math.round(wAvg(e.eraPlus, eIP, p.eraPlus, nIP)),
            fip: wAvg(e.fip, eIP, p.fip, nIP).toFixed(2),
            fipMinus: Math.round(wAvg(e.fipMinus, eIP, p.fipMinus, nIP)),
            war: (parseFloat(e.war||0) + parseFloat(p.war||0)).toFixed(1),
            siera: wAvg(e.siera, eIP, p.siera, nIP).toFixed(2)
          });
        } else {
          const cG = e.g + p.g, cGS = e.gs + p.gs, cPA = e.pa + p.pa, cAB = e.ab + p.ab;
          const cH = e.h + p.h, c2B = e.doubles + p.doubles, c3B = e.triples + p.triples, cHR = e.hr + p.hr;
          const cSO = e.so + p.so, cGIDP = e.gidp + p.gidp;
          const wAvg = (s1, w1, s2, w2) => (w1 + w2 === 0) ? 0 : ((parseFloat(s1) * w1) + (parseFloat(s2) * w2)) / (w1 + w2);
          const avg = cAB > 0 ? (cH / cAB).toFixed(3) : '.000';
          const tb = cH + c2B + (2 * c3B) + (3 * cHR);
          const slg = cAB > 0 ? (tb / cAB).toFixed(3) : '.000';
          const babipNum = cH - cHR, babipDenom = cAB - cSO - cHR;
          const babip = babipDenom > 0 ? (babipNum / babipDenom).toFixed(3) : '.000';
          map.set(p.name, { ...e,
            g: cG, gs: cGS, pa: cPA, ab: cAB, h: cH, doubles: c2B, triples: c3B, hr: cHR,
            bbPct: wAvg(e.bbPct, e.pa, p.bbPct, p.pa).toFixed(1),
            so: cSO, gidp: cGIDP, avg,
            obp: wAvg(e.obp, e.pa, p.obp, p.pa).toFixed(3),
            slg,
            woba: wAvg(e.woba, e.pa, p.woba, p.pa).toFixed(3),
            ops: wAvg(e.ops, e.pa, p.ops, p.pa).toFixed(3),
            opsPlus: Math.round(wAvg(e.opsPlus, e.pa, p.opsPlus, p.pa)),
            babip,
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
      return {
        id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', throws: row.T || '',
        ovr: parseNum(row.OVR), vari: parseNum(row.VAR), g: parseNum(row.G), gs: parseNum(row.GS), ip: row.IP || '0', bf: parseNum(row.BF),
        era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000', babip: row.BABIP || '.000', whip: row.WHIP || '0.00',
        braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00', hPer9: row['H/9'] || '0.00', bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00',
        lobPct: parsePct(row['LOB%']), eraPlus: parseNum(row['ERA+']), fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']), war: row.WAR || '0.0', siera: row.SIERA || '0.00'
      };
    } else {
      return {
        id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '', bats: row.B || '',
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
    if (file.size > MAX_FILE_SIZE) { showNotif(`File too large (${(file.size/1024/1024).toFixed(2)}MB). Max 1MB.`, 'error'); event.target.value = ''; return; }
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
            <button style={styles.addBtn} onClick={() => setShowNewTournament(true)}>+ New</button>
          </div>
          {showNewTournament && (<div style={styles.newForm}>
            <input type="text" placeholder="Name..." value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTournament()} style={styles.input} autoFocus />
            <div style={styles.formBtns}><button onClick={createTournament} style={styles.saveBtn}>Create</button><button onClick={() => setShowNewTournament(false)} style={styles.cancelBtn}>Cancel</button></div>
          </div>)}
          <div style={styles.tournamentList}>
            {filteredTournaments.length === 0 ? <p style={styles.emptyMsg}>No {sidebarTab} yet</p> :
              filteredTournaments.map(t => (<div key={t.id} style={{...styles.tournamentItem, ...(selectedTournament?.id === t.id ? styles.tournamentActive : {})}} onClick={() => selectTournament(t)}>
                <div style={styles.tournamentInfo}><span style={styles.tournamentName}>{t.name}</span><span style={styles.tournamentStats}>{t.batting.length} bat · {t.pitching.length} pitch</span></div>
                <button style={styles.delBtn} onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}>×</button>
              </div>))}
          </div>
        </aside>
        <div style={styles.content}>
          {!selectedTournament ? (<div style={styles.welcome}><h2 style={styles.welcomeTitle}>🏆 Welcome!</h2><p>Create or select a tournament to start tracking stats.</p></div>) : (<>
            <div style={styles.tournamentHeader}>
              <h2 style={styles.tournamentTitle}>{selectedTournament.name}</h2>
              {(selectedTournament.pitching.length > 0 || selectedTournament.batting.length > 0) && (<div style={styles.handednessContainer}>
                {selectedTournament.pitching.length > 0 && (() => { const s = getHandednessStats(selectedTournament.pitching, 'throws'); return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Pitchers (T):</span><span style={styles.handednessValue}>L {s.L}%</span><span style={styles.handednessValue}>S {s.S}%</span><span style={styles.handednessValue}>R {s.R}%</span></div>); })()}
                {selectedTournament.batting.length > 0 && (() => { const s = getHandednessStats(selectedTournament.batting, 'bats'); return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Batters (B):</span><span style={styles.handednessValue}>L {s.L}%</span><span style={styles.handednessValue}>S {s.S}%</span><span style={styles.handednessValue}>R {s.R}%</span></div>); })()}
              </div>)}
            </div>
            <div style={styles.uploadSection}>
              <label style={isAuthenticated ? styles.uploadBtn : styles.uploadBtnLocked}>{isAuthenticated ? '📁 Upload CSV' : '🔒 Upload CSV'}<input type="file" accept=".csv" onChange={handleFileUpload} style={{display:'none'}} /></label>
              <span style={styles.uploadHint}>{isAuthenticated ? 'Auto-detects type • Same-name players combined' : 'Password required'}</span>
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
              {getActiveFilterCount() > 0 && <button style={styles.resetBtn} onClick={resetFilters}>Reset All</button>}
            </div>
            {showAdvancedFilters && (<div style={styles.advancedFilters}><div style={styles.filterGroup}>
              <StatFilter label="Games (G)" filter={filters.gFilter} onChange={(u) => updateStatFilter('gFilter', u)} />
              {activeTab === 'batting' ? (<><StatFilter label="PA" filter={filters.paFilter} onChange={(u) => updateStatFilter('paFilter', u)} /><StatFilter label="AB" filter={filters.abFilter} onChange={(u) => updateStatFilter('abFilter', u)} /></>) : (<StatFilter label="IP" filter={filters.ipFilter} onChange={(u) => updateStatFilter('ipFilter', u)} />)}
            </div></div>)}
            <div style={styles.resultsCount}>Showing {filteredData.length} of {totalData} players</div>
            <div style={styles.tableContainer}>
              {activeTab === 'pitching' ? <PitchingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} /> : <BattingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} />}
            </div>
          </>)}
        </div>
      </main>
    </Layout>
  );
}

// Markdown parser for Info page
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/^### (.+)$/gm, '<h3 style="color:#9e4600;margin:16px 0 8px;font-size:16px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#9e4600;margin:20px 0 10px;font-size:20px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#9e4600;margin:24px 0 12px;font-size:24px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#362096;padding:2px 6px;border-radius:3px;font-family:monospace;">$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0;" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#9e4600;">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;">$1</li>')
    .replace(/\n/g, '<br />');
  return html;
}

function InfoPage() {
  const { isAuthenticated, requestAuth } = useAuth();
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
  const startEditing = () => { requestAuth(() => { setEditContent(JSON.parse(JSON.stringify(content))); setIsEditing(true); }); };
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
          {!isEditing && <button onClick={startEditing} style={styles.editBtn}>{isAuthenticated ? '✏️ Edit' : '🔒 Edit'}</button>}
        </div>
        {isEditing ? (<div style={styles.editContainer}>
          <div style={styles.editField}><label style={styles.editLabel}>Page Title</label><input type="text" value={editContent.title} onChange={(e) => setEditContent(c => ({ ...c, title: e.target.value }))} style={styles.input} /></div>
          
          <button onClick={() => setShowHelp(!showHelp)} style={styles.helpToggle}>{showHelp ? '▼ Hide' : '▶ Show'} Formatting Help</button>
          {showHelp && (
            <div style={styles.helpBox}>
              <p style={styles.helpTitle}>Markdown Formatting:</p>
              <code style={styles.helpCode}># Heading 1</code>
              <code style={styles.helpCode}>## Heading 2</code>
              <code style={styles.helpCode}>### Heading 3</code>
              <code style={styles.helpCode}>**bold text**</code>
              <code style={styles.helpCode}>*italic text*</code>
              <code style={styles.helpCode}>`inline code`</code>
              <code style={styles.helpCode}>[Link Text](https://url.com)</code>
              <code style={styles.helpCode}>![Alt Text](https://image-url.com/image.jpg)</code>
              <code style={styles.helpCode}>- List item</code>
            </div>
          )}
          
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
            content.sections.map((s, i) => (<div key={i} style={styles.infoSection}>
              <h3 style={styles.infoHeading}>{s.heading}</h3>
              <div style={styles.infoBody} dangerouslySetInnerHTML={{ __html: parseMarkdown(s.body) }} />
            </div>))}
        </div>)}
      </div>
    </Layout>
  );
}

function VideosPage() {
  const { isAuthenticated, requestAuth } = useAuth();
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
    });
  };

  const removeVideo = (i) => { requestAuth(() => { if (!confirm('Remove this video?')) return; saveVideos(videos.filter((_, idx) => idx !== i)); showNotif('Removed'); }); };

  if (isLoading) return <Layout notification={notification}><div style={styles.loading}><p>Loading...</p></div></Layout>;

  return (
    <Layout notification={notification}>
      <div style={styles.pageContent}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>📺 Videos</h2>
          <button onClick={() => requestAuth(() => setShowAddForm(true))} style={isAuthenticated ? styles.addBtn : styles.uploadBtnLocked}>{isAuthenticated ? '+ Add Video' : '🔒 Add Video'}</button>
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
        {videos.length === 0 ? <p style={styles.emptyMsg}>No videos yet. Add some videos to share!</p> : (
          <div style={styles.videoGrid}>
            {videos.map((v, i) => (<div key={i} style={styles.videoCard}>
              <div style={styles.thumbnailContainer} onClick={() => setPlayingVideo(i)}>
                {getThumbnail(v) ? <img src={getThumbnail(v)} alt={v.title} style={styles.thumbnail} /> : <div style={styles.thumbnailPlaceholder}>▶</div>}
                <div style={styles.playOverlay}>▶</div>
              </div>
              <div style={styles.videoInfo}><span style={styles.videoTitle}>{v.title}</span><span style={styles.videoPlatform}>{v.platform === 'youtube' ? 'YouTube' : 'Twitch'}</span></div>
              {isAuthenticated && <button onClick={() => removeVideo(i)} style={styles.removeVideoBtn}>✕</button>}
            </div>))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatFilter({ label, filter, onChange }) {
  return (<div style={styles.statFilter}><label style={styles.statFilterLabel}><input type="checkbox" checked={filter.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} style={styles.checkbox} />{label}</label>
    <div style={styles.statFilterControls}><select value={filter.operator} onChange={(e) => onChange({ operator: e.target.value })} style={styles.operatorSelect} disabled={!filter.enabled}>
      <option value=">">{'>'}</option><option value=">=">{'>='}</option><option value="=">=</option><option value="<=">{'<='}</option><option value="<">{'<'}</option>
    </select><input type="number" value={filter.value} onChange={(e) => onChange({ value: e.target.value })} style={styles.valueInput} disabled={!filter.enabled} min="0" /></div></div>);
}

function PitchingTable({ data, sortBy, sortDir, onSort }) {
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  const calcIPperG = (ip, g) => { if (!g) return '0.00'; const str = String(ip); let n = str.includes('.') ? parseFloat(str.split('.')[0]) + (parseFloat(str.split('.')[1]) / 3) : parseFloat(ip) || 0; return (n / g).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No pitching data</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="throws">T</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader><SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="ip">IP</SortHeader><SortHeader field="ipPerG">IP/G</SortHeader><SortHeader field="bf">BF</SortHeader><SortHeader field="era">ERA</SortHeader><SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="whip">WHIP</SortHeader><SortHeader field="braPer9">BRA/9</SortHeader><SortHeader field="hrPer9">HR/9</SortHeader><SortHeader field="hPer9">H/9</SortHeader><SortHeader field="bbPer9">BB/9</SortHeader><SortHeader field="kPer9">K/9</SortHeader><SortHeader field="lobPct">LOB%</SortHeader><SortHeader field="eraPlus">ERA+</SortHeader><SortHeader field="fip">FIP</SortHeader><SortHeader field="fipMinus">FIP-</SortHeader><SortHeader field="war">WAR</SortHeader><SortHeader field="siera">SIERA</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.throws}</td><td style={styles.tdOvr}>{p.ovr}</td><td style={styles.td}>{p.vari}</td><td style={styles.td}>{p.g}</td><td style={styles.td}>{p.gs}</td><td style={styles.td}>{p.ip}</td><td style={styles.tdStat}>{calcIPperG(p.ip, p.g)}</td><td style={styles.td}>{p.bf}</td><td style={styles.tdStat}>{p.era}</td><td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.babip}</td><td style={styles.tdStat}>{p.whip}</td><td style={styles.tdStat}>{p.braPer9}</td><td style={styles.tdStat}>{p.hrPer9}</td><td style={styles.tdStat}>{p.hPer9}</td><td style={styles.tdStat}>{p.bbPer9}</td><td style={styles.tdStat}>{p.kPer9}</td><td style={styles.td}>{p.lobPct}</td><td style={styles.tdStat}>{p.eraPlus}</td><td style={styles.tdStat}>{p.fip}</td><td style={styles.tdStat}>{p.fipMinus}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#4ade80' : '#f87171'}}>{p.war}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.siera) < 3.90 ? '#4ade80' : parseFloat(p.siera) > 3.90 ? '#f87171' : '#38bdf8'}}>{p.siera}</td>
    </tr>))}
  </tbody></table>);
}

function BattingTable({ data, sortBy, sortDir, onSort }) {
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  if (data.length === 0) return <div style={styles.emptyTable}>No batting data</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="bats">B</SortHeader><SortHeader field="ovr">OVR</SortHeader><SortHeader field="vari">VAR</SortHeader><SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="pa">PA</SortHeader><SortHeader field="ab">AB</SortHeader><SortHeader field="h">H</SortHeader><SortHeader field="doubles">2B</SortHeader><SortHeader field="triples">3B</SortHeader><SortHeader field="hr">HR</SortHeader><SortHeader field="bbPct">BB%</SortHeader><SortHeader field="so">SO</SortHeader><SortHeader field="gidp">GIDP</SortHeader><SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="slg">SLG</SortHeader><SortHeader field="woba">wOBA</SortHeader><SortHeader field="ops">OPS</SortHeader><SortHeader field="opsPlus">OPS+</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="wrcPlus">wRC+</SortHeader><SortHeader field="wraa">wRAA</SortHeader><SortHeader field="war">WAR</SortHeader><SortHeader field="sbPct">SB%</SortHeader><SortHeader field="bsr">BsR</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.td}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.td}>{p.bats}</td><td style={styles.tdOvr}>{p.ovr}</td><td style={styles.td}>{p.vari}</td><td style={styles.td}>{p.g}</td><td style={styles.td}>{p.gs}</td><td style={styles.td}>{p.pa}</td><td style={styles.td}>{p.ab}</td><td style={styles.td}>{p.h}</td><td style={styles.td}>{p.doubles}</td><td style={styles.td}>{p.triples}</td><td style={styles.td}>{p.hr}</td><td style={styles.td}>{p.bbPct}</td><td style={styles.td}>{p.so}</td><td style={styles.td}>{p.gidp}</td><td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.slg}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.woba) > 0.320 ? '#4ade80' : parseFloat(p.woba) < 0.320 ? '#f87171' : '#38bdf8'}}>{p.woba}</td>
      <td style={styles.tdStat}>{p.ops}</td><td style={styles.tdStat}>{p.opsPlus}</td><td style={styles.tdStat}>{p.babip}</td><td style={styles.tdStat}>{p.wrcPlus}</td><td style={styles.tdStat}>{p.wraa}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#4ade80' : '#f87171'}}>{p.war}</td>
      <td style={styles.td}>{p.sbPct}</td><td style={styles.tdStat}>{p.bsr}</td>
    </tr>))}
  </tbody></table>);
}

export default function App() {
  return (<BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<StatsPage />} />
    <Route path="/info" element={<InfoPage />} />
    <Route path="/videos" element={<VideosPage />} />
  </Routes></AuthProvider></BrowserRouter>);
}

const styles = {
  // Main container - dark purple base
  container: { minHeight: '100vh', background: '#171367', fontFamily: "'Courier New', monospace", color: '#ffffff' },
  loading: { minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' },
  notification: { position: 'fixed', top: 20, right: 20, padding: '12px 24px', borderRadius: 8, color: '#fff', fontWeight: 'bold', zIndex: 1000 },
  
  // Header - gradient purple with orange accent
  header: { background: 'linear-gradient(135deg, #171367, #362096)', borderBottom: '4px solid #9e4600', padding: '20px 32px' },
  headerContent: { maxWidth: 1800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  title: { margin: 0, fontSize: 28, color: '#9e4600', textTransform: 'uppercase', letterSpacing: 2 },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: '#ffffff' },
  
  // Navigation
  nav: { display: 'flex', gap: 8 },
  navLink: { padding: '10px 20px', background: '#362096', color: '#ffffff', textDecoration: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 14, border: '2px solid transparent' },
  navLinkActive: { background: '#9e4600', color: '#ffffff', borderColor: '#9e4600' },
  
  // Main layout
  main: { display: 'flex', maxWidth: 1800, margin: '0 auto', minHeight: 'calc(100vh - 120px)' },
  
  // Sidebar
  sidebar: { width: 260, background: '#362096', borderRight: '2px solid #9e4600', padding: 16, flexShrink: 0 },
  sidebarTabs: { display: 'flex', gap: 4, marginBottom: 16 },
  sidebarTabBtn: { flex: 1, padding: '10px 8px', background: '#171367', color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 },
  sidebarTabActive: { background: '#9e4600', color: '#ffffff' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '2px solid #9e4600' },
  sidebarTitle: { margin: 0, fontSize: 14, color: '#9e4600', textTransform: 'uppercase', fontWeight: 'bold' },
  
  // Buttons
  addBtn: { padding: '6px 12px', background: '#00683f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 },
  saveBtn: { flex: 1, padding: 8, background: '#00683f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { flex: 1, padding: 8, background: '#9e4600', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  uploadBtn: { padding: '10px 20px', background: '#00683f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  uploadBtnLocked: { padding: '10px 20px', background: '#362096', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  resetBtn: { padding: '10px 16px', background: '#9e4600', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  editBtn: { padding: '10px 20px', background: '#362096', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  
  // Forms
  newForm: { marginBottom: 12, padding: 12, background: '#171367', borderRadius: 8 },
  input: { width: '100%', padding: 10, background: '#171367', border: '2px solid #9e4600', borderRadius: 4, color: '#ffffff', fontSize: 14, boxSizing: 'border-box', marginBottom: 8 },
  textarea: { width: '100%', padding: 10, background: '#171367', border: '2px solid #9e4600', borderRadius: 4, color: '#ffffff', fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' },
  textareaLarge: { width: '100%', padding: 10, background: '#171367', border: '2px solid #9e4600', borderRadius: 4, color: '#ffffff', fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', minHeight: 150 },
  formBtns: { display: 'flex', gap: 8, marginTop: 10 },
  
  // Tournament list
  tournamentList: { display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMsg: { color: '#ffffff', fontSize: 13, textAlign: 'center', padding: '20px 0', opacity: 0.8 },
  tournamentItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#171367', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent' },
  tournamentActive: { borderColor: '#9e4600', background: '#362096' },
  tournamentInfo: { display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' },
  tournamentName: { fontWeight: 'bold', color: '#ffffff', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tournamentStats: { fontSize: 11, color: '#ffffff', opacity: 0.7 },
  delBtn: { width: 24, height: 24, background: 'transparent', color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 18, opacity: 0.7 },
  
  // Content area
  content: { flex: 1, padding: '24px 32px', overflow: 'auto' },
  welcome: { textAlign: 'center', padding: '60px 40px' },
  welcomeTitle: { fontSize: 32, color: '#9e4600', marginBottom: 12 },
  
  // Tournament header
  tournamentHeader: { marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #9e4600' },
  tournamentTitle: { fontSize: 24, color: '#9e4600', margin: 0 },
  handednessContainer: { display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' },
  handednessGroup: { display: 'flex', alignItems: 'center', gap: 12, background: '#362096', padding: '8px 16px', borderRadius: 6 },
  handednessLabel: { color: '#9e4600', fontWeight: 'bold', fontSize: 13 },
  handednessValue: { color: '#ffffff', fontSize: 13, fontFamily: "'Courier New', monospace" },
  
  // Upload section
  uploadSection: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: 16, background: '#362096', borderRadius: 8, border: '2px dashed #9e4600', flexWrap: 'wrap' },
  uploadHint: { color: '#ffffff', fontSize: 12, opacity: 0.8 },
  
  // Tabs
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { padding: '12px 24px', background: '#362096', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  tabActive: { background: '#9e4600', borderColor: '#9e4600', color: '#ffffff' },
  
  // Filters
  filterBar: { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { padding: '10px 16px', background: '#362096', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 4, fontSize: 14, width: 200 },
  filterSelect: { padding: '10px 16px', background: '#362096', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 4, fontSize: 14, cursor: 'pointer' },
  advancedFilterBtn: { padding: '10px 16px', background: '#362096', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' },
  advancedFilterBtnActive: { borderColor: '#00683f', color: '#00683f' },
  advancedFilterBtnHasFilters: { background: '#00683f', color: '#ffffff' },
  advancedFilters: { background: '#362096', borderRadius: 8, border: '2px solid #9e4600', padding: 16, marginBottom: 16 },
  filterGroup: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  statFilter: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 },
  statFilterLabel: { display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  statFilterControls: { display: 'flex', gap: 8 },
  operatorSelect: { padding: '6px 10px', background: '#171367', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 4, fontSize: 13, cursor: 'pointer' },
  valueInput: { padding: '6px 10px', background: '#171367', color: '#ffffff', border: '2px solid #9e4600', borderRadius: 4, fontSize: 13, width: 80 },
  resultsCount: { color: '#ffffff', fontSize: 12, marginBottom: 8, opacity: 0.8 },
  
  // Table - keeping stat colors unchanged
  tableContainer: { background: '#362096', borderRadius: 8, border: '2px solid #9e4600', overflow: 'auto', maxHeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: { padding: '10px 6px', background: '#171367', color: '#9e4600', fontWeight: 'bold', textAlign: 'center', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '2px solid #9e4600', userSelect: 'none' },
  tr: { borderBottom: '1px solid #362096' },
  td: { padding: '6px 6px', color: '#e2e8f0', textAlign: 'center', fontFamily: "'Courier New', monospace" },
  tdName: { padding: '6px 6px', color: '#f1f5f9', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'left' },
  tdOvr: { padding: '6px 6px', color: '#9e4600', textAlign: 'center', fontFamily: "'Courier New', monospace", fontWeight: 'bold' },
  tdStat: { padding: '6px 6px', color: '#38bdf8', textAlign: 'center', fontFamily: "'Courier New', monospace", fontWeight: 'bold' },
  emptyTable: { padding: 40, textAlign: 'center', color: '#ffffff', opacity: 0.7 },
  
  // Modal
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23,19,103,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#362096', padding: 32, borderRadius: 12, border: '2px solid #9e4600', maxWidth: 400, width: '90%' },
  modalTitle: { margin: '0 0 12px', color: '#9e4600', fontSize: 20 },
  modalText: { margin: '0 0 20px', color: '#ffffff', fontSize: 14, opacity: 0.8 },
  modalBtns: { display: 'flex', gap: 12, marginTop: 16 },
  authError: { color: '#f87171', fontSize: 13, margin: '0 0 12px', padding: '8px 12px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: 4 },
  
  // Page content
  pageContent: { flex: 1, padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #9e4600' },
  pageTitle: { margin: 0, fontSize: 28, color: '#9e4600' },
  
  // Info page
  infoContent: { display: 'flex', flexDirection: 'column', gap: 24 },
  infoSection: { background: '#362096', padding: 24, borderRadius: 8, border: '2px solid #9e4600' },
  infoHeading: { margin: '0 0 12px', color: '#9e4600', fontSize: 20 },
  infoBody: { margin: 0, color: '#ffffff', fontSize: 14, lineHeight: 1.6 },
  
  // Edit mode
  editContainer: { display: 'flex', flexDirection: 'column', gap: 16 },
  editField: { display: 'flex', flexDirection: 'column', gap: 8 },
  editLabel: { color: '#9e4600', fontWeight: 'bold', fontSize: 13 },
  editSection: { background: '#362096', padding: 16, borderRadius: 8, border: '2px solid #9e4600' },
  editSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editSectionNum: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', opacity: 0.7 },
  editSectionBtns: { display: 'flex', gap: 8 },
  moveBtn: { width: 28, height: 28, background: '#171367', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  removeBtn: { width: 28, height: 28, background: '#9e4600', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  addSectionBtn: { padding: '12px 24px', background: '#171367', color: '#9e4600', border: '2px dashed #9e4600', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  editActions: { display: 'flex', gap: 12, marginTop: 16 },
  
  // Markdown help
  helpToggle: { background: '#171367', color: '#9e4600', border: '1px solid #9e4600', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginBottom: 8 },
  helpBox: { background: '#171367', border: '1px solid #9e4600', borderRadius: 8, padding: 16, marginBottom: 16 },
  helpTitle: { color: '#9e4600', margin: '0 0 12px', fontWeight: 'bold' },
  helpCode: { display: 'block', background: '#362096', padding: '4px 8px', borderRadius: 4, marginBottom: 6, color: '#ffffff', fontSize: 12, fontFamily: 'monospace' },
  previewLabel: { color: '#9e4600', fontSize: 12, fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  previewBox: { background: '#171367', border: '1px solid #9e4600', borderRadius: 8, padding: 16, minHeight: 60, color: '#ffffff', fontSize: 14, lineHeight: 1.6 },
  
  // Videos page
  addVideoForm: { background: '#362096', padding: 24, borderRadius: 8, border: '2px solid #9e4600', marginBottom: 24 },
  formTitle: { margin: '0 0 16px', color: '#9e4600', fontSize: 18 },
  videoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  videoCard: { background: '#362096', borderRadius: 8, border: '2px solid #9e4600', overflow: 'hidden', position: 'relative' },
  thumbnailContainer: { position: 'relative', paddingTop: '56.25%', background: '#171367', cursor: 'pointer' },
  thumbnail: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  thumbnailPlaceholder: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 48, color: '#9e4600' },
  playOverlay: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 60, height: 60, background: 'rgba(158, 70, 0, 0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#ffffff', opacity: 0, transition: 'opacity 0.2s' },
  videoInfo: { padding: 16 },
  videoTitle: { display: 'block', color: '#ffffff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  videoPlatform: { color: '#ffffff', fontSize: 12, opacity: 0.7 },
  removeVideoBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(158, 70, 0, 0.9)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  videoPlayerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(23,19,103,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  videoPlayerContainer: { position: 'relative', width: '90%', maxWidth: 1000, aspectRatio: '16/9' },
  videoPlayer: { width: '100%', height: '100%', borderRadius: 8 },
  closePlayerBtn: { position: 'absolute', top: -40, right: 0, background: 'transparent', color: '#fff', border: 'none', fontSize: 32, cursor: 'pointer' }
};
