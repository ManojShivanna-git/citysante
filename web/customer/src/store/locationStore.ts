import { create } from 'zustand'

interface LocationState {
  lat: number; lng: number; address: string; loading: boolean
  setLocation: (lat: number, lng: number, address?: string) => void
  detect: () => Promise<void>
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: 12.9312, lng: 77.6215, address: 'Koramangala, Bangalore', loading: false,

  setLocation: (lat, lng, address = '') => set({ lat, lng, address }),

  detect: async () => {
    set({ loading: true })
    try {
      await new Promise<void>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            set({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Current Location' })
            resolve()
          },
          reject,
          { timeout: 10000 }
        )
      )
    } catch {
      // Keep default location
    } finally {
      set({ loading: false })
    }
  },
}))
