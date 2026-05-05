'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './FloatingTooltipHost.module.css'

export default function FloatingTooltipHost({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  const tooltipId = `floating-tip-${id.replace(/:/g, '')}`
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  const positionBubble = useCallback(() => {
    const anchor = anchorRef.current
    const bubble = bubbleRef.current
    if (!anchor || !bubble) return
    const r = anchor.getBoundingClientRect()
    bubble.style.setProperty('left', `${r.left + r.width / 2}px`)
    bubble.style.setProperty('top', `${r.top}px`)
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    positionBubble()
    const onScrollOrResize = () => positionBubble()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, positionBubble])

  const show = () => setOpen(true)
  const hide = () => setOpen(false)

  const bubble =
    open && typeof document !== 'undefined' ? (
      <span ref={bubbleRef} id={tooltipId} role="tooltip" className={styles.bubble}>
        {label}
      </span>
    ) : null

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {bubble ? createPortal(bubble, document.body) : null}
    </>
  )
}
