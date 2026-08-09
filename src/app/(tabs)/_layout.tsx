import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StickyHeader } from '@/components/ui/sticky-header';
import { PageCanvas } from '@/constants/theme';

export default function TabLayout() {
  return (
    <View style={[styles.container, { backgroundColor: PageCanvas }]}>
      {/*
        Rendered above the navigator, so it survives route changes and stays put
        while screens scroll under it. Shared with screens outside this group —
        see `sticky-header.tsx`.
      */}
      <StickyHeader />

      {/*
        Single navbar: the capsule above carries every link. Expo Router's Tabs
        bar is hidden — Tabs is kept only for route grouping and screen
        lifecycle, with navigation driven from the capsule.
      */}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: PageCanvas },
          tabBarStyle: styles.hiddenTabBar,
        }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="book" options={{ title: 'Send Parcel' }} />
        <Tabs.Screen name="available-packages" options={{ title: 'Find Jobs' }} />
        <Tabs.Screen name="driver" options={{ title: 'My Jobs' }} />
        <Tabs.Screen name="driver-signup" options={{ title: 'Drivers' }} />
        <Tabs.Screen name="locations" options={{ title: 'Hubs' }} />
        <Tabs.Screen name="about" options={{ title: 'About Us' }} />
        {/* Reached only after posting a parcel — not a nav destination. */}
        <Tabs.Screen name="parcel-confirmed" options={{ title: 'Parcel Posted' }} />
        {/* Reached only after accepting a job — not a nav destination. */}
        <Tabs.Screen name="job-accepted" options={{ title: 'Order Accepted' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hiddenTabBar: {
    display: 'none',
  },
});
