import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import { useAuthStore } from '../store/authStore'

import LoginScreen       from '../screens/LoginScreen'
import HomeScreen        from '../screens/HomeScreen'
import ActiveOrderScreen from '../screens/ActiveOrderScreen'
import HistoryScreen     from '../screens/HistoryScreen'
import ProfileScreen     from '../screens/ProfileScreen'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  ActiveOrder: undefined
}

export type MainTabParamList = {
  Home: undefined
  History: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab   = createBottomTabNavigator<MainTabParamList>()

const RED = '#dc2626'

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: RED,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingBottom: 6, height: 60 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home:    ['home',          'home-outline'],
            History: ['time',          'time-outline'],
            Profile: ['person-circle', 'person-circle-outline'],
          }
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline']
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ title: 'Deliveries' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function Navigation({ navigationRef }: { navigationRef?: React.RefObject<any> }) {
  const { isAuthenticated } = useAuthStore()

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"        component={MainTabs} />
            <Stack.Screen
              name="ActiveOrder"
              component={ActiveOrderScreen}
              options={{
                headerShown: true,
                title: 'Active Delivery',
                headerStyle: { backgroundColor: RED },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
