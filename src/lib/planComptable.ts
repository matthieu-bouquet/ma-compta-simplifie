// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export const PLAN_COMPTABLE_ASSOCIATIF = [
  // Classe 1: Comptes de capitaux
  { numero: "102", libelle: "Fonds associatifs sans droit de reprise" },
  { numero: "106", libelle: "Réserves" },
  { numero: "110", libelle: "Report à nouveau (solde créditeur)" },
  { numero: "119", libelle: "Report à nouveau (solde débiteur)" },
  { numero: "120", libelle: "Résultat de l'exercice (bénéfice)" },
  { numero: "129", libelle: "Résultat de l'exercice (perte)" },
  { numero: "139", libelle: "Subventions d'investissement" },

  // Classe 2: Comptes d'immobilisations
  { numero: "211", libelle: "Terrains" },
  { numero: "213", libelle: "Constructions" },
  { numero: "215", libelle: "Installations, matériel et outillage" },
  { numero: "218", libelle: "Autres immobilisations corporelles (matériel de sport)" },
  { numero: "2183", libelle: "Matériel informatique" },
  { numero: "281", libelle: "Amortissements des immobilisations corporelles" },

  // Classe 4: Comptes de tiers
  { numero: "401", libelle: "Fournisseurs" },
  { numero: "411", libelle: "Adhérents, clients" },
  { numero: "421", libelle: "Personnel - Rémunérations dues" },
  { numero: "431", libelle: "Sécurité sociale" },
  { numero: "444", libelle: "Etat - Impôts sur les bénéfices" },

  // Classe 5: Comptes financiers
  { numero: "512", libelle: "Banque" },
  { numero: "5122", libelle: "Compte Épargne / Livret" },
  { numero: "530", libelle: "Caisse" },

  // Classe 6: Comptes de charges
  { numero: "601", libelle: "Achats stockés - Matières premières" },
  { numero: "602", libelle: "Achats stockés - Autres approvisionnements" },
  { numero: "604", libelle: "Achats d'études et prestations de services" },
  { numero: "606", libelle: "Achats non stockés de matières et fournitures (eau, énergie, matériel divers)" },
  { numero: "613", libelle: "Locations" },
  { numero: "615", libelle: "Entretien et réparations" },
  { numero: "616", libelle: "Primes d'assurances" },
  { numero: "618", libelle: "Frais divers (compétitions, etc.)" },
  { numero: "622", libelle: "Rémunérations d'intermédiaires et honoraires" },
  { numero: "623", libelle: "Publicité, publications, relations publiques" },
  { numero: "625", libelle: "Déplacements, missions et réceptions" },
  { numero: "626", libelle: "Frais postaux et de télécommunications" },
  { numero: "627", libelle: "Services bancaires et assimilés" },
  { numero: "641", libelle: "Rémunérations du personnel" },
  { numero: "645", libelle: "Charges de sécurité sociale et de prévoyance" },
  { numero: "681", libelle: "Dotations aux amortissements" },

  // Classe 7: Comptes de produits
  { numero: "701", libelle: "Ventes de produits finis" },
  { numero: "706", libelle: "Prestations de services (cours, stages)" },
  { numero: "708", libelle: "Produits des activités annexes (buvette, boutique)" },
  { numero: "740", libelle: "Subventions d'exploitation" },
  { numero: "754", libelle: "Dons manuels" },
  { numero: "756", libelle: "Cotisations" },
  { numero: "760", libelle: "Produits financiers" },

  // Classe 8: Comptes spéciaux (ANC 2018-06) - Contributions volontaires en nature
  // Emplois des contributions volontaires en nature (débit)
  { numero: "860", libelle: "Secours en nature" },
  { numero: "861", libelle: "Mises à disposition gratuite de biens" },
  { numero: "862", libelle: "Prestations" },
  { numero: "864", libelle: "Personnel bénévole" },
  // Contributions volontaires en nature (crédit)
  { numero: "870", libelle: "Dons en nature" },
  { numero: "871", libelle: "Prestations en nature" },
  { numero: "875", libelle: "Bénévolat" },
];
