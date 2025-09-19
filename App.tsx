import React from 'react';
import { StatusBar } from 'expo-status-bar';
import KidsWeeklyPlanner from './KidsWeeklyPlanner';

export default function App() {
  return (
    <>
      <KidsWeeklyPlanner />
      <StatusBar style="auto" />
    </>
  );
}
