import ProjectSlugClient from './ProjectSlugClient'

// Generate static params for static export
// Returns a single placeholder path - actual routing happens client-side
export async function generateStaticParams() {
  return [{ slug: ['_'] }]
}

export default function ProjectSlugPage() {
  return <ProjectSlugClient />
}

