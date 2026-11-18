import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'

import LoginScreen        from '../screens/LoginScreen'
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
  Login:       undefined
  Home:        undefined
  Shop:        { shopId: string; shopName: string }
  Search:      undefined
  Cart:        undefined
  Checkout:    undefined
  Orders:      undefined
  OrderDetail: { orderId: string }
  Profile:     undefined
  Addresses:   undefined
  MapPicker:   undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function Navigation({ navigationRef }: { navigationRef?: any }) {
  const { isAuthenticated } = useAuthStore()

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home"    component={HomeScreen} />
            <Stack.Screen name="Search"  component={SearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Profile" component={ProfileScreen}
              options={{ headerShown: true, title: 'My Profile', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' }, headerBackVisible: false }}
            />
            <Stack.Screen name="Orders"  component={OrdersScreen}
              options={{ headerShown: true, title: 'My Orders', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="Shop"    component={ShopScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="Cart"    component={CartScreen}
              options={{ headerShown: true, title: 'My Cart', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="Checkout" component={CheckoutScreen}
              options={{ headerShown: true, title: 'Checkout', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen}
              options={{ headerShown: true, title: 'Order Details', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="Addresses" component={AddressesScreen}
              options={{ headerShown: true, title: 'My Addresses', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
            <Stack.Screen name="MapPicker" component={MapPickerScreen}
              options={{ headerShown: true, title: 'Pick Delivery Location', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111', headerTitleStyle: { fontWeight: '700' } }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
