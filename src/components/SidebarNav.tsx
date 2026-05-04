'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function navItemClass(pathname: string, href: string): string {
  return isNavActive(pathname, href) ? 'nav-item active' : 'nav-item'
}

type SidebarNavProps = {
  canAccessVolunteering: boolean
}

export default function SidebarNav({ canAccessVolunteering }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <div className="sidebar-sections">
      <nav className="nav-links sidebar-nav">
        <Link
          href="/"
          className={navItemClass(pathname, '/')}
          aria-label="Tableau de bord"
          title="Tableau de bord"
          data-tooltip="Tableau de bord"
          aria-current={isNavActive(pathname, '/') ? 'page' : undefined}
        >
          <LayoutDashboard size={18} aria-hidden="true" />
          <span className="sr-only">Tableau de bord</span>
        </Link>
        <Link
          href="/saisie"
          className={navItemClass(pathname, '/saisie')}
          aria-label="Saisie comptable"
          title="Saisie comptable"
          data-tooltip="Saisie comptable"
          aria-current={isNavActive(pathname, '/saisie') ? 'page' : undefined}
        >
          <PencilLine size={18} aria-hidden="true" />
          <span className="sr-only">Saisie comptable</span>
        </Link>
        <Link
          href="/documents"
          className={navItemClass(pathname, '/documents')}
          aria-label="Documents"
          title="Documents"
          data-tooltip="Documents"
          aria-current={isNavActive(pathname, '/documents') ? 'page' : undefined}
        >
          <FolderOpen size={18} aria-hidden="true" />
          <span className="sr-only">Documents</span>
        </Link>
        {canAccessVolunteering ? (
          <Link
            href="/benevolat"
            className={navItemClass(pathname, '/benevolat')}
            aria-label="Bénévolat"
            title="Bénévolat"
            data-tooltip="Bénévolat"
            aria-current={isNavActive(pathname, '/benevolat') ? 'page' : undefined}
          >
            <HandHeart size={18} aria-hidden="true" />
            <span className="sr-only">Bénévolat</span>
          </Link>
        ) : null}
        <Link
          href="/ecritures"
          className={navItemClass(pathname, '/ecritures')}
          aria-label="Grand livre"
          title="Grand livre"
          data-tooltip="Grand livre"
          aria-current={isNavActive(pathname, '/ecritures') ? 'page' : undefined}
        >
          <FileText size={18} aria-hidden="true" />
          <span className="sr-only">Grand livre</span>
        </Link>
      </nav>

      <div className="nav-links sidebar-bottom">
        <Link
          href="/exercices"
          className={navItemClass(pathname, '/exercices')}
          aria-label="Exercices"
          title="Exercices"
          data-tooltip="Exercices"
          aria-current={isNavActive(pathname, '/exercices') ? 'page' : undefined}
        >
          <CalendarDays size={18} aria-hidden="true" />
          <span className="sr-only">Exercices</span>
        </Link>
        <Link
          href="/bilan"
          className={navItemClass(pathname, '/bilan')}
          aria-label="Bilan & Résultat"
          title="Bilan & Résultat"
          data-tooltip="Bilan & Résultat"
          aria-current={isNavActive(pathname, '/bilan') ? 'page' : undefined}
        >
          <TrendingUp size={18} aria-hidden="true" />
          <span className="sr-only">Bilan & Résultat</span>
        </Link>
        <Link
          href="/previsionnel"
          className={navItemClass(pathname, '/previsionnel')}
          aria-label="Prévisionnel"
          title="Prévisionnel"
          data-tooltip="Prévisionnel"
          aria-current={isNavActive(pathname, '/previsionnel') ? 'page' : undefined}
        >
          <LineChart size={18} aria-hidden="true" />
          <span className="sr-only">Prévisionnel</span>
        </Link>
        <Link
          href="/parametres"
          className={navItemClass(pathname, '/parametres')}
          aria-label="Paramètres"
          title="Paramètres"
          data-tooltip="Paramètres"
          aria-current={isNavActive(pathname, '/parametres') ? 'page' : undefined}
        >
          <Settings size={18} aria-hidden="true" />
          <span className="sr-only">Paramètres</span>
        </Link>
      </div>
    </div>
  )
}
