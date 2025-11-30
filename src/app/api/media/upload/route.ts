import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm']
    const isImage = validImageTypes.includes(file.type)
    const isVideo = validVideoTypes.includes(file.type)

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Usa JPG, PNG, GIF, WebP, MP4, MOV o WebM.' },
        { status: 400 }
      )
    }

    // Validar tamaño
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024 // 100MB video, 10MB imagen
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Archivo demasiado grande. Máximo ${isVideo ? '100MB' : '10MB'}.` },
        { status: 400 }
      )
    }

    // Subir a Cloudinary
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    const cloudinaryFormData = new FormData()
    cloudinaryFormData.append('file', dataUri)
    cloudinaryFormData.append('upload_preset', 'castor_uploads')

    const resourceType = isVideo ? 'video' : 'image'
    const response = await fetch(`https://api.cloudinary.com/v1_1/dqzhacfga/${resourceType}/upload`, {
      method: 'POST',
      body: cloudinaryFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Media] Cloudinary upload error:', response.status, error)
      return NextResponse.json(
        { error: 'Error al subir archivo', details: error, status: response.status },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log('[Media] Upload response:', data)

    return NextResponse.json({
      success: true,
      url: data.secure_url,
      type: isVideo ? 'video' : 'image',
    })
  } catch (error) {
    console.error('[Media] Upload error:', error)
    return NextResponse.json(
      { error: 'Error al procesar archivo' },
      { status: 500 }
    )
  }
}
