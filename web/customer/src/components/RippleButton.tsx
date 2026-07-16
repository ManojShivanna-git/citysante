import { useRef, useState, useCallback } from 'react'
import clsx from 'clsx'

interface Ripple { id: number; x: number; y: number }

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Colour of the ripple circle — default white semi-transparent */
  rippleColor?: string
  /** Extra wrapper className (overflow-hidden is always applied) */
  className?: string
}

/**
 * Drop-in replacement for <button> that adds a material-style ripple on every
 * click plus a spring-bounce scale on the button itself.
 */
export default function RippleButton({
  children,
  className,
  onClick,
  rippleColor = 'rgba(255,255,255,0.38)',
  disabled,
  ...rest
}: Props) {
  const btnRef                  = useRef<HTMLButtonElement>(null)
  const [ripples, setRipples]   = useState<Ripple[]>([])
  const counter                 = useRef(0)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return

      // ── ripple ──
      const btn  = btnRef.current
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const id   = counter.current++
        const x    = e.clientX - rect.left
        const y    = e.clientY - rect.top
        setRipples(prev => [...prev, { id, x, y }])
        // clean up after animation
        setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600)
      }

      // ── spring on the button itself ──
      if (btn) {
        btn.classList.remove('animate-spring')
        // force reflow so re-adding the class triggers the animation again
        void btn.offsetWidth
        btn.classList.add('animate-spring')
        btn.addEventListener('animationend', () => btn.classList.remove('animate-spring'), { once: true })
      }

      onClick?.(e)
    },
    [disabled, onClick],
  )

  return (
    <button
      ref={btnRef}
      className={clsx('relative overflow-hidden', className)}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {children}

      {ripples.map(({ id, x, y }) => (
        <span
          key={id}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full animate-ripple"
          style={{
            left:       x,
            top:        y,
            width:      10,
            height:     10,
            marginLeft: -5,
            marginTop:  -5,
            background: rippleColor,
          }}
        />
      ))}
    </button>
  )
}
