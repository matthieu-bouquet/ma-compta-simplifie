'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type InputLine = {
  montantDebit: number
  montantCredit: number
  ecritureDate: string | null
  ecritureLibelle: string | null
}

type InputCompte = {
  id: string
  numero: string
  libelle: string
  lignes: InputLine[]
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('fr-FR')
}

function fmtMonth(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${m}/${y}`
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISO(s: string) {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function listDaysInclusive(start: Date, end: Date) {
  const days: Date[] = []
  const cur = startOfDay(start)
  const last = startOfDay(end)
  while (cur <= last) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function listMonthsInclusive(start: Date, end: Date) {
  const months: Date[] = []
  const cur = startOfMonth(start)
  const last = startOfMonth(end)
  while (cur <= last) {
    months.push(new Date(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#0ea5e9', '#22c55e', '#f59e0b']

function fmtEuro(v: number) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
  } catch {
    return `${v.toFixed(2)} €`
  }
}

export default function PaymentMethodsEvolutionChart({
  dateDebut,
  dateFin,
  nowIso,
  comptes,
}: {
  dateDebut: string
  dateFin: string
  nowIso: string
  comptes: InputCompte[]
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const [tooltipClient, setTooltipClient] = useState<{ x: number; y: number } | null>(null)
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<Set<string>>(() => new Set())
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)

  const data = useMemo(() => {
    const start = parseISO(dateDebut)
    const end = parseISO(dateFin)
    if (!start || !end) return null

    const startDay = startOfDay(start)
    const endDay = startOfDay(end)

    const months = listMonthsInclusive(startDay, endDay)
    const monthKeys = months.map(monthKey)

    const seriesMonthly = comptes.map((c) => {
      const monthDelta = new Map<string, number>()

      for (const l of c.lignes) {
        const delta = (l.montantDebit || 0) - (l.montantCredit || 0)
        if (!delta) continue

        // Astuce UX: les A-nouveau sont plutôt un "solde d'ouverture".
        // Comme leur date peut être celle de la création (pas forcément dateDebut),
        // on les rattache au mois de début de l'exercice pour une courbe plus lisible.
        const isANouveau = (l.ecritureLibelle || '').toLowerCase().startsWith('a-nouveau')

        const dRaw = isANouveau ? startDay : (l.ecritureDate ? parseISO(l.ecritureDate) : null)
        const d = dRaw ? startOfDay(dRaw) : null
        if (!d) continue
        if (d < startDay || d > endDay) continue

        const k = monthKey(d)
        monthDelta.set(k, (monthDelta.get(k) ?? 0) + delta)
      }

      // courbe cumulative (solde fin de mois)
      let acc = 0
      const values = monthKeys.map((k) => {
        acc += monthDelta.get(k) ?? 0
        return acc
      })

      return {
        id: c.id,
        label: `${c.numero} — ${c.libelle}`,
        values,
      }
    })

    const all = seriesMonthly.flatMap((s) => s.values)
    // Axe Y: on force un minimum à 0 (demande UX).
    const min = 0
    const max = all.length ? Math.max(0, ...all) : 0

    return { startDay, endDay, months, seriesMonthly, min, max }
  }, [dateDebut, dateFin, comptes])

  if (!data) return null
  if (!data.seriesMonthly.length) {
    return <div style={{ color: 'var(--text-secondary)' }}>Aucun moyen de paiement (classe 5) sur cet exercice.</div>
  }

  const width = 920
  const height = 320
  const pad = { l: 48, r: 16, t: 12, b: 54 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b

  const minY = data.min
  const maxY = data.max
  const span = Math.max(1e-9, maxY - minY)
  const xStep = data.months.length <= 1 ? 0 : w / (data.months.length - 1)

  const x = (i: number) => pad.l + i * xStep
  const y = (v: number) => pad.t + (1 - (v - minY) / span) * h

  const visibleSeriesMonthly = data.seriesMonthly.filter((s) => !hiddenSeriesIds.has(s.id))

  const todayX = useMemo(() => {
    if (!data.months.length) return null
    const today = parseISO(nowIso) ?? new Date()
    const start = data.startDay
    const end = addDays(data.endDay, 1)
    if (today < start || today >= end) return null

    // position intra-mois pour plus de précision
    const mStart = startOfMonth(today)
    const idx = data.months.findIndex((m) => sameMonth(m, mStart))
    if (idx < 0) return null
    const mEnd = startOfNextMonth(mStart)
    const frac = clamp((today.getTime() - mStart.getTime()) / Math.max(1, mEnd.getTime() - mStart.getTime()), 0, 1)
    const base = x(idx)
    if (data.months.length <= 1) return base
    if (idx >= data.months.length - 1) return base
    return base + frac * xStep
  }, [data.months, data.startDay, data.endDay, xStep, nowIso])

  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const t = i / yTicks
    const v = maxY - t * (maxY - minY)
    return { v, y: y(v) }
  })

  const updateHoverFromClientPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = clamp(clientX - rect.left, 0, rect.width)
    const py = clamp(clientY - rect.top, 0, rect.height)

    // Convert to viewBox coordinates (we use fixed viewBox size).
    const vx = (px / rect.width) * width
    const vy = (py / rect.height) * height

    const n = data.months.length
    if (n <= 1) {
      setHoverIndex(0)
      setTooltip({ x: vx, y: vy })
      return
    }

    const idx = clamp(Math.round((vx - pad.l) / xStep), 0, n - 1)
    setHoverIndex(idx)
    setTooltip({ x: vx, y: vy })
    setTooltipClient({ x: clientX, y: clientY })
  }

  const clearHover = () => {
    setHoverIndex(null)
    setTooltip(null)
    setTooltipClient(null)
  }

  const toggleSeries = (id: string) => {
    setHiddenSeriesIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Tooltip du graphe global: mois (1 point par mois)
  const monthLabelForIndex = (idx: number) => fmtMonth(data.months[idx])

  // Données pour le graphe "détail du mois" (1 point par jour, mois sélectionné)
  const monthOptions = useMemo(() => {
    return data.months.map((m) => ({ key: monthKey(m), label: fmtMonth(m), date: m }))
  }, [data.months])

  const defaultMonthKey = useMemo(() => {
    const today = parseISO(nowIso) ?? new Date()
    const todayM = startOfMonth(today)
    const inRange = monthOptions.find((m) => sameMonth(m.date, todayM))
    return (inRange ?? monthOptions[monthOptions.length - 1])?.key ?? null
  }, [monthOptions, nowIso])

  const effectiveMonthKey = selectedMonthKey ?? defaultMonthKey

  const monthDaily = useMemo(() => {
    if (!effectiveMonthKey) return null
    const m = monthOptions.find((x) => x.key === effectiveMonthKey)?.date
    if (!m) return null

    const monthStart = startOfMonth(m)
    const monthEndExclusive = startOfNextMonth(m)

    const start = data.startDay > monthStart ? data.startDay : monthStart
    const end = data.endDay < addDays(monthEndExclusive, -1) ? data.endDay : addDays(monthEndExclusive, -1)
    if (end < start) return null

    const days = listDaysInclusive(start, end)
    const keys = days.map(dayKey)

    // opening balance (somme des deltas avant le début du mois dans l'exercice)
    const openingBySerie = new Map<string, number>()
    for (const s of data.seriesMonthly) openingBySerie.set(s.id, 0)

    // On repart des lignes brutes (comptes) pour être exact au jour le jour.
    const perSeriesDayDelta = new Map<string, Map<string, number>>()
    for (const c of comptes) {
      const serieId = c.id
      perSeriesDayDelta.set(serieId, new Map())
      openingBySerie.set(serieId, 0)

      for (const l of c.lignes) {
        const delta = (l.montantDebit || 0) - (l.montantCredit || 0)
        if (!delta) continue
        const isANouveau = (l.ecritureLibelle || '').toLowerCase().startsWith('a-nouveau')
        const dRaw = isANouveau ? data.startDay : (l.ecritureDate ? parseISO(l.ecritureDate) : null)
        const d = dRaw ? startOfDay(dRaw) : null
        if (!d) continue
        if (d < data.startDay || d > data.endDay) continue

        if (d < start) {
          openingBySerie.set(serieId, (openingBySerie.get(serieId) ?? 0) + delta)
          continue
        }
        if (d > end) continue

        const k = dayKey(d)
        const map = perSeriesDayDelta.get(serieId)!
        map.set(k, (map.get(k) ?? 0) + delta)
      }
    }

    const seriesDaily = data.seriesMonthly.map((s) => {
      let acc = openingBySerie.get(s.id) ?? 0
      const deltas = perSeriesDayDelta.get(s.id) ?? new Map<string, number>()
      const values = keys.map((k) => {
        acc += deltas.get(k) ?? 0
        return acc
      })
      return { id: s.id, label: s.label, values }
    })

    const all = seriesDaily.flatMap((s) => s.values)
    const min = 0
    const max = all.length ? Math.max(0, ...all) : 0

    return { monthStart: start, days, seriesDaily, min, max }
  }, [effectiveMonthKey, monthOptions, data.startDay, data.endDay, data.seriesMonthly, comptes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Toggles (mutualisés pour les 2 graphes) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {data.seriesMonthly.map((s, si) => {
          const hidden = hiddenSeriesIds.has(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSeries(s.id)}
              aria-pressed={!hidden}
              title={hidden ? 'Afficher ce compte' : 'Masquer ce compte'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid var(--border-color)',
                background: hidden ? 'rgba(2,6,23,0.03)' : 'white',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: COLORS[si % COLORS.length],
                  opacity: hidden ? 0.35 : 1,
                }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', opacity: hidden ? 0.6 : 1 }}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Graphe global (mensuel) */}
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          role="img"
          aria-label="Graphique évolution des moyens de paiement"
          onMouseMove={(e) => updateHoverFromClientPoint(e.clientX, e.clientY)}
          onMouseLeave={clearHover}
        >
        <rect x="0" y="0" width={width} height={height} rx="10" fill="rgba(2,6,23,0.02)" />

        {/* grid + ticks */}
        {ticks.map((t, idx) => (
          <g key={idx}>
            <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} stroke="rgba(2,6,23,0.08)" strokeWidth="1" />
            <text x={pad.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="rgba(2,6,23,0.55)">
              {t.v.toFixed(0)}€
            </text>
          </g>
        ))}

        {/* x labels (mensuel) */}
        {(() => {
          const n = data.months.length
          const maxLabels = 8
          const step = Math.max(1, Math.ceil(n / maxLabels))
          return data.months.map((m, i) => {
            const isLast = i === n - 1
            if (i % step !== 0 && !isLast) return null
            return (
              <text
                key={i}
                x={x(i)}
                y={height - 18}
                textAnchor={i === 0 ? 'start' : isLast ? 'end' : 'middle'}
                fontSize="11"
                fill="rgba(2,6,23,0.55)"
              >
                {fmtMonth(m)}
              </text>
            )
          })
        })()}

        {/* today marker */}
        {todayX !== null && (
          <g>
            <line
              x1={todayX}
              x2={todayX}
              y1={pad.t}
              y2={pad.t + h}
              stroke="rgba(2,6,23,0.35)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <text
              x={todayX + 6}
              y={pad.t + 12}
              fontSize="11"
              fill="rgba(2,6,23,0.55)"
            >
              Aujourd’hui
            </text>
          </g>
        )}

        {/* hover month marker */}
        {hoverIndex !== null && (
          <line
            x1={x(hoverIndex)}
            x2={x(hoverIndex)}
            y1={pad.t}
            y2={pad.t + h}
            stroke="rgba(2,6,23,0.22)"
            strokeWidth="1.5"
          />
        )}

        {/* series */}
        {data.seriesMonthly.map((s, si) => {
          if (hiddenSeriesIds.has(s.id)) return null
          const color = COLORS[si % COLORS.length]
          const d = s.values
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
            .join(' ')
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={hoverIndex === i ? 4.2 : 2.2}
                  fill={color}
                  opacity={0.95}
                  onMouseEnter={(e) => updateHoverFromClientPoint((e as any).clientX, (e as any).clientY)}
                />
              ))}
            </g>
          )
        })}
      </svg>

        {/* tooltip (portal to body to avoid stacking/overflow issues) */}
        {hoverIndex !== null &&
          tooltipClient &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                zIndex: 100000,
                transform: `translate(${clamp(tooltipClient.x + 12, 12, window.innerWidth - 12)}px, ${clamp(tooltipClient.y - 8, 10, window.innerHeight - 10)}px)`,
                maxWidth: 320,
                background: 'rgba(15, 23, 42, 0.96)',
                color: 'white',
                padding: '10px 12px',
                borderRadius: 10,
                boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{monthLabelForIndex(hoverIndex)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleSeriesMonthly.map((s) => {
                  const si = data.seriesMonthly.findIndex((x) => x.id === s.id)
                  const color = COLORS[(si >= 0 ? si : 0) % COLORS.length]
                  return (
                    <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 99,
                          background: color,
                          flex: '0 0 auto',
                          marginTop: 2,
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                        <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{s.label}</span>
                        <span style={{ fontWeight: 700 }}>{fmtEuro(s.values[hoverIndex] ?? 0)}</span>
                      </div>
                    </div>
                  )
                })}
                {visibleSeriesMonthly.length === 0 && <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Aucune courbe affichée.</div>}
              </div>
            </div>,
            document.body,
          )}
      </div>

      {/* Graphe détail du mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Détail du mois</div>
        <select
          value={effectiveMonthKey ?? ''}
          onChange={(e) => setSelectedMonthKey(e.target.value)}
          style={{
            height: '36px',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            background: 'white',
            color: 'var(--text-primary)',
            padding: '0 0.6rem',
            outline: 'none',
            minWidth: 160,
          }}
          aria-label="Sélectionner un mois"
          title="Sélectionner un mois"
        >
          {monthOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {monthDaily ? (
        <MonthlyDetailChart
          nowIso={nowIso}
          width={width}
          height={260}
          pad={{ l: 48, r: 16, t: 12, b: 42 }}
          days={monthDaily.days}
          series={monthDaily.seriesDaily}
          hiddenSeriesIds={hiddenSeriesIds}
        />
      ) : (
        <div style={{ color: 'var(--text-secondary)' }}>Aucune donnée sur ce mois.</div>
      )}

      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Vue globale: 1 point par mois. Détail: 1 point par jour sur le mois sélectionné.
      </div>
    </div>
  )
}

function MonthlyDetailChart({
  nowIso,
  width,
  height,
  pad,
  days,
  series,
  hiddenSeriesIds,
}: {
  nowIso: string
  width: number
  height: number
  pad: { l: number; r: number; t: number; b: number }
  days: Date[]
  series: { id: string; label: string; values: number[] }[]
  hiddenSeriesIds: Set<string>
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const [tooltipClient, setTooltipClient] = useState<{ x: number; y: number } | null>(null)

  const visible = series.filter((s) => !hiddenSeriesIds.has(s.id))
  const all = visible.flatMap((s) => s.values)
  const minY = 0
  const maxY = all.length ? Math.max(0, ...all) : 0
  const span = Math.max(1e-9, maxY - minY)

  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const xStep = days.length <= 1 ? 0 : w / (days.length - 1)
  const x = (i: number) => pad.l + i * xStep
  const y = (v: number) => pad.t + (1 - (v - minY) / span) * h

  const todayX = useMemo(() => {
    if (!days.length) return null
    const today = parseISO(nowIso) ?? new Date()
    const start = days[0]
    const end = addDays(days[days.length - 1], 1)
    if (today < start || today >= end) return null
    const day = startOfDay(today)
    const idx = days.findIndex((d) => d.getTime() === day.getTime())
    if (idx < 0) return null
    const frac = clamp((today.getTime() - day.getTime()) / 86_400_000, 0, 1)
    const base = x(idx)
    if (days.length <= 1) return base
    if (idx >= days.length - 1) return base
    return base + frac * xStep
  }, [days, xStep, nowIso])

  const updateHoverFromClientPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = clamp(clientX - rect.left, 0, rect.width)
    const py = clamp(clientY - rect.top, 0, rect.height)
    const vx = (px / rect.width) * width
    const vy = (py / rect.height) * height
    const n = days.length
    if (n <= 1) {
      setHoverIndex(0)
      setTooltip({ x: vx, y: vy })
      return
    }
    const idx = clamp(Math.round((vx - pad.l) / xStep), 0, n - 1)
    setHoverIndex(idx)
    setTooltip({ x: vx, y: vy })
    setTooltipClient({ x: clientX, y: clientY })
  }

  const clearHover = () => {
    setHoverIndex(null)
    setTooltip(null)
    setTooltipClient(null)
  }

  const yTicks = 3
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const t = i / yTicks
    const v = maxY - t * (maxY - minY)
    return { v, y: y(v) }
  })

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Graphique détail mensuel"
        onMouseMove={(e) => updateHoverFromClientPoint(e.clientX, e.clientY)}
        onMouseLeave={clearHover}
      >
        <rect x="0" y="0" width={width} height={height} rx="10" fill="rgba(2,6,23,0.02)" />

        {ticks.map((t, idx) => (
          <g key={idx}>
            <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} stroke="rgba(2,6,23,0.08)" strokeWidth="1" />
            <text x={pad.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="rgba(2,6,23,0.55)">
              {t.v.toFixed(0)}€
            </text>
          </g>
        ))}

        {/* labels: 1, 15, last */}
        {(() => {
          const n = days.length
          return days.map((d, i) => {
            const isFirst = d.getDate() === 1
            const isMid = d.getDate() === 15
            const isLast = i === n - 1
            if (!isFirst && !isMid && !isLast) return null
            return (
              <text
                key={i}
                x={x(i)}
                y={height - 14}
                textAnchor={i === 0 ? 'start' : isLast ? 'end' : 'middle'}
                fontSize="11"
                fill="rgba(2,6,23,0.55)"
              >
                {d.getDate()}
              </text>
            )
          })
        })()}

        {todayX !== null && (
          <line
            x1={todayX}
            x2={todayX}
            y1={pad.t}
            y2={pad.t + h}
            stroke="rgba(2,6,23,0.35)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
        )}

        {hoverIndex !== null && (
          <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.t} y2={pad.t + h} stroke="rgba(2,6,23,0.22)" strokeWidth="1.5" />
        )}

        {series.map((s, si) => {
          if (hiddenSeriesIds.has(s.id)) return null
          const color = COLORS[si % COLORS.length]
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={hoverIndex === i ? 3.8 : 2.0}
                  fill={color}
                  opacity={0.9}
                />
              ))}
            </g>
          )
        })}
      </svg>

      {hoverIndex !== null &&
        tooltipClient &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              zIndex: 100000,
              transform: `translate(${clamp(tooltipClient.x + 12, 12, window.innerWidth - 12)}px, ${clamp(tooltipClient.y - 8, 10, window.innerHeight - 10)}px)`,
              maxWidth: 320,
              background: 'rgba(15, 23, 42, 0.96)',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 10,
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{fmtDay(days[hoverIndex])}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visible.map((s) => {
                const si = series.findIndex((x) => x.id === s.id)
                const color = COLORS[(si >= 0 ? si : 0) % COLORS.length]
                return (
                  <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 10, height: 10, borderRadius: 99, background: color, flex: '0 0 auto', marginTop: 2 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                      <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{s.label}</span>
                      <span style={{ fontWeight: 700 }}>{fmtEuro(s.values[hoverIndex] ?? 0)}</span>
                    </div>
                  </div>
                )
              })}
              {visible.length === 0 && <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Aucune courbe affichée.</div>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

