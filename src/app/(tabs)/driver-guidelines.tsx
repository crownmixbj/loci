import { useRouter } from 'expo-router';
import {
  ChevronDown,
  CircleCheck,
  FileText,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { CONDUCT, FAQS, REQUIREMENTS, type Guideline } from '@/constants/driver-guidelines';
import { MaxContentWidth, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REVIEW_WORKING_DAYS } from '@/store/driver-applications';
import { useSession } from '@/store/session';

/**
 * Driver Guidelines & FAQs.
 *
 * Open to everyone, signed in or not — someone deciding whether to apply needs
 * to read this *before* handing over a NIN and a bank account number, and
 * putting it behind sign-in would be exactly backwards.
 */
export default function DriverGuidelinesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { application } = useSession();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.content}>
        <ScreenHeader
          brand={false}
          title="Driver Guidelines & FAQs"
          subtitle={`What we ask of drivers, what we check, and the questions people actually ask. Reviews take up to ${REVIEW_WORKING_DAYS} working days.`}
        />

        <SectionLabel>What you need to apply</SectionLabel>
        <Card style={styles.card}>
          {REQUIREMENTS.map((item, index) => (
            <GuidelineRow key={item.key} item={item} first={index === 0} />
          ))}
        </Card>

        <SectionLabel>What we expect on the road</SectionLabel>
        <Card style={styles.card}>
          {CONDUCT.map((item, index) => (
            <GuidelineRow key={item.key} item={item} first={index === 0} />
          ))}
        </Card>

        <SectionLabel>Frequently asked</SectionLabel>
        <Card style={styles.card}>
          {FAQS.map((faq, index) => (
            <FaqRow key={faq.key} question={faq.question} answer={faq.answer} first={index === 0} />
          ))}
        </Card>

        <View style={styles.actions}>
          {application ? (
            <Button
              label="My application status"
              icon={(color, size) => <ShieldCheck color={color} size={size} />}
              onPress={() => router.navigate('/driver-updates')}
              style={styles.action}
            />
          ) : (
            <Button
              label="Apply to drive"
              icon={(color, size) => <FileText color={color} size={size} />}
              onPress={() => router.navigate('/driver-signup')}
              style={styles.action}
            />
          )}
          <Button
            label="Schedule a journey"
            variant="secondary"
            icon={(color, size) => <PackageSearch color={color} size={size} />}
            onPress={() => router.navigate('/available-packages')}
            style={styles.action}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function GuidelineRow({ item, first }: { item: Guideline; first: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.guideline,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}>
      <CircleCheck color={theme.success} size={17} style={styles.guidelineIcon} />
      <View style={styles.guidelineText}>
        <Text style={[styles.guidelineTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.guidelineBody, { color: theme.textSecondary }]}>{item.body}</Text>
      </View>
    </View>
  );
}

/**
 * One FAQ, collapsed by default.
 *
 * Ten open answers is a wall nobody reads. `accessibilityState.expanded` and a
 * rotating chevron mean the state is announced and visible, not just implied by
 * the content appearing.
 */
function FaqRow({ question, answer, first }: { question: string; answer: string; first: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View
      style={[
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.faqHeader, pressed && styles.pressed]}>
        <Text style={[styles.faqQuestion, { color: theme.text }]}>{question}</Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronDown color={theme.textMuted} size={17} />
        </View>
      </Pressable>

      {open && <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>{answer}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    gap: 0,
    marginBottom: Spacing.three,
  },
  guideline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three - 2,
  },
  guidelineIcon: {
    marginTop: 1,
  },
  guidelineText: {
    flex: 1,
    gap: Spacing.half,
  },
  guidelineTitle: {
    ...Typography.meta,
    ...font(700),
  },
  guidelineBody: {
    ...Typography.caption,
    lineHeight: 19,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three - 2,
  },
  faqQuestion: {
    ...Typography.meta,
    ...font(700),
    flex: 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    ...Typography.caption,
    lineHeight: 20,
    paddingBottom: Spacing.three - 2,
    // Indented under its question, clear of the chevron column.
    paddingRight: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  action: {
    flexGrow: 1,
    flexBasis: 180,
  },
});
