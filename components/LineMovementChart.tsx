import { Text, View } from 'react-native';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';
import type { LinePoint } from '../types/game';
import { SectionCard } from './SectionCard';
import { colors, styles } from '../constants/theme';
import { signed } from '../lib/calculations/consensus';
export function LineMovementChart({
  points,
  homeTeam,
}: {
  points: LinePoint[];
  homeTeam: string;
}) {
  if (points.length < 2)
    return (
      <SectionCard title="Line movement">
        <Text style={styles.muted}>
          Line movement will appear after multiple odds snapshots are collected.
        </Text>
      </SectionCard>
    );
  const values = points.map((p) => p.homeSpread),
    min = Math.min(...values) - 0.5,
    max = Math.max(...values) + 0.5;
  const first = Date.parse(points[0].capturedAt),
    last = Date.parse(points[points.length - 1].capturedAt);
  const coords = points.map((p) => ({
    x:
      12 +
      ((Date.parse(p.capturedAt) - first) / Math.max(1, last - first)) * 316,
    y: 16 + ((max - p.homeSpread) / (max - min)) * 108,
  }));
  return (
    <SectionCard title="Line movement">
      <Text style={styles.muted}>
        {homeTeam} consensus spread · Last 7 days
      </Text>
      <View style={styles.row}>
        <Text style={styles.muted}>{signed(max)}</Text>
        <Text style={styles.muted}>
          Latest {signed(values[values.length - 1])}
        </Text>
      </View>
      <Svg
        width="100%"
        height={140}
        viewBox="0 0 340 140"
        accessibilityLabel={`Home spread moved from ${signed(values[0])} to ${signed(values[values.length - 1])}`}
      >
        <Line x1="12" y1="124" x2="328" y2="124" stroke={colors.border} />
        <Polyline
          points={coords.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={colors.accent}
          strokeWidth="2.5"
        />
        {[coords[0], coords[coords.length - 1]].map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="4" fill={colors.accent} />
        ))}
      </Svg>
      <Text style={styles.muted}>{signed(min)}</Text>
      <View style={styles.row}>
        <Text style={styles.muted}>{new Date(first).toLocaleString()}</Text>
        <Text style={styles.muted}>{new Date(last).toLocaleString()}</Text>
      </View>
      <Text style={styles.muted}>
        First observed {signed(values[0])}. This is not a verified opening line.
        Book coverage may change between observations.
      </Text>
    </SectionCard>
  );
}
