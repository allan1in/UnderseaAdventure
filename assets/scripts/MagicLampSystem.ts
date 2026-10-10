import { _decorator, BlockInputEvents, Color, Component, director, Director, Graphics, Label, Node, resources, sp, Sprite, SpriteFrame, UITransform, Vec2, Vec3, warn } from 'cc';
import { HeroHealth } from './HeroHealth';
import { PetSystem } from './PetSystem';
import { LampGuide } from './LampGuide';
import { CoinSystem } from './CoinSystem';
import { FlatShape } from './FlatShape';
import { SoundEffects } from './SoundEffects';
import { CircleBody2D } from './CircleBody2D';

const { ccclass, property } = _decorator;
type PaymentCoin = { node: Node; start: Vec2; elapsed: number };

@ccclass('MagicLampSystem')
export class MagicLampSystem extends Component {
    @property({ type: Node, tooltip: '留空时自动关联 World 下的 Hero' })
    hero: Node | null = null;

    @property({ type: Node, tooltip: '留空时自动关联 World 下的 Ground' })
    ground: Node | null = null;

    @property({ type: sp.SkeletonData, tooltip: '留空时自动加载 resources/gameplay/magic-lamp/MX_shendeng.json' })
    lampData: sp.SkeletonData | null = null;

    @property({ type: SpriteFrame, tooltip: '留空时自动加载 resources/gameplay/guide-arrow/spriteFrame' })
    arrowFrame: SpriteFrame | null = null;

    @property(Node)
    lampView: Node | null = null;

    @property(Node)
    selectionOverlay: Node | null = null;

    @property(LampGuide)
    guideView: LampGuide | null = null;

    /** 本局各轮随机位置；切换阶段时生成，重复显示同一阶段时沿用。 */
    private positions: Vec2[] = [];

    @property({ tooltip: '召唤台与进度条整体外侧到地图边缘的最小留白，单位为 World 坐标' })
    edgePadding = 120;

    @property({ tooltip: '随机位置与英雄、前几轮召唤台的期望最小间距；地图过小时优先保证边缘留白' })
    minStationDistance = 500;

    @property({ tooltip: '召唤台底座椭圆的水平半径' })
    collisionRadius = 85;

    @property({ tooltip: '召唤台底座椭圆的垂直半径' })
    collisionRadiusY = 35;

    @property({ tooltip: '扇贝素材以底部为锚点，碰撞圆心向上贴合装置' })
    collisionOffsetY = 35;

    @property({ tooltip: '原神灯最终显示比例 2 × 0.73，再乘学习工程的 0.5' })
    visualScale = 0.73;

    @property({ tooltip: '原神灯投币 BoxCollider 500 × 500，经 0.73 × 0.5 缩放' })
    payWidth = 182.5;

    @property
    payHeight = 182.5;

    @property({ tooltip: '原碰撞偏移 (30,50) 经 0.73 × 0.5 缩放' })
    payOffsetX = 10.95;

    @property
    payOffsetY = 18.25;

    @property({ tooltip: '逐枚扣币的间隔，原场景为 0.08 秒' })
    payInterval = 0.08;

    @property({ tooltip: '原 coinAnimationData.y = 500；按学习工程一半比例为 250' })
    coinFlySpeed = 250;

    @property({ tooltip: '原 coinAnimationData.z = 2；高阶段间隔为 min(0.08, 2/门槛)' })
    payDuration = 2;

    @property({ tooltip: '原场景第一盏神灯预置 1 枚贡献，后两盏从 0 开始' })
    initialPaidCoins = 1;

    @property({ tooltip: '静态扇贝图片中珍珠相对于装置根节点的高度；金币飞行终点' })
    paymentTargetY = 156.179;

    private lamp: Node | null = null;
    private guide: LampGuide | null = null;
    private skeleton: sp.Skeleton | null = null;
    private progress: Graphics | null = null;
    private text: Label | null = null;
    private progressFill: Node | null = null;
    private ownsViews = false;
    private stage = 0;
    private paid = 0;
    private costs = [10, 50, 100];
    private paymentTimer = 0;
    private flights: PaymentCoin[] = [];
    private overlay: Node | null = null;
    private ownsPause = false;
    private pausedJoystick: Component | null = null;
    private overlayWidth = 0;
    private overlayHeight = 0;

    get lampNode(): Node | null { return this.lamp; }
    get stageIndex(): number { return this.stage; }
    get paidCoins(): number { return this.paid; }
    get isSelectionOpen(): boolean { return this.overlay?.active ?? false; }

    onLoad(): void {
        this.hero ??= this.node.getChildByName('Hero');
        this.ground ??= this.node.getChildByName('Ground');
        if (!this.hero || this.hero.parent !== this.node || !this.ground || this.ground.parent !== this.node) {
            warn('MagicLampSystem: World 下需要 Hero 和 Ground 节点。');
            return;
        }
        this.overlay = this.selectionOverlay;
        this.node.on('pets-ready', this.onPetsReady, this);
        if (this.overlay) {
            this.overlay.active = false;
            this.overlay.on('pet-selected', this.onPetSelected, this);
            director.on(Director.EVENT_BEFORE_DRAW, this.resizeOverlay, this);
        }
        if (this.lampView && this.guideView) this.bindLamp();
        else if (this.lampData && this.arrowFrame) this.createLamp();
        else void this.loadAssets();
    }

    private async loadAssets(): Promise<void> {
        try {
            const load = <T extends sp.SkeletonData | SpriteFrame>(path: string, type: any): Promise<T> =>
                new Promise((resolve, reject) => resources.load(path, type, (error, asset) => error ? reject(error) : resolve(asset as T)));
            const [lamp, arrow] = await Promise.all([
                this.lampData ? Promise.resolve(this.lampData) : load<sp.SkeletonData>('gameplay/magic-lamp/MX_shendeng', sp.SkeletonData),
                this.arrowFrame ? Promise.resolve(this.arrowFrame) : load<SpriteFrame>('gameplay/guide-arrow/spriteFrame', SpriteFrame),
            ]);
            if (!this.isValid) return;
            this.lampData = lamp;
            this.arrowFrame = arrow;
            this.createLamp();
            if (!this.enabledInHierarchy) this.onDisable();
        } catch (error) {
            if (this.isValid) warn(`MagicLampSystem: 神灯素材加载失败：${String(error)}`);
        }
    }

    private bindLamp(): void {
        this.lamp = this.lampView;
        this.configureCollision();
        this.guide = this.guideView;
        this.skeleton = this.lamp?.getChildByName('Spine')?.getComponent(sp.Skeleton) ?? null;
        const bar = this.lamp?.getChildByName('CoinProgress');
        this.progressFill = bar?.getChildByName('Fill') ?? null;
        this.text = bar?.getChildByName('Amount')?.getComponent(Label) ?? null;
        if (this.guide) this.guide.hero = this.hero;
        this.configureAnimation();
        this.showStage(0);
    }

    private createLamp(): void {
        if (this.lamp || !this.lampData || !this.arrowFrame) return;
        this.ownsViews = true;
        const lamp = new Node('MagicLamp');
        lamp.layer = this.node.layer;
        this.node.addChild(lamp);
        lamp.addComponent(UITransform).setContentSize(337, 187);
        const shadow = this.child(lamp, 'Shadow');
        const graphic = shadow.addComponent(Graphics);
        graphic.fillColor = new Color(15, 67, 40, 100);
        graphic.ellipse(12.775, 7.3, 68.62, 14.6);
        graphic.fill();
        const picture = this.child(lamp, 'Spine');
        picture.setPosition(12.167, 3.457, 0);
        picture.setScale(this.visualScale, this.visualScale, 1);
        this.skeleton = picture.addComponent(sp.Skeleton);
        this.skeleton.skeletonData = this.lampData;
        this.skeleton.premultipliedAlpha = false;
        this.configureAnimation();
        const bar = this.child(lamp, 'CoinProgress');
        bar.setPosition(10.009, 170.804, 0);
        bar.getComponent(UITransform)!.setContentSize(173, 27);
        this.progress = bar.addComponent(Graphics);
        const caption = this.child(bar, 'Amount');
        caption.getComponent(UITransform)!.setContentSize(173, 27);
        this.text = caption.addComponent(Label);
        this.text.fontSize = 18;
        this.text.lineHeight = 24;
        this.text.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.text.verticalAlign = Label.VerticalAlign.CENTER;
        this.text.color = new Color(255, 255, 255, 255);
        const line = this.child(this.node, 'LampGuide');
        this.guide = line.addComponent(LampGuide);
        this.guide.hero = this.hero;
        this.guide.arrowFrame = this.arrowFrame;
        this.lamp = lamp;
        this.configureCollision();
        this.showStage(0);
    }

    private configureCollision(): void {
        if (!this.lamp) return;
        const body = this.lamp.getComponent(CircleBody2D) ?? this.lamp.addComponent(CircleBody2D);
        body.radius = Math.max(0, this.collisionRadius);
        body.verticalRadius = Math.max(0, this.collisionRadiusY);
        body.offsetY = this.collisionOffsetY;
        // 同时加入角色组和宠物组，Boss 没有身体组件，仍可自由穿过。
        body.collisionGroup = 3;
        body.collisionMask = 3;
    }

    onEnable(): void {
        if (this.lamp) this.lamp.active = this.stage < this.positions.length && this.stage < this.costs.length;
        if (this.guide) this.guide.node.active = true;
    }

    onDisable(): void {
        this.closeSelection();
        if (this.lamp?.isValid) this.lamp.active = false;
        if (this.guide?.isValid) this.guide.node.active = false;
    }

    update(deltaTime = 0): void {
        if (this.isSelectionOpen) return;
        this.updateFlights(Math.max(0, deltaTime));
        const health = this.hero?.getComponent(HeroHealth);
        if (this.guide) {
            this.guide.target = !health || health.isAlive ? this.lamp : null;
        }
        const coins = this.node.getComponent(CoinSystem);
        const cost = this.costs[this.stage];
        // 满额后不再扣款，但资源就绪时仍须再次尝试打开选择界面。
        if (cost !== undefined && this.paid >= cost && this.lamp?.activeInHierarchy
            && this.hero?.activeInHierarchy && (!health || health.isAlive)) {
            this.paymentTimer = 0;
            this.openSelection();
            return;
        }
        if (!this.lamp?.activeInHierarchy || !this.hero?.activeInHierarchy || (health && !health.isAlive)
            || !coins || cost === undefined || this.paid >= cost || coins.balance <= 0 || !this.isNearLamp()) {
            this.paymentTimer = 0;
            return;
        }
        const interval = Math.max(0.02, Math.min(this.payInterval, this.payDuration / cost));
        // 离开范围和余额用尽时清空计时；后台恢复最多补 0.1 秒的投币。
        this.paymentTimer += Math.min(0.1, Math.max(0, deltaTime));
        while (this.paymentTimer >= interval && this.paid < cost && coins.balance > 0) {
            this.paymentTimer -= interval;
            if (!coins.spendCoins(1)) break;
            SoundEffects.play('coin-shopping');
            this.paid++;
            this.refreshProgress();
            this.createPaymentCoin(coins);
            if (this.paid >= cost) {
                this.openSelection();
                break;
            }
            if (this.skeleton?.getCurrent(0)?.animation?.name === 'idle') {
                this.skeleton.setAnimation(0, 'idle2', false);
                this.skeleton.addAnimation(0, 'idle', true, 0);
            }
        }
    }

    /** 调整显示值时不凭空消费余额，正常投币由 update 统一扣款。 */
    setPaidCoins(amount: number): void {
        this.paid = Math.min(this.costs[this.stage] ?? 0, Math.max(0, Math.floor(amount)));
        this.refreshProgress();
    }

    /** 伙伴选择完成后切换阶段，不能由靠近或计时自动触发。 */
    showStage(index: number): void {
        if (!this.lamp || !this.ground) return;
        this.closeSelection();
        this.clearFlights();
        this.paymentTimer = 0;
        if (this.skeleton?.skeletonData) this.skeleton.setAnimation(0, 'idle', true);
        this.stage = Math.max(0, Math.floor(index));
        this.lamp.active = this.stage < this.costs.length;
        this.paid = this.stage === 0 ? Math.min(this.costs[0], Math.max(0, Math.floor(this.initialPaidCoins))) : 0;
        if (!this.lamp.active) {
            if (this.guide) this.guide.target = null;
            return;
        }
        const transform = this.ground.getComponent(UITransform);
        if (!transform) return;
        const bounds = this.getPlacementBounds(transform);
        const position = this.positions[this.stage] ?? this.randomPosition(bounds);
        position.set(this.clamp(position.x, bounds.left, bounds.right),
            this.clamp(position.y, bounds.bottom, bounds.top));
        this.positions[this.stage] = position;
        this.lamp.setPosition(position.x, position.y, 0);
        if (this.guide) this.guide.target = this.lamp;
        this.refreshProgress();
    }

    private getPlacementBounds(map: UITransform): { left: number; right: number; bottom: number; top: number } {
        const ground = this.ground!, lamp = this.lamp!;
        const width = map.width * Math.abs(ground.scale.x), height = map.height * Math.abs(ground.scale.y);
        const mapLeft = ground.position.x - width * map.anchorX;
        const mapBottom = ground.position.y - height * map.anchorY;
        // 包围盒包含召唤台、阴影、上方进度条及图标，不能只按旧神灯图片留边。
        const rect = lamp.getComponent(UITransform)?.getBoundingBoxToWorld();
        const lower = rect ? this.node.inverseTransformPoint(new Vec3(), new Vec3(rect.xMin, rect.yMin, 0)) : null;
        const upper = rect ? this.node.inverseTransformPoint(new Vec3(), new Vec3(rect.xMax, rect.yMax, 0)) : null;
        const pad = Math.max(0, this.edgePadding);
        let left = mapLeft + pad + Math.max(0, lower ? lamp.position.x - lower.x : 170);
        let right = mapLeft + width - pad - Math.max(0, upper ? upper.x - lamp.position.x : 183);
        let bottom = mapBottom + pad + Math.max(0, lower ? lamp.position.y - lower.y : 94);
        let top = mapBottom + height - pad - Math.max(0, upper ? upper.y - lamp.position.y : 270);
        if (left > right) left = right = (left + right) / 2;
        if (bottom > top) bottom = top = (bottom + top) / 2;
        return { left, right, bottom, top };
    }

    private randomPosition(bounds: { left: number; right: number; bottom: number; top: number }): Vec2 {
        const anchors = this.positions.filter(Boolean);
        if (this.hero) anchors.push(new Vec2(this.hero.position.x, this.hero.position.y));
        let best = new Vec2((bounds.left + bounds.right) / 2, (bounds.bottom + bounds.top) / 2);
        let bestDistance = -1;
        for (let attempt = 0; attempt < 64; attempt++) {
            const candidate = new Vec2(bounds.left + Math.random() * (bounds.right - bounds.left),
                bounds.bottom + Math.random() * (bounds.top - bounds.bottom));
            const distance = anchors.length ? Math.min(...anchors.map(p => Math.hypot(candidate.x - p.x, candidate.y - p.y))) : Infinity;
            if (distance > bestDistance) { best = candidate; bestDistance = distance; }
            if (distance >= Math.max(0, this.minStationDistance)) return candidate;
        }
        return best;
    }

    onDestroy(): void {
        this.node.off('pets-ready', this.onPetsReady, this);
        this.closeSelection();
        this.clearFlights();
        director.off(Director.EVENT_BEFORE_DRAW, this.resizeOverlay, this);
        this.overlay?.off('pet-selected', this.onPetSelected, this);
        if (this.ownsViews) {
            if (this.overlay?.isValid) this.overlay.destroy();
            if (this.lamp?.isValid) this.lamp.destroy();
            if (this.guide?.isValid) this.guide.node.destroy();
        }
    }

    private onPetSelected(): void {
        if (this.isSelectionOpen) this.showStage(this.stage + 1);
    }

    /** 选择完成后隐藏面板，释放本系统拥有的暂停。 */
    closeSelection(): void {
        if (this.overlay?.isValid) this.overlay.active = false;
        if (this.pausedJoystick?.isValid) this.pausedJoystick.enabled = true;
        this.pausedJoystick = null;
        if (this.ownsPause) director.resume();
        this.ownsPause = false;
    }

    private isNearLamp(): boolean {
        if (!this.lamp || !this.hero) return false;
        const health = this.hero.getComponent(HeroHealth);
        const bounds = health?.getHurtBounds() ?? { left: this.hero.position.x, right: this.hero.position.x,
            bottom: this.hero.position.y, top: this.hero.position.y };
        const x = this.lamp.position.x + this.payOffsetX;
        const y = this.lamp.position.y + this.collisionOffsetY + this.payOffsetY;
        // 投币区域覆盖身体边缘，英雄无需走进召唤台才能付款。
        const reach = Math.max(0, this.collisionRadius) + 45;
        const halfWidth = Math.max(this.payWidth / 2, reach + Math.abs(this.payOffsetX));
        const halfHeight = Math.max(this.payHeight / 2, Math.max(0, this.collisionRadiusY) + 45 + Math.abs(this.payOffsetY));
        return bounds.right >= x - halfWidth && bounds.left <= x + halfWidth
            && bounds.top >= y - halfHeight && bounds.bottom <= y + halfHeight;
    }

    private createPaymentCoin(coins: CoinSystem): void {
        if (!this.hero || !coins.coinFrame) return;
        const node = coins.createCoinNode('LampPaymentCoin', 29);
        const start = new Vec2(this.hero.position.x, this.hero.position.y + 64.691);
        node.setPosition(start.x, start.y, 0);
        this.flights.push({ node, start, elapsed: 0 });
    }

    private updateFlights(deltaTime: number): void {
        if (!this.lamp) return;
        const target = new Vec2(this.lamp.position.x, this.lamp.position.y + this.paymentTargetY);
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const coin = this.flights[i];
            if (!coin.node.isValid) { this.flights.splice(i, 1); continue; }
            coin.elapsed += deltaTime;
            const distance = Vec2.distance(coin.start, target);
            const t = Math.min(1, coin.elapsed / Math.max(0.08, distance / Math.max(1, this.coinFlySpeed)));
            if (t >= 1) {
                coin.node.active = false;
                coin.node.destroy();
                this.flights.splice(i, 1);
            } else {
                if (distance > 100) {
                    // 对照原 PlayerShopping.coinAnimation 的双控制点贝塞尔轨迹。
                    const rotation = coin.start.x > this.lamp.position.x ? Math.PI / 4 : -Math.PI / 4;
                    const dx = (coin.start.x - target.x) / 2;
                    const dy = (coin.start.y - target.y) / 2;
                    const controlX = coin.start.x + dx * Math.cos(rotation) - dy * Math.sin(rotation);
                    const controlY = coin.start.y + 100 + dx * Math.sin(rotation) + dy * Math.cos(rotation);
                    const u = 1 - t;
                    const startWeight = u * u * u + 3 * u * u * t;
                    const controlWeight = 3 * u * t * t;
                    coin.node.setPosition(startWeight * coin.start.x + controlWeight * controlX + t * t * t * target.x,
                        startWeight * coin.start.y + controlWeight * controlY + t * t * t * target.y, 0);
                } else {
                    coin.node.setPosition(coin.start.x + (target.x - coin.start.x) * t,
                        coin.start.y + (target.y - coin.start.y) * t, 0);
                }
            }
        }
    }

    private clearFlights(): void {
        for (const coin of this.flights) if (coin.node.isValid) { coin.node.active = false; coin.node.destroy(); }
        this.flights = [];
    }

    private openSelection(): void {
        if (!this.node.getComponent(PetSystem)?.assetsReady) return;
        if (this.isSelectionOpen || !this.node.parent) return;
        SoundEffects.play('shop');
        if (!this.overlay) {
            this.overlay = this.child(this.node.parent, 'LampSelectionOverlay');
            this.overlay.addComponent(Graphics);
            this.overlay.addComponent(BlockInputEvents);
            this.overlay.on('pet-selected', this.onPetSelected, this);
            director.on(Director.EVENT_BEFORE_DRAW, this.resizeOverlay, this);
        }
        this.overlay.active = true;
        this.overlay.setSiblingIndex(this.node.parent.children.length - 1);
        this.resizeOverlay();
        this.clearFlights();
        if (this.guide) { this.guide.target = null; this.guide.lateUpdate(); }
        const joystick = this.node.parent.getChildByName('Joystick')?.getComponent('JoystickController');
        if (joystick?.enabled) { this.pausedJoystick = joystick; joystick.enabled = false; }
        // pause 停止逻辑、动画和计时；渲染与输入系统继续工作，遮罩仍可显示。
        this.ownsPause = !director.isPaused();
        director.pause();
    }

    private onPetsReady(): void {
        if (this.costs[this.stage] !== undefined && this.paid >= this.costs[this.stage]
            && this.lamp?.activeInHierarchy && this.hero?.activeInHierarchy
            && this.hero.getComponent(HeroHealth)?.isAlive) this.openSelection();
    }

    private configureAnimation(): void {
        if (!this.skeleton?.skeletonData) return;
        for (const from of ['idle', 'idle2', 'summon']) {
            for (const to of ['idle', 'idle2', 'summon']) {
                if (from !== to && this.skeleton.findAnimation(from) && this.skeleton.findAnimation(to)) {
                    this.skeleton.setMix(from, to, .06);
                }
            }
        }
        this.skeleton.setAnimation(0, 'idle', true);
    }

    private resizeOverlay(): void {
        if (!this.overlay?.active || !this.node.parent) return;
        const canvas = this.node.parent.getComponent(UITransform);
        if (!canvas) return;
        this.overlay.setPosition(canvas.width * (0.5 - canvas.anchorX), canvas.height * (0.5 - canvas.anchorY), 0);
        if (canvas.width === this.overlayWidth && canvas.height === this.overlayHeight) return;
        this.overlayWidth = canvas.width;
        this.overlayHeight = canvas.height;
        this.overlay.getComponent(UITransform)!.setContentSize(canvas.contentSize);
        const shape = this.overlay.getComponent(FlatShape);
        if (shape) { shape.redraw(); return; }
        const graphic = this.overlay.getComponent(Graphics)!;
        graphic.clear();
        graphic.fillColor = new Color(0, 0, 0, 175);
        graphic.rect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        graphic.fill();
    }

    private refreshProgress(): void {
        if (!this.text) return;
        const cost = this.costs[this.stage] ?? 0;
        this.text.string = `${this.paid}/${cost}`;
        if (this.progressFill) {
            const ratio = cost > 0 ? Math.max(0, Math.min(1, this.paid / cost)) : 0;
            const sprite = this.progressFill.getComponent(Sprite);
            if (sprite?.type === Sprite.Type.FILLED) sprite.fillRange = ratio;
            else {
                const transform = this.progressFill.getComponent(UITransform)!;
                transform.setContentSize(169 * ratio, transform.height);
                this.progressFill.getComponent(FlatShape)?.redraw();
            }
            return;
        }
        if (!this.progress) return;
        this.progress.clear();
        this.progress.fillColor = new Color(26, 65, 85, 230);
        this.progress.roundRect(-86.5, -13.5, 173, 27, 8);
        this.progress.fill();
        const width = cost > 0 ? 169 * this.paid / cost : 0;
        if (width > 0) {
            this.progress.fillColor = new Color(0, 175, 244, 255);
            this.progress.rect(-84.5, -11.5, width, 23);
            this.progress.fill();
        }
    }

    private child(parent: Node, name: string): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.addComponent(UITransform);
        return node;
    }

    private clamp(value: number, min: number, max: number): number {
        return min <= max ? Math.min(max, Math.max(min, value)) : (min + max) / 2;
    }
}
