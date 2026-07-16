import { useRef, useCallback } from 'react'

/**
 * Returns a ref to attach to the qty counter <span> and a trigger function.
 * Call trigger() on every qty change to play the bump animation.
 */
export function useQtyBump() {
  const ref = useRef<HTMLSpanElement>(null)

  const trigger = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.classList.remove('animate-qty-bump')
    void el.offsetWidth            // force reflow
    el.classList.add('animate-qty-bump')
    el.addEventListener('animationend', () => el.classList.remove('animate-qty-bump'), { once: true })
  }, [])

  return { ref, trigger }
}
