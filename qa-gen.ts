import { downloadSimplifiedMatchPdf } from "@/lib/simplified-pdf";
// stub browser bits
(globalThis as any).window = globalThis;
(globalThis as any).navigator = { userAgent: "node" };
const blobs: any[] = [];
(globalThis as any).document = { createElement: () => ({ click(){}, style:{} }), body: { appendChild(){}, removeChild(){} } };
(globalThis as any).URL.createObjectURL = (b: Blob) => { blobs.push(b); return "blob:x"; };
(globalThis as any).URL.revokeObjectURL = () => {};

const mkPlayers = (n: number, pre: string) => Array.from({length:n},(_,i)=>({id:`${pre}${i}`,name:`Jugadora ${pre}${i}`,number:i+1,position:(["punta","central","opuesto","armador","libero","punta"] as any)[i%6]}));
const teamA:any = {id:"ta",name:"Club Universitario CUC",shortName:"CUC",color:"#f97316",players:mkPlayers(12,"a")};
const teamB:any = {id:"tb",name:"Banco Nación 28",shortName:"BN28",color:"#3b82f6",players:mkPlayers(12,"b")};
let t = Date.now();
const events:any[] = [];
const scores = [[25,23],[25,27],[23,25],[25,18],[15,11]];
const sets:any[] = [];
scores.forEach(([sa,sb], si)=>{
  const n = si+1;
  const seqA = Array.from({length:sa},()=> "A"), seqB = Array.from({length:sb},()=> "B");
  const all = [...seqA, ...seqB].sort(()=>Math.random()-0.5);
  const types = ["attack","block","ace","opponent_error","serve_error","attack_error","unforced_error"];
  all.forEach((side)=>{
    const type = types[Math.floor(Math.random()*types.length)] as any;
    const isErr = ["serve_error","attack_error","unforced_error"].includes(type);
    events.push({id:`p${t}`,setNumber:n,timestamp:t++,scoringSide:side,type,playerSide:isErr?(side==="A"?"B":"A"):side,playerId: isErr ? (side==="A"?"b1":"a1") : (side==="A"?"a2":"b2")});
  });
  // recepciones y ataques neutros
  for(let i=0;i<20;i++){
    events.push({id:`r${t}`,kind:"reception",side:i%2?"A":"B",playerId:i%2?"a3":"b3",rating:["double_positive","positive","neutral","negative","overpass"][i%5],setNumber:n,timestamp:t++});
    events.push({id:`aa${t}`,kind:"attackAttempt",side:i%2?"A":"B",playerId:i%2?"a4":"b4",setNumber:n,timestamp:t++});
  }
  sets.push({number:n,scoreA:sa,scoreB:sb,finished:true});
});
const match:any = {id:"m1",teamAId:"ta",teamBId:"tb",startingLineupA:[],startingLineupB:[],onCourtA:[],onCourtB:[],status:"finished",currentSet:5,setsToWin:3,pointsPerSet:25,sets,events,servingSide:"A",initialServingSide:"A",scheduledAt:Date.now(),createdAt:Date.now(),category:"Sub 18",venue:"Estadio Central",setStartTimes:{1:t-9_000_000,2:t-7_000_000,3:t-5_000_000,4:t-3_000_000,5:t-1_000_000}};

await downloadSimplifiedMatchPdf(match, teamA, teamB, {competition:"Superliga Femenina 2"});
const buf = Buffer.from(await blobs[0].arrayBuffer());
await Bun.write("/tmp/qa/out.pdf", buf);
console.log("ok", buf.length);
