import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#FAFAFA' },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        tabBarStyle: {
          backgroundColor: '#FAFAFA',
          borderTopColor: '#E5E5E5',
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '캘린더',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="briefing"
        options={{
          title: '브리핑',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
