import { useMutation } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { analyzeGame } from '../lib/api/analysis';
import { colors, styles } from '../constants/theme';
import { SectionCard } from './SectionCard';
import { EdgeBadge } from './EdgeBadge';
export function AnalysisCard({ id }: { id: string }) {
  const mutation = useMutation({ mutationFn: () => analyzeGame(id) }),
    result = mutation.data,
    analysis = result?.analysis;
  return (
    <SectionCard title="AI analysis">
      <Text style={styles.muted}>
        An explanation of the evidence, with PASS as a valid outcome.
      </Text>
      {analysis && (
        <>
          <View style={styles.row}>
            <EdgeBadge lean={analysis.lean} />
            <Text style={styles.heading}>{analysis.confidence} / 100</Text>
          </View>
          <Text style={styles.muted}>
            Confidence in this conclusion · Not a win or cover probability
          </Text>
          {analysis.lean === 'PASS' && (
            <Text style={styles.muted}>
              PASS means no directional advantage is established. Confidence in
              PASS is not a betting signal.
            </Text>
          )}
          <Text style={styles.text}>{analysis.summary}</Text>
          <Text style={styles.label}>Market evidence</Text>
          <Text style={styles.text}>{analysis.marketAnalysis}</Text>
          {analysis.weatherAnalysis && (
            <Text style={styles.text}>{analysis.weatherAnalysis}</Text>
          )}
          {analysis.injuryAnalysis && (
            <Text style={styles.text}>{analysis.injuryAnalysis}</Text>
          )}
          <Text style={styles.label}>Key factors</Text>
          {analysis.keyFactors.map((factor, i) => (
            <View key={i} style={{ gap: 4 }}>
              <Text style={styles.text}>{factor.factor}</Text>
              <Text style={styles.label}>
                {factor.direction} · {factor.importance}
              </Text>
              <Text style={styles.muted}>{factor.explanation}</Text>
            </View>
          ))}
          <Text style={styles.label}>Data limitations & risks</Text>
          {analysis.riskFactors.map((risk, i) => (
            <Text key={i} style={styles.muted}>
              • {risk}
            </Text>
          ))}
          <Text style={styles.muted}>
            Weather unavailable · Injury data unavailable · Quantitative model
            unavailable
          </Text>
          <Text style={styles.muted}>
            {result.model} · {new Date(result.createdAt).toLocaleString()}
          </Text>
        </>
      )}
      {!analysis && (
        <Text style={styles.text}>
          Market context is available for analysis. Weather, injuries, and a
          quantitative model are not connected.
        </Text>
      )}
      {mutation.error && (
        <Text accessibilityRole="alert" style={{ color: colors.warning }}>
          {mutation.error.message}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={[styles.button, { opacity: mutation.isPending ? 0.6 : 1 }]}
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>
            {analysis ? 'Refresh analysis' : 'Analyze game'}
          </Text>
        )}
      </Pressable>
      <Text style={styles.muted}>
        Results are cached for 10 minutes. Analysis uses the data observed at
        the timestamp shown.
      </Text>
    </SectionCard>
  );
}
