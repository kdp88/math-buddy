import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function HighScoreModal({ visible, onClose, highScores }) {
  const sorted = Object.entries(highScores).sort(([, a], [, b]) => b - a);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🏆 High Scores</Text>

          {sorted.length === 0 ? (
            <Text style={styles.empty}>No scores yet — start playing!</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
              {sorted.map(([name, score], i) => (
                <View key={name} style={[styles.row, i === 0 && styles.rowFirst]}>
                  <Text style={styles.medal}>{MEDALS[i] ?? `${i + 1}.`}</Text>
                  <Text style={styles.name} numberOfLines={1}>{name || 'Anonymous'}</Text>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>⭐ {score}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  sheet: {
    width:             '100%',
    maxWidth:          420,
    backgroundColor:   '#fff9f0',
    borderRadius:      24,
    paddingHorizontal: 24,
    paddingTop:        32,
    paddingBottom:     24,
    maxHeight:         '80%',
  },
  title: {
    fontSize:     26,
    fontWeight:   '800',
    color:        '#222',
    textAlign:    'center',
    marginBottom: 20,
  },
  empty: {
    fontSize:    16,
    color:       '#999',
    textAlign:   'center',
    marginBottom: 24,
    fontStyle:   'italic',
  },
  list: {
    marginBottom: 20,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 14,
    backgroundColor:   '#f5f5f5',
    borderRadius:      14,
    marginBottom:      8,
    gap:               12,
  },
  rowFirst: {
    backgroundColor: '#fff3cd',
  },
  medal: {
    fontSize: 22,
    width:    30,
  },
  name: {
    flex:       1,
    fontSize:   17,
    fontWeight: '700',
    color:      '#222',
  },
  scoreBadge: {
    backgroundColor: '#4c6ef5',
    borderRadius:    12,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  scoreText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#fff',
  },
  closeBtn: {
    backgroundColor: '#4c6ef5',
    borderRadius:    16,
    paddingVertical: 15,
    alignItems:      'center',
  },
  closeBtnTxt: {
    fontSize:   18,
    fontWeight: '800',
    color:      '#fff',
  },
});
