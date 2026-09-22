'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  PencilLine,
  FileText,
  TrendingUp,
  Settings,
  FolderOpen,
  HandHeart,
  LineChart,
  Receipt,
  Users,
  HeartHandshake,
  BookOpen,
  ClipboardList,
  CalendarRange,
  Landmark,
} from 'lucide-react'

type NavLeaf = { href: string; label: string; icon: ReactNode }

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItemLink({
  href,
  label,
  pathname,
  children,
}: {
  href: string
  label: string
  pathname: string
  children: ReactNode
}) {
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      className={active ? 'nav-item active' : 'nav-item'}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-item-icon" aria-hidden="true">
        {children}
      </span>
      <span className="nav-item-label">{label}</span>
    </Link>
  )
}

function NavFlyout({
  label,
  pathname,
  icon,
  items,
}: {
  label: string
  pathname: string
  icon: ReactNode
  items: NavLeaf[]
}) {
  const active = items.some((item) => isNavActive(pathname, item.href))
  const hubHref = items[0]?.href ?? '/'
  return (
    <div className="nav-flyout-host">
      <Link
        href={hubHref}
        className={active ? 'nav-item active' : 'nav-item'}
        aria-haspopup="menu"
        aria-current={active ? 'true' : undefined}
      >
        <span className="nav-item-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="nav-item-label">{label}</span>
      </Link>
      <div className="nav-flyout" role="menu" aria-label={label}>
        {items.map((item) => {
          const itemActive = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={itemActive ? 'nav-flyout-item active' : 'nav-flyout-item'}
              aria-current={itemActive ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <div className="sidebar-sections">
      <nav className="nav-links sidebar-nav" aria-label="Navigation principale">
        <NavItemLink href="/" label="Tableau de bord" pathname={pathname}>
          <LayoutDashboard size={18} />
        </NavItemLink>

        <NavFlyout
          label="Vie associative"
          pathname={pathname}
          icon={<Landmark size={18} />}
          items={[
            { href: '/adhesions', label: 'Adhésions', icon: <ClipboardList size={16} aria-hidden="true" /> },
            { href: '/adherents', label: 'Adhérents', icon: <Users size={16} aria-hidden="true" /> },
            { href: '/dons', label: 'Dons', icon: <HeartHandshake size={16} aria-hidden="true" /> },
            { href: '/benevolat', label: 'Bénévolat', icon: <HandHeart size={16} aria-hidden="true" /> },
            { href: '/saisons', label: 'Saisons', icon: <CalendarRange size={16} aria-hidden="true" /> },
          ]}
        />

        <NavItemLink href="/factures" label="Facturation" pathname={pathname}>
          <Receipt size={18} />
        </NavItemLink>

        <NavFlyout
          label="Comptabilité"
          pathname={pathname}
          icon={<BookOpen size={18} />}
          items={[
            { href: '/saisie', label: 'Saisie', icon: <PencilLine size={16} aria-hidden="true" /> },
            { href: '/documents', label: 'Documents', icon: <FolderOpen size={16} aria-hidden="true" /> },
            { href: '/ecritures', label: 'Grand livre', icon: <FileText size={16} aria-hidden="true" /> },
            { href: '/bilan', label: 'Bilan & Résultat', icon: <TrendingUp size={16} aria-hidden="true" /> },
            { href: '/previsionnel', label: 'Prévisionnel', icon: <LineChart size={16} aria-hidden="true" /> },
            { href: '/exercices', label: 'Exercices', icon: <CalendarDays size={16} aria-hidden="true" /> },
          ]}
        />
      </nav>

      <div className="nav-links sidebar-bottom">
        <NavItemLink href="/parametres" label="Paramètres" pathname={pathname}>
          <Settings size={18} />
        </NavItemLink>
      </div>
    </div>
  )
}
