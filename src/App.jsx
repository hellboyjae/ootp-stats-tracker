import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from './supabase.js';

const UPLOAD_PASSWORD = 'nanodoctorootp1';

export default function App() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('pitching');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [uploadType, setUploadType] = useState('pitching');
  const [filters, setFilters] = useState({ 
    search: '', position: 'all', sortBy: 'war', sortDir: 'desc',
    gFilter: { enabled: false, operator: '>=', value: 0 },
    paFilter: { enabled: false, operator: '>=', value: 0 },
    abFilter: { enabled: false, operator: '>=', value: 0 },
    ipFilter: { enabled: false, operator: '>=', value: 0 }
  });
  const [notification, setNotification] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tournaments');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const parsed = (data || []).map(t => ({
        id: t.id, name: t.name, createdAt: t.created_at,
        category: t.category || 'tournaments',
        batting: t.batting || [], pitching: t.pitching || []
      }));
      setTournaments(parsed);
      const lastSelectedId = localStorage.getItem('selectedTournamentId');
      if (lastSelectedId) {
        const found = parsed.find(t => t.id === lastSelectedId);
        if (found) { setSelectedTournament(found); setSidebarTab(found.category || 'tournaments'); }
      }
      if (sessionStorage.getItem('uploadAuthenticated') === 'true') setIsAuthenticated(true);
    } catch (e) { console.error('Load error:', e); showNotification('Failed to load data', 'error'); }
    setIsLoading(false);
  };

  const saveTournament = async (tournament) => {
    try {
      const { error } = await supabase.from('tournaments').upsert({
        id: tournament.id, name: tournament.name, created_at: tournament.createdAt,
        category: tournament.category, batting: tournament.batting, pitching: tournament.pitching
      });
      if (error) throw error;
    } catch (e) { console.error('Save error:', e); showNotification('Failed to save', 'error'); }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const createTournament = async () => {
    if (!newTournamentName.trim()) return;
    const newTournament = {
      id: crypto.randomUUID(), name: newTournamentName.trim(),
      createdAt: new Date().toISOString(), category: sidebarTab, batting: [], pitching: []
    };
    await saveTournament(newTournament);
    setTournaments([newTournament, ...tournaments]);
    setSelectedTournament(newTournament);
    localStorage.setItem('selectedTournamentId', newTournament.id);
    setNewTournamentName(''); setShowNewTournament(false);
    showNotification(`${sidebarTab === 'drafts' ? 'Draft' : 'Tournament'} "${newTournament.name}" created!`);
  };

  const deleteTournament = async (id) => {
    if (!confirm('Delete this and all its data?')) return;
    try {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);
      if (error) throw error;
      const updated = tournaments.filter(t => t.id !== id);
      const newSelected = selectedTournament?.id === id ? null : selectedTournament;
      setTournaments(updated); setSelectedTournament(newSelected);
      newSelected ? localStorage.setItem('selectedTournamentId', newSelected.id) : localStorage.removeItem('selectedTournamentId');
      showNotification('Deleted successfully');
    } catch (e) { console.error('Delete error:', e); showNotification('Failed to delete', 'error'); }
  };

  const selectTournament = (t) => { setSelectedTournament(t); localStorage.setItem('selectedTournamentId', t.id); };

  const handlePasswordSubmit = () => {
    if (passwordInput === UPLOAD_PASSWORD) {
      setIsAuthenticated(true); sessionStorage.setItem('uploadAuthenticated', 'true');
      setShowPasswordModal(false); setPasswordInput(''); showNotification('Access granted!');
    } else { showNotification('Incorrect password', 'error'); setPasswordInput(''); }
  };

  const parseIP = (ip) => {
    if (!ip) return 0;
    const str = String(ip);
    if (str.includes('.')) { const [whole, frac] = str.split('.'); return parseFloat(whole) + (parseFloat(frac) / 3); }
    return parseFloat(ip) || 0;
  };

  const formatIP = (decimalIP) => {
    const whole = Math.floor(decimalIP);
    const frac = Math.round((decimalIP - whole) * 3);
    if (frac === 0) return whole.toString();
    if (frac === 3) return (whole + 1).toString();
    return `${whole}.${frac}`;
  };

  const combinePlayerStats = (existingPlayers, newPlayers, type) => {
    const playerMap = new Map();
    existingPlayers.forEach(p => playerMap.set(p.name, { ...p }));
    newPlayers.forEach(p => {
      if (playerMap.has(p.name)) {
        const existing = playerMap.get(p.name);
        if (type === 'pitching') {
          const combinedIP = parseIP(existing.ip) + parseIP(p.ip);
          const existingIP = parseIP(existing.ip), newIP = parseIP(p.ip);
          const weightedAvg = (s1, i1, s2, i2) => (i1 + i2 === 0) ? 0 : ((parseFloat(s1) * i1) + (parseFloat(s2) * i2)) / (i1 + i2);
          playerMap.set(p.name, { ...existing, g: existing.g + p.g, gs: existing.gs + p.gs,
            winPct: weightedAvg(existing.winPct, existingIP, p.winPct, newIP).toFixed(1),
            svPct: weightedAvg(existing.svPct, existingIP, p.svPct, newIP).toFixed(1),
            ip: formatIP(combinedIP), bf: existing.bf + p.bf,
            era: weightedAvg(existing.era, existingIP, p.era, newIP).toFixed(2),
            avg: weightedAvg(existing.avg, existingIP, p.avg, newIP).toFixed(3),
            obp: weightedAvg(existing.obp, existingIP, p.obp, newIP).toFixed(3),
            babip: weightedAvg(existing.babip, existingIP, p.babip, newIP).toFixed(3),
            whip: weightedAvg(existing.whip, existingIP, p.whip, newIP).toFixed(2),
            braPer9: weightedAvg(existing.braPer9, existingIP, p.braPer9, newIP).toFixed(2),
            hrPer9: weightedAvg(existing.hrPer9, existingIP, p.hrPer9, newIP).toFixed(2),
            bbPer9: weightedAvg(existing.bbPer9, existingIP, p.bbPer9, newIP).toFixed(2),
            kPer9: weightedAvg(existing.kPer9, existingIP, p.kPer9, newIP).toFixed(2),
            lobPct: weightedAvg(existing.lobPct, existingIP, p.lobPct, newIP).toFixed(1),
            eraPlus: Math.round(weightedAvg(existing.eraPlus, existingIP, p.eraPlus, newIP)),
            fip: weightedAvg(existing.fip, existingIP, p.fip, newIP).toFixed(2),
            fipMinus: Math.round(weightedAvg(existing.fipMinus, existingIP, p.fipMinus, newIP)),
            war: (parseFloat(existing.war || 0) + parseFloat(p.war || 0)).toFixed(1),
            siera: weightedAvg(existing.siera, existingIP, p.siera, newIP).toFixed(2)
          });
        } else {
          const cG = existing.g + p.g, cGS = existing.gs + p.gs, cPA = existing.pa + p.pa, cAB = existing.ab + p.ab;
          const cH = existing.h + p.h, c2B = existing.doubles + p.doubles, c3B = existing.triples + p.triples;
          const cHR = existing.hr + p.hr, cRBI = existing.rbi + p.rbi, cR = existing.r + p.r;
          const cBB = existing.bb + p.bb, cIBB = existing.ibb + p.ibb, cHP = existing.hp + p.hp;
          const cSO = existing.so + p.so, cGIDP = existing.gidp + p.gidp, cSB = existing.sb + p.sb, cCS = existing.cs + p.cs;
          const avg = cAB > 0 ? (cH / cAB).toFixed(3) : '.000';
          const obp = cPA > 0 ? ((cH + cBB + cHP) / cPA).toFixed(3) : '.000';
          const tb = cH + c2B + (2 * c3B) + (3 * cHR);
          const slg = cAB > 0 ? (tb / cAB).toFixed(3) : '.000';
          const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
          const iso = cAB > 0 ? ((tb - cH) / cAB).toFixed(3) : '.000';
          const cOPSplus = cPA > 0 ? ((existing.opsPlus * existing.pa) + (p.opsPlus * p.pa)) / cPA : 0;
          const babipNum = cH - cHR, babipDenom = cAB - cSO - cHR;
          const babip = babipDenom > 0 ? (babipNum / babipDenom).toFixed(3) : '.000';
          playerMap.set(p.name, { ...existing, g: cG, gs: cGS, pa: cPA, ab: cAB, h: cH, doubles: c2B, triples: c3B,
            hr: cHR, rbi: cRBI, r: cR, bb: cBB, ibb: cIBB, hp: cHP, so: cSO, gidp: cGIDP,
            avg, obp, slg, iso, ops, opsPlus: Math.round(cOPSplus), babip,
            war: (parseFloat(existing.war || 0) + parseFloat(p.war || 0)).toFixed(1), sb: cSB, cs: cCS
          });
        }
      } else { playerMap.set(p.name, { ...p, id: crypto.randomUUID() }); }
    });
    return Array.from(playerMap.values());
  };

  const parseNum = (val) => { const num = parseFloat(val); return isNaN(num) ? 0 : num; };

  const normalizePlayerData = (row, type) => {
    if (type === 'pitching') {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '',
        number: row['#'] || '', throws: row.T || '', g: parseNum(row.G), gs: parseNum(row.GS),
        winPct: row['WIN%'] || '0.0', svPct: row['SV%'] || '0.0', ip: row.IP || '0', bf: parseNum(row.BF),
        era: row.ERA || '0.00', avg: row.AVG || '.000', obp: row.OBP || '.000', babip: row.BABIP || '.000',
        whip: row.WHIP || '0.00', braPer9: row['BRA/9'] || '0.00', hrPer9: row['HR/9'] || '0.00',
        bbPer9: row['BB/9'] || '0.00', kPer9: row['K/9'] || '0.00', lobPct: row['LOB%'] || '0.0',
        eraPlus: parseNum(row['ERA+']), fip: row.FIP || '0.00', fipMinus: parseNum(row['FIP-']),
        war: row.WAR || '0.0', siera: row.SIERA || '0.00'
      };
    } else {
      return { id: crypto.randomUUID(), name: row.Name?.trim() || 'Unknown', pos: row.POS?.trim() || '',
        number: row['#'] || '', inf: row.Inf || '', bats: row.B || '', throws: row.T || '',
        g: parseNum(row.G), gs: parseNum(row.GS), pa: parseNum(row.PA), ab: parseNum(row.AB),
        h: parseNum(row.H), doubles: parseNum(row['2B']), triples: parseNum(row['3B']), hr: parseNum(row.HR),
        rbi: parseNum(row.RBI), r: parseNum(row.R), bb: parseNum(row.BB), ibb: parseNum(row.IBB),
        hp: parseNum(row.HP), so: parseNum(row.SO), gidp: parseNum(row.GIDP), avg: row.AVG || '.000',
        obp: row.OBP || '.000', slg: row.SLG || '.000', iso: row.ISO || '.000', ops: row.OPS || '.000',
        opsPlus: parseNum(row['OPS+']), babip: row.BABIP || '.000', war: row.WAR || '0.0',
        sb: parseNum(row.SB), cs: parseNum(row.CS)
      };
    }
  };

  // CSV ingestion helpers: trim headers, auto-detect batting vs pitching, and validate required columns
  const normalizeHeader = (h) => (h ?? '').toString().replace(/^\uFEFF/, '').trim();

  const EXPECTED_BATTING_HEADERS = [
    'POS','#','Name','Inf','B','T','G','GS','PA','AB','H','2B','3B','HR','RBI','R','BB','IBB','HP','SO','GIDP','AVG','OBP','SLG','ISO','OPS','OPS+','BABIP','WAR','SB','CS'
  ];

  const EXPECTED_PITCHING_HEADERS = [
    'POS','#','Name','T','G','GS','WIN%','SV%','IP','BF','ERA','AVG','OBP','BABIP','WHIP','BRA/9','HR/9','BB/9','K/9','LOB%','ERA+','FIP','FIP-','WAR','SIERA'
  ];

  const headersEqual = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (normalizeHeader(a[i]) !== normalizeHeader(b[i])) return false;
    }
    return true;
  };

  const detectCsvType = (headers = []) => {
    const normalized = headers.map(normalizeHeader);

    if (headersEqual(normalized, EXPECTED_PITCHING_HEADERS)) return 'pitching';
    if (headersEqual(normalized, EXPECTED_BATTING_HEADERS)) return 'batting';

    return null;
  };

  const validateCsvHeaders = (headers = [], type) => {
    const expected = type === 'pitching' ? EXPECTED_PITCHING_HEADERS : EXPECTED_BATTING_HEADERS;
    const normalized = headers.map(normalizeHeader);

    if (headersEqual(normalized, expected)) {
      return { ok: true, reason: null };
    }

    const maxLen = Math.max(normalized.length, expected.length);
    for (let i = 0; i < maxLen; i++) {
      const got = normalized[i];
      const exp = expected[i];
      if (got !== exp) {
        return {
          ok: false,
          reason: `Header mismatch at column ${i + 1}. Expected "${exp ?? '(end)'}" but got "${got ?? '(end)'}".`
        };
      }
    }

    return { ok: false, reason: 'Header mismatch.' };
  };


  const handleFileUpload = (event) => {
    if (!isAuthenticated) { setShowPasswordModal(true); event.target.value = ''; return; }
    const file = event.target.files[0];
    if (!file || !selectedTournament) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: async (results) => {
                const headers = (results?.meta?.fields || []).map(normalizeHeader);
        const detectedType = detectCsvType(headers);

        if (!detectedType) {
          showNotification(
            'Unrecognized CSV format. Header row must exactly match the expected OOTP export for batting or pitching.',
            'error'
          );
          event.target.value = '';
          return;
        }

        // Always follow detected type (hard requirement)
        if (detectedType !== uploadType) {
          setUploadType(detectedType);
          showNotification(`Detected ${detectedType} CSV — switching upload type`, 'info');
        }

        const typeToUse = detectedType;

        const validation = validateCsvHeaders(headers, typeToUse);
        if (!validation.ok) {
          showNotification(`${validation.reason} (Expected exact ${typeToUse} header set.)`, 'error');
          event.target.value = '';
          return;
        }

        if (results.data.length === 0) { showNotification('No data found', 'error'); return; }
        const processedData = results.data.filter(row => row.Name?.trim()).map(row => normalizePlayerData(row, typeToUse));
        const combinedData = combinePlayerStats(selectedTournament[typeToUse], processedData, typeToUse);
        const updatedTournament = { ...selectedTournament, [typeToUse]: combinedData };
        await saveTournament(updatedTournament);
        setTournaments(tournaments.map(t => t.id === selectedTournament.id ? updatedTournament : t));
        setSelectedTournament(updatedTournament);
        showNotification(`Processed ${processedData.length} records → ${combinedData.length} players`);
        event.target.value = '';
      },
      error: (error) => showNotification(`CSV Error: ${error.message}`, 'error')
    });
  };

  const passesFilter = (value, filter) => {
    if (!filter.enabled) return true;
    const numValue = parseFloat(value) || 0, filterValue = parseFloat(filter.value) || 0;
    switch (filter.operator) {
      case '>': return numValue > filterValue;
      case '>=': return numValue >= filterValue;
      case '=': return numValue === filterValue;
      case '<=': return numValue <= filterValue;
      case '<': return numValue < filterValue;
      default: return true;
    }
  };

  const getFilteredData = (data, type) => {
    if (!data) return [];
    let filtered = [...data];
    if (filters.search) filtered = filtered.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.position !== 'all') filtered = filtered.filter(p => p.pos.toUpperCase() === filters.position.toUpperCase());
    filtered = filtered.filter(p => passesFilter(p.g, filters.gFilter));
    if (type === 'batting') {
      filtered = filtered.filter(p => passesFilter(p.pa, filters.paFilter));
      filtered = filtered.filter(p => passesFilter(p.ab, filters.abFilter));
    } else { filtered = filtered.filter(p => passesFilter(parseIP(p.ip), filters.ipFilter)); }
    filtered.sort((a, b) => {
      let aVal = a[filters.sortBy], bVal = b[filters.sortBy];
      if (!isNaN(parseFloat(aVal)) && !isNaN(parseFloat(bVal))) {
        aVal = parseFloat(aVal); bVal = parseFloat(bVal);
        return filters.sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return filters.sortDir === 'asc' ? String(aVal||'').localeCompare(String(bVal||'')) : String(bVal||'').localeCompare(String(aVal||''));
    });
    return filtered;
  };

  const toggleSort = (field) => {
    if (filters.sortBy === field) setFilters(f => ({ ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' }));
    else setFilters(f => ({ ...f, sortBy: field, sortDir: 'desc' }));
  };

  const updateStatFilter = (filterName, updates) => setFilters(f => ({ ...f, [filterName]: { ...f[filterName], ...updates } }));

  const resetFilters = () => setFilters({ search: '', position: 'all', sortBy: 'war', sortDir: 'desc',
    gFilter: { enabled: false, operator: '>=', value: 0 }, paFilter: { enabled: false, operator: '>=', value: 0 },
    abFilter: { enabled: false, operator: '>=', value: 0 }, ipFilter: { enabled: false, operator: '>=', value: 0 }
  });

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.position !== 'all') count++;
    ['gFilter', 'paFilter', 'abFilter', 'ipFilter'].forEach(f => { if (filters[f].enabled) count++; });
    return count;
  };

  const pitchingPositions = ['all', 'SP', 'RP', 'CL'];
  const battingPositions = ['all', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const getHandednessStats = (players, field) => {
    if (!players || players.length === 0) return { L: 0, S: 0, R: 0 };
    const total = players.length, counts = { L: 0, S: 0, R: 0 };
    players.forEach(p => { const val = (p[field] || '').toUpperCase(); if (counts[val] !== undefined) counts[val]++; });
    return { L: ((counts.L / total) * 100).toFixed(0), S: ((counts.S / total) * 100).toFixed(0), R: ((counts.R / total) * 100).toFixed(0) };
  };

  const filteredTournaments = tournaments.filter(t => (t.category || 'tournaments') === sidebarTab);

  if (isLoading) return <div style={styles.loading}><p>Loading...</p></div>;

  const filteredData = selectedTournament ? getFilteredData(selectedTournament[activeTab], activeTab) : [];
  const totalData = selectedTournament ? selectedTournament[activeTab].length : 0;

  return (
    <div style={styles.container}>
      {notification && <div style={{...styles.notification, background: notification.type === 'error' ? '#dc2626' : notification.type === 'warning' ? '#d97706' : notification.type === 'info' ? '#2563eb' : '#059669'}}>{notification.message}</div>}
      {showPasswordModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>🔐 Enter Password</h3>
            <p style={styles.modalText}>Upload access is password protected.</p>
            <input type="password" placeholder="Enter password..." value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              style={styles.input} autoFocus />
            <div style={styles.modalBtns}>
              <button onClick={handlePasswordSubmit} style={styles.saveBtn}>Submit</button>
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); }} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <header style={styles.header}>
        <h1 style={styles.title}>⚾ OOTP Stats Tracker</h1>
        <p style={styles.subtitle}>Out of the Park Baseball Tournament Manager</p>
      </header>
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
          {showNewTournament && (
            <div style={styles.newForm}>
              <input type="text" placeholder={`${sidebarTab === 'drafts' ? 'Draft' : 'Tournament'} name...`} value={newTournamentName}
                onChange={(e) => setNewTournamentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTournament()} style={styles.input} autoFocus />
              <div style={styles.formBtns}>
                <button onClick={createTournament} style={styles.saveBtn}>Create</button>
                <button onClick={() => setShowNewTournament(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </div>
          )}
          <div style={styles.tournamentList}>
            {filteredTournaments.length === 0 ? <p style={styles.emptyMsg}>No {sidebarTab} yet</p> :
              filteredTournaments.map(t => (
                <div key={t.id} style={{...styles.tournamentItem, ...(selectedTournament?.id === t.id ? styles.tournamentActive : {})}} onClick={() => selectTournament(t)}>
                  <div style={styles.tournamentInfo}>
                    <span style={styles.tournamentName}>{t.name}</span>
                    <span style={styles.tournamentStats}>{t.batting.length} bat · {t.pitching.length} pitch</span>
                  </div>
                  <button style={styles.delBtn} onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}>×</button>
                </div>
              ))}
          </div>
        </aside>
        <div style={styles.content}>
          {!selectedTournament ? (
            <div style={styles.welcome}>
              <h2 style={styles.welcomeTitle}>🏆 Welcome!</h2>
              <p>Create or select a tournament to start tracking stats.</p>
              <div style={styles.features}>
                <div style={styles.feature}><b>📊 Import CSV</b><br/>Upload OOTP exports</div>
                <div style={styles.feature}><b>🔄 Auto-Combine</b><br/>Same-name players merged</div>
                <div style={styles.feature}><b>🔍 Filter & Sort</b><br/>By position, name, stats</div>
                <div style={styles.feature}><b>💾 Cloud Sync</b><br/>Data saved to cloud</div>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.tournamentHeader}>
                <h2 style={styles.tournamentTitle}>{selectedTournament.name}</h2>
                {(selectedTournament.pitching.length > 0 || selectedTournament.batting.length > 0) && (
                  <div style={styles.handednessContainer}>
                    {selectedTournament.pitching.length > 0 && (() => {
                      const stats = getHandednessStats(selectedTournament.pitching, 'throws');
                      return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Pitchers (T):</span>
                        <span style={styles.handednessValue}>L {stats.L}%</span><span style={styles.handednessValue}>S {stats.S}%</span><span style={styles.handednessValue}>R {stats.R}%</span></div>);
                    })()}
                    {selectedTournament.batting.length > 0 && (() => {
                      const stats = getHandednessStats(selectedTournament.batting, 'bats');
                      return (<div style={styles.handednessGroup}><span style={styles.handednessLabel}>Batters (B):</span>
                        <span style={styles.handednessValue}>L {stats.L}%</span><span style={styles.handednessValue}>S {stats.S}%</span><span style={styles.handednessValue}>R {stats.R}%</span></div>);
                    })()}
                  </div>
                )}
              </div>
              <div style={styles.uploadSection}>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} style={styles.select}>
                  <option value="pitching">Pitching Stats</option><option value="batting">Batting Stats</option>
                </select>
                {isAuthenticated ? (
                  <label style={styles.uploadBtn}>📁 Upload CSV<input type="file" accept=".csv" onChange={handleFileUpload} style={{display:'none'}} /></label>
                ) : (
                  <button style={styles.uploadBtnLocked} onClick={() => setShowPasswordModal(true)}>🔒 Upload CSV</button>
                )}
                <span style={styles.uploadHint}>{isAuthenticated ? 'Players with same name = stats combined' : 'Password required to upload'}</span>
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
              {showAdvancedFilters && (
                <div style={styles.advancedFilters}><div style={styles.filterGroup}>
                  <StatFilter label="Games (G)" filter={filters.gFilter} onChange={(u) => updateStatFilter('gFilter', u)} />
                  {activeTab === 'batting' ? (<><StatFilter label="Plate Appearances (PA)" filter={filters.paFilter} onChange={(u) => updateStatFilter('paFilter', u)} />
                    <StatFilter label="At Bats (AB)" filter={filters.abFilter} onChange={(u) => updateStatFilter('abFilter', u)} /></>) : (
                    <StatFilter label="Innings Pitched (IP)" filter={filters.ipFilter} onChange={(u) => updateStatFilter('ipFilter', u)} />)}
                </div></div>
              )}
              <div style={styles.resultsCount}>Showing {filteredData.length} of {totalData} players</div>
              <div style={styles.tableContainer}>
                {activeTab === 'pitching' ? <PitchingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} /> : <BattingTable data={filteredData} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort} />}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatFilter({ label, filter, onChange }) {
  return (<div style={styles.statFilter}><label style={styles.statFilterLabel}>
    <input type="checkbox" checked={filter.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} style={styles.checkbox} />{label}</label>
    <div style={styles.statFilterControls}>
      <select value={filter.operator} onChange={(e) => onChange({ operator: e.target.value })} style={styles.operatorSelect} disabled={!filter.enabled}>
        <option value=">">{'>'}</option><option value=">=">{'>='}</option><option value="=">=</option><option value="<=">{'<='}</option><option value="<">{'<'}</option>
      </select>
      <input type="number" value={filter.value} onChange={(e) => onChange({ value: e.target.value })} style={styles.valueInput} disabled={!filter.enabled} min="0" />
    </div></div>);
}

function PitchingTable({ data, sortBy, sortDir, onSort }) {
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  const calcIPperG = (ip, g) => { if (!g || g === 0) return '0.00'; let ipNum = 0; const ipStr = String(ip);
    if (ipStr.includes('.')) { const [w, f] = ipStr.split('.'); ipNum = parseFloat(w) + (parseFloat(f) / 3); } else { ipNum = parseFloat(ip) || 0; } return (ipNum / g).toFixed(2); };
  if (data.length === 0) return <div style={styles.emptyTable}>No pitching data matches your filters.</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="throws">T</SortHeader>
    <SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="winPct">WIN%</SortHeader><SortHeader field="svPct">SV%</SortHeader>
    <SortHeader field="ip">IP</SortHeader><SortHeader field="ipPerG">IP/G</SortHeader><SortHeader field="bf">BF</SortHeader><SortHeader field="era">ERA</SortHeader>
    <SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="whip">WHIP</SortHeader>
    <SortHeader field="braPer9">BRA/9</SortHeader><SortHeader field="hrPer9">HR/9</SortHeader><SortHeader field="bbPer9">BB/9</SortHeader><SortHeader field="kPer9">K/9</SortHeader>
    <SortHeader field="lobPct">LOB%</SortHeader><SortHeader field="eraPlus">ERA+</SortHeader><SortHeader field="fip">FIP</SortHeader><SortHeader field="fipMinus">FIP-</SortHeader>
    <SortHeader field="war">WAR</SortHeader><SortHeader field="siera">SIERA</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.tdPos}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.tdNum}>{p.throws}</td>
      <td style={styles.tdNum}>{p.g}</td><td style={styles.tdNum}>{p.gs}</td><td style={styles.tdNum}>{p.winPct}</td><td style={styles.tdNum}>{p.svPct}</td>
      <td style={styles.tdNum}>{p.ip}</td><td style={styles.tdStat}>{calcIPperG(p.ip, p.g)}</td><td style={styles.tdNum}>{p.bf}</td><td style={styles.tdStat}>{p.era}</td>
      <td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.babip}</td><td style={styles.tdStat}>{p.whip}</td>
      <td style={styles.tdStat}>{p.braPer9}</td><td style={styles.tdStat}>{p.hrPer9}</td><td style={styles.tdStat}>{p.bbPer9}</td><td style={styles.tdStat}>{p.kPer9}</td>
      <td style={styles.tdNum}>{p.lobPct}</td><td style={styles.tdStat}>{p.eraPlus}</td><td style={styles.tdStat}>{p.fip}</td><td style={styles.tdStat}>{p.fipMinus}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#4ade80' : '#f87171'}}>{p.war}</td><td style={styles.tdStat}>{p.siera}</td>
    </tr>))}
  </tbody></table>);
}

function BattingTable({ data, sortBy, sortDir, onSort }) {
  const SortHeader = ({ field, children }) => (<th style={styles.th} onClick={() => onSort(field)}>{children} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}</th>);
  if (data.length === 0) return <div style={styles.emptyTable}>No batting data matches your filters.</div>;
  return (<table style={styles.table}><thead><tr>
    <SortHeader field="pos">POS</SortHeader><SortHeader field="name">Name</SortHeader><SortHeader field="bats">B</SortHeader>
    <SortHeader field="g">G</SortHeader><SortHeader field="gs">GS</SortHeader><SortHeader field="pa">PA</SortHeader><SortHeader field="ab">AB</SortHeader>
    <SortHeader field="h">H</SortHeader><SortHeader field="doubles">2B</SortHeader><SortHeader field="triples">3B</SortHeader><SortHeader field="hr">HR</SortHeader>
    <SortHeader field="rbi">RBI</SortHeader><SortHeader field="r">R</SortHeader><SortHeader field="bb">BB</SortHeader><SortHeader field="so">SO</SortHeader>
    <SortHeader field="avg">AVG</SortHeader><SortHeader field="obp">OBP</SortHeader><SortHeader field="slg">SLG</SortHeader><SortHeader field="ops">OPS</SortHeader>
    <SortHeader field="iso">ISO</SortHeader><SortHeader field="opsPlus">OPS+</SortHeader><SortHeader field="babip">BABIP</SortHeader><SortHeader field="war">WAR</SortHeader>
    <SortHeader field="sb">SB</SortHeader><SortHeader field="cs">CS</SortHeader>
  </tr></thead><tbody>
    {data.map(p => (<tr key={p.id} style={styles.tr}>
      <td style={styles.tdPos}>{p.pos}</td><td style={styles.tdName}>{p.name}</td><td style={styles.tdNum}>{p.bats}</td>
      <td style={styles.tdNum}>{p.g}</td><td style={styles.tdNum}>{p.gs}</td><td style={styles.tdNum}>{p.pa}</td><td style={styles.tdNum}>{p.ab}</td>
      <td style={styles.tdNum}>{p.h}</td><td style={styles.tdNum}>{p.doubles}</td><td style={styles.tdNum}>{p.triples}</td><td style={styles.tdNum}>{p.hr}</td>
      <td style={styles.tdNum}>{p.rbi}</td><td style={styles.tdNum}>{p.r}</td><td style={styles.tdNum}>{p.bb}</td><td style={styles.tdNum}>{p.so}</td>
      <td style={styles.tdStat}>{p.avg}</td><td style={styles.tdStat}>{p.obp}</td><td style={styles.tdStat}>{p.slg}</td><td style={styles.tdStat}>{p.ops}</td>
      <td style={styles.tdStat}>{p.iso}</td><td style={styles.tdStat}>{p.opsPlus}</td><td style={styles.tdStat}>{p.babip}</td>
      <td style={{...styles.tdStat, color: parseFloat(p.war) >= 0 ? '#4ade80' : '#f87171'}}>{p.war}</td>
      <td style={styles.tdNum}>{p.sb}</td><td style={styles.tdNum}>{p.cs}</td>
    </tr>))}
  </tbody></table>);
}

const styles = {
  container: { minHeight: '100vh', background: '#0f172a', fontFamily: "'Courier New', monospace", color: '#f1f5f9' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f1f5f9' },
  notification: { position: 'fixed', top: 20, right: 20, padding: '12px 24px', borderRadius: 8, color: '#fff', fontWeight: 'bold', zIndex: 1000 },
  header: { background: 'linear-gradient(135deg, #1e3a8a, #1e40af)', borderBottom: '4px solid #fbbf24', padding: '20px 32px' },
  title: { margin: 0, fontSize: 28, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 2 },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: '#e2e8f0' },
  main: { display: 'flex', maxWidth: 1800, margin: '0 auto', minHeight: 'calc(100vh - 100px)' },
  sidebar: { width: 260, background: '#1e293b', borderRight: '2px solid #334155', padding: 16, flexShrink: 0 },
  sidebarTabs: { display: 'flex', gap: 4, marginBottom: 16 },
  sidebarTabBtn: { flex: 1, padding: '10px 8px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 },
  sidebarTabActive: { background: '#475569', color: '#fbbf24' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '2px solid #334155' },
  sidebarTitle: { margin: 0, fontSize: 14, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold' },
  addBtn: { padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 },
  newForm: { marginBottom: 12, padding: 12, background: '#334155', borderRadius: 8 },
  input: { width: '100%', padding: 10, background: '#1e293b', border: '2px solid #475569', borderRadius: 4, color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' },
  formBtns: { display: 'flex', gap: 8, marginTop: 10 },
  saveBtn: { flex: 1, padding: 8, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { flex: 1, padding: 8, background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  tournamentList: { display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMsg: { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  tournamentItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#334155', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent' },
  tournamentActive: { borderColor: '#fbbf24', background: '#475569' },
  tournamentInfo: { display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' },
  tournamentName: { fontWeight: 'bold', color: '#f1f5f9', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tournamentStats: { fontSize: 11, color: '#94a3b8' },
  delBtn: { width: 24, height: 24, background: 'transparent', color: '#94a3b8', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 18 },
  content: { flex: 1, padding: '24px 32px', overflow: 'auto' },
  welcome: { textAlign: 'center', padding: '60px 40px' },
  welcomeTitle: { fontSize: 32, color: '#fbbf24', marginBottom: 12 },
  features: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 32, textAlign: 'left' },
  feature: { padding: 16, background: '#1e293b', borderRadius: 8, border: '2px solid #334155', fontSize: 13, color: '#e2e8f0' },
  tournamentHeader: { marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #334155' },
  tournamentTitle: { fontSize: 24, color: '#fbbf24', margin: 0 },
  handednessContainer: { display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' },
  handednessGroup: { display: 'flex', alignItems: 'center', gap: 12, background: '#334155', padding: '8px 16px', borderRadius: 6 },
  handednessLabel: { color: '#fbbf24', fontWeight: 'bold', fontSize: 13 },
  handednessValue: { color: '#f1f5f9', fontSize: 13, fontFamily: "'Courier New', monospace" },
  uploadSection: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: 16, background: '#1e293b', borderRadius: 8, border: '2px dashed #475569', flexWrap: 'wrap' },
  select: { padding: '10px 16px', background: '#334155', color: '#f1f5f9', border: '2px solid #475569', borderRadius: 4, fontSize: 14, cursor: 'pointer' },
  uploadBtn: { padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  uploadBtnLocked: { padding: '10px 20px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' },
  uploadHint: { color: '#94a3b8', fontSize: 12 },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { padding: '12px 24px', background: '#334155', color: '#e2e8f0', border: '2px solid #475569', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  tabActive: { background: '#475569', borderColor: '#fbbf24', color: '#fbbf24' },
  filterBar: { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { padding: '10px 16px', background: '#334155', color: '#f1f5f9', border: '2px solid #475569', borderRadius: 4, fontSize: 14, width: 200 },
  filterSelect: { padding: '10px 16px', background: '#334155', color: '#f1f5f9', border: '2px solid #475569', borderRadius: 4, fontSize: 14, cursor: 'pointer' },
  advancedFilterBtn: { padding: '10px 16px', background: '#334155', color: '#e2e8f0', border: '2px solid #475569', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' },
  advancedFilterBtnActive: { borderColor: '#fbbf24', color: '#fbbf24' },
  advancedFilterBtnHasFilters: { background: '#475569', color: '#38bdf8' },
  resetBtn: { padding: '10px 16px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  advancedFilters: { background: '#1e293b', borderRadius: 8, border: '2px solid #334155', padding: 16, marginBottom: 16 },
  filterGroup: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  statFilter: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 },
  statFilterLabel: { display: 'flex', alignItems: 'center', gap: 8, color: '#f1f5f9', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  statFilterControls: { display: 'flex', gap: 8 },
  operatorSelect: { padding: '6px 10px', background: '#334155', color: '#f1f5f9', border: '2px solid #475569', borderRadius: 4, fontSize: 13, cursor: 'pointer' },
  valueInput: { padding: '6px 10px', background: '#334155', color: '#f1f5f9', border: '2px solid #475569', borderRadius: 4, fontSize: 13, width: 80 },
  resultsCount: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  tableContainer: { background: '#1e293b', borderRadius: 8, border: '2px solid #334155', overflow: 'auto', maxHeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: {
    textAlign: 'left',
    padding: '10px 5px',
  },
  thNum: {
    textAlign: 'right',
    padding: '10px 5px',
  },

  tr: { borderBottom: '1px solid #334155' },
  tdPos: { padding: '8px 5px', color: '#fbbf24', fontWeight: 'bold' },
  tdName: { padding: '8px 5px', color: '#f1f5f9', fontWeight: 'bold', whiteSpace: 'nowrap' },
  tdNum: { padding: '8px 5px', color: '#e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace" },
  tdStat: { padding: '8px 5px', color: '#38bdf8', textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 'bold' },
  emptyTable: { padding: 40, textAlign: 'center', color: '#94a3b8' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1e293b', padding: 32, borderRadius: 12, border: '2px solid #475569', maxWidth: 400, width: '90%' },
  modalTitle: { margin: '0 0 12px', color: '#fbbf24', fontSize: 20 },
  modalText: { margin: '0 0 20px', color: '#94a3b8', fontSize: 14 },
  modalBtns: { display: 'flex', gap: 12, marginTop: 16 }
};
