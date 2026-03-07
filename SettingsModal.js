import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const GAME_MODES = [
  {
    key:   'classic',
    icon:  '📝',
    label: 'Classic',
    desc:  'Type the answer on a number pad',
    color: '#4c6ef5',
    bg:    '#eef1ff',
  },
  {
    key:   'spaceship',
    icon:  '🚀',
    label: 'Spaceship',
    desc:  'Move your ship and shoot the correct asteroid',
    color: '#0891b2',
    bg:    '#e0f7fb',
  },
  {
    key:   'cockpit',
    icon:  '🎯',
    label: 'Cockpit',
    desc:  'First-person view — aim your crosshair and fire',
    color: '#7c3aed',
    bg:    '#f3eeff',
  },
  {
    key:   'haunted-house',
    icon:  '👻',
    label: 'Haunted House',
    desc:  'Explore the house and knock on the right door',
    color: '#b45309',
    bg:    '#fef3c7',
  },
];

const OPS = [
  { key: '+', label: 'Addition',       icon: '➕' },
  { key: '-', label: 'Subtraction',    icon: '➖' },
  { key: '×', label: 'Multiplication', icon: '✖️' },
  { key: '÷', label: 'Division',       icon: '➗' },
];

const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   range: '1 – 5'  },
  { key: 'medium', label: 'Medium', range: '1 – 10' },
  { key: 'hard',   label: 'Hard',   range: '1 – 20' },
];

export default function SettingsModal({ visible, onClose, settings, onSave }) {
  // page: 'mode' | 'options'
  const [page,  setPage]  = useState('mode');
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (visible) {
      setPage('mode');
      setDraft(settings);
    }
  }, [visible]);

  function selectMode(key) {
    setDraft(d => ({ ...d, mode: key }));
    setPage('options');
  }

  function toggleOp(key) {
    setDraft(d => {
      const next = d.ops.includes(key)
        ? d.ops.filter(o => o !== key)
        : [...d.ops, key];
      return next.length === 0 ? d : { ...d, ops: next };
    });
  }

  function setDifficulty(key) {
    setDraft(d => ({ ...d, difficulty: key }));
  }

  function save() {
    onSave(draft);
    onClose();
  }

  const chosenMode = GAME_MODES.find(m => m.key === draft.mode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── PAGE 1: Choose game mode ── */}
          {page === 'mode' && (
            <>
              <Text style={styles.title}>Choose a Game Mode</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {GAME_MODES.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeCard, { borderColor: m.color, backgroundColor: m.bg }]}
                    onPress={() => selectMode(m.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modeCardIcon}>{m.icon}</Text>
                    <View style={styles.modeCardTxt}>
                      <Text style={[styles.modeCardLabel, { color: m.color }]}>{m.label}</Text>
                      <Text style={styles.modeCardDesc}>{m.desc}</Text>
                    </View>
                    <Text style={[styles.modeCardArrow, { color: m.color }]}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* ── PAGE 2: Ops + Difficulty ── */}
          {page === 'options' && (
            <>
              {/* Header with back + chosen mode badge */}
              <View style={styles.optionsHeader}>
                <TouchableOpacity onPress={() => setPage('mode')} style={styles.backBtn}>
                  <Text style={styles.backTxt}>‹ Back</Text>
                </TouchableOpacity>
                <View style={[styles.modeBadge, { backgroundColor: chosenMode?.bg, borderColor: chosenMode?.color }]}>
                  <Text style={styles.modeBadgeIcon}>{chosenMode?.icon}</Text>
                  <Text style={[styles.modeBadgeLabel, { color: chosenMode?.color }]}>
                    {chosenMode?.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>What to practice</Text>
              <View style={styles.opGrid}>
                {OPS.map(op => {
                  const active = draft.ops.includes(op.key);
                  return (
                    <TouchableOpacity
                      key={op.key}
                      style={[styles.opChip, active && styles.opChipActive]}
                      onPress={() => toggleOp(op.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.opIcon}>{op.icon}</Text>
                      <Text style={[styles.opLabel, active && styles.opLabelActive]}>
                        {op.label}
                      </Text>
                      {active && (
                        <View style={styles.opCheck}>
                          <Text style={styles.opCheckTxt}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Difficulty</Text>
              <View style={styles.diffRow}>
                {DIFFICULTIES.map(d => {
                  const active = draft.difficulty === d.key;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[styles.diffChip, active && styles.diffChipActive]}
                      onPress={() => setDifficulty(d.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.diffLabel, active && styles.diffLabelActive]}>
                        {d.label}
                      </Text>
                      <Text style={[styles.diffRange, active && styles.diffRangeActive]}>
                        {d.range}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
                <Text style={styles.saveBtnTxt}>Let's Play!</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: '#fff9f0',
  },
  sheet: {
    flex:              1,
    paddingHorizontal: 24,
    paddingBottom:     36,
    paddingTop:        56, // room for status bar
  },
  handle: {
    // unused in full-screen mode, kept to avoid missing key errors
    height: 0,
  },
  title: {
    fontSize:     24,
    fontWeight:   '800',
    color:        '#222',
    marginBottom: 18,
    textAlign:    'center',
  },

  // ── Mode cards (page 1) ──
  modeCard: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   16,
    paddingHorizontal: 16,
    borderRadius:      16,
    borderWidth:       2,
    marginBottom:      12,
    gap:               14,
  },
  modeCardIcon:  { fontSize: 32 },
  modeCardTxt:   { flex: 1 },
  modeCardLabel: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  modeCardDesc:  { fontSize: 13, color: '#666' },
  modeCardArrow: { fontSize: 28, fontWeight: '300' },

  // ── Options page (page 2) ──
  optionsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   18,
  },
  backBtn: {
    paddingVertical:   6,
    paddingHorizontal: 4,
  },
  backTxt: {
    fontSize:   17,
    color:      '#4c6ef5',
    fontWeight: '600',
  },
  modeBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       2,
  },
  modeBadgeIcon:  { fontSize: 16 },
  modeBadgeLabel: { fontSize: 14, fontWeight: '700' },

  sectionLabel: {
    fontSize:      13,
    fontWeight:    '600',
    color:         '#888',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  10,
  },

  // Operations 2×2 grid
  opGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
    marginBottom:  20,
  },
  opChip: {
    width:             '47.5%',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingVertical:   13,
    paddingHorizontal: 14,
    backgroundColor:   '#f0f0f0',
    borderRadius:      14,
    borderWidth:       2,
    borderColor:       'transparent',
  },
  opChipActive: {
    backgroundColor: '#eef1ff',
    borderColor:     '#4c6ef5',
  },
  opIcon:        { fontSize: 18 },
  opLabel:       { fontSize: 14, fontWeight: '600', color: '#555', flex: 1 },
  opLabelActive: { color: '#4c6ef5' },
  opCheck: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: '#4c6ef5',
    alignItems:      'center',
    justifyContent:  'center',
  },
  opCheckTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // Difficulty row
  diffRow: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  24,
  },
  diffChip: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius:    14,
    borderWidth:     2,
    borderColor:     'transparent',
  },
  diffChipActive: {
    backgroundColor: '#eef1ff',
    borderColor:     '#4c6ef5',
  },
  diffLabel:       { fontSize: 15, fontWeight: '700', color: '#555' },
  diffLabelActive: { color: '#4c6ef5' },
  diffRange:       { fontSize: 11, color: '#999', marginTop: 2 },
  diffRangeActive: { color: '#7c94f9' },

  saveBtn: {
    backgroundColor: '#4c6ef5',
    borderRadius:    16,
    paddingVertical: 17,
    alignItems:      'center',
    shadowColor:     '#4c6ef5',
    shadowOpacity:   0.35,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       5,
  },
  saveBtnTxt: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#fff',
  },
});
