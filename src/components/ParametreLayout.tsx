// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";
import styles from "./ParametreLayout.module.css";

interface ParametreLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function ParametreLayout({ children, title, description }: ParametreLayoutProps) {
  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            <h1
              className={`page-title no-topbar-pad ${styles.title} ${
                description ? styles.titleWithDescription : ""
              }`}
            >
              {title}
            </h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>

          <Link
            href="/parametres"
            className={`btn ${styles.backButton}`}
            title="Retour aux paramètres"
            aria-label="Retour aux paramètres"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
