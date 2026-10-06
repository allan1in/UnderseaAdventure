import { _decorator, BlockInputEvents, Component, director, instantiate, Node, Prefab, sp, Sprite, UITransform } from 'cc';
import { BossController } from './BossController';
import { HeroHealth } from './HeroHealth';
import { FlatShape } from './FlatShape';
import { SoundEffects } from './SoundEffects';
import { hasBattleStarted } from './BattleSession';
import { MusicDirector } from './MusicDirector';
const { ccclass, property, executionOrder } = _decorator;

@ccclass('BossBattleSystem')
@executionOrder(60)
export class BossBattleSystem extends Component {
    @property(Node) hero: Node | null = null;
    @property(Node) ground: Node | null = null;
    @property(Prefab) bossPrefab: Prefab | null = null;
    @property({ tooltip: '首次拖动摇杆后累计游戏秒数；原示例 60，不包含开场等待和选卡暂停' }) spawnAfter = 60;
    @property(sp.Skeleton) warning: sp.Skeleton | null = null;
    @property({ type: Node, tooltip: '海底 Boss 静态预警横幅' }) themeWarning: Node | null = null;
    @property(Node) resultOverlay: Node | null = null;
    @property(Node) resultPanel: Node | null = null;
    @property(Node) winView: Node | null = null;
    @property(Node) loseView: Node | null = null;
    private elapsed = 0;
    private boss: Node | null = null;
    private warningTime = 0;
    private warningShown = false;
    private completed = false;
    private ownsPause = false;

    get runningTime(): number { return this.elapsed; }
    get bossNode(): Node | null { return this.boss; }
    get isComplete(): boolean { return this.completed; }

    onLoad(): void {
        this.hero ??= this.node.getChildByName('Hero'); this.ground ??= this.node.getChildByName('Ground');
        const warningNode = this.node.parent?.getChildByName('BossWarning');
        if (!this.themeWarning && warningNode?.getComponent(Sprite)) this.themeWarning = warningNode;
        this.hero?.on(HeroHealth.DIED, this.onHeroDied, this);
        if (this.resultOverlay) { this.resultOverlay.active = false; this.resultOverlay.getComponent(BlockInputEvents) ?? this.resultOverlay.addComponent(BlockInputEvents); }
        if (this.warning) this.warning.node.active = false;
        if (this.themeWarning) this.themeWarning.active = false;
    }

    lateUpdate(deltaTime: number): void {
        if (director.isPaused() || !hasBattleStarted(this.hero) || this.completed || !this.hero?.getComponent(HeroHealth)?.isAlive) return;
        const dt = Math.max(0, deltaTime); this.elapsed += dt;
        if (this.warningTime > 0) {
            this.warningTime -= dt;
            if (this.warningTime <= 0 && this.warning) this.warning.node.active = false;
            if (this.warningTime <= 0 && this.themeWarning) this.themeWarning.active = false;
        }
        if (!this.boss && this.bossPrefab && this.elapsed >= Math.max(0, this.spawnAfter)) {
            // 预警不依赖是否能立即找到 Boss 出生位置，拥挤时也按时提示。
            if (!this.warningShown) {
                this.warningShown = true;
                this.showWarning();
            }
            this.spawnBoss();
        }
    }

    private spawnBoss(): void {
        if (!this.hero || !this.bossPrefab) return;
        const node = instantiate(this.bossPrefab); node.active = false;
        const boss = node.getComponent(BossController);
        if (!boss) { node.destroy(); return; }
        boss.target = this.hero; boss.ground = this.ground; this.node.addChild(node);
        const viewport = this.node.parent?.getComponent(UITransform);
        const distance = Math.max(250, viewport?.height ?? 720);
        // 原 Boss 从远处被移到英雄一屏高附近；当前地图四角较近，优先使用有空位的方向。
        let found = false;
        for (let ring = 0; ring < 3 && !found; ring++) for (let direction = 0; direction < 16; direction++) {
            const angle = direction * Math.PI / 8, radius = distance + ring * 100;
            const point = boss.clampToMap(this.hero.position.x + Math.cos(angle) * radius,
                this.hero.position.y + Math.sin(angle) * radius);
            if (Math.hypot(point.x - this.hero.position.x, point.y - this.hero.position.y) < 220) continue;
            node.setPosition(point.x, point.y); found = true; break;
        }
        if (!found) { node.destroy(); return; }
        this.boss = node;
        node.on(BossController.DEFEATED, this.onBossDefeated, this); node.active = true;
        MusicDirector.useBossMusic();
    }

    private showWarning(): void {
        SoundEffects.play('boss-show');
        const canvas = this.node.parent;
        const viewport = canvas?.getComponent(UITransform);
        if (this.themeWarning) {
            const width = this.themeWarning.getComponent(UITransform)?.width ?? 520;
            this.themeWarning.active = true;
            this.themeWarning.setSiblingIndex((canvas?.children.length ?? 1) - 1);
            this.themeWarning.setPosition(0, (viewport?.height ?? 720) * .36);
            const fit = Math.min(1, ((viewport?.width ?? 1280) - 30) / width);
            this.themeWarning.setScale(fit, fit, 1);
            this.warningTime = 2;
        } else if (this.warning?.skeletonData) {
            this.warning.node.active = true;
            this.warning.node.setPosition(0, (viewport?.height ?? 720) * .36);
            const scale = Math.min(.5, ((viewport?.width ?? 1280) - 30) / 1520);
            this.warning.node.setScale(scale, scale, 1);
            this.warningTime = this.warning.setAnimation(0, 'idle', false)?.animationEnd ?? 2;
        }
    }

    private onBossDefeated(): void { MusicDirector.restoreBackground(); this.finish(true); }
    private onHeroDied(): void { this.finish(false); }

    private finish(win: boolean): void {
        if (this.completed) return;
        this.completed = true;
        SoundEffects.play(win ? 'win' : 'fail');
        if (this.warning) this.warning.node.active = false;
        if (this.themeWarning) this.themeWarning.active = false;
        const canvas = this.node.parent, ui = canvas?.getComponent(UITransform);
        const joystick = canvas?.getChildByName('Joystick')?.getComponent('JoystickController');
        if (joystick) joystick.enabled = false;
        // 如在选卡时通过外部流程结算，关闭它的暂停后由结算系统接管。
        const selection = canvas?.getChildByName('LampSelectionOverlay'); if (selection) selection.active = false;
        if (this.winView) this.winView.active = win;
        if (this.loseView) this.loseView.active = !win;
        if (this.resultOverlay && ui) {
            this.resultOverlay.active = true; this.resultOverlay.setSiblingIndex(canvas!.children.length - 1);
            this.resultOverlay.getComponent(UITransform)?.setContentSize(ui.contentSize);
            this.resultOverlay.getComponent(FlatShape)?.redraw();
            const fit = Math.max(.1, Math.min(1, (ui.width - 30) / 640, (ui.height - 30) / 570));
            this.resultPanel?.setScale(fit, fit, 1);
        }
        canvas?.emit('battle-complete', win);
        this.ownsPause = !director.isPaused(); director.pause();
    }

    onDestroy(): void {
        if (this.hero?.isValid) this.hero.off(HeroHealth.DIED, this.onHeroDied, this);
        if (this.boss?.isValid) { this.boss.off(BossController.DEFEATED, this.onBossDefeated, this); this.boss.destroy(); }
        if (this.ownsPause) director.resume();
    }
}
