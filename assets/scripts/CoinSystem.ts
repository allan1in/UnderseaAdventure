import { _decorator, Color, Component, Graphics, instantiate, Label, Node, Prefab, resources, Sprite, SpriteFrame, UITransform, Widget, warn } from 'cc';
import { HeroHealth } from './HeroHealth';
import { SoundEffects } from './SoundEffects';

const { ccclass, property } = _decorator;
type Coin = { node: Node; picture: Node; age: number; attracted: boolean };

@ccclass('CoinSystem')
export class CoinSystem extends Component {
    static readonly COLLECTED = 'coin-collected';
    static readonly BALANCE_CHANGED = 'coin-balance-changed';
    static readonly MAX_BALANCE = 999;

    @property({ type: Node, tooltip: '此组件挂在 World；留空时自动关联 World 下的 Hero' })
    hero: Node | null = null;

    @property({ type: SpriteFrame, tooltip: '留空时自动加载 resources/gameplay/coin/spriteFrame' })
    coinFrame: SpriteFrame | null = null;

    @property({ type: Prefab, tooltip: '死亡掉落与神灯投币共用的金币模板' })
    coinPrefab: Prefab | null = null;

    @property(Node)
    hudNode: Node | null = null;

    @property({ tooltip: '英雄进入此距离后开始吸附金币，单位是 World 坐标' })
    attractRadius = 300;

    @property({ tooltip: '金币到达英雄脚边此距离内才计入总数' })
    collectRadius = 20;

    @property({ tooltip: '吸附金币每秒移动的距离' })
    attractSpeed = 550;

    @property({ tooltip: '金币掉落后先弹跳展示，再允许收集，单位秒' })
    dropDuration = 0.25;

    @property({ tooltip: '地图中金币图片的显示宽度' })
    coinSize = 32;

    @property({ tooltip: '收集目的地相对 Hero 身体中心的脚边偏移' })
    pickupOffsetY = -40;

    private coins: Coin[] = [];
    private collected = 0;
    private available = 0;
    private hud: Node | null = null;
    private counter: Label | null = null;
    private missingFrameWarned = false;
    private ownsHud = false;

    get totalCoins(): number { return this.collected; }
    get balance(): number { return this.available; }
    get activeCoinCount(): number { return this.coins.filter(c => c.node.isValid).length; }

    onLoad(): void {
        this.hero ??= this.node.getChildByName('Hero');
        // 新场景以 Prefab 的外观为准；旧场景继续使用 Coin Frame。
        this.coinFrame = this.coinPrefab?.data.getChildByName('Sprite')?.getComponent(Sprite)?.spriteFrame ?? this.coinFrame;
        if (this.coinFrame) this.createHud();
        else resources.load('gameplay/coin/spriteFrame', SpriteFrame, (error, frame) => {
            if (!this.isValid) return;
            if (error) { warn(`CoinSystem: 金币素材加载失败：${error.message}`); return; }
            this.coinFrame = frame;
            this.createHud();
            if (this.hud) this.hud.active = this.enabledInHierarchy;
        });
    }

    /** 总收集量单独保留；神灯只能花费当前余额。 */
    spendCoins(amount: number): boolean {
        if (!Number.isInteger(amount) || amount <= 0 || amount > this.available) return false;
        this.available -= amount;
        this.refreshBalance();
        return true;
    }
    onEnable(): void { if (this.hud) this.hud.active = true; }
    onDisable(): void { if (this.hud?.isValid) this.hud.active = false; }

    dropCoin(x: number, y: number): boolean {
        if (!this.coinFrame) {
            if (!this.missingFrameWarned) {
                warn('CoinSystem: 金币素材尚未就绪，请检查 resources/gameplay/coin 的导入状态。');
                this.missingFrameWarned = true;
            }
            return false;
        }
        const node = this.createCoinNode('Coin', Math.max(1, this.coinSize));
        node.setPosition(x, y, 0);
        const picture = node.getChildByName('Sprite')!;
        this.coins.push({ node, picture, age: 0, attracted: false });
        return true;
    }

    update(deltaTime: number): void {
        const hero = this.hero;
        if (!hero?.isValid || !hero.activeInHierarchy || hero.parent !== this.node) return;
        const health = hero.getComponent(HeroHealth);
        if (health && !health.isAlive) return;
        const elapsed = Math.max(0, deltaTime);
        const targetX = hero.position.x;
        const targetY = hero.position.y + this.pickupOffsetY * Math.abs(hero.scale.y);
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            if (!coin.node.isValid) { this.coins.splice(i, 1); continue; }
            coin.age += elapsed;
            const dropTime = Math.max(0, this.dropDuration);
            if (coin.age < dropTime) {
                coin.picture.setPosition(0, Math.sin(Math.PI * coin.age / dropTime) * 16, 0);
                continue;
            }
            coin.picture.setPosition(0, coin.attracted ? 0 : Math.sin(coin.age * 4) * 2, 0);
            const dx = targetX - coin.node.position.x;
            const dy = targetY - coin.node.position.y;
            const distance = Math.hypot(dx, dy);
            const collectRadius = Math.max(0, this.collectRadius);
            if (!coin.attracted && distance <= Math.max(collectRadius, this.attractRadius)) coin.attracted = true;
            if (!coin.attracted) continue;
            const step = Math.max(0, this.attractSpeed) * elapsed;
            if (distance <= collectRadius || distance <= step) {
                // 先从数组移除，再更新总数，保证同一枚金币只能收集一次。
                this.coins.splice(i, 1);
                coin.node.active = false;
                coin.node.destroy();
                this.collected++;
                this.available = Math.min(CoinSystem.MAX_BALANCE, this.available + 1);
                SoundEffects.play('coin-map');
                this.refreshBalance();
                this.node.emit(CoinSystem.COLLECTED, this.collected);
            } else if (distance > 0) {
                coin.node.setPosition(coin.node.position.x + dx / distance * step,
                    coin.node.position.y + dy / distance * step, 0);
            }
        }
    }

    onDestroy(): void {
        for (const coin of this.coins) if (coin.node.isValid) coin.node.destroy();
        this.coins = [];
        if (this.ownsHud && this.hud?.isValid) this.hud.destroy();
    }

    private addCoinSprite(node: Node, width: number): Sprite {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = true;
        sprite.spriteFrame ??= this.coinFrame;
        const size = sprite.spriteFrame?.rect;
        transform.setContentSize(width, size?.width ? width * size.height / size.width : width);
        return sprite;
    }

    /** 两种金币运动共用一个可编辑模板，逻辑仍分别由对应系统管理。 */
    createCoinNode(name: string, width: number): Node {
        const node = this.coinPrefab ? instantiate(this.coinPrefab) : new Node(name);
        node.name = name;
        node.layer = this.node.layer;
        this.node.addChild(node);
        node.getComponent(UITransform) ?? node.addComponent(UITransform);
        let picture = node.getChildByName('Sprite');
        if (!picture) {
            picture = new Node('Sprite');
            picture.layer = node.layer;
            node.addChild(picture);
        }
        this.addCoinSprite(picture, width);
        return node;
    }

    private createHud(): void {
        if (this.hud?.isValid) return;
        const authored = this.hudNode ?? this.node.parent?.getChildByName('CoinHUD');
        if (authored) {
            this.hud = authored;
            const icon = authored.getChildByName('CoinIcon')?.getComponent(Sprite);
            // HUD 使用独立拆分图标，不被地图掉落金币的外观覆盖。
            if (icon) icon.spriteFrame ??= this.coinFrame;
            this.counter = authored.getChildByName('Total')?.getComponent(Label) ?? null;
            this.refreshBalance();
            return;
        }
        this.ownsHud = true;
        const canvas = this.node.parent;
        if (!canvas?.getComponent(UITransform)) return;
        const hud = new Node('CoinHUD');
        hud.layer = canvas.layer;
        canvas.addChild(hud);
        hud.addComponent(UITransform).setContentSize(150, 44);
        const background = hud.addComponent(Graphics);
        background.fillColor = new Color(24, 50, 40, 190);
        background.roundRect(-75, -22, 150, 44, 14);
        background.fill();
        const widget = hud.addComponent(Widget);
        widget.target = canvas;
        widget.isAlignTop = true;
        widget.isAlignRight = true;
        widget.top = 20;
        widget.right = 24;
        widget.alignMode = Widget.AlignMode.ALWAYS;
        const icon = new Node('CoinIcon');
        icon.layer = hud.layer;
        hud.addChild(icon);
        icon.setPosition(-68, 0, 0);
        this.addCoinSprite(icon, 44);
        const number = new Node('Total');
        number.layer = hud.layer;
        hud.addChild(number);
        number.setPosition(0, 0, 0);
        number.addComponent(UITransform).setContentSize(88, 34);
        const label = number.addComponent(Label);
        label.string = String(this.available);
        label.fontSize = 28;
        label.lineHeight = 34;
        label.color = new Color(255, 246, 211, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        this.hud = hud;
        this.counter = label;
        widget.updateAlignment();
    }

    private refreshBalance(): void {
        if (this.counter) this.counter.string = String(this.available);
        this.node.emit(CoinSystem.BALANCE_CHANGED, this.available);
    }
}
