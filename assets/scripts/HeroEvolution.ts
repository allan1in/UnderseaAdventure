import { _decorator, Animation, AnimationClip, assetManager, Component, JsonAsset, Node, Rect, resources, Size, sp, Sprite, SpriteFrame, Texture2D, Vec2, Vec4 } from 'cc';
import { HeroController } from './HeroController';
import { HeroHealth } from './HeroHealth';
import { HeroVisual } from './HeroVisual';
import { SoundEffects } from './SoundEffects';
import { CircleBody2D } from './CircleBody2D';

const { ccclass, property, executionOrder } = _decorator;
type Action = 'idle' | 'walk' | 'attack';
type Form = {
    life: number; damage: number; barY: number; offsets: number[][]; scale: number;
    actions: Record<Action, { ids: string[]; fps: number; reverse: boolean; loop: boolean }>;
    attack: { width: number; height: number; x: number; y: number; hitProgress: number };
    bodyWidth: number; bodyHeight: number;
    slash: { ids: (string | null)[]; fps: number; transform: number[] };
    themeVisual?: { offsets: number[][]; scale: number; barY: number;
        swim?: boolean;
        attackEffect?: { frame: string; bounds: number[] };
        animation?: { offsets: number[][]; scale: number };
        collision?: { radius: number; radiusY?: number; hurtWidth: number; hurtHeight: number; hurtOffsetY: number; width: number; height: number } };
};
type FrameIndex = { frames: { id: string; name: string; rect: number[]; original: number[]; offset: number[]; rotated: boolean }[] };

/** 每招募一只宠物按原示例的等级顺序进化；不绑定具体宠物种类。 */
@ccclass('HeroEvolution')
@executionOrder(20)
export class HeroEvolution extends Component {
    @property([SpriteFrame]) themeSlashFrames: SpriteFrame[] = [];
    @property([Vec4]) themeSlashBounds: Vec4[] = [];
    @property([Texture2D]) textures: Texture2D[] = [];
    @property([JsonAsset]) frameIndices: JsonAsset[] = [];
    @property(JsonAsset) formData: JsonAsset | null = null;
    @property(sp.SkeletonData) finalSkeleton: sp.SkeletonData | null = null;
    @property({ type: sp.SkeletonData, tooltip: '第一形态完整骨骼动画：Idle、Move、Attack' })
    stageOneSkeleton: sp.SkeletonData | null = null;
    @property({ type: sp.SkeletonData, tooltip: '第二形态完整骨骼动画：Idle、Move、Attack' })
    stageTwoSkeleton: sp.SkeletonData | null = null;
    @property({ type: sp.SkeletonData, tooltip: '第三形态完整骨骼动画：Idle、Move、Attack' })
    stageThreeSkeleton: sp.SkeletonData | null = null;
    @property({ type: sp.SkeletonData, tooltip: '第四形态完整骨骼动画：Idle、Move、Attack，含独立披风' })
    stageFourSkeleton: sp.SkeletonData | null = null;
    @property(Node) upgradeEffect: Node | null = null;
    @property({ type: [SpriteFrame], tooltip: '海底主题四个形态的外观；没有动作帧的形态使用静态图片' })
    themeFrames: SpriteFrame[] = [];

    @property({ type: AnimationClip, tooltip: '第一形态待机动画：HeroIdle.anim，可在动画编辑器修改' })
    stageOneIdleClip: AnimationClip | null = null;
    @property({ type: AnimationClip, tooltip: '第一形态奔跑动画：HeroWalk.anim，可在动画编辑器修改' })
    stageOneRunClip: AnimationClip | null = null;
    @property({ type: AnimationClip, tooltip: '第一形态攻击动画：HeroAttack.anim，可在动画编辑器修改' })
    stageOneAttackClip: AnimationClip | null = null;
    @property({ type: SpriteFrame, tooltip: '第一形态待机首帧，用于换算动画画布的显示比例' })
    stageOneIdleFrame: SpriteFrame | null = null;

    @property({ type: [AnimationClip], tooltip: '四个形态的待机动画，按形态顺序排列' })
    themeIdleClips: AnimationClip[] = [];
    @property({ type: [AnimationClip], tooltip: '四个形态的奔跑动画，按形态顺序排列' })
    themeRunClips: AnimationClip[] = [];
    @property({ type: [AnimationClip], tooltip: '四个形态的攻击动画，按形态顺序排列' })
    themeAttackClips: AnimationClip[] = [];

    private stage = 0;
    private frames = new Map<string, SpriteFrame>();
    private clips: AnimationClip[] = [];
    private forms: Form[] = [];
    private effectTime = 0;
    private effectClip: AnimationClip | null = null;
    private loadingThemeClips = false;
    private pendingEvolutions = 0;

    get stageIndex(): number { return this.stage; }

    onLoad(): void {
        this.forms = this.formData?.json.forms ?? [];
        this.loadThemeSlashFrames();
        this.frameIndices.forEach((data, i) => {
            const texture = this.textures[i];
            if (!texture) return;
            for (const source of (data.json as FrameIndex).frames) {
                const frame = new SpriteFrame(); frame.name = source.name;
                frame.reset({ texture, rect: new Rect(...source.rect as [number, number, number, number]),
                    originalSize: new Size(source.original[0], source.original[1]),
                    offset: new Vec2(source.offset[0], source.offset[1]), isRotate: source.rotated });
                this.frames.set(source.id, frame);
            }
        });
        const effect = this.formData?.json.upgrade;
        if (effect && this.upgradeEffect) {
            this.effectClip = this.makeClip('HeroUpgrade', effect.ids, effect.fps, false, false);
            const animation = this.upgradeEffect.getComponent(Animation)!;
            animation.addClip(this.effectClip);
        }
        this.node.parent?.on('pet-recruited', this.evolve, this);
        this.scheduleOnce(() => this.loadAdditionalThemeClips(), .25);
        if (!this.stageOneSkeleton) resources.load('gameplay/hero/stage01-rig/hero-stage-01', sp.SkeletonData, (error, data) => {
            if (!this.isValid) return;
            if (error) { console.error('[HeroEvolution] 第一形态骨骼加载失败', error); return; }
            this.stageOneSkeleton = data;
            if (this.stage === 0) this.applyStageOneSkeleton();
        });
        if (!this.stageTwoSkeleton) resources.load('gameplay/hero/stage02-rig/hero-stage-02', sp.SkeletonData, (error, data) => {
            if (!this.isValid) return;
            if (error) { console.error('[HeroEvolution] 第二形态骨骼加载失败', error); return; }
            this.stageTwoSkeleton = data;
            if (this.stage === 1) this.applyStageTwoSkeleton();
        });
        if (!this.stageThreeSkeleton) resources.load('gameplay/hero/stage03-rig/hero-stage-03', sp.SkeletonData, (error, data) => {
            if (!this.isValid) return;
            if (error) { console.error('[HeroEvolution] 第三形态骨骼加载失败', error); return; }
            this.stageThreeSkeleton = data;
            if (this.stage === 2) this.applyStageThreeSkeleton();
        });
        if (!this.stageFourSkeleton) resources.load('gameplay/hero/stage04-rig/hero-stage-04', sp.SkeletonData, (error, data) => {
            if (!this.isValid) return;
            if (error) { console.error('[HeroEvolution] 第四形态骨骼加载失败', error); return; }
            this.stageFourSkeleton = data;
            if (this.stage === 3) this.applyStageFourSkeleton();
        });
    }

    start(): void {
        const form = this.forms[0];
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        if (!form?.themeVisual || !this.themeFrames[0] || !visual || !hero) return;
        const animation = visual.animationComponent;
        if (this.stageOneSkeleton) {
            hero.swimActions = true;
            hero.slashClip = null;
            hero.themeSlashFrame = this.themeSlashFrames[0] ?? null;
            hero.themeSlashBounds = this.themeSlashBounds[0] ?? new Vec4(0, 0, 1, 1);
            this.applyThemeBody(form);
            this.applyStageOneSkeleton();
            return;
        }
        // 编辑器已打开的场景可能尚未同步新增字段，沿用原 Animation 上的资源引用。
        this.stageOneIdleClip ??= animation?.clips.find(clip => clip?.name === 'HeroIdle') ?? null;
        this.stageOneRunClip ??= animation?.clips.find(clip => clip?.name === 'HeroWalk') ?? hero.walkClip;
        this.stageOneAttackClip ??= animation?.clips.find(clip => clip?.name === 'HeroAttack') ?? hero.attackClip;
        this.themeIdleClips[0] ??= this.stageOneIdleClip!;
        this.themeRunClips[0] ??= this.stageOneRunClip!;
        this.themeAttackClips[0] ??= this.stageOneAttackClip!;
        hero.swimActions = !!form.themeVisual.swim;
        if (hero.swimActions) this.themeRunClips[0] = this.themeIdleClips[0];
        this.configureThemeVisual(form, 0, visual);
        hero.attackOffsetX = form.attack.x - visual.idleOffsetX;
        hero.attackRange = form.attack.width;
        hero.attackHeight = form.attack.height;
        hero.attackOffsetY = form.attack.y;
        // 新攻击帧已包含武器；旧剑弧会伸到新武器之外。
        hero.slashClip = null;
        hero.themeSlashFrame = this.themeSlashFrames[0] ?? null;
        hero.themeSlashBounds = this.themeSlashBounds[0] ?? new Vec4(0, 0, 1, 1);
        this.applyThemeBody(form);
        const [idle, walk, attack] = this.makeThemeClips(form, 0);
        if (animation) {
            animation.stop();
            for (const clip of [idle, walk, attack]) animation.addClip(clip);
            animation.defaultClip = idle;
        }
        hero.walkClip = walk;
        hero.attackClip = attack;
        hero.hitTime = attack.duration / Math.max(.0001, attack.speed) * form.attack.hitProgress;
        hero.attackSoundDelay = attack.duration / Math.max(.0001, attack.speed) * .25;
        this.applyStageOneSkeleton();
        hero.stopMoving();
    }

    private applyStageOneSkeleton(): void {
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        if (!this.stageOneSkeleton || !visual || !hero || this.stage !== 0) return;
        visual.configureSpine(this.stageOneSkeleton, { x: 10, y: -11, scale: .68, singleTrack: true });
        hero.attackOffsetX = this.forms[0].attack.x;
        hero.hitTime = .205;
        hero.attackSoundDelay = .12;
        hero.stopMoving();
    }

    private evolve(): void {
        if (this.loadingThemeClips) { this.pendingEvolutions++; return; }
        const next = this.stage + 1, form = this.forms[next];
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        const health = this.getComponent(HeroHealth);
        const themed = !!(this.themeFrames[next] && form?.themeVisual);
        if (!form || !visual || !hero || !health?.isAlive || (next === 3 && !themed && !this.finalSkeleton)) return;
        let idle: AnimationClip | null = null, walk: AnimationClip | null = null, attack: AnimationClip | null = null;
        const skeletonData = next === 1 ? this.stageTwoSkeleton : next === 2 ? this.stageThreeSkeleton : next === 3 ? this.stageFourSkeleton : null;
        const articulated = !!skeletonData;
        if (articulated) {
            visual.configureSpine(skeletonData!, { x: 10, y: -11, scale: next === 1 ? .74 : next === 2 ? .80 : .86, singleTrack: true });
        } else if (themed) {
            this.configureThemeVisual(form, next, visual);
            [idle, walk, attack] = this.makeThemeClips(form, next);
        } else if (next < 3) {
            visual.configureFrame(form.offsets, form.scale);
            const clips = (['idle', 'walk', 'attack'] as Action[]).map(action => {
                const source = form.actions[action];
                return this.makeClip(`HeroForm${next + 1}-${action}`, source.ids, source.fps, source.loop, source.reverse);
            });
            [idle, walk, attack] = clips;
        } else visual.configureSpine(this.finalSkeleton!);
        hero.swimActions = themed && !!form.themeVisual?.swim;
        const slash = themed ? null : this.makeClip(`HeroForm${next + 1}-slash`, form.slash.ids, form.slash.fps, false, false);
        hero.applyEvolution(idle, walk, attack, { ...form.attack, damage: form.damage,
            bodyWidth: form.bodyWidth, bodyHeight: form.bodyHeight, slash: form.slash.transform }, slash);
        hero.themeSlashFrame = themed ? this.themeSlashFrames[next] ?? null : null;
        hero.themeSlashBounds = this.themeSlashBounds[next] ?? new Vec4(0, 0, 1, 1);
        if (themed) this.applyThemeBody(form);
        hero.attackSound = next < 2 ? 'player-attack-1' : 'player-attack-2';
        hero.attackSoundDelay = themed ? (attack?.duration ?? .48) / Math.max(.0001, attack?.speed ?? 1) * .25 : .3;
        hero.attackSoundVolume = next < 2 ? 1 : .8;
        health.upgrade(form.life, themed ? form.themeVisual!.barY : form.barY);
        this.stage = next;
        if (articulated) {
            if (next === 1) this.applyStageTwoSkeleton();
            else if (next === 2) this.applyStageThreeSkeleton();
            else this.applyStageFourSkeleton();
        }
        SoundEffects.play('player-upgrade');
        if (this.effectClip && this.upgradeEffect) {
            this.upgradeEffect.active = true;
            this.upgradeEffect.getComponent(Animation)!.play(this.effectClip.name);
            this.effectTime = this.effectClip.duration;
        }
        this.node.emit('hero-evolved', this.stage);
    }

    private applyStageTwoSkeleton(): void {
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        if (!this.stageTwoSkeleton || !visual || !hero || this.stage !== 1) return;
        visual.configureSpine(this.stageTwoSkeleton, { x: 10, y: -11, scale: .74, singleTrack: true });
        hero.walkClip = hero.attackClip = null;
        hero.attackOffsetX = this.forms[1].attack.x;
        hero.hitTime = .205;
        hero.attackSoundDelay = .12;
        hero.stopMoving();
    }

    private applyStageThreeSkeleton(): void {
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        if (!this.stageThreeSkeleton || !visual || !hero || this.stage !== 2) return;
        visual.configureSpine(this.stageThreeSkeleton, { x: 10, y: -11, scale: .80, singleTrack: true });
        hero.walkClip = hero.attackClip = null;
        hero.attackOffsetX = this.forms[2].attack.x;
        hero.hitTime = .205;
        hero.attackSoundDelay = .12;
        hero.stopMoving();
    }

    private applyStageFourSkeleton(): void {
        const visual = this.getComponent(HeroVisual), hero = this.getComponent(HeroController);
        if (!this.stageFourSkeleton || !visual || !hero || this.stage !== 3) return;
        visual.configureSpine(this.stageFourSkeleton, { x: 10, y: -11, scale: .86, singleTrack: true });
        hero.walkClip = hero.attackClip = null;
        hero.attackOffsetX = this.forms[3].attack.x;
        hero.hitTime = .205;
        hero.attackSoundDelay = .12;
        hero.stopMoving();
    }

    update(dt: number): void {
        if (this.effectTime <= 0) return;
        this.effectTime = Math.max(0, this.effectTime - Math.max(0, dt));
        if (!this.effectTime && this.upgradeEffect) this.upgradeEffect.active = false;
    }

    private makeThemeClips(form: Form, stage: number): AnimationClip[] {
        // 四个形态均使用磁盘动画，编辑器改帧与运行时播放共用同一资源。
        if (this.hasThemeAnimations(stage)) {
            return [this.themeIdleClips[stage], form.themeVisual?.swim ? this.themeIdleClips[stage] : this.themeRunClips[stage], this.themeAttackClips[stage]];
        }
        return (['idle', 'walk', 'attack'] as Action[]).map(action => {
            const source = form.actions[action];
            // 最终形态原 Spine Attack 为 0.8 秒；静态替身保留同样的攻击计时。
            const count = source?.ids.length ?? (action === 'attack' ? 24 : 10);
            const fps = source?.fps ?? (action === 'attack' ? 30 : 20);
            const clip = AnimationClip.createWithSpriteFrames(Array(count).fill(this.themeFrames[stage]), fps);
            clip.name = `SeaHeroForm${stage + 1}-${action}`;
            clip.wrapMode = action === 'attack' ? AnimationClip.WrapMode.Normal : AnimationClip.WrapMode.Loop;
            this.clips.push(clip);
            return clip;
        });
    }

    private hasThemeAnimations(stage: number): boolean {
        return !!(this.themeIdleClips[stage] && this.themeRunClips[stage] && this.themeAttackClips[stage]);
    }

    private loadThemeSlashFrames(): void {
        // current_scene 可能仍是编辑器内存中的旧场景，数组引用为空。
        // 按已导入的资源 UUID 补齐；不依赖用户重新挂载四张图片。
        this.forms.forEach((form, stage) => {
            const effect = form.themeVisual?.attackEffect;
            if (!effect) return;
            this.themeSlashBounds[stage] ??= new Vec4(...effect.bounds as [number, number, number, number]);
            if (this.themeSlashFrames[stage]) return;
            assetManager.loadAny<SpriteFrame>(effect.frame, (error, frame) => {
                if (!this.isValid) return;
                if (error) { console.error('[HeroEvolution] 剑弧素材加载失败', error); return; }
                this.themeSlashFrames[stage] = frame;
                if (stage === this.stage) {
                    const hero = this.getComponent(HeroController);
                    if (hero) { hero.themeSlashFrame = frame; hero.themeSlashBounds = this.themeSlashBounds[stage]; }
                }
            });
        });
    }

    private configureThemeVisual(form: Form, stage: number, visual: HeroVisual): void {
        const settings = form.themeVisual!;
        if (this.hasThemeAnimations(stage) && settings.animation) {
            visual.configureFrame(settings.animation.offsets, settings.animation.scale, true);
        } else {
            const scale = stage === 0 && this.hasThemeAnimations(0)
                ? settings.scale * this.themeFrames[0].originalSize.width / (this.stageOneIdleFrame?.originalSize.width ?? 256)
                : settings.scale;
            visual.configureFrame(settings.offsets, scale);
        }
    }

    private loadAdditionalThemeClips(): void {
        if ([1, 2, 3].every(stage => (stage === 1 && !!this.stageTwoSkeleton) || (stage === 2 && !!this.stageThreeSkeleton) || (stage === 3 && !!this.stageFourSkeleton) || this.hasThemeAnimations(stage))) return;
        // 兼容编辑器仍打开旧场景的情况，新数组未同步时从 resources 补齐后续形态。
        this.loadingThemeClips = true;
        resources.loadDir('gameplay/hero/theme-animations', AnimationClip, (error, clips) => {
            if (!this.isValid) return;
            if (error) console.error('[HeroEvolution] 英雄动画加载失败', error);
            else for (let stage = 1; stage < 4; stage++) {
                if ((stage === 1 && this.stageTwoSkeleton) || (stage === 2 && this.stageThreeSkeleton) || (stage === 3 && this.stageFourSkeleton)) continue;
                const prefix = `HeroStage${String(stage + 1).padStart(2, '0')}`;
                const idle = clips.find(clip => clip.name === `${prefix}Idle`);
                const run = clips.find(clip => clip.name === `${prefix}Walk`);
                const attack = clips.find(clip => clip.name === `${prefix}Attack`);
                if (idle) this.themeIdleClips[stage] ??= idle;
                if (run) this.themeRunClips[stage] ??= run;
                if (attack) this.themeAttackClips[stage] ??= attack;
            }
            this.loadingThemeClips = false;
            const pending = this.pendingEvolutions;
            this.pendingEvolutions = 0;
            for (let i = 0; i < pending; i++) this.evolve();
        });
    }

    private applyThemeBody(form: Form): void {
        const health = this.getComponent(HeroHealth);
        if (health && form.themeVisual) health.healthBarOffsetY = form.themeVisual.barY;
        const shape = form.themeVisual?.collision;
        if (!shape) return;
        const body = this.getComponent(CircleBody2D), hero = this.getComponent(HeroController);
        if (body) { body.radius = shape.radius; body.verticalRadius = shape.radiusY ?? shape.radius; }
        if (hero) { hero.bodyWidth = shape.width; hero.bodyHeight = shape.height; }
        if (health) {
            health.hurtWidth = shape.hurtWidth;
            health.hurtHeight = shape.hurtHeight;
            health.hurtOffsetY = shape.hurtOffsetY;
        }
    }

    private makeClip(name: string, ids: (string | null)[], fps: number, loop: boolean, reverse: boolean): AnimationClip {
        const frames = ids.map(id => id ? this.frames.get(id) ?? null : null);
        for (let i = 0; i < ids.length; i++) if (ids[i] && !frames[i]) throw new Error(`Missing hero frame: ${ids[i]}`);
        // null 保留原挥砍特效的前摇空帧，不会提前显示剑弧。
        const clip = AnimationClip.createWithSpriteFrames(frames as SpriteFrame[], fps);
        clip.name = name;
        clip.wrapMode = loop ? (reverse ? AnimationClip.WrapMode.PingPong : AnimationClip.WrapMode.Loop) : AnimationClip.WrapMode.Normal;
        this.clips.push(clip);
        return clip;
    }

    onDestroy(): void {
        this.node.parent?.off('pet-recruited', this.evolve, this);
        for (const clip of this.clips) clip.destroy();
        for (const frame of this.frames.values()) frame.destroy();
        this.frames.clear();
    }
}
