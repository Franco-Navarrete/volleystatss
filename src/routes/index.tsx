import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/components/LandingPage'

export const Route = createFileRoute('/')({
  head: () => ({
    title: 'RALLY · Estadísticas de Vóley para Entrenadores',
    meta: [
      {
        name: 'description',
        content: 'La plataforma definitiva para el scouting y análisis de vóley. Gestiona tus partidos, equipos y estadísticas en tiempo real.',
      },
      {
        property: 'og:title',
        content: 'RALLY · Estadísticas de Vóley Profesionales',
      },
      {
        property: 'og:description',
        content: 'Optimiza el rendimiento de tu equipo con datos precisos y scouting avanzado.',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
  }),
  component: LandingPage,
})
