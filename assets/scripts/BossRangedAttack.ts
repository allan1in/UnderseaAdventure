import { _decorator, Color, Component, Graphics, JsonAsset, Mask, Node, resources, Sprite, SpriteFrame, UIOpacity, UITransform, Vec2, Vec4 } from 'cc';
import { HeroHealth } from './HeroHealth';
import { SoundEffects } from './SoundEffects';
const { ccclass, property } = _decorator;

/** 定点远程技能：预警锁定脚下位置，延时后仅判定一次，不追踪移动中的英雄。 */
@ccclass('BossRangedAttack')
export class BossRangedAttack extends Component {
    @property warningTime = .5;
    @property damage = 5;
    @property radiusX = 100;
    @property radiusY = 60;
    @property eruptionDuration = .55;
    @property(SpriteFrame) tentacleFrame: SpriteFrame | null = null;
    @property([SpriteFrame]) tentacleFrames: SpriteFrame[] = [];
    @property([Vec2]) tentacleFrameOffsets: Vec2[] = [];
    @property(Vec4) tentacleBounds = new Vec4(0, 0, 1, 1);
    private root: Node | null = null;
    private warning: Graphics | null = null;
    private opening: Graphics | null = null;
    private tentacle: Node | null = null;
    private tentacleSprite: Sprite | null = null;
    private clip: Node | null = null;
    private elapsed = 0;
    private running = false;
    private hitApplied = false;
    private displayHeight = 200;

    get isRunning(): boolean { return this.running; }

    onLoad(): void {
        if (!this.tentacleFrames.length) resources.loadDir('gameplay/boss/tentacle-strike-frames', SpriteFrame, (error, frames) => {
            if (error || !this.isValid || frames.length !== 16) return;
            this.tentacleFrames = frames.sort((a, b) => a.name.localeCompare(b.name));
            this.configurePicture();
        });
        if (!this.tentacleFrameOffsets.length) resources.load('gameplay/boss/tentacle-strike-timing', JsonAsset, (error, asset) => {
            if (!error && this.isValid) this.tentacleFrameOffsets = asset.json.offsets.map((xy: number[]) => new Vec2(xy[0], xy[1]));
        });
        // 新组件自动挂载时也能加载素材，兼容编辑器内尚未刷新的 Boss Prefab。
        if (!this.tentacleFrame) resources.load('gameplay/boss/tentacle-strike/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !this.isValid) return;
            this.tentacleFrame = frame;
            this.configurePicture();
        });
    }

    begin(hero: HeroHealth): void {
        this.stop();
        if (!hero.isAlive || !this.node.parent) return;
        this.createVisual();
        const bounds = hero.getHurtBounds();
        this.root!.setPosition((bounds.left + bounds.right) / 2, bounds.bottom, 0);
        this.root!.active = true; this.running = true; this.elapsed = 0; this.hitApplied = false;
        this.clip!.active = false; this.opening!.node.active = false;
        this.drawWarning(0);
    }

    advance(dt: number, hero: HeroHealth): void {
        if (!this.running) return;
        if (!hero.isAlive || hero.node.parent !== this.node.parent) { this.stop(); return; }
        this.elapsed += Math.max(0, dt);
        if (this.elapsed + .000001 < this.warningTime) {
            this.drawWarning(this.elapsed / Math.max(.001, this.warningTime)); return;
        }
        if (!this.hitApplied) {
            this.hitApplied = true; this.warning!.node.active = false;
            this.opening!.node.active = true; this.clip!.active = true;
            SoundEffects.play('boss-attack');
            if (this.contains(hero)) hero.takeDamage(this.damage);
        }
        const t = Math.max(0, this.elapsed - this.warningTime);
        if (t >= this.eruptionDuration) { this.stop(); return; }
        if (this.tentacleFrames.length) {
            const index = Math.min(this.tentacleFrames.length - 1, Math.floor(t / this.eruptionDuration * this.tentacleFrames.length));
            this.tentacleSprite!.spriteFrame = this.tentacleFrames[index];
            const offset = this.tentacleFrameOffsets[index] ?? Vec2.ZERO;
            const scale = this.displayHeight / this.tentacleFrames[index].originalSize.height;
            this.tentacle!.setPosition(offset.x * scale, offset.y * scale, 0);
            this.drawOpening(t);
            return;
        }
        const rise = Math.min(1, .1 + t / .12);
        const retreat = Math.max(0, (t - Math.max(.12, this.eruptionDuration - .2)) / .2);
        const visible = rise * (1 - Math.min(1, retreat));
        // 图片自地下向上平移，矩形遮罩裁去地面以下的部分，避免压缩触手形状。
        this.tentacle!.setPosition(0, -this.displayHeight * (1 - visible), 0);
        this.root!.getComponent(UIOpacity)!.opacity = Math.round(255 * (1 - Math.min(1, retreat)));
        this.drawOpening(t);
    }

    private contains(hero: HeroHealth): boolean {
        const bounds = hero.getHurtBounds(), p = this.root!.position;
        const dx = ((bounds.left + bounds.right) / 2 - p.x) / Math.max(1, this.radiusX);
        const dy = (bounds.bottom - p.y) / Math.max(1, this.radiusY);
        return dx * dx + dy * dy <= 1;
    }

    private child(name: string): Node {
        const node = new Node(name); node.layer = this.node.layer; this.root!.addChild(node); return node;
    }

    private createVisual(): void {
        if (this.root) { this.root.getComponent(UIOpacity)!.opacity = 255; return; }
        this.root = new Node('BossTentacleStrike'); this.root.layer = this.node.layer;
        this.node.parent!.addChild(this.root); this.root.addComponent(UIOpacity);
        this.warning = this.child('TargetWarning').addComponent(Graphics);
        this.opening = this.child('SeafloorOpening').addComponent(Graphics);
        this.clip = this.child('TentacleClip');
        const clipUI = this.clip.addComponent(UITransform); clipUI.setContentSize(240, 240); clipUI.setAnchorPoint(.5, 0);
        this.clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
        this.tentacle = new Node('Tentacle'); this.tentacle.layer = this.node.layer; this.clip.addChild(this.tentacle);
        this.tentacle.addComponent(UITransform);
        this.tentacleSprite = this.tentacle.addComponent(Sprite);
        this.tentacleSprite.sizeMode = Sprite.SizeMode.CUSTOM; this.tentacleSprite.trim = false;
        this.configurePicture();
    }

    private configurePicture(): void {
        if (!this.tentacleSprite) return;
        if (this.tentacleFrames.length) {
            const frame = this.tentacleFrames[0], size = frame.originalSize;
            this.tentacleSprite.spriteFrame = frame;
            const ui = this.tentacle!.getComponent(UITransform)!;
            ui.setContentSize(size.width * this.displayHeight / size.height, this.displayHeight);
            // 帧图使用相同画布与底座轴，切帧时不按单帧内容改变显示尺寸。
            ui.setAnchorPoint(.5, 1 - 350 / 384);
            return;
        }
        if (!this.tentacleFrame) return;
        this.tentacleSprite.spriteFrame = this.tentacleFrame;
        const size = this.tentacleFrame.originalSize, b = this.tentacleBounds;
        const hasBounds = b.w > 1, height = hasBounds ? b.w : size.height;
        const ui = this.tentacle!.getComponent(UITransform)!;
        ui.setContentSize(size.width * this.displayHeight / height, size.height * this.displayHeight / height);
        ui.setAnchorPoint(hasBounds ? (b.x + b.z / 2) / size.width : .5,
            hasBounds ? 1 - (b.y + b.w) / size.height : 0);
    }

    private drawWarning(progress: number): void {
        const g = this.warning!; g.node.active = true; g.clear();
        g.fillColor = new Color(235, 57, 82, 65); g.ellipse(0, 0, this.radiusX, this.radiusY); g.fill();
        g.lineWidth = 4; g.strokeColor = new Color(255, 99, 112, 255); g.ellipse(0, 0, this.radiusX, this.radiusY); g.stroke();
        g.fillColor = new Color(255, 116, 104, 85); g.moveTo(0, 0);
        const end = Math.max(0, Math.min(1, progress)) * Math.PI * 2;
        for (let i = 0; i <= 48; i++) {
            const angle = Math.PI / 2 - end * i / 48;
            g.lineTo(Math.cos(angle) * this.radiusX, Math.sin(angle) * this.radiusY);
        }
        g.close(); g.fill();
    }

    private drawOpening(t: number): void {
        const g = this.opening!; g.clear();
        g.fillColor = new Color(11, 33, 59, 220); g.ellipse(0, 0, 42, 14); g.fill();
        g.strokeColor = new Color(82, 241, 239, Math.round(220 * Math.max(0, 1 - t / .3))); g.lineWidth = 3;
        g.ellipse(0, 0, 48 + t * 100, 16 + t * 35); g.stroke();
    }

    stop(): void { this.running = false; if (this.root) this.root.active = false; }
    onDisable(): void { this.stop(); }
    onDestroy(): void { this.root?.destroy(); }
}
