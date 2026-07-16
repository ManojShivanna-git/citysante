import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { RED } from '../theme'

import LoginScreen        from '../screens/LoginScreen'
import RegisterScreen     from '../screens/RegisterScreen'
import HomeScreen         from '../screens/HomeScreen'
import ShopScreen         from '../screens/ShopScreen'
import SearchScreen       from '../screens/SearchScreen'
import CartScreen         from '../screens/CartScreen'
import CheckoutScreen     from '../screens/CheckoutScreen'
import OrdersScreen       from '../screens/OrdersScreen'
import OrderDetailScreen  from '../screens/OrderDetailScreen'
import ProfileScreen      from '../screens/ProfileScreen'
import AddressesScreen    from '../screens/AddressesScreen'
import MapPickerScreen    from '../screens/MapPickerScreen'

export type RootStackParamList = {
  AuthStack:   undefined
  MainTabs:    undefined
  Shop:        { shopId: string; shopName: string }
  Cart:        undefined
  Checkout:    undefined
  OrderDetail: { orderId: string }
  Addresses:   undefined
  MapPicker:   undefined
  Login:       undefined
}

export type AuthStackParamList = {
  Login: undefined
  Register: undefined
}

export type MainTabParamList = {
  Home: undefined
  Search: undefined
  Orders: undefined
  Profile: undefined
}

const Root  = createNativeStackNavigator<RootStackParamList>()
const Auth  = createNativeStackNavigator<AuthStackParamList>()
const Tab   = createBottomTabNavigator<MainTabParamList>()

function AuthStack() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Login"    component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
    </Auth.Navigator>
  )
}

function MainTabs() {
  const itemCount = useCartStore((s) => s.totalItems())
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
            Search:  ['search',        'search-outline'],
            Orders:  ['receipt',       'receipt-outline'],
            Profile: ['person-circle', 'person-circle-outline'],
          }
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline']
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ title: 'Home' }} />
      <Tab.Screen name="Search"  component={SearchScreen}  options={{ title: 'Search' }} />
      <Tab.Screen name="Orders"  component={OrdersScreen}  options={{ title: 'Orders' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  )
}

export default function Navigation({ navigationRef }: { navigationRef?: any }) {
  const { isAuthenticated } = useAuthStore()

  return (
    <NavigationContainer ref={navigationRef}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Root.Screen name="AuthStack" component={AuthStack} />
        ) : (
          <>
            <Root.Screen name="MainTabs" component={MainTabs} />
            <Root.Screen
              name="Shop"
              component={ShopScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Root.Screen
              name="Cart"
              component={CartScreen}
              options={{
                headerShown: true,
                title: 'My Cart',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Root.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                headerShown: true,
                title: 'Checkout',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Root.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{
                headerShown: true,
                title: 'Order Details',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Root.Screen
              name="Addresses"
              component={AddressesScreen}
              options={{
                headerShown: true,
                title: 'My Addresses',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Root.Screen
              name="MapPicker"
              component={MapPickerScreen}
              options={{
                headerShown: true,
                title: 'Pick Delivery Location',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        )}
      </Root.Navigator>
    </NavigationContainer>
  )
}
