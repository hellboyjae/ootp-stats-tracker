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
        <div style={styles.modalOverlay} onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setAuthError(''); }}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Authentication Required</h2>
            <p style={styles.modalText}>
              {requiredLevel === 'master' ? 'This action requires master access.' : 'Enter password to continue.'}
            </p>
            {authError && <div style={styles.authError}>{authError}</div>}
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()} 
              placeholder="Password" 
              style={styles.searchInput} 
              autoFocus
            />
            <div style={styles.modalBtns}>
              <button style={{...styles.btn, ...styles.btnSecondary}} onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setAuthError(''); }}>Cancel</button>
              <button style={styles.btn} onClick={handlePasswordSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

function useAuth() { return useContext(AuthContext); }

// Theme definitions
const darkTheme = {
  // Backgrounds - clear visual hierarchy
  mainBg: '#0d1117',           // Darkest - page background
  sidebarBg: '#161b22',        // Sidebar chrome
  cardBg: '#1c2128',           // Control cards
  tableContainerBg: '#21262d', // Table container - brighter than surroundings
  tableRowBg: '#21262d',       // Table rows
  tableRowHover: '#2d333b',    // Row hover
  tableHeaderBg: '#161b22',    // Table header
  inputBg: '#0d1117',          // Inputs
  
  // Borders - subtle, not heavy
  border: '#30363d',           // General borders
  borderSubtle: '#21262d',     // Very subtle borders
  tableBorder: '#30363d',      // Table borders
  inputBorder: '#30363d',      // Input borders
  
  // Text - clear hierarchy
  textPrimary: '#e6edf3',      // Primary text (white)
  textSecondary: '#8b949e',    // Secondary text (dimmed)
  textMuted: '#6e7681',        // Muted/meta text
  
  // Accent & semantic colors
  accent: '#58a6ff',           // Primary accent (blue)
  success: '#3fb950',          // Green
  warning: '#d29922',          // Gold/amber
  error: '#f85149',            // Red
};

const lightTheme = {
  mainBg: '#ffffff',
  sidebarBg: '#f6f8fa',
  cardBg: '#f6f8fa',
  tableContainerBg: '#ffffff',
  tableRowBg: '#ffffff',
  tableRowHover: '#f6f8fa',
  tableHeaderBg: '#f6f8fa',
  inputBg: '#ffffff',
  
  border: '#d0d7de',
  borderSubtle: '#d8dee4',
  tableBorder: '#d0d7de',
  inputBorder: '#d0d7de',
  
  textPrimary: '#1f2328',
  textSecondary: '#656d76',
  textMuted: '#8c959f',
  
  accent: '#0969da',
  success: '#1a7f37',
  warning: '#9a6700',
  error: '#d1242f',
};

function TournamentPage() {
  const { theme } = useTheme();
  const { requestAuth } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);
  const [parsedData, setParsedData] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isPer9Mode, setIsPer9Mode] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Advanced filters state
  const [activeFilters, setActiveFilters] = useState({});

  useEffect(() => { loadTournaments(); }, []);

  async function loadTournaments() {
    const { data } = await supabase.from('site_content').select('content').eq('id', 'tournaments').single();
    if (data?.content) {
      setTournaments(data.content || []);
      if (data.content.length > 0 && !activeTournamentId) {
        setActiveTournamentId(data.content[0].id);
      }
    }
  }

  async function handleAddTournament() {
    requestAuth(async () => {
      const name = prompt('Tournament name:');
      if (!name) return;
      const newT = { id: Date.now().toString(), name, files: {} };
      const updated = [...tournaments, newT];
      await supabase.from('site_content').update({ content: updated }).eq('id', 'tournaments');
      setTournaments(updated);
      setActiveTournamentId(newT.id);
    }, 'upload');
  }

  async function handleDeleteTournament(id) {
    requestAuth(async () => {
      if (!window.confirm('Delete this tournament?')) return;
      const updated = tournaments.filter(t => t.id !== id);
      await supabase.from('site_content').update({ content: updated }).eq('id', 'tournaments');
      setTournaments(updated);
      if (activeTournamentId === id) setActiveTournamentId(updated[0]?.id || null);
    }, 'master');
  }

  function handleFileUpload(e, fileType) {
    requestAuth(() => {
      const file = e.target.files[0];
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result) => {
          const t = tournaments.find(x => x.id === uploadingFor);
          if (!t) return;
          t.files[fileType] = result.data;
          const updated = tournaments.map(x => x.id === uploadingFor ? t : x);
          await supabase.from('site_content').update({ content: updated }).eq('id', 'tournaments');
          setTournaments(updated);
          setParsedData(prev => ({ ...prev, [uploadingFor]: { ...prev[uploadingFor], [fileType]: result.data } }));
          setShowUpload(false);
          setUploadingFor(null);
        }
      });
    }, 'upload');
  }

  const activeTournament = tournaments.find(t => t.id === activeTournamentId);
  const hitterData = activeTournament?.files?.hitters || [];
  const pitcherData = activeTournament?.files?.pitchers || [];

  // Compute handedness stats
  const handednessStats = React.useMemo(() => {
    const stats = { LHH: 0, RHH: 0, LHP: 0, RHP: 0 };
    hitterData.forEach(row => {
      if (row.Bats === 'L') stats.LHH++;
      else if (row.Bats === 'R') stats.RHH++;
    });
    pitcherData.forEach(row => {
      if (row.Throws === 'L') stats.LHP++;
      else if (row.Throws === 'R') stats.RHP++;
    });
    return stats;
  }, [hitterData, pitcherData]);

  const styles = getStyles(theme);

  // Stat definitions for toggles
  const hitterStatGroups = [
    { label: 'Contact', stats: ['CON', 'GAP', 'POW', 'EYE', 'K%'] },
    { label: 'Speed', stats: ['SPD', 'STL', 'BR'] },
    { label: 'Defense', stats: ['Field', 'Arm', 'Turn2', 'React', 'Blk'] }
  ];

  const pitcherStatGroups = [
    { label: 'Pitches', stats: ['Stuff', 'Movement'] },
    { label: 'Control', stats: ['Control', 'Cmd'] },
    { label: 'Other', stats: ['GB%', 'Stamina'] }
  ];

  const [visibleHitterStats, setVisibleHitterStats] = useState(
    hitterStatGroups.flatMap(g => g.stats)
  );
  const [visiblePitcherStats, setVisiblePitcherStats] = useState(
    pitcherStatGroups.flatMap(g => g.stats)
  );

  const toggleStatGroup = (isHitter, groupStats) => {
    if (isHitter) {
      const allVisible = groupStats.every(s => visibleHitterStats.includes(s));
      setVisibleHitterStats(prev => 
        allVisible ? prev.filter(s => !groupStats.includes(s)) : [...new Set([...prev, ...groupStats])]
      );
    } else {
      const allVisible = groupStats.every(s => visiblePitcherStats.includes(s));
      setVisiblePitcherStats(prev =>
        allVisible ? prev.filter(s => !groupStats.includes(s)) : [...new Set([...prev, ...groupStats])]
      );
    }
  };

  return (
    <div style={styles.tournamentPage}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Tournaments</h2>
          <button onClick={handleAddTournament} style={styles.addBtn}>+</button>
        </div>
        <div style={styles.tournamentList}>
          {tournaments.map(t => (
            <div
              key={t.id}
              onClick={() => setActiveTournamentId(t.id)}
              style={{
                ...styles.tournamentItem,
                ...(activeTournamentId === t.id ? styles.tournamentActive : {})
              }}
            >
              <div style={styles.tournamentInfo}>
                <div style={styles.tournamentName}>{t.name}</div>
                <div style={styles.tournamentStats}>
                  {(t.files?.hitters?.length || 0) + (t.files?.pitchers?.length || 0)} players
                </div>
              </div>
              <button 
                onClick={e => { e.stopPropagation(); handleDeleteTournament(t.id); }}
                style={styles.delBtn}
                title="Delete tournament"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {!activeTournament ? (
          <div style={styles.welcome}>
            <div style={styles.welcomeTitle}>BeaneCounter</div>
            <div style={styles.welcomeText}>Select a tournament or create a new one to get started</div>
          </div>
        ) : (
          <>
            {/* Tournament header - LOW EMPHASIS */}
            <div style={styles.tournamentHeaderCompact}>
              <h1 style={styles.tournamentTitleCompact}>{activeTournament.name}</h1>
              <div style={styles.handednessContainerCompact}>
                <span style={styles.handednessItemCompact}>
                  <span style={styles.handednessLabelCompact}>LHH</span>
                  <span style={styles.handednessValueCompact}>{handednessStats.LHH}</span>
                </span>
                <span style={styles.handednessItemCompact}>
                  <span style={styles.handednessLabelCompact}>RHH</span>
                  <span style={styles.handednessValueCompact}>{handednessStats.RHH}</span>
                </span>
                <span style={styles.handednessSeparator}>|</span>
                <span style={styles.handednessItemCompact}>
                  <span style={styles.handednessLabelCompact}>LHP</span>
                  <span style={styles.handednessValueCompact}>{handednessStats.LHP}</span>
                </span>
                <span style={styles.handednessItemCompact}>
                  <span style={styles.handednessLabelCompact}>RHP</span>
                  <span style={styles.handednessValueCompact}>{handednessStats.RHP}</span>
                </span>
              </div>
            </div>

            {/* Upload section - only show when needed */}
            {(!hitterData.length || !pitcherData.length) && (
              <div style={styles.uploadSectionCompact}>
                <span style={styles.uploadHint}>Missing data files:</span>
                {!hitterData.length && (
                  <label style={styles.uploadLabel}>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={e => { setUploadingFor(activeTournamentId); handleFileUpload(e, 'hitters'); }}
                      style={{display: 'none'}}
                    />
                    <span style={styles.uploadBtn}>Upload Hitters CSV</span>
                  </label>
                )}
                {!pitcherData.length && (
                  <label style={styles.uploadLabel}>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={e => { setUploadingFor(activeTournamentId); handleFileUpload(e, 'pitchers'); }}
                      style={{display: 'none'}}
                    />
                    <span style={styles.uploadBtn}>Upload Pitchers CSV</span>
                  </label>
                )}
              </div>
            )}

            {/* Data tables */}
            {hitterData.length > 0 && (
              <DataTable
                title="Hitters"
                data={hitterData}
                type="hitter"
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                positionFilter={positionFilter}
                setPositionFilter={setPositionFilter}
                showAdvancedFilters={showAdvancedFilters}
                setShowAdvancedFilters={setShowAdvancedFilters}
                isPer9Mode={isPer9Mode}
                setIsPer9Mode={setIsPer9Mode}
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                visibleStats={visibleHitterStats}
                statGroups={hitterStatGroups}
                toggleStatGroup={toggleStatGroup}
              />
            )}

            {pitcherData.length > 0 && (
              <DataTable
                title="Pitchers"
                data={pitcherData}
                type="pitcher"
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                positionFilter={positionFilter}
                setPositionFilter={setPositionFilter}
                showAdvancedFilters={showAdvancedFilters}
                setShowAdvancedFilters={setShowAdvancedFilters}
                isPer9Mode={isPer9Mode}
                setIsPer9Mode={setIsPer9Mode}
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                visibleStats={visiblePitcherStats}
                statGroups={pitcherStatGroups}
                toggleStatGroup={toggleStatGroup}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DataTable({ 
  title, data, type, searchTerm, setSearchTerm, positionFilter, setPositionFilter,
  showAdvancedFilters, setShowAdvancedFilters, isPer9Mode, setIsPer9Mode,
  sortConfig, setSortConfig, activeFilters, setActiveFilters,
  visibleStats, statGroups, toggleStatGroup
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const isHitter = type === 'hitter';
  const positionKey = isHitter ? 'Position' : 'Role';
  
  // Get all unique positions
  const allPositions = [...new Set(data.map(p => p[positionKey]))].filter(Boolean).sort();

  // Define stat columns based on type
  const statColumns = isHitter 
    ? visibleStats
    : visibleStats;

  // Filter and sort data
  let filtered = data.filter(p => {
    const name = p.Name || '';
    const pos = p[positionKey] || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'All' || pos === positionFilter;
    
    // Apply advanced filters
    const matchesAdvanced = Object.entries(activeFilters).every(([stat, filter]) => {
      if (!filter.enabled) return true;
      const val = parseFloat(p[stat]);
      const threshold = parseFloat(filter.value);
      if (isNaN(val) || isNaN(threshold)) return true;
      
      switch (filter.operator) {
        case '>': return val > threshold;
        case '<': return val < threshold;
        case '>=': return val >= threshold;
        case '<=': return val <= threshold;
        case '=': return Math.abs(val - threshold) < 0.01;
        default: return true;
      }
    });
    
    return matchesSearch && matchesPosition && matchesAdvanced;
  });

  // Apply sorting
  if (sortConfig.key) {
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      // Handle numeric sorting
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String sorting
      aVal = String(aVal || '');
      bVal = String(bVal || '');
      if (sortConfig.direction === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (stat, field, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [stat]: { ...(prev[stat] || { enabled: false, operator: '>', value: '' }), [field]: value }
    }));
  };

  const activeFilterCount = Object.values(activeFilters).filter(f => f.enabled).length;

  // Color coding for stats
  const getStatColor = (stat, value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return theme.textPrimary;
    
    // Percentage stats (K%)
    if (stat.includes('%')) {
      if (num >= 25) return theme.error;
      if (num >= 20) return theme.warning;
      return theme.textPrimary;
    }
    
    // OVR
    if (stat === 'OVR') {
      if (num >= 80) return theme.warning;
      if (num >= 70) return theme.success;
      return theme.textPrimary;
    }
    
    // Standard stats
    if (num >= 70) return theme.success;
    if (num >= 60) return theme.textPrimary;
    if (num >= 50) return theme.warning;
    return theme.error;
  };

  return (
    <div style={styles.tableSection}>
      {/* Unified Control Bar */}
      <div style={styles.controlBar}>
        {/* Left side - Search and filters */}
        <div style={styles.controlBarLeft}>
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={styles.searchInputCompact}
          />
          <select
            value={positionFilter}
            onChange={e => setPositionFilter(e.target.value)}
            style={styles.filterSelectCompact}
          >
            <option value="All">All Positions</option>
            {allPositions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              ...styles.controlButton,
              ...(showAdvancedFilters ? styles.controlButtonActive : {}),
              ...(activeFilterCount > 0 ? styles.controlButtonHasFilters : {})
            }}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>

        {/* Right side - Stat toggles */}
        <div style={styles.controlBarRight}>
          <div style={styles.statToggleGroup}>
            {statGroups.map(group => {
              const allVisible = group.stats.every(s => visibleStats.includes(s));
              return (
                <button
                  key={group.label}
                  onClick={() => toggleStatGroup(isHitter, group.stats)}
                  style={{
                    ...styles.statToggle,
                    ...(allVisible ? styles.statToggleActive : {})
                  }}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div style={styles.advancedFiltersCompact}>
          <div style={styles.filterGridCompact}>
            {statColumns.slice(0, 8).map(stat => {
              const filter = activeFilters[stat] || { enabled: false, operator: '>', value: '' };
              return (
                <div key={stat} style={styles.filterItemCompact}>
                  <label style={styles.filterLabelCompact}>
                    <input
                      type="checkbox"
                      checked={filter.enabled}
                      onChange={e => handleFilterChange(stat, 'enabled', e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span style={styles.filterStatName}>{stat}</span>
                  </label>
                  {filter.enabled && (
                    <div style={styles.filterControls}>
                      <select
                        value={filter.operator}
                        onChange={e => handleFilterChange(stat, 'operator', e.target.value)}
                        style={styles.filterOperator}
                      >
                        <option value=">">{'>'}</option>
                        <option value="<">{'<'}</option>
                        <option value=">=">{'>='}</option>
                        <option value="<=">{'<='}</option>
                        <option value="=">=</option>
                      </select>
                      <input
                        type="number"
                        value={filter.value}
                        onChange={e => handleFilterChange(stat, 'value', e.target.value)}
                        placeholder="Value"
                        style={styles.filterValue}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={styles.resultsCount}>
        {filtered.length} {filtered.length === 1 ? 'player' : 'players'}
      </div>

      {/* Table */}
      <div style={styles.tableContainerElevated}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thSticky} onClick={() => handleSort('Name')}>
                Name {sortConfig.key === 'Name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.thSticky} onClick={() => handleSort(positionKey)}>
                {positionKey} {sortConfig.key === positionKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.thSticky} onClick={() => handleSort(isHitter ? 'Bats' : 'Throws')}>
                {isHitter ? 'B' : 'T'} {sortConfig.key === (isHitter ? 'Bats' : 'Throws') && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{...styles.thSticky, ...styles.thOvr}} onClick={() => handleSort('OVR')}>
                OVR {sortConfig.key === 'OVR' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              {statColumns.map(stat => (
                <th key={stat} style={styles.thSticky} onClick={() => handleSort(stat)}>
                  {stat} {sortConfig.key === stat && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4 + statColumns.length} style={styles.emptyTable}>
                  No players found
                </td>
              </tr>
            ) : (
              filtered.map((player, idx) => (
                <tr key={idx} style={styles.tableRow}>
                  <td style={styles.tdName}>{player.Name}</td>
                  <td style={styles.tdCenter}>{player[positionKey]}</td>
                  <td style={styles.tdCenter}>{player[isHitter ? 'Bats' : 'Throws']}</td>
                  <td style={{...styles.tdCenter, ...styles.tdOvr, color: getStatColor('OVR', player.OVR)}}>
                    {player.OVR}
                  </td>
                  {statColumns.map(stat => (
                    <td 
                      key={stat} 
                      style={{
                        ...styles.tdCenter,
                        color: getStatColor(stat, player[stat])
                      }}
                    >
                      {player[stat] || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoPage() {
  const { theme } = useTheme();
  const { hasAccess, requestAuth } = useAuth();
  const [content, setContent] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { loadContent(); }, []);

  async function loadContent() {
    const { data } = await supabase.from('site_content').select('content').eq('id', 'info').single();
    if (data?.content) {
      setContent(data.content);
      setEditContent(data.content);
    }
  }

  function toggleEdit() {
    if (!editMode) {
      requestAuth(() => setEditMode(true), 'master');
    } else {
      setEditMode(false);
      setEditContent(content);
    }
  }

  async function saveContent() {
    await supabase.from('site_content').update({ content: editContent }).eq('id', 'info');
    setContent(editContent);
    setEditMode(false);
  }

  const styles = getStyles(theme);

  return (
    <div style={styles.pageContent}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Information</h1>
        <div style={{display: 'flex', gap: 12}}>
          {hasAccess('master') && (
            <>
              {editMode && <button style={styles.btn} onClick={saveContent}>Save</button>}
              <button style={{...styles.btn, ...styles.btnSecondary}} onClick={toggleEdit}>
                {editMode ? 'Cancel' : 'Edit'}
              </button>
            </>
          )}
        </div>
      </div>
      {editMode ? (
        <EditView content={editContent} setContent={setEditContent} showHelp={showHelp} setShowHelp={setShowHelp} />
      ) : (
        <ReadView content={content} />
      )}
    </div>
  );
}

function ReadView({ content }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <div style={styles.infoContent}>
      {content.map((section, i) => (
        <div key={i} style={styles.infoSection}>
          <h2 style={styles.infoHeading}>{section.heading}</h2>
          <div style={styles.infoBody} dangerouslySetInnerHTML={{ __html: parseMarkdown(section.body) }} />
        </div>
      ))}
    </div>
  );
}

function EditView({ content, setContent, showHelp, setShowHelp }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const updateSection = (i, field, val) => {
    const updated = [...content];
    updated[i][field] = val;
    setContent(updated);
  };

  const moveSection = (i, dir) => {
    if ((dir === -1 && i === 0) || (dir === 1 && i === content.length - 1)) return;
    const updated = [...content];
    [updated[i], updated[i + dir]] = [updated[i + dir], updated[i]];
    setContent(updated);
  };

  const removeSection = (i) => {
    setContent(content.filter((_, idx) => idx !== i));
  };

  const addSection = () => {
    setContent([...content, { heading: 'New Section', body: '' }]);
  };

  return (
    <div style={styles.editContainer}>
      <button style={styles.helpToggle} onClick={() => setShowHelp(!showHelp)}>
        {showHelp ? 'Hide' : 'Show'} Markdown Help
      </button>
      {showHelp && <MarkdownHelp />}
      {content.map((section, i) => (
        <div key={i} style={styles.editSection}>
          <div style={styles.editSectionHeader}>
            <span style={styles.editSectionNum}>Section {i + 1}</span>
            <div style={styles.editSectionBtns}>
              <button style={styles.moveBtn} onClick={() => moveSection(i, -1)}>↑</button>
              <button style={styles.moveBtn} onClick={() => moveSection(i, 1)}>↓</button>
              <button style={styles.removeBtn} onClick={() => removeSection(i)}>×</button>
            </div>
          </div>
          <div style={styles.editField}>
            <label style={styles.editLabel}>Heading</label>
            <input
              value={section.heading}
              onChange={e => updateSection(i, 'heading', e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={styles.editField}>
            <label style={styles.editLabel}>Body (Markdown supported)</label>
            <textarea
              value={section.body}
              onChange={e => updateSection(i, 'body', e.target.value)}
              rows={8}
              style={{...styles.searchInput, resize: 'vertical', fontFamily: 'monospace', fontSize: 13}}
            />
          </div>
          <div style={styles.editField}>
            <div style={styles.previewLabel}>Preview:</div>
            <div style={styles.previewBox} dangerouslySetInnerHTML={{ __html: parseMarkdown(section.body) }} />
          </div>
        </div>
      ))}
      <button style={styles.addSectionBtn} onClick={addSection}>+ Add Section</button>
    </div>
  );
}

function MarkdownHelp() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  return (
    <div style={styles.helpBox}>
      <div style={styles.helpTitle}>Markdown Syntax</div>
      <code style={styles.helpCode}>**bold text**</code>
      <code style={styles.helpCode}>*italic text*</code>
      <code style={styles.helpCode}>[link text](https://url.com)</code>
      <code style={styles.helpCode}>- bullet point</code>
      <code style={styles.helpCode}>1. numbered list</code>
    </div>
  );
}

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n/g, '<br/>');
}

function VideosPage() {
  const { theme } = useTheme();
  const { hasAccess, requestAuth } = useAuth();
  const [videos, setVideos] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', url: '' });
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => { loadVideos(); }, []);

  async function loadVideos() {
    const { data } = await supabase.from('site_content').select('content').eq('id', 'videos').single();
    if (data?.content) setVideos(data.content);
  }

  function handleAddVideo() {
    requestAuth(() => setShowAddForm(true), 'master');
  }

  async function saveVideo() {
    if (!newVideo.title || !newVideo.url) return;
    const video = { id: Date.now().toString(), ...newVideo };
    const updated = [...videos, video];
    await supabase.from('site_content').update({ content: updated }).eq('id', 'videos');
    setVideos(updated);
    setNewVideo({ title: '', url: '' });
    setShowAddForm(false);
  }

  async function removeVideo(id) {
    requestAuth(async () => {
      const updated = videos.filter(v => v.id !== id);
      await supabase.from('site_content').update({ content: updated }).eq('id', 'videos');
      setVideos(updated);
    }, 'master');
  }

  function getEmbedUrl(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : new URLSearchParams(new URL(url).search).get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  }

  function getThumbnail(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : new URLSearchParams(new URL(url).search).get('v');
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    return null;
  }

  const styles = getStyles(theme);

  return (
    <div style={styles.pageContent}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Videos</h1>
        {hasAccess('master') && !showAddForm && (
          <button style={styles.btn} onClick={handleAddVideo}>Add Video</button>
        )}
      </div>

      {showAddForm && (
        <div style={styles.addVideoForm}>
          <h2 style={styles.formTitle}>Add New Video</h2>
          <div style={styles.editField}>
            <label style={styles.editLabel}>Title</label>
            <input
              value={newVideo.title}
              onChange={e => setNewVideo({...newVideo, title: e.target.value})}
              style={styles.searchInput}
              placeholder="Video title"
            />
          </div>
          <div style={styles.editField}>
            <label style={styles.editLabel}>URL</label>
            <input
              value={newVideo.url}
              onChange={e => setNewVideo({...newVideo, url: e.target.value})}
              style={styles.searchInput}
              placeholder="YouTube or Vimeo URL"
            />
          </div>
          <div style={styles.modalBtns}>
            <button style={{...styles.btn, ...styles.btnSecondary}} onClick={() => { setShowAddForm(false); setNewVideo({ title: '', url: '' }); }}>Cancel</button>
            <button style={styles.btn} onClick={saveVideo}>Add Video</button>
          </div>
        </div>
      )}

      <div style={styles.videoGrid}>
        {videos.map(video => (
          <div key={video.id} style={styles.videoCard}>
            <div 
              style={styles.thumbnailContainer}
              onClick={() => setPlayingVideo(video)}
              onMouseEnter={e => e.currentTarget.querySelector('.play-overlay').style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.querySelector('.play-overlay').style.opacity = '0'}
            >
              {getThumbnail(video.url) ? (
                <img src={getThumbnail(video.url)} alt={video.title} style={styles.thumbnail} />
              ) : (
                <div style={styles.thumbnailPlaceholder}>🎥</div>
              )}
              <div className="play-overlay" style={styles.playOverlay}>▶</div>
            </div>
            <div style={styles.videoInfo}>
              <span style={styles.videoTitle}>{video.title}</span>
              <span style={styles.videoPlatform}>
                {video.url.includes('youtube') ? 'YouTube' : video.url.includes('vimeo') ? 'Vimeo' : 'Video'}
              </span>
            </div>
            {hasAccess('master') && (
              <button style={styles.removeVideoBtn} onClick={() => removeVideo(video.id)}>×</button>
            )}
          </div>
        ))}
      </div>

      {playingVideo && (
        <div style={styles.videoPlayerOverlay} onClick={() => setPlayingVideo(null)}>
          <div style={styles.videoPlayerContainer} onClick={e => e.stopPropagation()}>
            <button style={styles.closePlayerBtn} onClick={() => setPlayingVideo(null)}>×</button>
            <iframe
              src={getEmbedUrl(playingVideo.url)}
              style={styles.videoPlayer}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const { theme, toggle } = useTheme();
  const styles = getStyles(theme);

  return (
    <div style={styles.app}>
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <div style={styles.logo}>BeaneCounter</div>
        </div>
        <div style={styles.navLinks}>
          <NavLink to="/" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>
            Tournaments
          </NavLink>
          <NavLink to="/info" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>
            Info
          </NavLink>
          <NavLink to="/videos" style={({isActive}) => ({...styles.navLink, ...(isActive ? styles.navLinkActive : {})})}>
            Videos
          </NavLink>
        </div>
        <button onClick={toggle} style={styles.themeToggle}>
          {theme === darkTheme ? '☀️' : '🌙'}
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<TournamentPage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="/videos" element={<VideosPage />} />
      </Routes>
    </div>
  );
}

function getStyles(t) {
  return {
    // App container
    app: { 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: t.mainBg, 
      color: t.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    
    // Navigation - treated as chrome, reduced emphasis
    nav: { 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '0 24px', 
      height: 56,
      background: t.sidebarBg, 
      borderBottom: `1px solid ${t.borderSubtle}`,
      flexShrink: 0
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: 24 },
    logo: { 
      fontSize: 18, 
      fontWeight: 700, 
      color: t.accent,
      letterSpacing: '-0.5px'
    },
    navLinks: { display: 'flex', gap: 4 },
    navLink: { 
      padding: '8px 16px', 
      color: t.textSecondary, 
      textDecoration: 'none', 
      borderRadius: 6, 
      fontSize: 14,
      fontWeight: 500,
      transition: 'all 0.15s'
    },
    navLinkActive: { 
      background: t.mainBg, 
      color: t.textPrimary,
      fontWeight: 600
    },
    themeToggle: { 
      background: 'transparent', 
      border: 'none', 
      fontSize: 20, 
      cursor: 'pointer', 
      padding: 8,
      opacity: 0.7,
      transition: 'opacity 0.15s'
    },
    
    // Buttons
    btn: { 
      padding: '8px 16px', 
      background: t.accent, 
      color: '#fff', 
      border: 'none', 
      borderRadius: 6, 
      cursor: 'pointer', 
      fontWeight: 600, 
      fontSize: 13,
      transition: 'opacity 0.15s'
    },
    btnSecondary: { 
      background: t.cardBg, 
      color: t.textPrimary, 
      border: `1px solid ${t.border}`
    },
    
    // Tournament page layout
    tournamentPage: { display: 'flex', flex: 1, overflow: 'hidden' },
    
    // Sidebar - reduced emphasis, treated as navigation chrome
    sidebar: { 
      width: 260, 
      background: t.sidebarBg, 
      borderRight: `1px solid ${t.borderSubtle}`,
      display: 'flex', 
      flexDirection: 'column',
      flexShrink: 0
    },
    sidebarHeader: { 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '16px 16px 12px',
      borderBottom: `1px solid ${t.borderSubtle}`
    },
    sidebarTitle: { 
      fontSize: 13, 
      fontWeight: 600, 
      color: t.textMuted, 
      margin: 0,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    addBtn: { 
      width: 28, 
      height: 28, 
      background: t.cardBg, 
      color: t.accent, 
      border: `1px solid ${t.border}`, 
      borderRadius: 6, 
      cursor: 'pointer', 
      fontWeight: 700, 
      fontSize: 16,
      transition: 'all 0.15s'
    },
    tournamentList: { 
      flex: 1, 
      overflow: 'auto', 
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    },
    tournamentItem: { 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '10px 12px', 
      background: 'transparent',
      borderRadius: 6, 
      cursor: 'pointer', 
      border: '1px solid transparent',
      transition: 'all 0.15s'
    },
    tournamentActive: { 
      background: t.cardBg,
      border: `1px solid ${t.border}`
    },
    tournamentInfo: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 2, 
      overflow: 'hidden',
      flex: 1
    },
    tournamentName: { 
      fontWeight: 600, 
      color: t.textPrimary, 
      fontSize: 13, 
      whiteSpace: 'nowrap', 
      overflow: 'hidden', 
      textOverflow: 'ellipsis'
    },
    tournamentStats: { 
      fontSize: 11, 
      color: t.textMuted
    },
    delBtn: { 
      width: 24, 
      height: 24, 
      background: 'transparent', 
      color: t.textMuted, 
      border: 'none', 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 18,
      opacity: 0.5,
      transition: 'opacity 0.15s',
      flexShrink: 0,
      marginLeft: 8
    },
    
    // Main content area
    content: { 
      flex: 1, 
      padding: '20px 24px', 
      overflow: 'auto',
      background: t.mainBg
    },
    welcome: { 
      textAlign: 'center', 
      padding: '80px 40px' 
    },
    welcomeTitle: { 
      fontSize: 36, 
      color: t.accent, 
      marginBottom: 12, 
      fontWeight: 700,
      letterSpacing: '-1px'
    },
    welcomeText: { 
      color: t.textSecondary, 
      fontSize: 15
    },
    
    // Tournament header - LOW EMPHASIS (page context)
    tournamentHeaderCompact: { 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingBottom: 10,
      borderBottom: `1px solid ${t.borderSubtle}`
    },
    tournamentTitleCompact: { 
      fontSize: 20, 
      color: t.textSecondary, 
      margin: 0, 
      fontWeight: 600,
      letterSpacing: '-0.3px'
    },
    handednessContainerCompact: { 
      display: 'flex', 
      gap: 12,
      alignItems: 'center',
      fontSize: 11,
      color: t.textMuted
    },
    handednessItemCompact: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    },
    handednessLabelCompact: {
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    },
    handednessValueCompact: {
      fontFamily: 'Consolas, Monaco, monospace',
      fontWeight: 600,
      color: t.textSecondary
    },
    handednessSeparator: {
      color: t.borderSubtle,
      margin: '0 4px'
    },
    
    // Upload section
    uploadSectionCompact: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12, 
      marginBottom: 16, 
      padding: '10px 14px', 
      background: t.cardBg, 
      borderRadius: 6,
      border: `1px solid ${t.border}`
    },
    uploadHint: { 
      color: t.textMuted, 
      fontSize: 12,
      fontWeight: 500
    },
    uploadLabel: {
      cursor: 'pointer'
    },
    uploadBtn: {
      padding: '6px 12px',
      background: t.accent,
      color: '#fff',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-block',
      transition: 'opacity 0.15s'
    },
    
    // Table section wrapper
    tableSection: {
      marginBottom: 32
    },
    
    // UNIFIED CONTROL BAR - MEDIUM EMPHASIS
    controlBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 14px',
      background: t.cardBg,
      borderRadius: 6,
      border: `1px solid ${t.border}`,
      marginBottom: 12,
      flexWrap: 'wrap'
    },
    controlBarLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 300
    },
    controlBarRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    },
    
    // Search input - compact
    searchInputCompact: { 
      padding: '6px 10px', 
      background: t.inputBg, 
      color: t.textPrimary, 
      border: `1px solid ${t.inputBorder}`, 
      borderRadius: 4, 
      fontSize: 13,
      fontFamily: 'inherit',
      width: 180,
      transition: 'border-color 0.15s'
    },
    
    // Filter select - compact
    filterSelectCompact: { 
      padding: '6px 10px', 
      background: t.inputBg, 
      color: t.textPrimary, 
      border: `1px solid ${t.inputBorder}`, 
      borderRadius: 4, 
      fontSize: 13, 
      cursor: 'pointer',
      fontFamily: 'inherit',
      minWidth: 110
    },
    
    // Control buttons
    controlButton: {
      padding: '6px 12px',
      background: 'transparent',
      color: t.textSecondary,
      border: `1px solid ${t.border}`,
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
      transition: 'all 0.15s',
      whiteSpace: 'nowrap'
    },
    controlButtonActive: {
      color: t.accent,
      borderColor: t.accent
    },
    controlButtonHasFilters: {
      background: t.accent,
      color: '#fff',
      borderColor: t.accent
    },
    
    // Stat toggle group
    statToggleGroup: {
      display: 'flex',
      gap: 4,
      background: t.inputBg,
      padding: 3,
      borderRadius: 4,
      border: `1px solid ${t.border}`
    },
    statToggle: {
      padding: '4px 10px',
      background: 'transparent',
      color: t.textSecondary,
      border: 'none',
      borderRadius: 3,
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: 600,
      transition: 'all 0.15s',
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    },
    statToggleActive: {
      background: t.cardBg,
      color: t.accent
    },
    
    // Advanced filters - compact
    advancedFiltersCompact: {
      background: t.cardBg,
      borderRadius: 6,
      border: `1px solid ${t.border}`,
      padding: 12,
      marginBottom: 12
    },
    filterGridCompact: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 10
    },
    filterItemCompact: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    },
    filterLabelCompact: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 500,
      color: t.textPrimary
    },
    filterStatName: {
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: 11
    },
    checkbox: {
      width: 14,
      height: 14,
      cursor: 'pointer',
      accentColor: t.accent
    },
    filterControls: {
      display: 'flex',
      gap: 4
    },
    filterOperator: {
      padding: '4px 6px',
      background: t.inputBg,
      color: t.textPrimary,
      border: `1px solid ${t.inputBorder}`,
      borderRadius: 3,
      fontSize: 11,
      cursor: 'pointer',
      fontFamily: 'Consolas, Monaco, monospace',
      width: 45
    },
    filterValue: {
      padding: '4px 6px',
      background: t.inputBg,
      color: t.textPrimary,
      border: `1px solid ${t.inputBorder}`,
      borderRadius: 3,
      fontSize: 11,
      flex: 1,
      fontFamily: 'Consolas, Monaco, monospace'
    },
    
    // Results count
    resultsCount: { 
      color: t.textMuted, 
      fontSize: 11, 
      marginBottom: 6,
      fontWeight: 500,
      letterSpacing: '0.2px'
    },
    
    // TABLE CONTAINER - HIGHEST EMPHASIS - visually dominates
    tableContainerElevated: { 
      background: t.tableContainerBg,
      borderRadius: 6,
      border: `1px solid ${t.tableBorder}`,
      overflow: 'auto',
      maxHeight: '70vh',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    },
    
    // Table - dense, professional
    table: { 
      width: '100%', 
      borderCollapse: 'collapse',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums'
    },
    
    // Table header - sticky, dimmed
    thSticky: { 
      padding: '7px 8px',
      background: t.tableHeaderBg,
      color: t.textSecondary,
      fontWeight: 600,
      textAlign: 'center',
      position: 'sticky',
      top: 0,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      borderBottom: `1px solid ${t.tableBorder}`,
      userSelect: 'none',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      transition: 'color 0.15s',
      zIndex: 10
    },
    thOvr: {
      color: t.accent,
      fontWeight: 700
    },
    
    // Table rows - reduced padding for density
    tableRow: {
      borderBottom: `1px solid ${t.borderSubtle}`,
      background: t.tableRowBg,
      transition: 'background-color 0.1s'
    },
    
    // Table cells - tight spacing
    tdCenter: {
      padding: '5px 8px',
      textAlign: 'center',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 12,
      color: t.textPrimary
    },
    tdName: {
      padding: '5px 8px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      textAlign: 'left',
      fontSize: 12,
      color: t.textPrimary
    },
    tdOvr: {
      fontWeight: 700,
      fontSize: 13
    },
    
    emptyTable: { 
      padding: 40, 
      textAlign: 'center', 
      color: t.textMuted,
      fontSize: 13
    },
    
    // Modal
    modalOverlay: { 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000 
    },
    modal: { 
      background: t.cardBg, 
      padding: 28, 
      borderRadius: 8, 
      border: `1px solid ${t.border}`, 
      maxWidth: 400, 
      width: '90%', 
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)' 
    },
    modalTitle: { 
      margin: '0 0 8px', 
      color: t.textPrimary, 
      fontSize: 18, 
      fontWeight: 700 
    },
    modalText: { 
      margin: '0 0 20px', 
      color: t.textSecondary, 
      fontSize: 13,
      lineHeight: 1.5
    },
    modalBtns: { 
      display: 'flex', 
      gap: 10, 
      marginTop: 20 
    },
    authError: { 
      color: t.error, 
      fontSize: 12, 
      margin: '0 0 12px', 
      padding: '8px 12px', 
      background: `${t.error}15`, 
      borderRadius: 4,
      fontWeight: 500
    },
    
    // Page content
    pageContent: { 
      flex: 1, 
      padding: '20px 24px', 
      maxWidth: 1200, 
      margin: '0 auto',
      width: '100%'
    },
    pageHeader: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20, 
      paddingBottom: 12, 
      borderBottom: `1px solid ${t.border}` 
    },
    pageTitle: { 
      margin: 0, 
      fontSize: 24, 
      color: t.textPrimary, 
      fontWeight: 700,
      letterSpacing: '-0.5px'
    },
    
    // Info page
    infoContent: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 20 
    },
    infoSection: { 
      background: t.cardBg, 
      padding: 20, 
      borderRadius: 6, 
      border: `1px solid ${t.border}` 
    },
    infoHeading: { 
      margin: '0 0 10px', 
      color: t.accent, 
      fontSize: 18, 
      fontWeight: 700 
    },
    infoBody: { 
      margin: 0, 
      color: t.textPrimary, 
      fontSize: 13, 
      lineHeight: 1.6 
    },
    
    // Edit mode
    editContainer: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 16 
    },
    editField: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 6 
    },
    editLabel: { 
      color: t.textSecondary, 
      fontWeight: 600, 
      fontSize: 12 
    },
    editSection: { 
      background: t.cardBg, 
      padding: 16, 
      borderRadius: 6, 
      border: `1px solid ${t.border}` 
    },
    editSectionHeader: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 12 
    },
    editSectionNum: { 
      color: t.textMuted, 
      fontSize: 11, 
      fontWeight: 600,
      textTransform: 'uppercase'
    },
    editSectionBtns: { 
      display: 'flex', 
      gap: 6 
    },
    moveBtn: { 
      width: 28, 
      height: 28, 
      background: t.mainBg, 
      color: t.textPrimary, 
      border: `1px solid ${t.border}`, 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 13,
      fontWeight: 700
    },
    removeBtn: { 
      width: 28, 
      height: 28, 
      background: t.error, 
      color: '#fff', 
      border: 'none', 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 14 
    },
    addSectionBtn: { 
      padding: '12px 20px', 
      background: t.cardBg, 
      color: t.accent, 
      border: `1px dashed ${t.border}`, 
      borderRadius: 6, 
      cursor: 'pointer', 
      fontWeight: 600, 
      fontSize: 13,
      transition: 'all 0.15s'
    },
    
    // Markdown help
    helpToggle: { 
      background: t.cardBg, 
      color: t.accent, 
      border: `1px solid ${t.border}`, 
      padding: '7px 14px', 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 12, 
      fontWeight: 600, 
      marginBottom: 12 
    },
    helpBox: { 
      background: t.mainBg, 
      border: `1px solid ${t.border}`, 
      borderRadius: 6, 
      padding: 14, 
      marginBottom: 16 
    },
    helpTitle: { 
      color: t.textSecondary, 
      margin: '0 0 10px', 
      fontWeight: 700,
      fontSize: 12
    },
    helpCode: { 
      display: 'block', 
      background: t.cardBg, 
      padding: '4px 8px', 
      borderRadius: 3, 
      marginBottom: 4, 
      color: t.textPrimary, 
      fontSize: 11, 
      fontFamily: 'Consolas, Monaco, monospace' 
    },
    previewLabel: { 
      color: t.textSecondary, 
      fontSize: 11, 
      fontWeight: 600, 
      marginTop: 10, 
      marginBottom: 4 
    },
    previewBox: { 
      background: t.mainBg, 
      border: `1px solid ${t.border}`, 
      borderRadius: 6, 
      padding: 14, 
      minHeight: 60, 
      color: t.textPrimary, 
      fontSize: 13, 
      lineHeight: 1.6 
    },
    
    // Videos page
    addVideoForm: { 
      background: t.cardBg, 
      padding: 20, 
      borderRadius: 6, 
      border: `1px solid ${t.border}`, 
      marginBottom: 20 
    },
    formTitle: { 
      margin: '0 0 14px', 
      color: t.textPrimary, 
      fontSize: 16, 
      fontWeight: 700 
    },
    videoGrid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
      gap: 16 
    },
    videoCard: { 
      background: t.cardBg, 
      borderRadius: 6, 
      border: `1px solid ${t.border}`, 
      overflow: 'hidden', 
      position: 'relative',
      transition: 'border-color 0.15s'
    },
    thumbnailContainer: { 
      position: 'relative', 
      paddingTop: '56.25%', 
      background: t.mainBg, 
      cursor: 'pointer' 
    },
    thumbnail: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      objectFit: 'cover' 
    },
    thumbnailPlaceholder: { 
      position: 'absolute', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)', 
      fontSize: 48, 
      color: t.textMuted,
      opacity: 0.4
    },
    playOverlay: { 
      position: 'absolute', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)', 
      width: 60, 
      height: 60, 
      background: `${t.accent}dd`, 
      borderRadius: '50%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontSize: 22, 
      color: '#fff', 
      opacity: 0, 
      transition: 'opacity 0.2s',
      paddingLeft: 4
    },
    videoInfo: { 
      padding: 12 
    },
    videoTitle: { 
      display: 'block', 
      color: t.textPrimary, 
      fontWeight: 600, 
      fontSize: 13, 
      marginBottom: 4 
    },
    videoPlatform: { 
      color: t.textMuted, 
      fontSize: 11 
    },
    removeVideoBtn: { 
      position: 'absolute', 
      top: 8, 
      right: 8, 
      width: 28, 
      height: 28, 
      background: `${t.error}dd`, 
      color: '#fff', 
      border: 'none', 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 14 
    },
    videoPlayerOverlay: { 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.92)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000 
    },
    videoPlayerContainer: { 
      position: 'relative', 
      width: '90%', 
      maxWidth: 1000, 
      aspectRatio: '16/9' 
    },
    videoPlayer: { 
      width: '100%', 
      height: '100%', 
      borderRadius: 6 
    },
    closePlayerBtn: { 
      position: 'absolute', 
      top: -40, 
      right: 0, 
      background: 'transparent', 
      color: '#fff', 
      border: 'none', 
      fontSize: 32, 
      cursor: 'pointer',
      opacity: 0.8,
      transition: 'opacity 0.15s'
    }
  };
}

export default App;
