import { useState } from "react";
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Package, 
  MoreVertical,
  Plus,
  Search,
  Maximize2,
  Trash2,
  Edit,
  Copy,
  ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrgType = 'federacion' | 'asociacion' | 'liga' | 'club' | 'categoria' | 'equipo';

interface OrganizationNode {
  id: string;
  name: string;
  type: OrgType;
  children?: OrganizationNode[];
  status: 'active' | 'inactive';
  plan?: string;
  userCount?: number;
}

export function OrganizationTree({ data, onSelect }: { data: OrganizationNode[], onSelect: (node: OrganizationNode) => void }) {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar organización..." 
            className="pl-9 h-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <ChevronUp className="size-4 mr-2" /> Contraer todo
        </Button>
      </div>

      <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
        <div className="divide-y divide-border/40">
          {data.map((node) => (
            <HierarchyRow key={node.id} node={node} level={0} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HierarchyRow({ node, level, onSelect }: { node: OrganizationNode, level: number, onSelect: (node: OrganizationNode) => void }) {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;

  const typeLabels: Record<OrgType, string> = {
    federacion: 'Federación',
    asociacion: 'Asociación',
    liga: 'Liga',
    club: 'Club',
    categoria: 'Categoría',
    equipo: 'Equipo'
  };

  const typeColors: Record<OrgType, string> = {
    federacion: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900',
    asociacion: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900',
    liga: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900',
    club: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-900',
    categoria: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-900',
    equipo: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900'
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
      <div 
        className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
        style={{ paddingLeft: `${(level * 24) + 16}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={`size-6 flex items-center justify-center rounded hover:bg-muted/50 transition-colors ${!hasChildren && 'invisible'}`}
        >
          {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
        </button>

        <div className={`size-8 rounded-lg ${typeColors[node.type] || 'bg-muted'} flex items-center justify-center shrink-0 border shadow-sm`}>
          <Building2 className="size-4" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm truncate group-hover:text-primary transition-colors">{node.name}</span>
            <Badge variant="outline" className={`text-[9px] uppercase font-black px-1.5 py-0 h-4 border-transparent ${typeColors[node.type]}`}>
              {typeLabels[node.type]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
            {node.userCount !== undefined && <span className="flex items-center gap-1"><Users className="size-3" /> {node.userCount}</span>}
            {node.plan && (
              <>
                <span className="opacity-40">•</span>
                <span className="flex items-center gap-1 font-medium">{node.plan}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7 h-7" title="Expandir">
            <Maximize2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 h-7" title="Nuevo hijo">
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="border-l border-border/40 ml-7">
          {node.children!.map((child) => (
            <HierarchyRow key={child.id} childNode={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
