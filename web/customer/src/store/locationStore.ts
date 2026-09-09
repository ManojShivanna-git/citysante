import { create } from 'zustand'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`
    )
    const data = await res.json()
    if (data.results?.[0]) {
      // Return locality + city (e.g. "Koramangala, Bengaluru")
      const components = data.results[0].address_components as any[]
      const locality = components.find((c: any) => c.types.includes('sublocality_level_1') || c.types.includes('locality'))?.long_name
      const city     = components.find((c: any) => c.types.includes('locality') || c.types.includes('administrative_area_level_2'))?.long_name
      if (locality && city && locality !== city) return `${locality}, ${city}`
      return data.results[0].formatted_address.split(',').slice(0, 2).join(',')
    }
  } catch {}
  return 'Current Location'
}

interface LocationState {
  lat: number
  lng: number
  address: string
  loading: boolean
  setLocation: (lat: number, lng: number, address?: string) => void
  detect: () => Promise<void>
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: 0, lng: 0, address: '', loading: false,

  setLocation: (lat, lng, address = '') => set({ lat, lng, address }),

  detect: async () => {
    set({ loading: true })
    try {
      await new Promise<void>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords
            const address = await reverseGeocode(lat, lng)
            set({ lat, lng, address })
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
