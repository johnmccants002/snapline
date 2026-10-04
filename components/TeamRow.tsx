import { Text, View } from 'react-native';
import { team } from '../constants/teams';
import { colors, styles } from '../constants/theme';
export function TeamRow({
  name,
  location,
}: {
  name: string;
  location: string;
}) {
  const t = team(name);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.muted}>{t.city || location}</Text>
        <Text style={styles.heading}>{t.nickname}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
        {t.abbreviation}
      </Text>
      <Text style={[styles.label, { width: 40, textAlign: 'right' }]}>
        {location}
      </Text>
    </View>
  );
}
