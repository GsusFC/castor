// Sistema unificado de embeds para Castor
// Uso:
// - EmbedPreview: Para Composer (con opción de eliminar)
// - EmbedDisplay: Para Feed (solo lectura)

export { EmbedPreview } from './EmbedPreview'
export { EmbedDisplay } from './EmbedDisplay'

// Re-export renderers individuales por si se necesitan
export * from './renderers'

// Re-export tipos
export type { 
  EmbedData, 
  EmbedType, 
  EmbedCast, 
  EmbedAuthor, 
  EmbedMetadata,
  BaseRendererProps,
  RemovableProps,
} from './types'
