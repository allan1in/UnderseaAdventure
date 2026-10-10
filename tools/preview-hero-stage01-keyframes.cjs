// Preview only: reuse approved cutout textures, without changing runtime assets.
const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const project=path.resolve(__dirname,'..'),theme=path.join(project,'../主题素材/海底冒险');
const source=path.join(theme,'textures/characters/hero/animations/stage-01/skeleton-rig');
const out=path.join(theme,'previews/hero-stage01-keyframes-v3');fs.mkdirSync(out,{recursive:true});
const rig=JSON.parse(fs.readFileSync(path.join(source,'hero-stage-01.json'),'utf8'));
const bones=Object.fromEntries(rig.bones.map(b=>[b.name,b])),attachments=rig.skins[0].attachments;
function bone(name,settings){Object.assign(bones[name],settings)}
function part(name,settings){Object.assign(attachments[name][name],settings)}
bone('body',{rotation:-22});bone('head',{x:13,y:20,rotation:22});bone('backpack',{x:-25,y:-5,rotation:0});
part('head',{width:120,height:114,x:0,y:39});part('torso',{width:55,height:61,x:0,y:-5});part('backpack',{width:40,height:62});
for(const side of ['near','far']){
 const n=side==='near';
 bone(side+'-upper-arm',{x:n?-17:13,y:n?5:6,rotation:n?-10:-8,length:18});
 bone(side+'-forearm',{x:18,y:0,rotation:n?35:38,length:15});
 bone(side+'-hand',{x:15,y:0,rotation:n?-3:-8});
 part(side+'-upper-arm',{width:n?30:27,height:n?23:20,x:9,y:0});
 part(side+'-forearm',{width:n?25:22,height:n?18:16,x:8,y:0});
 part(side+'-hand',{width:n?25:22,height:n?20:18,x:9,y:0});
 bone(side+'-thigh',{x:n?-10:1,y:n?-23:-26,rotation:n?-100:-110,length:16});
 bone(side+'-shin',{x:16,y:0,rotation:n?-35:-30,length:13});
 bone(side+'-boot',{x:13,y:0,rotation:90});
 part(side+'-thigh',{width:n?21:18,height:n?27:24,x:8,y:0,rotation:90});
 part(side+'-shin',{width:n?17:15,height:n?23:21,x:7,y:0,rotation:90});
 part(side+'-boot',{width:n?27:24,height:n?18:16,x:3,y:-6,rotation:0});
}
const poses=[
 {action:'Idle',title:'待机',time:0,rot:{}},
 {action:'Idle',title:'吸气上浮',time:.6,rot:{body:1,head:-1,'near-forearm':2,'near-thigh':2},rootY:1.2},
 {action:'Idle',title:'轻摆',time:1.2,rot:{body:0,head:0,'near-forearm':0,'near-thigh':0}},
 {action:'Idle',title:'呼气回落',time:1.8,rot:{body:-1,head:1,'far-forearm':2,'far-thigh':2},rootY:-1.2},
 {action:'Idle',title:'回到中心',time:2.1,rot:{body:-.5,head:.5}},
 {action:'Idle',title:'循环衔接',time:2.4,rot:{}},
 {action:'Move',title:'收腿准备',time:0,rot:{'near-thigh':8,'near-shin':-10,'far-thigh':-8,'far-shin':8,'near-upper-arm':-4,'near-forearm':5}},
 {action:'Move',title:'开始划水',time:.2,rot:{body:2,head:-2,'near-thigh':0,'near-shin':0,'far-thigh':0,'far-shin':0,'near-upper-arm':2,'near-forearm':-4},rootY:1},
 {action:'Move',title:'蹬腿推进',time:.4,rot:{body:3,head:-3,'near-thigh':-15,'near-shin':8,'far-thigh':12,'far-shin':-10,'near-upper-arm':6,'near-forearm':-8},rootY:2},
 {action:'Move',title:'换腿回收',time:.6,rot:{body:0,head:0,'near-thigh':-8,'near-shin':6,'far-thigh':8,'far-shin':-8}},
 {action:'Move',title:'反侧推进',time:.8,rot:{body:-2,head:2,'near-thigh':12,'near-shin':-12,'far-thigh':-15,'far-shin':8,'far-upper-arm':6,'far-forearm':-8},rootY:-1},
 {action:'Move',title:'回到起势',time:1.2,rot:{'near-thigh':8,'near-shin':-10,'far-thigh':-8,'far-shin':8,'near-upper-arm':-4,'near-forearm':5}},
 {action:'Attack',title:'起手',time:0,rot:{}},
 {action:'Attack',title:'蓄力收拳',time:.08,rot:{body:-3,head:3,'near-upper-arm':-8,'near-forearm':25,'near-hand':-17,'far-forearm':10}},
 {action:'Attack',title:'出拳',time:.15,rot:{body:-1,head:1,'near-upper-arm':18,'near-forearm':-25,'near-hand':7}},
 {action:'Attack',title:'命中',time:.205,rot:{body:4,head:-4,'near-upper-arm':28,'near-forearm':-25,'near-hand':-3,'near-thigh':-4,'far-forearm':10},rootX:2},
 {action:'Attack',title:'收拳缓冲',time:.32,rot:{body:2,head:-2,'near-upper-arm':14,'near-forearm':-20,'near-hand':6}},
 {action:'Attack',title:'恢复游泳',time:.48,rot:{}}
];
function world(pose){const result={};for(const b of rig.bones){const p=result[b.parent]||{x:0,y:0,a:0},r=p.a*Math.PI/180;const x=(b.x||0)+(b.name==='root'?(pose.rootX||0):0),y=(b.y||0)+(b.name==='root'?(pose.rootY||0):0);result[b.name]={x:p.x+x*Math.cos(r)-y*Math.sin(r),y:p.y+x*Math.sin(r)+y*Math.cos(r),a:p.a+(b.rotation||0)+(pose.rot[b.name]||0)}}return result}
(async()=>{const art={};for(const s of rig.slots)art[s.name]=await loadImage(path.join(source,s.name+'.png'));
 const sheet=createCanvas(2160,1110),ctx=sheet.getContext('2d');ctx.fillStyle='#e7f2f6';ctx.fillRect(0,0,sheet.width,sheet.height);
 const reference=await loadImage(path.join(theme,'textures/characters/hero/animations/stage-01/swim/swim-01.png'));
 const comparison=createCanvas(1000,470),cx=comparison.getContext('2d');cx.fillStyle='#e7f2f6';cx.fillRect(0,0,1000,470);
 function render(context,pose,x,y,scale){const w=world(pose);context.save();context.translate(x,y);context.scale(scale,-scale);for(const s of rig.slots){const b=w[s.bone],a=attachments[s.name][s.attachment];context.save();context.translate(b.x,b.y);context.rotate(b.a*Math.PI/180);context.translate(a.x||0,a.y||0);context.rotate((a.rotation||0)*Math.PI/180);context.scale(1,-1);context.drawImage(art[s.name],-a.width/2,-a.height/2,a.width,a.height);context.restore()}context.restore()}
 for(let i=0;i<poses.length;i++){const p=poses[i],col=i%6,row=Math.floor(i/6),x=col*360,y=row*370;
  ctx.fillStyle='#fff';ctx.fillRect(x+8,y+8,344,354);ctx.fillStyle='#174657';ctx.font='bold 20px sans-serif';ctx.fillText(`${p.action} ${String(i%6+1).padStart(2,'0')} · ${p.time}s`,x+20,y+38);ctx.font='18px sans-serif';ctx.fillText(p.title,x+20,y+65);
  render(ctx,p,x+164,y+254,1.55);
  const image=createCanvas(384,384),ic=image.getContext('2d');render(ic,p,168,263,1.65);fs.writeFileSync(path.join(out,`${p.action.toLowerCase()}-${String(i%6+1).padStart(2,'0')}.png`),image.toBuffer('image/png'));
 }
 cx.fillStyle='#174657';cx.font='24px sans-serif';cx.fillText('原游泳帧 / Original',50,40);cx.fillText('调整后的部件拼接 / Cutout v3',510,40);cx.drawImage(reference,10,65,440,440);render(cx,poses[0],690,325,1.48);
 fs.writeFileSync(path.join(out,'keyframes-sheet.png'),sheet.toBuffer('image/png'));fs.writeFileSync(path.join(out,'proportion-comparison.png'),comparison.toBuffer('image/png'));
 fs.writeFileSync(path.join(out,'poses.json'),JSON.stringify({previewOnly:true,sourceParts:source,rig,poses},null,2));
 console.log(JSON.stringify({output:out,keyframes:poses.length,previewOnly:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
