import { Link } from '@tanstack/react-router'
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Target, 
  Wallet,
  Menu
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"

export function MobileNav() {
  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
      <h1 className="text-xl font-black tracking-tighter text-primary">RALLY</h1>
      
      <div className="flex items-center gap-2">
         <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-card border-r-0">
             <Sidebar className="w-full h-full border-r-0" />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
