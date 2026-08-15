import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import { AlertTriangle, MessageCircle } from "lucide-react"

export const Route = createFileRoute('/')({
  head: () => ({
    title: 'BLOQUEADO - ESTA EXTENSIÓN FOI PIRATEADA',
    meta: [
      {
        name: 'description',
        content: 'La clave utilizada en esta extensión ha sido bloqueada por uso no autorizado.',
      },
    ],
  }),
  component: BlockedPage,
})

function BlockedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-8">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-red-500/10 text-red-500 animate-pulse">
            <AlertTriangle className="size-16" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight uppercase">
            ESTA EXTENSIÓN FOI PIRATEADA
          </h1>
          
          <div className="text-slate-300 text-lg leading-relaxed font-medium">
            "A clave utilizada nesta extensão foi bloqueada por uso não autorizado. 
            Fale com o contato oficial abaixo para adquirir a versão original. 
            FALAR COM O CONTATO OFICIAL (91) 98583-7992 ou no botão abaixo"
          </div>
        </div>

        <div className="pt-4">
          <Button 
            asChild 
            className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.4)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <a href="https://wa.me/91985837992" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-6" />
              CHAMAR NO WHATSAPP
            </a>
          </Button>
        </div>

        <div className="text-slate-500 text-xs uppercase tracking-widest pt-4">
          ID de Seguridad: ERR_LICENSE_PIRACY_DETECTED
        </div>
      </div>
    </div>
  )
}
