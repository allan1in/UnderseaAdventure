/* Native Cocos state/clip fixture; the canvas displays the PNG chosen by Cocos. */
window.runAnimationFixture = async function () {
    const cc = window.cc;
    const manifest = await (await fetch('/manifest.json')).json();
    const report = await (await fetch('/temp/animation-fix/alignment-report.json')).json();
    const frames = new Map(), clips = new Map(), images = new Map(), textures = new Map();
    const checks = [];
    function assert(value, message) { if (!value) throw Error(message); checks.push(message); }
    function frame(uuid) {
        if (!frames.has(uuid)) {
            const info = manifest[uuid];
            if (!info) return null;
            const key = info.width + 'x' + info.height;
            if (!textures.has(key)) {
                const texture = new cc.Texture2D(); texture.reset({width:info.width,height:info.height}); textures.set(key,texture);
            }
            const f = new cc.SpriteFrame();
            f.reset({ texture: textures.get(key), rect: new cc.Rect(0, 0, info.width, info.height), originalSize: new cc.Size(info.width, info.height) });
            f.name = uuid;
            frames.set(uuid, f);
        }
        return frames.get(uuid);
    }
    async function loadClip(file) {
        if (clips.has(file)) return clips.get(file);
        const raw = await (await fetch('/' + file)).json();
        const details = new cc.deserialize.Details();
        const clip = cc.deserialize(raw, details);
        details.uuidList.forEach((uuid, i) => { details.uuidObjList[i][details.uuidPropList[i]] = frame(uuid); });
        clips.set(file, clip);
        return clip;
    }
    const sheet = document.createElement('canvas'); sheet.width = 1800; sheet.height = 2100;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#193543'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    const previews = [];
    for (let g = 0; g < report.length; g++) {
        const group = report[g];
        const nodes = [], states = [];
        for (let action = 0; action < 3; action++) {
            const clip = await loadClip(group.clips[action].path);
            const node = new cc.Node('Preview-' + group.name);
            node.addComponent(cc.UITransform);
            const sprite = node.addComponent(cc.Sprite); sprite.sizeMode = cc.Sprite.SizeMode.RAW; sprite.trim = false;
            const state = new cc.AnimationState(clip); state.initialize(node);
            nodes.push(node); states.push(state);
            assert(Math.abs(clip.duration - group.clips[action].duration) < 1e-6, group.name + ' ' + clip.name + ' duration');
            const raw = await (await fetch('/' + group.clips[action].path)).json();
            // Every native frame sample must apply its stored body correction and sprite reference.
            for (let key = 0; key < raw[5]._times.length; key++) {
                state.time = raw[5]._times[key] + .00001; state.sample();
                const poseIndex = key < 24 ? key : 46 - key;
                const pose = group.poses[['idle', 'move', 'attack'][action]][poseIndex];
                if (Math.abs(node.scale.x - pose.scale[0]) > 1e-5 || Math.abs(node.position.x - pose.position[0]) > 1e-5) throw Error(group.name + ' native transform mismatch at ' + key);
                if (sprite.spriteFrame?.name !== raw[5]._values[key].__uuid__) throw Error(group.name + ' wrong native frame at ' + key);
            }
            checks.push(group.name + ' ' + clip.name + ' all native frame/transform samples');
            for (const key of [0, 11, 23]) {
                state.time = key / clip.sample + .00001; state.sample();
                const uuid = sprite.spriteFrame.name;
                if (!images.has(uuid)) {
                    const image = new Image(); image.src = manifest[uuid].path; await image.decode(); images.set(uuid, image);
                }
                const x = (action * 3 + [0, 11, 23].indexOf(key)) * 200 + 100;
                const y = g * 210 + 130;
                const image = images.get(uuid), s = node.scale.x;
                const displayFactor = group.name === 'Octopus' ? .42 : group.name.startsWith('Hero') ? .85 : 1;
                ctx.save(); ctx.translate(x, y); ctx.scale(displayFactor, displayFactor);
                ctx.drawImage(image, node.position.x - image.width*s/2, -node.position.y - image.height*s/2, image.width*s, image.height*s);
                ctx.restore(); ctx.fillStyle = 'white'; ctx.font = '12px sans-serif';
                ctx.fillText(group.name + ' ' + ['idle','move','attack'][action] + ' ' + (key+1), x - 92, g*210+16);
            }
        }
        previews.push({ group, nodes, states });
    }
    window.nativeSheet = sheet.toDataURL('image/png');
    window.animationPreview = { manifest, frames, clips, images, report, previews, getFrame:frame };
    return { checks, clipCount: clips.size, groupCount: report.length };
};

window.runActorFixture = async function () {
    const cc = window.cc, preview = window.animationPreview;
    const { assetIndex, scriptIds } = await (await fetch('/asset-index.json')).json();
    const modules = {};
    for (const name of ['MusicDirector','BossAttackEffects','BossRangedAttack','PetHitEffect','CircleBody2D','HeroController','HeroHealth','HeroVisual','CharacterAnimation','PetFollower','PetAttack','EnemyController','EnemySpawner','BossController','BossBattleSystem','BossVisual','SpriteTransition','AdPresentation','PetSelection','JoystickController']) {
        const m = await System.import('/scripts/' + name);
        cc.js._setClassId(scriptIds[name], m[name]); modules[name] = m[name];
    }
    async function loadPrefab(name) {
        const raw = await (await fetch('/assets/prefabs/' + name + '.prefab')).json();
        const details = new cc.deserialize.Details();
        const prefab = cc.deserialize(raw, details);
        for (let i = 0; i < details.uuidList.length; i++) {
            const uuid = details.uuidList[i], file = assetIndex[uuid];
            let value = preview.getFrame(uuid) || null;
            if (!value && file?.endsWith('.anim')) {
                const relative = file.slice(1);
                value = preview.clips.get(relative);
                if (!value) {
                    const d = new cc.deserialize.Details(); value = cc.deserialize(await (await fetch(file)).json(), d);
                    d.uuidList.forEach((id,k) => { d.uuidObjList[k][d.uuidPropList[k]] = preview.frames.get(id) || null; });
                }
            }
            details.uuidObjList[i][details.uuidPropList[i]] = value;
        }
        return cc.instantiate(prefab);
    }
    const checks = [];
    function assert(ok, name) { if (!ok) throw Error(name); checks.push(name); }
    const scene = new cc.Scene('AnimationChecks');
    cc.director.runSceneImmediate(scene);
    const world = new cc.Node('World'); scene.addChild(world);
    const heroNode = new cc.Node('Hero'); heroNode.active = false; world.addChild(heroNode);
    heroNode.addComponent(cc.UITransform);
    const visual = new cc.Node('Visual'); heroNode.addChild(visual); visual.addComponent(cc.UITransform);
    const picture = new cc.Node('Sprite'); visual.addChild(picture); picture.addComponent(cc.UITransform);
    const sprite = picture.addComponent(cc.Sprite); sprite.sizeMode = cc.Sprite.SizeMode.RAW;
    const animation = picture.addComponent(cc.Animation);
    const health = heroNode.addComponent(modules.HeroHealth); health.showHealthBar = false;
    const heroVisual = heroNode.addComponent(modules.HeroVisual);
    const hero = heroNode.addComponent(modules.HeroController); hero.world = world;
    const enemy = await loadPrefab('Enemy'); enemy.active = false; world.addChild(enemy); enemy.setPosition(110,0);
    const enemyController = enemy.getComponent(modules.EnemyController); enemyController.maxHealth = 10000; enemyController.target = heroNode;
    heroNode.active = true; enemy.active = true;
    const manager = cc.director.getSystem('animation');
    function tick(controller, dt) {
        manager.update(dt);
        controller.update(dt);
        for (const node of [picture, enemy.getChildByName('Visual')?.getChildByName('Sprite')]) node?.getComponent(modules.SpriteTransition)?.update(dt);
    }
    const forms = await (await fetch('/assets/resources/gameplay/hero/forms.json')).json();
    const sceneData = await (await fetch('/assets/scenes/Main.scene')).json();
    const effectSettings=sceneData.find(o=>o.themeSlashFrames);
    for (let stage = 0; stage < 4; stage++) {
        const group = preview.report[stage];
        const [idle, move, attack] = group.clips.map(c => preview.clips.get(c.path));
        animation.stop(); heroNode.setPosition(0,0); enemy.setPosition(110,0);
        heroVisual.configureFrame(forms.forms[stage].themeVisual.animation.offsets, forms.forms[stage].themeVisual.animation.scale, true);
        animation.clips = [idle,move,attack]; animation.defaultClip = idle;
        const form = forms.forms[stage];
        hero.applyEvolution(idle,move,attack,{...form.attack, damage:1, bodyWidth:form.bodyWidth,bodyHeight:form.bodyHeight,slash:form.slash.transform}, null);
        hero.themeSlashFrame=preview.getFrame(effectSettings.themeSlashFrames[stage].__uuid__);
        const box=effectSettings.themeSlashBounds[stage];hero.themeSlashBounds=new cc.Vec4(box.x,box.y,box.z,box.w);
        hero.update(0);
        assert(hero.attacking, 'Hero' + (stage+1) + ' starts attack');
        const before = heroNode.position.clone(), startHealth = enemyController.currentHealth;
        for (let i = 0; i < 20; i++) { hero.move(0,1,.1); tick(hero,1/60); }
        assert(heroNode.position.y > before.y, 'Hero' + (stage+1) + ' permits movement during attack');
        assert(hero.attacking && hero.currentClip === attack && animation.getState(attack.name).isPlaying,
            'Hero' + (stage+1) + ' moving does not interrupt or restart attack');
        const slash=hero.slashNode,slashUI=slash.getComponent(cc.UITransform);
        assert(slash.getComponent(cc.Sprite).spriteFrame===hero.themeSlashFrame && slash.getComponent(cc.UIOpacity).opacity>0,
            'Hero'+(stage+1)+' displays its new ocean slash during the strike');
        assert(Math.abs(slash.position.y-heroNode.position.y-hero.attackOffsetY)<.001,
            'Hero'+(stage+1)+' ocean slash follows movement');
        assert(Math.abs(slashUI.width*box.z/hero.themeSlashFrame.originalSize.width-hero.attackRange*hero.themeSlashScale)<.001,
            'Hero'+(stage+1)+' ocean slash uses the configured visual enlargement');
        for (let i = 0; i < 12; i++) tick(hero,1/60);
        assert(!hero.attacking, 'Hero' + (stage+1) + ' finishes attack within 0.54 s');
        assert(!slash.active,'Hero'+(stage+1)+' ocean slash disappears after recovery');
        assert(enemyController.currentHealth === startHealth-1, 'Hero' + (stage+1) + ' one damage hit per attack');
        hero.move(1,0,5);
        assert(heroNode.position.x > before.x, 'Hero' + (stage+1) + ' resumes held movement');
        hero.onDisable(); hero.stopMoving();
    }
    for (const [prefabName,groupName] of [['PetBlueDragon','Shark'],['PetFox','Turtle'],['PetRedDragon','Seahorse'],['PetWhiteTiger','Jellyfish']]) {
        const node = await loadPrefab(prefabName); node.active = false; world.addChild(node); node.setPosition(-300,0);
        const follower = node.getComponent(modules.PetFollower); follower.target=heroNode;
        node.active = true;
        const animator = node.getComponent(modules.CharacterAnimation); animator.start(); animator.show('attack',true);
        const before = node.position.clone();
        for(let i=0;i<30;i++){follower.update(1/60);manager.update(1/60);animator.update(1/60);}
        assert(node.position.equals(before), groupName + ' movement locked during attack');
        for(let i=0;i<8;i++){manager.update(1/60);animator.update(1/60);}
        follower.update(.12);
        assert(!animator.isAttacking && !node.position.equals(before), groupName + ' resumes following after 0.6 s');
        node.active=false;
    }
    heroNode.setPosition(0,0); enemy.setPosition(75,0);
    enemyController.attackCooldown=0; enemyController.update(0);
    assert(enemyController.attacking, 'Crab starts attack using child Sprite animation');
    const crabPosition=enemy.position.clone();
    for(let i=0;i<30;i++)tick(enemyController,1/60);
    assert(enemy.position.equals(crabPosition),'Crab cannot move during attack');
    for(let i=0;i<10;i++)tick(enemyController,1/60);
    assert(!enemyController.attacking,'Crab attack finishes within 0.67 s');
    enemyController.takeDamage(10000);
    for(let i=0;i<22;i++)tick(enemyController,1/60);
    assert(enemyController.isReadyToRemove,'Crab death completes with normalized child animation');
    const boss=await loadPrefab('Boss');boss.active=false;world.addChild(boss);boss.setPosition(120,0);
    const bossController=boss.getComponent(modules.BossController);bossController.target=heroNode;boss.active=true;
    bossController.update(0);
    assert(bossController.attacking,'Boss starts attack');
    assert(!boss.getChildByName('AttackTelegraph'),'Boss has no attack telegraph');
    assert(!boss.getComponent(modules.BossAttackEffects),'Boss prefab no longer has attack effects');
    assert(!boss.children.some(n=>/^Attack(?:Sweep\d*|Hit|Telegraph)$/.test(n.name)), 'Boss starts attack without overlay effects');
    assert(!boss.getChildByName('Visual').children.some(n => n.name === 'ActionTransition' && n.active),
        'Boss attack transition has no duplicate body Sprite');
    const bossPosition=boss.position.clone();
    for(let i=0;i<40;i++)tick(bossController,1/60);
    assert(boss.position.equals(bossPosition),'Boss cannot move during attack');
    for(let i=0;i<8;i++)tick(bossController,1/60);
    assert(!bossController.attacking,'Boss attack finishes within 0.8 s');
    assert(!boss.children.some(n=>/^Attack(?:Sweep\d*|Hit|Telegraph)$/.test(n.name)), 'Boss recovery has no overlay effects');
    assert(!boss.getChildByName('Visual').children.some(n => n.name === 'ActionTransition' && n.active),
        'Boss recovery transition has no duplicate body Sprite');
    assert(!boss.getComponent(modules.CircleBody2D),'Boss still has no blocking body');
    assert(bossController.moveSpeed>enemyController.moveSpeed && bossController.moveSpeed<300,
        'Boss speed is between ordinary enemy and hero speeds');
    const speedStart=boss.position.clone();heroNode.setPosition(speedStart.x+1000,speedStart.y);
    bossController.update(.1);
    assert(Math.abs(boss.position.x-speedStart.x-20)<.001,'Boss moves at 200 units per second');
    const collisionWorld = new cc.Node('CollisionChecks'); scene.addChild(collisionWorld);
    const station = new cc.Node('Station'); collisionWorld.addChild(station);
    const obstacle = station.addComponent(modules.CircleBody2D);
    obstacle.radius=85; obstacle.verticalRadius=35; obstacle.offsetY=35;
    obstacle.collisionGroup=3;obstacle.collisionMask=3;
    const walker = new cc.Node('Walker');collisionWorld.addChild(walker);
    const body = walker.addComponent(modules.CircleBody2D);body.radius=10;
    assert(body.canOccupy(0,-15),'Ellipse leaves space below the visible base');
    assert(!body.canOccupy(0,35),'Ellipse blocks the center of the visible base');
    walker.setPosition(0,150);body.moveTo(0,-100);
    assert(Math.abs(walker.position.y-80)<.001,'Vertical sweep stops at ellipse top plus body radius');
    walker.setPosition(150,35);body.moveTo(-150,35);
    assert(Math.abs(walker.position.x-95)<.001,'Horizontal sweep stops at ellipse side plus body radius');
    assert(!body.canOccupy(0,35),'Spawn placement uses the shifted ellipse');
    const resultNode = new cc.Node('Settlement');resultNode.active=false;scene.addChild(resultNode);
    const presentation=resultNode.addComponent(modules.AdPresentation);
    const logo=new cc.Node('Logo');resultNode.addChild(logo);logo.addComponent(cc.UIOpacity).opacity=0;
    presentation.fadeViews=[logo];presentation.showResult(true);
    assert(logo.getComponent(cc.UIOpacity).opacity===255,'Victory settlement appears immediately');
    logo.getComponent(cc.UIOpacity).opacity=0;presentation.showResult(false);
    assert(logo.getComponent(cc.UIOpacity).opacity===255,'Defeat settlement appears immediately');
    const card = new cc.Node('Card');card.active=false;scene.addChild(card);
    const petPicture=new cc.Node('Pet');card.addChild(petPicture);petPicture.addComponent(cc.UITransform);petPicture.addComponent(cc.Sprite);
    const selection=card.addComponent(modules.PetSelection);
    selection.enabled=false;
    selection.petSystem={petPrefabs:[]};
    for(const name of ['PetRedDragon','PetFox','PetWhiteTiger','PetBlueDragon'])selection.petSystem.petPrefabs.push({data:await loadPrefab(name)});
    const cardUI=petPicture.getComponent(cc.UITransform);
    const cardSheet=document.createElement('canvas');cardSheet.width=880;cardSheet.height=330;
    const cardContext=cardSheet.getContext('2d');cardContext.fillStyle='#173c4c';cardContext.fillRect(0,0,880,330);
    const cardSettings=sceneData.find(o=>o.themeCardFrames);
    for(let i=0;i<4;i++){
        selection.configureCard(card,i);
        const frame=petPicture.getComponent(cc.Sprite).spriteFrame,image=preview.images.get(frame.name);
        assert(!!image,'Card '+(i+1)+' uses its imported pet frame');
        const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;
        const pc=probe.getContext('2d');pc.drawImage(image,0,0);const pixels=pc.getImageData(0,0,image.width,image.height).data;
        let left=image.width,top=image.height,right=0,bottom=0;
        for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>=128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
        const sx=cardUI.width/image.width,sy=cardUI.height/image.height;
        assert(Math.abs(Math.max((right-left)*sx,(bottom-top)*sy)-145)<.001,'Card '+(i+1)+' visible pet fills the common 145 px region');
        assert(Math.abs(sx-sy)<.00001,'Card '+(i+1)+' preserves the pet aspect ratio');
        assert(Math.abs(((left+right)/2-image.width*cardUI.anchorX)*sx)<.001&&Math.abs(((top+bottom)/2-image.height*(1-cardUI.anchorY))*sy)<.001,
            'Card '+(i+1)+' centers its actual visible pixels');
        const backdrop=new Image();backdrop.src=preview.manifest[cardSettings.themeCardFrames[i].__uuid__].path;await backdrop.decode();
        cardContext.drawImage(backdrop,i*220+15,15,190,275);
        cardContext.drawImage(image,i*220+110-cardUI.anchorX*cardUI.width,150-(1-cardUI.anchorY)*cardUI.height,cardUI.width,cardUI.height);
        cardContext.strokeStyle='#64e6d9';cardContext.strokeRect(i*220+110-72.5,150-72.5,145,145);
        cardContext.fillStyle='white';cardContext.font='16px sans-serif';cardContext.textAlign='center';cardContext.fillText(['海马','海龟','水母','鲨鱼'][i],i*220+110,315);
    }
    window.cardPreview=cardSheet.toDataURL('image/png');

    // Exercise the new strike boundaries with small hurt boxes, so large victim
    // art cannot hide a range regression. Include mirrored attacks and escapes.
    const strikes=new cc.Node('StrikeChecks');scene.addChild(strikes);
    heroNode.setParent(strikes);heroNode.setPosition(0,0);hero.enabled=false;
    const victim=await loadPrefab('Enemy');victim.active=false;strikes.addChild(victim);
    const victimController=victim.getComponent(modules.EnemyController);
    victimController.maxHealth=10000;victimController.hurtWidth=10;victimController.hurtHeight=10;victimController.hurtOffsetY=0;
    victim.active=true;
    for(let stage=0;stage<4;stage++) {
        const form=forms.forms[stage], shape=form.attack;
        const [idle,move,attack]=preview.report[stage].clips.map(c=>preview.clips.get(c.path));
        heroVisual.configureFrame(form.themeVisual.animation.offsets,form.themeVisual.animation.scale,true);
        hero.applyEvolution(idle,move,attack,{...shape,damage:1,bodyWidth:form.bodyWidth,bodyHeight:form.bodyHeight,slash:form.slash.transform},null);
        for(const facing of [1,-1]) {
            heroVisual.setFacing(facing);
            victim.setPosition(facing*(shape.x+shape.width/2-2),shape.y);
            assert(hero.getAttackTargets().includes(victimController),'Hero'+(stage+1)+' strike reaches weapon tip facing '+facing);
            victim.setPosition(facing*(shape.x+shape.width/2+10),shape.y);
            assert(!hero.getAttackTargets().includes(victimController),'Hero'+(stage+1)+' cannot hit beyond weapon tip facing '+facing);
        }
    }
    heroNode.setPosition(500,0);
    for(const prefabName of ['PetBlueDragon','PetFox','PetRedDragon','PetWhiteTiger']) {
        const pet=await loadPrefab(prefabName);pet.active=false;strikes.addChild(pet);pet.setPosition(0,0);
        const follower=pet.getComponent(modules.PetFollower);follower.target=heroNode;
        const attack=pet.getComponent(modules.PetAttack);attack.hitEffectPrefab=null;pet.active=true;
        assert(attack.attackWidth===350 && attack.attackHeight===350,prefabName+' retains remote area skill');
        for(const side of [1,-1]) {
            attack.onDisable();
            victim.setPosition(side*160,attack.attackOffsetY);
            const initial=victimController.currentHealth;attack.update(0);
            assert(victimController.currentHealth===initial-attack.damage,prefabName+' remote attack immediately hits side '+side);
            attack.update(.3);
            assert(victimController.currentHealth===initial-attack.damage,prefabName+' respects skill cooldown side '+side);
        }
        attack.onDisable();victim.setPosition(200,attack.attackOffsetY);
        const initial=victimController.currentHealth;attack.update(0);
        assert(victimController.currentHealth===initial,prefabName+' excludes targets outside remote area');
        pet.active=false;
    }
    for(const prefabName of ['PetBlueDragonHit','PetFoxHit','PetRedDragonHit','PetWhiteTigerHit']) {
        const effect=await loadPrefab(prefabName);effect.active=false;strikes.addChild(effect);effect.active=true;
        const playback=effect.getComponent(modules.PetHitEffect);
        assert(playback.themeFrames.length===24 && effect.active,prefabName+' starts its new 24 frame effect');
        assert(playback.picture.spriteFrame===playback.themeFrames[0],prefabName+' starts with the imported first frame');
        playback.update(1/24+.00001);
        assert(playback.picture.spriteFrame===playback.themeFrames[1],prefabName+' advances through imported frames');
        assert(playback.picture.getComponent(cc.UITransform).width===200,prefabName+' keeps stable effect display size');
        playback.update(1);
        assert(!effect.active,prefabName+' returns to pool after effect completion');
    }
    boss.setParent(strikes);boss.setPosition(0,0);bossController.cooldown=0;bossController.target=heroNode;
    health.hurtWidth=10;health.hurtHeight=10;health.hurtOffsetY=0;
    heroNode.setPosition(100,bossController.attackOffsetY);bossController.update(0);
    assert(bossController.attacking,'Boss starts within calibrated tentacle reach');
    const heroHealth=health.currentHealth;
    heroNode.setPosition(260,bossController.attackOffsetY);bossController.update(.31);
    assert(health.currentHealth===heroHealth,'Boss misses escaped target even inside the old enlarged lock range');
    const crab=await loadPrefab('Enemy');crab.active=false;strikes.addChild(crab);crab.setPosition(0,0);
    const crabController=crab.getComponent(modules.EnemyController);crabController.target=heroNode;crab.active=true;
    for(const facing of [1,-1]) {
        crab.setScale(facing,1,1);
        heroNode.setPosition(facing*(crabController.attackOffsetX+crabController.attackWidth/2-2),crabController.attackOffsetY);
        assert(crabController.isTargetInAttackArea(health),'Crab claw reaches its visible edge facing '+facing);
        heroNode.setPosition(facing*(crabController.attackOffsetX+crabController.attackWidth/2+10),crabController.attackOffsetY);
        assert(!crabController.isTargetInAttackArea(health),'Crab claw cannot hit beyond visible edge facing '+facing);
    }
    const remote=await loadPrefab('Boss');remote.active=false;strikes.addChild(remote);remote.setPosition(0,0);
    const remoteController=remote.getComponent(modules.BossController);remoteController.target=heroNode;remote.active=true;
    const ranged=remote.getComponent(modules.BossRangedAttack);
    health.upgrade(100,104);heroNode.setPosition(450,0);remoteController.update(0);
    assert(ranged.isRunning&&!remoteController.attacking,'Distant hero triggers the new remote attack instead of melee');
    const locked=ranged.root.position.clone();
    remoteController.update(.49);
    assert(health.currentHealth===100&&ranged.warning.node.active,'Remote attack warns for the full 0.5 seconds');
    heroNode.setPosition(600,0);remoteController.update(.01);
    assert(ranged.root.position.equals(locked),'Warning stays at the locked position when the hero moves');
    assert(health.currentHealth===100&&!ranged.warning.node.active&&ranged.clip.active,'Leaving the warning dodges the erupting tentacle');
    assert(ranged.tentacleFrames.length===16&&ranged.tentacleFrameOffsets.length===16,'Remote attack loads all 16 frames and base registrations from the native prefab');
    const seenFrames=new Set([ranged.tentacleSprite.spriteFrame]);
    const effectSize=ranged.tentacle.getComponent(cc.UITransform).contentSize.clone();
    for(let i=1;i<16;i++){
        remoteController.update(ranged.eruptionDuration/16);
        seenFrames.add(ranged.tentacleSprite.spriteFrame);
        const size=ranged.tentacle.getComponent(cc.UITransform).contentSize;
        assert(size.width===effectSize.width&&size.height===effectSize.height,'Remote frame '+(i+1)+' keeps the same sprite canvas size');
    }
    assert(seenFrames.size===16,'Remote attack plays all 16 distinct imported frames');
    remoteController.update(.05);assert(!ranged.isRunning&&!ranged.root.active,'Remote attack clears after the animation');
    heroNode.setPosition(450,0);remoteController.cooldown=0;remoteController.rangedCooldown=0;remoteController.update(0);
    remoteController.update(.25);cc.director.pause();remoteController.update(1);
    assert(health.currentHealth===100&&Math.abs(ranged.elapsed-.25)<.0001,'Pausing gameplay freezes the remote warning timer');
    cc.director.resume();remoteController.update(.25);
    assert(health.currentHealth===95,'Remote tentacle deals exactly 5 damage at 0.5 seconds');
    remoteController.update(.1);assert(health.currentHealth===95,'Remote animation cannot apply repeated damage');
    assert(!ranged.root.getComponent(modules.CircleBody2D),'Remote effect does not block characters');
    remoteController.takeDamage(10000);assert(!ranged.isRunning&&!ranged.root.active,'Boss death cancels its remote attack');
    const canvas=new cc.Node('HintCanvas');scene.addChild(canvas);
    const canvasUI=canvas.addComponent(cc.UITransform);canvasUI.setContentSize(1280,720);
    const stick=new cc.Node('Joystick');stick.active=false;canvas.addChild(stick);stick.addComponent(cc.UITransform);
    const base=new cc.Node('joystick-base');stick.addChild(base);base.addComponent(cc.UITransform).setContentSize(177,176.01757631822386);
    const knob=new cc.Node('joystick-knob');stick.addChild(knob);knob.addComponent(cc.UITransform).setContentSize(71,70.17521781219749);
    const joystick=stick.addComponent(modules.JoystickController);joystick.knob=knob;
    const originalLoad=cc.resources.load;
    // Hand pixels are checked in the real preview; isolate resource loading here.
    cc.resources.load=(path,type,callback)=>callback(null,preview.getFrame('f5501a43-3aad-48d8-aec6-2982aeff7789@f9941'));
    try{stick.active=true;}finally{cc.resources.load=originalLoad;}
    const hint=canvas.getChildByName('JoystickHint'),hintBase=hint.getChildByName('joystick-base'),hintKnob=hint.getChildByName('joystick-knob');
    assert(hint.active && hint.getChildByName('DragHand'),'Opening hint shows joystick and hand before first use');
    assert(hintBase.getComponent(cc.UITransform).width===base.getComponent(cc.UITransform).width&&hintBase.scale.equals(base.scale)
        &&hintKnob.getComponent(cc.UITransform).width===knob.getComponent(cc.UITransform).width&&hintKnob.scale.equals(knob.scale),
        'Hint uses the exact real joystick and knob sizes');
    assert(!hint.getChildByName('Caption'),'Opening joystick hint has no caption');
    for(const [w,h] of [[1280,720],[390,844],[844,390],[320,568]]){
        canvasUI.setContentSize(w,h);joystick.updateHint(0);
        assert(Math.abs(hint.position.x-w*.22)<.001&&Math.abs(hint.position.y+h*.18)<.001,
            'Hint follows viewport center toward bottom right '+w+'x'+h);
        assert(hint.position.x+88.5<w/2&&hint.position.y-90>-h/2,
            'Full joystick and hand fit within viewport '+w+'x'+h);
    }
    cc.director.pause();joystick.updateHint(0);assert(!hint.active,'Paused overlays hide unused joystick hint');
    cc.director.resume();joystick.updateHint(0);assert(hint.active,'Unused hint returns when gameplay resumes');
    const waitingWorld=new cc.Node('WaitingWorld');canvas.addChild(waitingWorld);
    heroNode.setParent(waitingWorld);heroNode.setPosition(0,0);health.upgrade(100,104);joystick.hero=heroNode;
    const ground=new cc.Node('Ground');waitingWorld.addChild(ground);ground.addComponent(cc.UITransform).setContentSize(2832,2832);
    const spawnerNode=new cc.Node('EnemySpawner');waitingWorld.addChild(spawnerNode);
    const spawner=spawnerNode.addComponent(modules.EnemySpawner);
    spawner.hero=heroNode;spawner.world=waitingWorld;spawner.ground=ground;spawner.enemyPrefab=new cc.Prefab();
    let spawnAttempts=0;spawner.spawnOne=()=>spawnAttempts++;
    const battle=waitingWorld.addComponent(modules.BossBattleSystem);battle.hero=heroNode;battle.spawnAfter=1;battle.bossPrefab=new cc.Prefab();
    let bossAttempts=0;battle.spawnBoss=()=>bossAttempts++;
    spawner.lateUpdate(120);battle.lateUpdate(120);
    assert(spawnAttempts===0&&spawner.timer===0&&battle.runningTime===0&&!battle.warningShown,
        'Opening wait generates no enemies and accumulates no spawn or Boss time');
    joystick.onTouchStart({getUILocation:()=>new cc.Vec2(),getID:()=>1});
    assert(!hint.active&&stick.getComponent(cc.UIOpacity).opacity===255,'Touch shows the real joystick and temporarily hides the hint');
    spawner.lateUpdate(2);battle.lateUpdate(2);
    assert(spawnAttempts===0&&battle.runningTime===0,'Touching without dragging does not start gameplay');
    joystick.onTouchEnd({getID:()=>1});joystick.updateHint(0);
    assert(hint.active,'Releasing a tap restores the unused joystick hint');
    joystick.onTouchStart({getUILocation:()=>new cc.Vec2(),getID:()=>2});
    joystick.onTouchMove({getUILocation:()=>new cc.Vec2(30,0),getID:()=>3});
    joystick.onTouchMove({getUILocation:()=>new cc.Vec2(3,0),getID:()=>2});
    spawner.lateUpdate(2);battle.lateUpdate(2);
    assert(spawnAttempts===0&&battle.runningTime===0,'Other fingers and dead-zone movement do not start gameplay');
    cc.director.pause();joystick.onTouchMove({getUILocation:()=>new cc.Vec2(30,0),getID:()=>2});cc.director.resume();
    battle.lateUpdate(2);assert(battle.runningTime===0,'Dragging while paused cannot start gameplay');
    joystick.onTouchMove({getUILocation:()=>new cc.Vec2(30,0),getID:()=>2});
    spawner.lateUpdate(.29);battle.lateUpdate(.29);
    assert(spawnAttempts===0&&Math.abs(battle.runningTime-.29)<.00001,'A real drag starts both timers from zero without catching up the opening wait');
    spawner.lateUpdate(.01);battle.lateUpdate(.01);
    assert(spawnAttempts===1&&bossAttempts===0,'The first enemy waits for its normal spawn interval after the drag');
    joystick.onTouchEnd({getID:()=>2});joystick.updateHint(.5);
    assert(!hint.active,'Hint stays hidden after releasing the first joystick drag');
    spawner.lateUpdate(.7);battle.lateUpdate(.7);
    assert(spawnAttempts===2&&bossAttempts===1&&Math.abs(battle.runningTime-1)<.00001,'Releasing the joystick keeps gameplay running and starts Boss timing at the first drag');
    cc.director.pause();spawner.lateUpdate(2);battle.lateUpdate(2);cc.director.resume();
    assert(spawnAttempts===2&&battle.runningTime===1,'Paused gameplay freezes both started timers');
    const session=await System.import('/scripts/BattleSession'),nextHero=new cc.Node('NextRoundHero');
    assert(session.hasBattleStarted(heroNode)&&!session.hasBattleStarted(nextHero),'A new round hero does not inherit the previous round start state');nextHero.destroy();
    const musicNode=new cc.Node('MusicChecks');musicNode.active=false;scene.addChild(musicNode);
    const music=musicNode.addComponent(modules.MusicDirector);
    function source(){return {clip:true,playing:false,plays:0,stops:0,loop:false,playOnAwake:true,
        play(){this.playing=true;this.plays++;},stop(){this.playing=false;this.stops++;}};}
    music.hero=heroNode;music.backgroundMusic=source();music.bossMusic=source();music.ambience=source();musicNode.active=true;
    const normal=music.backgroundMusic,bossMusic=music.bossMusic,bubbles=music.ambience;
    assert(!normal.playing&&!bossMusic.playing&&!bubbles.playing&&!normal.playOnAwake,'Background tracks wait for a real user gesture');
    joystick.onTouchStart({getUILocation:()=>new cc.Vec2(),getID:()=>4});
    assert(normal.playing&&bubbles.playing&&!bossMusic.playing,'Joystick input explicitly starts normal music and ambience');
    joystick.onTouchEnd({getID:()=>4});
    assert(normal.plays===1&&bubbles.plays===1,'Releasing the joystick does not restart already playing tracks');
    normal.playing=false;bubbles.playing=false;
    joystick.onTouchStart({getUILocation:()=>new cc.Vec2(),getID:()=>5});joystick.onTouchEnd({getID:()=>5});
    assert(normal.plays===2&&bubbles.plays===2,'A later gesture retries playback if the browser blocked or suspended it');
    const ambienceStops=bubbles.stops;
    modules.MusicDirector.useBossMusic();
    assert(!normal.playing&&bossMusic.playing&&bubbles.playing&&bubbles.stops===ambienceStops,'Boss phase replaces only normal music and preserves continuous bubbles');
    modules.MusicDirector.useBossMusic();assert(bossMusic.plays===1,'Repeated Boss phase signals do not restart its loop');
    const victoryNode=new cc.Node('VictoryMusicCheck');waitingWorld.addChild(victoryNode);
    const victory=victoryNode.addComponent(modules.BossBattleSystem);victory.onBossDefeated();
    assert(normal.playing&&!bossMusic.playing&&bubbles.playing&&bubbles.stops===ambienceStops,'Defeating Boss restores normal music while bubbles continue into the paused victory screen');
    victoryNode.destroy();cc.director.resume();
    assert(normal.loop&&bossMusic.loop&&bubbles.loop,'All three background tracks are configured to loop');
    musicNode.active=false;assert(!normal.playing&&!bossMusic.playing&&!bubbles.playing,'Leaving the scene stops all managed background tracks');musicNode.destroy();
    stick.destroy();canvas.destroy();
    return checks;
};

window.playNativePreview = async function () {
    const { manifest, report, previews, images } = window.animationPreview;
    const unique = new Set();
    for (const preview of previews) for (const state of preview.states) {
        const file = report.find(g => g.name === preview.group.name).clips.find(c => c.path.endsWith(state.clip.name + '.anim'));
        const raw = await (await fetch('/' + file.path)).json();
        for (const v of raw[5]._values) unique.add(v.__uuid__);
    }
    await Promise.all([...unique].map(async uuid => {
        if (images.has(uuid)) return;
        const image = new Image(); image.src = manifest[uuid].path; await image.decode(); images.set(uuid,image);
    }));
    const canvas = document.getElementById('preview'), ctx = canvas.getContext('2d');
    let draws = 0;
    const started = performance.now();
    function draw(now) {
        const elapsed = (now-started)/1000, phase = elapsed % 6;
        ctx.fillStyle='#193543';ctx.fillRect(0,0,1280,760);
        for (let i=0;i<previews.length;i++) {
            const preview=previews[i];
            const action=phase<2?0:phase<4?1:phase<4+preview.states[2].clip.duration?2:0;
            const state=preview.states[action],node=preview.nodes[action];
            state.time=action===0?(phase<2?phase:phase-4-preview.states[2].clip.duration):action===1?phase-2:phase-4;
            state.sample();
            const sprite=node.getComponent(cc.Sprite),image=images.get(sprite.spriteFrame.name);
            const x=(i%5)*256+128,y=Math.floor(i/5)*380+230,factor=preview.group.name==='Octopus'?.6:1;
            ctx.save();ctx.translate(x,y);ctx.scale(factor,factor);
            const s=node.scale.x;
            ctx.drawImage(image,node.position.x-image.width*s/2,-node.position.y-image.height*s/2,image.width*s,image.height*s);
            ctx.restore();ctx.fillStyle='white';ctx.font='16px sans-serif';ctx.fillText(preview.group.name+' / '+['idle','move','attack'][action],x-105,y-190);
        }
        draws++;window.previewDraws=draws;
        if(elapsed<12)requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
};
