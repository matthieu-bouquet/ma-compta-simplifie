// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Metadata } from "next";
import "./globals.css";
import Image from "next/image";
import { getCurrentAssociationId } from "@/lib/associationContext";
import { getCurrentAssociation } from "@/lib/currentAssociation";
import { isAssociationLegalForm } from "@/lib/legalForms";
import TopBar from "@/components/TopBar";
import SidebarNav from "@/components/SidebarNav";
import { PRODUCT_DISPLAY_NAME } from "@/lib/productDisplayName";

export const metadata: Metadata = {
  title: `${PRODUCT_DISPLAY_NAME} - Outil de gestion`,
  description: "Outil de comptabilité en partie double pour association sportive",
  icons: {
    icon: [{ url: "/favicon.svg" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentAssociationId = await getCurrentAssociationId();
  const currentAssociation = await getCurrentAssociation();
  const canAccessVolunteering = currentAssociation ? isAssociationLegalForm(currentAssociation.legalFormCode) : false;
  return (
    <html lang="fr">
      <body>
        <div className="app-container">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <Image
                src="/app-icon.svg"
                alt={`Icône ${PRODUCT_DISPLAY_NAME}`}
                title={PRODUCT_DISPLAY_NAME}
                width={56}
                height={56}
                priority
                className="sidebar-logo-image"
              />
            </div>
            <SidebarNav canAccessVolunteering={canAccessVolunteering} />
          </aside>
          <main className="main-content">
            <TopBar currentAssociationId={currentAssociationId} />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
