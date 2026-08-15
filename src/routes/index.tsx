import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import { AlertTriangle, MessageCircle } from "lucide-react"

export const Route = createFileRoute('/')({
  head: () => ({
    title: 'BLOQUEADO - ESTA EXTENSÃO FOI PIRATEADA',
    meta: [
      {
        name: 'description',
        content: 'A chave utilizada nesta extensão foi bloqueada por uso não autorizado.',
      },
    ],
  }),
  component: PiracyNotice,
})

function PiracyNotice() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="max-w-2xl w-full bg-slate-900/50 border border-red-500/30 rounded-3xl p-8 md:p-12 backdrop-blur-xl shadow-2xl text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-red-500/10 p-5 rounded-full ring-8 ring-red-500/5 animate-pulse">
            <AlertTriangle className="size-16 text-red-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-red-500 uppercase italic">
            ESTA EXTENSÃO FOI PIRATEADA
          </h1>
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-medium">
            A chave utilizada nesta extensão foi bloqueada por uso não autorizado. 
            Fale com o contato oficial abaixo para adquirir a versão original.
          </p>
          
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 inline-block w-full">
            <p className="text-slate-400 text-sm uppercase tracking-widest mb-2 font-bold">Contato Oficial</p>
            <p className="text-2xl md:text-3xl font-mono font-bold text-white selection:bg-red-500 selection:text-white">
              (91) 98583-7992
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <Button 
            asChild
            size="lg" 
            className="bg-green-600 hover:bg-green-500 text-white rounded-full px-10 h-16 text-xl font-black shadow-lg shadow-green-600/20 hover:scale-105 transition-all w-full md:w-auto uppercase tracking-tighter"
          >
            <a href="https://wa.me/91985837992" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-3 size-6 fill-current" />
              CHAMAR NO WHATSAPP
            </a>
          </Button>
          
          <p className="text-slate-500 text-xs italic">
            FALAR COM O CONTATO OFICIAL (91) 98583-7992 ou no botão acima
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">
        Security System v4.2.0 · Anti-Tamper Enabled
      </div>
    </div>
  )
}
