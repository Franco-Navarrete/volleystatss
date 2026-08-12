
import { supabase } from "./src/integrations/supabase/client";

async function fixFile() {
  const fs = require('fs');
  const path = 'src/routes/_authenticated/matches.$id.index.tsx';
  let content = fs.readFileSync(path, 'utf8');
  const lines = content.split('\n');
  
  // The block starts at line 557 (0-indexed 556)
  // if (showNotFound) {
  //   return (
  //     <CompactShell> ...
  
  // Let's find the indices
  let startIdx = -1;
  let endIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (showNotFound) {') && lines[i+2]?.includes('<CompactShell>')) {
      startIdx = i;
      break;
    }
  }
  
  if (startIdx !== -1) {
    // Look for the end of this block which ends with ); and then } and then another if (!match || !teamA || !teamB)
    let depth = 0;
    for (let i = startIdx; i < lines.length; i++) {
        if (lines[i].includes('{')) depth++;
        if (lines[i].includes('}')) depth--;
        if (depth === 0 && i > startIdx) {
            endIdx = i;
            break;
        }
    }
  }

  console.log(`Found block from line ${startIdx + 1} to ${endIdx + 1}`);
  
  if (startIdx !== -1 && endIdx !== -1) {
    const blockContent = lines.slice(startIdx, endIdx + 1).join('\n');
    console.log("BLOCK CONTENT LENGTH:", blockContent.length);
    
    // We want to replace it with a single correct block.
    // The issue is likely that there's a fragment issue or missing wrapping inside the block.
    // But actually, the error "JSX expressions must have one parent element" usually means
    // something like:
    // return (
    //   <Element1 />
    //   <Element2 />
    // )
    // instead of <><Element1 /><Element2 /></>
    
    // Looking at the code from code--view:
    /*
    560:       <CompactShell>
    561:         <div className="text-center py-20 px-6">
    ...
    681:       </CompactShell>
    682:     );
    683:   }
    */
    // Wait, line 643 starts a <div> but is it inside the <CompactShell>?
    // 642: 
    // 643:             <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border/60 text-left space-y-3">
    
    // If line 641 closes the fragment from 584:
    // 584:               <>
    // ...
    // 640:               </>
    // 641:             )}
    // Then 643 is a sibling of the first <div> (561).
    // So 561-681 needs a Fragment.
  }
}

fixFile();
