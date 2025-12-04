import Link from 'next/link'
import { Clock, Calendar, User, ExternalLink, Edit, FileText, Trash2, Video, Image, ChevronLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AutoRefresh } from '@/components/AutoRefresh'
import { cn } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CastCreator {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface CastMedia {
  id: string
  url: string
  type: string
  thumbnailUrl: string | null
}

interface Cast {
  id: string
  content: string
  scheduledAt: Date
  status: string
  castHash?: string | null
  channelId?: string | null
  account: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  } | null
  createdBy?: CastCreator | null
  media?: CastMedia[]
}

export default async function ScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string }>
}) {
  // Solo admins pueden ver esta página
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    redirect('/dashboard')
  }

  const { status: filterStatus, tab } = await searchParams
  
  const casts = await db.query.scheduledCasts.findMany({
    with: {
      account: true,
      media: true,
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
      
      {/* Botón volver */}
      <Link 
        href="/dashboard" 
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-gray-900">
            {filtered ? filtered.title : 'Todos los casts'}
          </h1>
          <p className="text-gray-500 mt-1">
            {filtered ? (
              <>
                {filtered.casts.length} cast{filtered.casts.length !== 1 ? 's' : ''}
                {(filterStatus || tab) && (
                  <Link href="/dashboard/scheduled" className="ml-2 text-gray-900 hover:underline">
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
  const media = cast.media || []
  
  const statusStyles: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
    publishing: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    published: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    draft: 'bg-amber-50 text-amber-700 border-amber-100',
  }

  const statusLabels: Record<string, string> = {
    scheduled: 'Programado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Fallido',
    draft: 'Borrador',
  }
  
  return (
    <Card className={cn(
      "overflow-hidden transition-all group",
      isDraft && "border-amber-200 bg-amber-50/30"
    )}>
      {/* Vista colapsada */}
      <div className="w-full p-3 flex items-center gap-3">
        {cast.account.pfpUrl ? (
          <img
            src={cast.account.pfpUrl}
            alt={cast.account.username}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">
            {cast.content || <span className="text-gray-400 italic">Sin contenido</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>@{cast.account.username}</span>
            {!isDraft && (
              <>
                <span>·</span>
                <span>
                  {scheduledDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'Europe/Madrid',
                  })}
                  {' '}
                  {scheduledDate.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </>
            )}
            {cast.channelId && (
              <>
                <span>·</span>
                <span className="text-purple-600">#{cast.channelId}</span>
              </>
            )}
            {media.length > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  {media.some(m => m.type === 'video') ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <Image className="w-3 h-3" />
                  )}
                  {media.length}
                </span>
              </>
            )}
            {cast.createdBy && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  {cast.createdBy.pfpUrl ? (
                    <img 
                      src={cast.createdBy.pfpUrl} 
                      alt=""
                      className="w-3 h-3 rounded-full"
                    />
                  ) : null}
                  por @{cast.createdBy.username}
                </span>
              </>
            )}
          </div>
        </div>

        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0",
          statusStyles[cast.status] || 'bg-gray-50 text-gray-600 border-gray-100'
        )}>
          {statusLabels[cast.status] || cast.status}
        </span>

        {/* Link a Warpcast */}
        {cast.status === 'published' && cast.castHash && (
          <a
            href={`https://warpcast.com/${cast.account.username}/${cast.castHash.slice(0, 10)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-400 hover:text-gray-900 p-1"
            title="Ver en Warpcast"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {/* Acciones en hover - redirige al dashboard para editar */}
        {cast.status !== 'published' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              asChild
              title="Editar (ir al dashboard)"
            >
              <Link href={`/dashboard?edit=${cast.id}`}>
                <Edit className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
