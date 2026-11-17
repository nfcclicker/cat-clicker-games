// Model: 30 seconds, 98% fish capture and 10% boot capture, no clock/magnet/guard or hidden fish.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const r=path.resolve(__dirname,"..");
const c=vm.createContext({Path2D:class{},console});
for(const f of ["stages.js","fish-data.js","aquarium-data.js","power-ups.js"]) vm.runInContext(fs.readFileSync(path.join(r,"game/white-basket",f),"utf8"),c);
vm.runInContext(`
let seed=20261118;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(const stage of seaStages.slice(1)){
 const scores=[];
 for(let trial=0;trial<20000;trial++){
  let score=0,combo=0;
  const powers=newPowers();
  for(let elapsed=200;elapsed<28500;elapsed+=1040-elapsed/30000*375+random()*120){
   const roll=random();
   const type=elapsed<3600?"fish":roll<.14?"boot":roll<.28?"gold":"fish";
   if(type==="boot"){if(random()<.1){score-=20;combo=0;}continue;}
   const rare=type==="fish"?rollRareFish(random,stage.id):null;
   if(random()>=.98){combo=0;continue;}
   combo++;
   tryFever(powers,combo,elapsed);
   score+=(rare?.points??(type==="gold"?50:10))*(elapsed<powers.feverEnd?2:1);
  }
  scores.push(score);
 }
 scores.sort((a,b)=>a-b);
 console.log(stage.id,JSON.stringify({target:aquariumTargets[stage.id],median:scores[10000],p90:scores[18000],clearRate:scores.filter(s=>s>=aquariumTargets[stage.id]).length/20000}));
}
`,c);