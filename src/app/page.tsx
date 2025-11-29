import { Calendar, Users, Zap } from 'lucide-react'
import { SignInButton } from './SignInButton'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-farcaster-purple rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-lg">Caster</span>
          </div>
          <SignInButton />
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Programa tus casts
          <br />
          <span className="text-farcaster-purple">como un pro</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Gestiona múltiples cuentas de Farcaster, programa publicaciones y 
          mantén tu presencia activa sin esfuerzo.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Multi-cuenta"
            description="Gestiona cuentas personales y de empresa desde un solo lugar."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Programación"
            description="Programa casts individuales o threads completos para cualquier momento."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Publicación automática"
            description="Tus casts se publican automáticamente a la hora programada."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          Hecho para el estudio · {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border shadow-sm">
      <div className="w-12 h-12 bg-farcaster-purple/10 rounded-xl flex items-center justify-center text-farcaster-purple mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}
