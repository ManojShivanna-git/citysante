import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'

import LoginScreen          from '../screens/LoginScreen'
import RegisterShopScreen   from '../screens/RegisterShopScreen'
import HomeScreen           from '../screens/HomeScreen'
import OrdersScreen         from '../screens/OrdersScreen'
import OrderDetailScreen    from '../screens/OrderDetailScreen'
import ProductsScreen       from '../screens/ProductsScreen'
import RidersScreen         from '../screens/RidersScreen'
import NotificationsScreen  from '../screens/NotificationsScreen'
import ProfileScreen        from '../screens/ProfileScreen'
import CatalogScreen        from '../screens/CatalogScreen'
import SettingsScreen       from '../screens/SettingsScreen'
import BillingScreen        from '../screens/BillingScreen'

export type RootStackParamList = {
  Login:         undefined
  MainTabs:      undefined
  RegisterShop:  undefined
  OrderDetail:   { orderId: string }
  Notifications: undefined
  Catalog:       undefined
  Settings:      undefined
  Billing:       undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab   = createBottomTabNavigator()

const ORANGE = '#f97316'

const HEADER = {
  headerStyle: { backgroundColor: '#fff' },
  headerTintColor: '#111',
  headerTitleStyle: { fontWeight: '700' as const },
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingBottom: 6, height: 60 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home:     ['home',          'home-outline'],
            Orders:   ['receipt',       'receipt-outline'],
            Products: ['cube',          'cube-outline'],
            Riders:   ['bicycle',       'bicycle-outline'],
            Profile:  ['person-circle', 'person-circle-outline'],
          }
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline']
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     options={{ title: 'Home' }} />
      <Tab.Screen name="Orders"   component={OrdersScreen}   options={{ title: 'Orders' }} />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: 'Products' }} />
      <Tab.Screen name="Riders"   component={RidersScreen}   options={{ title: 'Riders' }} />
      <Tab.Screen name="Profile"  component={ProfileScreen}  options={{ title: 'Profile' }} />
    </Tab.Navigator>
  )
}

export default function Navigation({ navigationRef }: { navigationRef?: React.RefObject<any> }) {
  const { isAuthenticated, shop } = useAuthStore()

  return (
    <NavigationContainer ref={navigationRef}>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen as any} />
        </Stack.Navigator>
      ) : !shop ? (
        // Logged in but no shop yet — show onboarding
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="RegisterShop" component={RegisterShopScreen as any} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={HEADER}>
          <Stack.Screen name="MainTabs"      component={MainTabs}            options={{ headerShown: false }} />
          <Stack.Screen name="OrderDetail"   component={OrderDetailScreen}   options={{ title: 'Order Details' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="Catalog"       component={CatalogScreen}       options={{ title: 'Add from Catalog' }} />
          <Stack.Screen name="Settings"      component={SettingsScreen}      options={{ title: 'Shop Settings' }} />
          <Stack.Screen name="Billing"       component={BillingScreen}       options={{ title: 'Billing & Commission' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  )
}
