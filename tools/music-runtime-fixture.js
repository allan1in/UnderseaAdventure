window.prepareMusicFixture=async function(){
 const MusicDirector=(await System.import('/scripts/MusicDirector')).MusicDirector;
 const scene=cc.director.getScene(),root=new cc.Node('RealAudioChecks');root.active=false;scene.addChild(root);
 const hero=new cc.Node('MusicHero');root.addChild(hero);
 async function source(name,file,volume){
  const clip=await new Promise((resolve,reject)=>cc.assetManager.loadRemote(location.origin+'/assets/audio/'+file,{ext:'.mp3'},(error,asset)=>error?reject(error):resolve(asset)));
  const node=new cc.Node(name);root.addChild(node);const audio=node.addComponent(cc.AudioSource);
  audio.playOnAwake=false;audio.loop=true;audio.volume=volume;audio.clip=clip;return audio;
 }
 const normal=await source('Normal','music/bgm-undersea-game-loop.mp3',.3);
 const boss=await source('Boss','music/bgm-boss-battle.mp3',.3);
 const ambience=await source('Bubbles','ambience/amb-undersea-bubbles-loop.mp3',.15);
 const music=root.addComponent(MusicDirector);music.hero=hero;music.backgroundMusic=normal;music.bossMusic=boss;music.ambience=ambience;root.active=true;
 const button=document.createElement('button');button.id='music-gesture';button.textContent='Play music test';button.style.cssText='position:fixed;top:0;left:0;z-index:999';document.body.appendChild(button);
 button.onclick=()=>MusicDirector.startFromGesture(hero);
 window.musicFixture={normal,boss,ambience,MusicDirector,root};
 return {durations:[normal,boss,ambience].map(a=>a.duration),initial:[normal,boss,ambience].map(a=>a.playing)};
};
