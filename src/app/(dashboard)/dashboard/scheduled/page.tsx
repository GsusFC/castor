import Link from 'next/link'
import { Clock, Calendar, User, ExternalLink, Edit, FileText } from 'lucide-react'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

interface CastCreator {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface Cast {
  id: string
  content: string
  scheduledAt: Date
  status: string
  castHash?: string | null
  account: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  } | null
  createdBy?: CastCreator | null
}

export default async function ScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string }>
}) {
  const { status: filterStatus, tab } = await searchParams
  
  const casts = await db.query.scheduledCasts.findMany({
    with: {
      account: true,
      createdBy: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          pfpUrl: true,
        },
      },
    },
    orderBy: (casts, { desc }) => [desc(casts.scheduledAt)],
  })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const drafts = casts.filter(c => c.status === 'draft')
  const scheduled = casts.filter(c => c.status === 'scheduled')
  const today = casts.filter(c => 
    c.status === 'scheduled' && 
    new Date(c.scheduledAt) >= todayStart && 
    new Date(c.scheduledAt) < todayEnd
  )
  const published = casts.filter(c => c.status === 'published')
  const failed = casts.filter(c => c.status === 'failed')

  // Filtrar según el parámetro de URL
  const getFilteredCasts = () => {
    // Primero verificar tab para borradores
    if (tab === 'draft') {
      return { title: 'Borradores', casts: drafts, isDraft: true }
    }
    
    switch (filterStatus) {
      case 'scheduled':
        return { title: 'Programados', casts: scheduled }
      case 'today':
        return { title: 'Programados para hoy', casts: today }
      case 'published':
        return { title: 'Publicados', casts: published }
      case 'failed':
        return { title: 'Fallidos', casts: failed }
      default:
        return null
    }
  }

  const filtered = getFilteredCasts()

  // Auto-refresh solo si hay casts programados pendientes
  const hasScheduledCasts = scheduled.length > 0

  return (
    <div className="max-w-4xl">
      {/* Auto-refresh cada 30s si hay casts programados */}
      <AutoRefresh interval={30000} enabled={hasScheduledCasts} />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display text-gray-900">
            {filtered ? filtered.title : 'Casts'}
          </h1>
          <p className="text-gray-500 mt-1">
            {filtered ? (
              <>
                {filtered.casts.length} cast{filtered.casts.length !== 1 ? 's' : ''}
                {(filterStatus || tab) && (
                  <Link href="/dashboard/scheduled" className="ml-2 text-castor-black hover:underline">
                    Ver todos
                  </Link>
                )}
              </>
            ) : (
              <>
                {drafts.length > 0 && <><Link href="/dashboard/scheduled?tab=draft" className="hover:underline">{drafts.length} borrador{drafts.length !== 1 ? 'es' : ''}</Link> · </>}
                {scheduled.length} programados · {published.length} publicados
                {failed.length > 0 && ` · ${failed.length} fallidos`}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Vista filtrada */}
      {filtered ? (
        filtered.casts.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-500">No hay casts en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.casts.map((cast) => (
              <CastCard key={cast.id} cast={cast} />
            ))}
          </div>
        )
      ) : casts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Borradores */}
          {drafts.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-amber-600 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Borradores
              </h2>
              <div className="space-y-3">
                {drafts.map((cast) => (
                  <CastCard key={cast.id} cast={cast} isDraft />
                ))}
              </div>
            </section>
          )}

          {/* Programados */}
          {scheduled.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Programados
              </h2>
              <div className="space-y-3">
                {scheduled.map((cast) => (
                  <CastCard key={cast.id} cast={cast} />
                ))}
              </div>
            </section>
          )}

          {/* Publicados */}
          {published.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                ✓ Publicados
              </h2>
              <div className="space-y-3">
                {published.map((cast) => (
                  <CastCard key={cast.id} cast={cast} />
                ))}
              </div>
            </section>
          )}

          {/* Fallidos */}
          {failed.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                ✗ Fallidos
              </h2>
              <div className="space-y-3">
                {failed.map((cast) => (
                  <CastCard key={cast.id} cast={cast} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="text-center">
      <CardContent className="pt-12 pb-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No hay casts programados</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Usa el botón "Nuevo Cast" del menú lateral para programar tu primer cast.
        </p>
      </CardContent>
    </Card>
  )
}

function CastCard({ cast, isDraft = false }: { cast: Cast; isDraft?: boolean }) {
  if (!cast.account) return null
  
  const scheduledDate = new Date(cast.scheduledAt)
  const hasSchedule = cast.status !== 'draft' || (cast.content && cast.scheduledAt)
  
  return (
    <Card className={`p-4 ${isDraft ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {cast.account.pfpUrl ? (
            <img
              src={cast.account.pfpUrl}
              alt={cast.account.username}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div>
            <span className="font-medium">
              {cast.account.displayName || cast.account.username}
            </span>
            <span className="text-gray-500 ml-2">@{cast.account.username}</span>
            {isDraft && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Borrador
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-castor-black" asChild title="Editar cast">
          <Link href={`/dashboard/edit/${cast.id}`}>
            <Edit className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <p className="text-gray-900 mb-4 whitespace-pre-wrap text-sm leading-relaxed">
        {cast.content || <span className="text-gray-400 italic">Sin contenido</span>}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {hasSchedule && !isDraft && (
            <>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>
                  {scheduledDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>
                  {scheduledDate.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </div>
            </>
          )}
          {isDraft && (
            <span className="text-amber-600 text-xs">
              Sin programar
            </span>
          )}
          {/* Mostrar quién programó el cast */}
          {cast.createdBy && (
            <div className="flex items-center gap-1.5 border-l pl-4">
              {cast.createdBy.pfpUrl ? (
                <img 
                  src={cast.createdBy.pfpUrl} 
                  alt={cast.createdBy.username}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span className="text-xs">
                por @{cast.createdBy.username}
              </span>
            </div>
          )}
        </div>

        {/* Link a Warpcast si está publicado */}
        {cast.status === 'published' && cast.castHash && (
          <Button variant="link" size="sm" className="h-auto p-0 text-castor-black hover:no-underline hover:text-castor-dark" asChild>
            <a
              href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              Ver en Warpcast
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        )}
      </div>
    </Card>
  )
}
