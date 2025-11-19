const breadcrumbMapping: Record<string, string> = {
  'dashboard': 'Tableau de bord',
  'topologies': 'Topologies',
  'creer': 'Créer une topologie',
  'visualiser': 'Visualiser',
  'noeuds': 'Nœuds réseau',
  'ajouter': 'Ajouter un nœud',
  'metriques': 'Métriques temps réel',
  'surveillance': 'Surveillance',
  'historique': 'Historique',
  'rapports': 'Rapports',
  'parametres': 'Paramètres',
  'configuration': 'Configuration',
  'projects': 'Projets',
  'stats': 'Statistiques',
  'settings': 'Paramètres',
}

export function getFrenchName(segment: string): string {
  return breadcrumbMapping[segment.toLowerCase()] || capitalizeFirstLetter(segment)
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}