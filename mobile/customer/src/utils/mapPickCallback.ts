/**
 * Module-level callback store for the map address picker.
 *
 * Why: React Navigation serialises route params, so you cannot pass a function
 * as a param to MapPickerScreen. Instead, the screen that launches the picker
 * registers a callback here before navigating, and MapPickerScreen calls it
 * on confirm.
 */

export interface MapPickResult {
  street:  string
  city:    string
  state:   string
  pincode: string
  lat:     number
  lng:     number
}

type Callback = (result: MapPickResult) => void

let _pending: Callback | null = null

export function setMapPickCallback(cb: Callback) {
  _pending = cb
}

export function callMapPickCallback(result: MapPickResult) {
  if (_pending) {
    _pending(result)
    _pending = null
  }
}
